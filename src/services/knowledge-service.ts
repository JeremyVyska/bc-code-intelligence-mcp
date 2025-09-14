import {
  AtomicTopic,
  TopicSearchParams,
  TopicSearchResult,
  BCKBConfig
} from '../types/bc-knowledge.js';
import { LayerService } from '../layers/layer-service.js';
import { LayerResolutionResult } from '../types/layer-types.js';

/**
 * Business Central Knowledge Service
 *
 * Manages loading, caching, and searching of atomic BC knowledge topics
 * using the layered architecture system. Provides intelligent topic discovery
 * and relationship traversal with support for project overrides.
 */
export class KnowledgeService {
  private layerService: LayerService;
  private initialized = false;

  constructor(private config: BCKBConfig) {
    // Initialize layer service with embedded knowledge from submodule
    const embeddedPath = config.knowledge_base_path.replace(/\/knowledge-base$/, '/embedded-knowledge');
    this.layerService = new LayerService(embeddedPath, './bckb-overrides');
  }

  /**
   * Initialize the knowledge service by loading all layers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('🔄 Initializing BC Knowledge Service with Layer System...');

    try {
      // Initialize the layer service (loads embedded + project layers)
      const layerResults = await this.layerService.initialize();

      this.initialized = true;

      // Log initialization results
      const successfulLayers = layerResults.filter(r => r.success);
      const totalTopics = successfulLayers.reduce((sum, r) => sum + r.topicsLoaded, 0);

      console.error(`✅ Knowledge Service initialized with ${successfulLayers.length}/${layerResults.length} layers and ${totalTopics} total topics`);

      // Log layer details
      for (const result of layerResults) {
        if (result.success) {
          console.error(`  📚 ${result.layerName}: ${result.topicsLoaded} topics, ${result.indexesLoaded} indexes (${result.loadTimeMs}ms)`);
        } else {
          console.error(`  ❌ ${result.layerName}: Failed - ${result.error}`);
        }
      }

    } catch (error) {
      console.error('❌ Failed to initialize Knowledge Service:', error);
      throw error;
    }
  }

  // Tag indexes are now handled by individual layers
  // This method is kept for backward compatibility but delegates to layers
  private getTagIndexes(): Map<string, any> {
    const tagIndexes = new Map<string, any>();

    // Get tag indexes from embedded layer
    const embeddedLayer = this.layerService.getLayer('embedded');
    if (embeddedLayer && 'getIndex' in embeddedLayer) {
      // Access embedded layer indexes if available
      const indexNames = (embeddedLayer as any).getIndexNames?.() || [];
      for (const indexName of indexNames) {
        if (indexName.startsWith('tag:')) {
          const tagName = indexName.replace('tag:', '');
          const tagIndex = (embeddedLayer as any).getIndex?.(indexName);
          if (tagIndex) {
            tagIndexes.set(tagName, tagIndex);
          }
        }
      }
    }

    return tagIndexes;
  }

  /**
   * Search for topics based on various criteria using the layer system
   */
  async searchTopics(params: TopicSearchParams): Promise<TopicSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Delegate to layer service for unified search across all layers
    return await this.layerService.searchTopics(params);
  }


  /**
   * Get a specific topic by ID with layer resolution
   */
  async getTopic(topicId: string, includeSamples = false): Promise<AtomicTopic | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Resolve topic through layer system
    const resolution = await this.layerService.resolveTopic(topicId);
    if (!resolution) return null;

    // Return copy to prevent mutation
    const result = { ...resolution.topic };
    if (!includeSamples) {
      delete result.samples;
    }

    return result;
  }

  /**
   * Get topic relationships and learning paths from layers
   */
  async getTopicRelationships(topicId: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get relationships from embedded layer
    const embeddedLayer = this.layerService.getLayer('embedded');
    if (!embeddedLayer || !('getIndex' in embeddedLayer)) return null;

    const topicRelationships = (embeddedLayer as any).getIndex?.('topic-relationships');
    if (!topicRelationships) return null;

    const relationships = topicRelationships.topic_relationships?.[topicId];
    if (!relationships) return null;

    return {
      ...relationships,
      learning_pathways: this.findLearningPathways(topicId, topicRelationships),
      related_by_domain: await this.findRelatedByDomain(topicId)
    };
  }

  /**
   * Find learning pathways that include this topic
   */
  private findLearningPathways(topicId: string, topicRelationships: any): string[] {
    if (!topicRelationships?.learning_pathways) return [];

    const pathways: string[] = [];
    for (const [pathwayName, topics] of Object.entries(topicRelationships.learning_pathways)) {
      if (Array.isArray(topics) && topics.includes(topicId)) {
        pathways.push(pathwayName);
      }
    }

    return pathways;
  }

  /**
   * Find topics related by domain using layer system
   */
  private async findRelatedByDomain(topicId: string): Promise<string[]> {
    const resolution = await this.layerService.resolveTopic(topicId);
    if (!resolution) return [];

    const targetDomain = resolution.topic.frontmatter.domain;
    const allTopicIds = this.layerService.getAllTopicIds();
    const relatedTopics: string[] = [];

    // Check first 50 topics to avoid performance issues
    for (const otherTopicId of allTopicIds.slice(0, 50)) {
      if (otherTopicId !== topicId) {
        const otherResolution = await this.layerService.resolveTopic(otherTopicId);
        if (otherResolution?.topic.frontmatter.domain === targetDomain) {
          relatedTopics.push(otherTopicId);
          if (relatedTopics.length >= 10) break; // Limit to 10
        }
      }
    }

    return relatedTopics;
  }

  /**
   * Get knowledge base statistics from layer system
   */
  getStatistics() {
    const layerStats = this.layerService.getLayerStatistics();

    // Get domain catalog from embedded layer
    const embeddedLayer = this.layerService.getLayer('embedded');
    const domainCatalog = embeddedLayer && 'getIndex' in embeddedLayer
      ? (embeddedLayer as any).getIndex?.('domain-catalog')
      : null;

    return {
      total_topics: layerStats.total.totalTopics,
      total_layers: layerStats.total.layers,
      layer_details: layerStats.layers,
      domains: domainCatalog?.domains || {},
      most_common_tags: domainCatalog?.global_statistics?.most_common_tags || [],
      initialized: this.initialized,
      last_loaded: new Date().toISOString(),
      memory_usage: layerStats.total.memoryUsage
    };
  }
}