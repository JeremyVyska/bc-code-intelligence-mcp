/**
 * Enhanced Layer Service
 *
 * Central service for managing and resolving knowledge from multiple layers.
 * Supports configuration-driven layer loading with git repositories,
 * handles layer initialization, topic resolution with override logic, and
 * provides unified access to layered knowledge system.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  AtomicTopic,
  TopicSearchParams,
  TopicSearchResult
} from '../types/bc-knowledge.js';

import {
  IKnowledgeLayer,
  LayerPriority,
  LayerLoadResult,
  LayerResolutionResult,
  LayerSystemConfig,
  OverrideStrategy
} from '../types/layer-types.js';

import {
  BCKBConfiguration,
  LayerConfiguration,
  LayerSourceType,
  AuthConfiguration,
  ConfigLayerLoadResult
} from '../types/index.js';

import { EmbeddedKnowledgeLayer } from './embedded-layer.js';
import { ProjectKnowledgeLayer } from './project-layer.js';
import { GitKnowledgeLayer } from './git-layer.js';
import { AdvancedCacheManager } from '../cache/cache-manager.js';
import Fuse from 'fuse.js';

export class LayerService {
  private layers: IKnowledgeLayer[] = [];
  private initialized = false;
  private loadResults: Map<string, LayerLoadResult> = new Map();
  private topicCache = new Map<string, LayerResolutionResult>();
  private searchIndex: Fuse<AtomicTopic> | null = null;
  private cacheManager: AdvancedCacheManager | null = null;

  constructor(
    private readonly embeddedPath: string = (() => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      return join(__dirname, '../../embedded-knowledge');
    })(),
    private readonly projectPath: string = './bckb-overrides',
    private readonly config: Partial<LayerSystemConfig> = {}
  ) {
    // Initialize basic layers for simple constructor usage
    console.error(`🔧 Creating embedded layer from path: ${this.embeddedPath}`);
    this.layers.push(new EmbeddedKnowledgeLayer(this.embeddedPath));

    // Add project layer if path exists (will be checked during initialization)
    if (this.projectPath) {
      console.error(`🔧 Creating project layer from path: ${this.projectPath}`);
      this.layers.push(new ProjectKnowledgeLayer(this.projectPath));
    }
  }

  /**
   * Initialize layers from BCKB configuration
   */
  async initializeFromConfiguration(config: BCKBConfiguration): Promise<ConfigLayerLoadResult[]> {
    console.log(`🔧 Initializing ${config.layers.length} layers from configuration...`);

    // Initialize advanced cache manager
    this.cacheManager = new AdvancedCacheManager(config.cache);
    console.log(`💾 Advanced cache manager initialized with ${config.cache.max_size_mb}MB limit`);

    const results: ConfigLayerLoadResult[] = [];
    this.layers = [];

    // Create layers based on configuration in priority order
    const sortedLayers = [...config.layers]
      .filter(layer => layer.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const layerConfig of sortedLayers) {
      try {
        console.log(`📦 Creating layer: ${layerConfig.name} (priority: ${layerConfig.priority})`);

        const layer = await this.createLayerFromConfig(layerConfig);
        this.layers.push(layer);

        // Initialize the layer
        const result = await layer.initialize();
        results.push({
          layer_name: layerConfig.name,
          success: result.success,
          topics_loaded: result.topicsLoaded,
          load_time_ms: result.loadTimeMs,
          errors: result.error ? [result.error] : [],
          warnings: [],
          source_info: {
            type: layerConfig.source.type,
            location: this.getLayerLocation(layerConfig),
            last_updated: new Date()
          }
        });

        this.loadResults.set(layerConfig.name, result);

      } catch (error) {
        const errorMessage = `Failed to create layer ${layerConfig.name}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`❌ ${errorMessage}`);

        results.push({
          layer_name: layerConfig.name,
          success: false,
          topics_loaded: 0,
          load_time_ms: 0,
          errors: [errorMessage],
          warnings: [],
          source_info: {
            type: layerConfig.source.type,
            location: this.getLayerLocation(layerConfig)
          }
        });
      }
    }

    // Build resolution index
    await this.buildResolutionIndex();

    // Warm up cache with frequently accessed topics
    if (this.cacheManager) {
      await this.warmUpCache(config);
    }

    this.initialized = true;

    console.log(`✅ Initialized ${results.length} layers successfully`);
    return results;
  }

  /**
   * Initialize the default layer stack (legacy method)
   */
  private initializeLayers(): void {
    // Add layers in priority order (lowest to highest priority)
    this.layers = [
      new EmbeddedKnowledgeLayer(this.embeddedPath),  // Priority 0 (base layer)
      new ProjectKnowledgeLayer(this.projectPath)     // Priority 300 (highest)
    ];

    // Sort layers by priority (lowest first)
    this.layers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Initialize all layers
   */
  async initialize(): Promise<LayerLoadResult[]> {
    if (this.initialized) {
      return Array.from(this.loadResults.values());
    }

    console.error('🔄 Initializing Layer Service...');
    const startTime = Date.now();

    const results: LayerLoadResult[] = [];

    // Initialize layers in parallel for better performance
    if (this.config.enableParallelLoading !== false) {
      const promises = this.layers.map(layer => this.initializeLayer(layer));
      results.push(...await Promise.allSettled(promises).then(settled =>
        settled.map(result =>
          result.status === 'fulfilled'
            ? result.value
            : {
                layerName: 'unknown',
                success: false,
                topicsLoaded: 0,
                indexesLoaded: 0,
                error: result.reason?.message || 'Unknown error',
                loadTimeMs: 0
              }
        )
      ));
    } else {
      // Sequential initialization
      for (const layer of this.layers) {
        try {
          const result = await this.initializeLayer(layer);
          results.push(result);
        } catch (error) {
          results.push({
            layerName: layer.name,
            success: false,
            topicsLoaded: 0,
            indexesLoaded: 0,
            error: error instanceof Error ? error.message : String(error),
            loadTimeMs: 0
          });
        }
      }
    }

    // Build unified search index from all layers
    this.buildUnifiedSearchIndex();

    const totalTime = Date.now() - startTime;
    const successfulLayers = results.filter(r => r.success);
    const totalTopics = successfulLayers.reduce((sum, r) => sum + r.topicsLoaded, 0);

    this.initialized = true;

    console.error(`✅ Layer Service initialized: ${successfulLayers.length}/${results.length} layers, ${totalTopics} topics (${totalTime}ms)`);

    return results;
  }

  /**
   * Initialize a single layer
   */
  private async initializeLayer(layer: IKnowledgeLayer): Promise<LayerLoadResult> {
    if (!layer.enabled) {
      const result: LayerLoadResult = {
        layerName: layer.name,
        success: false,
        topicsLoaded: 0,
        indexesLoaded: 0,
        error: 'Layer disabled',
        loadTimeMs: 0
      };
      this.loadResults.set(layer.name, result);
      return result;
    }

    try {
      const result = await layer.initialize();
      this.loadResults.set(layer.name, result);
      return result;
    } catch (error) {
      const result: LayerLoadResult = {
        layerName: layer.name,
        success: false,
        topicsLoaded: 0,
        indexesLoaded: 0,
        error: error instanceof Error ? error.message : String(error),
        loadTimeMs: 0
      };
      this.loadResults.set(layer.name, result);
      throw error;
    }
  }

  /**
   * Create a layer from configuration
   */
  private async createLayerFromConfig(config: LayerConfiguration): Promise<IKnowledgeLayer> {
    switch (config.source.type) {
      case LayerSourceType.EMBEDDED:
        return new EmbeddedKnowledgeLayer(
          config.source.path || this.embeddedPath
        );

      case LayerSourceType.GIT:
        if (!('url' in config.source) || !config.source.url) {
          throw new Error(`Git layer ${config.name} requires URL`);
        }
        return new GitKnowledgeLayer(
          config.name,
          config.priority,
          config.source as any, // Cast to avoid type issues
          config.auth
        );

      case LayerSourceType.LOCAL:
        if (!('path' in config.source) || !config.source.path) {
          throw new Error(`Local layer ${config.name} requires path`);
        }
        return new ProjectKnowledgeLayer(config.source.path);

      case LayerSourceType.HTTP:
        throw new Error(`HTTP layers not yet implemented for ${config.name}`);

      case LayerSourceType.NPM:
        throw new Error(`NPM layers not yet implemented for ${config.name}`);

      default:
        throw new Error(`Unsupported layer type for ${config.name}: ${config.source.type}`);
    }
  }

  /**
   * Get location string for a layer configuration
   */
  private getLayerLocation(config: LayerConfiguration): string {
    switch (config.source.type) {
      case LayerSourceType.GIT:
        return 'url' in config.source ? config.source.url || '' : '';
      case LayerSourceType.LOCAL:
        return 'path' in config.source ? config.source.path || '' : '';
      case LayerSourceType.EMBEDDED:
        return 'path' in config.source ? config.source.path || this.embeddedPath : this.embeddedPath;
      case LayerSourceType.HTTP:
        return 'url' in config.source ? config.source.url || '' : '';
      case LayerSourceType.NPM:
        return 'package' in config.source ? config.source.package || '' : '';
      default:
        return 'unknown';
    }
  }

  /**
   * Build resolution index after configuration-based initialization
   */
  private async buildResolutionIndex(): Promise<void> {
    // Clear cache
    this.topicCache.clear();

    // Build unified search index
    this.buildUnifiedSearchIndex();

    console.log(`📚 Built resolution index for ${this.layers.length} layers`);
  }

  /**
   * Build unified search index across all layers
   */
  private buildUnifiedSearchIndex(): void {
    const allTopics: AtomicTopic[] = [];

    // Collect all topics from all layers (higher priority layers override)
    const topicMap = new Map<string, AtomicTopic>();

    for (const layer of this.layers) {
      for (const topicId of layer.getTopicIds()) {
        // Always use the highest priority version (last one wins due to layer sorting)
        const topic = topicMap.get(topicId);
        if (!topic || layer.priority > this.getTopicLayer(topicId)?.priority!) {
          const layerTopic = this.getTopicFromLayer(layer, topicId);
          if (layerTopic) {
            topicMap.set(topicId, layerTopic);
          }
        }
      }
    }

    allTopics.push(...topicMap.values());

    // Create Fuse search index
    this.searchIndex = new Fuse(allTopics, {
      keys: [
        { name: 'frontmatter.title', weight: 0.3 },
        { name: 'frontmatter.tags', weight: 0.25 },
        { name: 'frontmatter.domain', weight: 0.2 },
        { name: 'content', weight: 0.15 },
        { name: 'frontmatter.prerequisites', weight: 0.05 },
        { name: 'frontmatter.related_topics', weight: 0.05 }
      ],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true
    });

    console.error(`🔍 Search index built with ${allTopics.length} unique topics`);
  }

  /**
   * Resolve a topic with layer override logic
   */
  async resolveTopic(topicId: string): Promise<LayerResolutionResult | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check advanced cache first if available
    if (this.cacheManager) {
      const cachedTopic = this.cacheManager.getTopic(topicId);
      if (cachedTopic) {
        // Return a resolution result from cached topic
        return {
          topic: cachedTopic,
          sourceLayer: 'cache', // We'd need to store source layer info in cache
          isOverride: false,
          overriddenLayers: []
        };
      }
    }

    // Check legacy cache
    const cached = this.topicCache.get(topicId);
    if (cached) {
      return cached;
    }

    // Find the highest priority layer that has this topic
    let resolvedTopic: AtomicTopic | null = null;
    let sourceLayer: string = '';
    let overriddenLayers: string[] = [];

    // Go through layers in reverse order (highest priority first)
    const reversedLayers = [...this.layers].reverse();

    for (const layer of reversedLayers) {
      if (layer.hasTopic(topicId)) {
        if (!resolvedTopic) {
          // This is the highest priority layer with this topic
          const topic = await layer.getTopic(topicId);
          if (topic) {
            resolvedTopic = topic;
            sourceLayer = layer.name;
          }
        } else {
          // This layer has the topic but was overridden
          overriddenLayers.push(layer.name);
        }
      }
    }

    if (!resolvedTopic) {
      return null;
    }

    const result: LayerResolutionResult = {
      topic: resolvedTopic,
      sourceLayer,
      isOverride: overriddenLayers.length > 0,
      overriddenLayers
    };

    // Cache the result in both caches
    this.topicCache.set(topicId, result);

    if (this.cacheManager && resolvedTopic) {
      // Determine source type for intelligent TTL
      const sourceLayer = this.layers.find(l => l.name === result.sourceLayer);
      const sourceType = this.getSourceTypeForLayer(sourceLayer);
      this.cacheManager.cacheTopic(topicId, resolvedTopic, sourceType);
    }

    return result;
  }

  /**
   * Get all available topic IDs from all layers
   */
  getAllTopicIds(): string[] {
    const topicIds = new Set<string>();

    for (const layer of this.layers) {
      for (const topicId of layer.getTopicIds()) {
        topicIds.add(topicId);
      }
    }

    return Array.from(topicIds);
  }

  /**
   * Search topics across all layers
   */
  async searchTopics(params: TopicSearchParams): Promise<TopicSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: TopicSearchResult[] = [];
    const limit = params.limit || 50;

    // Use unified search index for fuzzy search
    if (this.searchIndex) {
      const query = [
        params.domain,
        ...(params.tags || []),
        params.code_context
      ].filter(Boolean).join(' ');

      if (query) {
        const searchResults = this.searchIndex.search(query, { limit });
        for (const result of searchResults) {
          const searchResult = this.topicToSearchResult(result.item, result.score || 0);
          results.push(searchResult);
        }
      }
    }

    // Filter by additional criteria
    let filteredResults = results;

    if (params.difficulty) {
      filteredResults = filteredResults.filter(r => r.difficulty === params.difficulty);
    }

    if (params.bc_version) {
      filteredResults = this.filterByBCVersion(filteredResults, params.bc_version);
    }

    return filteredResults.slice(0, limit);
  }

  /**
   * Get layer statistics
   */
  getLayerStatistics() {
    const stats = this.layers.map(layer => layer.getStatistics());

    const total = {
      layers: stats.length,
      totalTopics: stats.reduce((sum, s) => sum + s.topicCount, 0),
      totalIndexes: stats.reduce((sum, s) => sum + s.indexCount, 0),
      memoryUsage: stats.reduce((sum, s) => sum + (s.memoryUsage?.total || 0), 0)
    };

    return { layers: stats, total };
  }

  /**
   * Get topics that are overridden in higher layers
   */
  getOverriddenTopics(): { [topicId: string]: LayerResolutionResult } {
    const overridden: { [topicId: string]: LayerResolutionResult } = {};

    for (const topicId of this.getAllTopicIds()) {
      const cached = this.topicCache.get(topicId);
      if (cached?.isOverride) {
        overridden[topicId] = cached;
      }
    }

    return overridden;
  }

  /**
   * Refresh layer cache (useful for development)
   */
  async refreshCache(): Promise<void> {
    this.topicCache.clear();

    if (this.cacheManager) {
      this.cacheManager.clearAll();
    }

    this.initialized = false;
    await this.initialize();
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    if (!this.cacheManager) {
      return { advanced_cache_enabled: false };
    }

    return {
      advanced_cache_enabled: true,
      ...this.cacheManager.getStats()
    };
  }

  /**
   * Get a specific layer by name
   */
  getLayer(layerName: string): IKnowledgeLayer | null {
    return this.layers.find(layer => layer.name === layerName) || null;
  }

  /**
   * Get all layers
   */
  getLayers(): IKnowledgeLayer[] {
    return [...this.layers];
  }

  // Private helper methods

  private getTopicLayer(topicId: string): IKnowledgeLayer | null {
    // Find highest priority layer that has this topic
    const reversedLayers = [...this.layers].reverse();
    return reversedLayers.find(layer => layer.hasTopic(topicId)) || null;
  }

  private getTopicFromLayer(layer: IKnowledgeLayer, topicId: string): AtomicTopic | null {
    if (!layer.hasTopic(topicId)) return null;

    // Use the synchronous method to get already loaded topics
    return layer.getTopicSync(topicId);
  }

  private topicToSearchResult(topic: AtomicTopic, relevanceScore: number): TopicSearchResult {
    const firstParagraph = topic.content.split('\n\n')[0]?.replace(/[#*`]/g, '').trim() || '';
    const summary = firstParagraph.length > 200
      ? firstParagraph.substring(0, 200) + '...'
      : firstParagraph;

    return {
      id: topic.id,
      title: topic.frontmatter.title,
      domain: topic.frontmatter.domain,
      difficulty: topic.frontmatter.difficulty,
      relevance_score: 1 - relevanceScore,
      summary,
      tags: topic.frontmatter.tags,
      prerequisites: topic.frontmatter.prerequisites || [],
      estimated_time: topic.frontmatter.estimated_time || undefined
    };
  }

  private filterByBCVersion(results: TopicSearchResult[], bcVersion: string): TopicSearchResult[] {
    const requestedVersion = parseInt(bcVersion.replace(/\D/g, ''));

    return results.filter(result => {
      // This would need access to the actual topic to check bc_versions
      // For now, accept all results
      return true; // TODO: Implement proper BC version filtering
    });
  }

  /**
   * Get source type for cache TTL determination
   */
  private getSourceTypeForLayer(layer: IKnowledgeLayer | undefined): 'git' | 'local' | 'embedded' | 'http' | 'npm' {
    if (!layer) return 'embedded';

    const layerType = layer.constructor.name;
    switch (layerType) {
      case 'GitKnowledgeLayer': return 'git';
      case 'ProjectKnowledgeLayer': return 'local';
      case 'EmbeddedKnowledgeLayer': return 'embedded';
      default: return 'embedded';
    }
  }

  /**
   * Get all topics from all layers with resolution applied
   */
  async getAllResolvedTopics(): Promise<AtomicTopic[]> {
    const allTopics: AtomicTopic[] = [];
    const processedIds = new Set<string>();

    // Get all topic IDs from all layers
    for (const layer of this.layers) {
      const topicIds = layer.getTopicIds();

      for (const topicId of topicIds) {
        if (!processedIds.has(topicId)) {
          processedIds.add(topicId);

          const resolution = await this.resolveTopic(topicId);
          if (resolution && resolution.topic) {
            allTopics.push(resolution.topic);
          }
        }
      }
    }

    return allTopics;
  }

  /**
   * Warm up cache with frequently accessed topics
   */
  private async warmUpCache(config: BCKBConfiguration): Promise<void> {
    if (!this.cacheManager) return;

    console.log('🔥 Warming up advanced cache...');

    const warmUpTopics: Array<{ key: string; topic: AtomicTopic; sourceType: any }> = [];

    // Sample some topics from each layer for warm-up
    for (const layer of this.layers) {
      const topicIds = layer.getTopicIds().slice(0, 10); // First 10 topics per layer
      const sourceType = this.getSourceTypeForLayer(layer);

      for (const topicId of topicIds) {
        try {
          const topic = await layer.getTopic(topicId);
          if (topic) {
            warmUpTopics.push({
              key: topicId,
              topic,
              sourceType
            });
          }
        } catch (error) {
          // Skip topics that fail to load during warm-up
          continue;
        }
      }
    }

    if (warmUpTopics.length > 0) {
      await this.cacheManager.warmUpCache(warmUpTopics);
    }
  }
}