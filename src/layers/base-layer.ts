/**
 * Base Knowledge Layer
 *
 * Abstract base class providing common functionality for all knowledge layer implementations.
 * ALL layers support three content types: topics, specialists, and methodologies.
 */

import { AtomicTopic } from '../types/bc-knowledge.js';
import { SpecialistDefinition } from '../services/specialist-loader.js';
import {
  IKnowledgeLayer,
  LayerPriority,
  LayerLoadResult,
  LayerStatistics
} from '../types/layer-types.js';
import { LayerContentType } from '../types/enhanced-layer-types.js';

export abstract class BaseKnowledgeLayer implements IKnowledgeLayer {
  // ALL layers support all three content types
  readonly supported_content_types: LayerContentType[] = ['topics', 'specialists', 'methodologies'];
  
  protected topics = new Map<string, AtomicTopic>();
  protected specialists = new Map<string, SpecialistDefinition>();
  protected methodologies = new Map<string, any>();
  protected indexes = new Map<string, any>();
  protected loadResult: LayerLoadResult | null = null;
  protected initialized = false;

  constructor(
    public readonly name: string,
    public readonly priority: LayerPriority,
    public readonly enabled: boolean = true
  ) {}

  /**
   * Initialize the layer - must be implemented by subclasses
   */
  abstract initialize(): Promise<LayerLoadResult>;

  /**
   * Load topics from the layer source - must be implemented by subclasses
   */
  protected abstract loadTopics(): Promise<number>;

  /**
   * Load specialists from the layer source - must be implemented by subclasses
   */
  protected abstract loadSpecialists(): Promise<number>;

  /**
   * Load methodologies from the layer source - must be implemented by subclasses
   */
  protected abstract loadMethodologies(): Promise<number>;

  /**
   * Load indexes from the layer source - must be implemented by subclasses
   */
  protected abstract loadIndexes(): Promise<number>;

  /**
   * Check if the layer has a specific topic
   */
  hasTopic(topicId: string): boolean {
    return this.topics.has(topicId);
  }

  /**
   * Get a topic from this layer
   */
  async getTopic(topicId: string): Promise<AtomicTopic | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.topics.get(topicId) || null;
  }

  /**
   * Get a topic from this layer synchronously (for already loaded topics)
   */
  getTopicSync(topicId: string): AtomicTopic | null {
    return this.topics.get(topicId) || null;
  }

  /**
   * Get all topic IDs available in this layer
   */
  getTopicIds(): string[] {
    return Array.from(this.topics.keys());
  }

  /**
   * Search for topics within this layer using simple text matching
   */
  searchTopics(query: string, limit = 50): AtomicTopic[] {
    const normalizedQuery = query.toLowerCase();
    const results: AtomicTopic[] = [];

    for (const topic of this.topics.values()) {
      const searchableText = [
        topic.frontmatter.title,
        topic.frontmatter.domain,
        topic.frontmatter.tags?.join(' ') || '',
        topic.content
      ].join(' ').toLowerCase();

      if (searchableText.includes(normalizedQuery)) {
        results.push(topic);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Generic content access methods (for MultiContentLayerService compatibility)
   */
  
  /**
   * Check if layer has specific content by type and ID
   */
  hasContent<T extends LayerContentType>(type: T, id: string): boolean {
    switch (type) {
      case 'topics':
        return this.topics.has(id);
      case 'specialists':
        return this.specialists.has(id);
      case 'methodologies':
        return this.methodologies.has(id);
      default:
        return false;
    }
  }

  /**
   * Get content by type and ID
   */
  async getContent<T extends LayerContentType>(
    type: T,
    id: string
  ): Promise<any | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    switch (type) {
      case 'topics':
        return this.topics.get(id) || null;
      case 'specialists':
        return this.specialists.get(id) || null;
      case 'methodologies':
        return this.methodologies.get(id) || null;
      default:
        return null;
    }
  }

  /**
   * Get all content IDs for a specific type
   */
  getContentIds<T extends LayerContentType>(type: T): string[] {
    switch (type) {
      case 'topics':
        return Array.from(this.topics.keys());
      case 'specialists':
        return Array.from(this.specialists.keys());
      case 'methodologies':
        return Array.from(this.methodologies.keys());
      default:
        return [];
    }
  }

  /**
   * Search content by type
   */
  searchContent<T extends LayerContentType>(
    type: T,
    query: string,
    limit: number = 10
  ): any[] {
    switch (type) {
      case 'topics':
        return this.searchTopics(query, limit);
      case 'specialists':
        return this.searchSpecialists(query, limit);
      case 'methodologies':
        return this.searchMethodologies(query, limit);
      default:
        return [];
    }
  }

  /**
   * Search specialists within this layer
   */
  protected searchSpecialists(query: string, limit: number = 10): SpecialistDefinition[] {
    const normalizedQuery = query.toLowerCase();
    const results: SpecialistDefinition[] = [];

    for (const specialist of this.specialists.values()) {
      const searchableText = [
        specialist.title,
        specialist.role,
        specialist.team,
        specialist.expertise.primary.join(' '),
        specialist.expertise.secondary.join(' '),
        specialist.domains.join(' ')
      ].join(' ').toLowerCase();

      if (searchableText.includes(normalizedQuery)) {
        results.push(specialist);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Search methodologies within this layer
   */
  protected searchMethodologies(query: string, limit: number = 10): any[] {
    // TODO: Implement when methodology structure is defined
    return [];
  }

  /**
   * Get layer statistics
   */
  getStatistics(): LayerStatistics {
    const topicsMemory = this.estimateTopicsMemoryUsage();
    const indexesMemory = this.estimateIndexesMemoryUsage();

    return {
      name: this.name,
      priority: this.priority,
      enabled: this.enabled,
      topicCount: this.topics.size,
      indexCount: this.indexes.size,
      lastLoaded: this.loadResult?.success ? new Date() : undefined,
      loadTimeMs: this.loadResult?.loadTimeMs,
      memoryUsage: {
        topics: topicsMemory,
        indexes: indexesMemory,
        total: topicsMemory + indexesMemory
      }
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    this.topics.clear();
    this.indexes.clear();
    this.initialized = false;
    this.loadResult = null;
  }

  /**
   * Helper to create successful load result
   */
  protected createLoadResult(topicsLoaded: number, indexesLoaded: number, loadTimeMs: number): LayerLoadResult {
    return {
      layerName: this.name,
      success: true,
      topicsLoaded,
      indexesLoaded,
      loadTimeMs
    };
  }

  /**
   * Helper to create error load result
   */
  protected createErrorResult(error: string, loadTimeMs: number): LayerLoadResult {
    return {
      layerName: this.name,
      success: false,
      topicsLoaded: 0,
      indexesLoaded: 0,
      error,
      loadTimeMs
    };
  }

  /**
   * Estimate memory usage of loaded topics
   */
  private estimateTopicsMemoryUsage(): number {
    let totalBytes = 0;

    for (const topic of this.topics.values()) {
      // Rough estimation of memory usage
      totalBytes += JSON.stringify(topic).length * 2; // UTF-16 character size
    }

    return totalBytes;
  }

  /**
   * Estimate memory usage of loaded indexes
   */
  private estimateIndexesMemoryUsage(): number {
    let totalBytes = 0;

    for (const index of this.indexes.values()) {
      // Rough estimation of memory usage
      totalBytes += JSON.stringify(index).length * 2; // UTF-16 character size
    }

    return totalBytes;
  }

  /**
   * Validate that a topic has required structure
   */
  protected validateTopic(topic: AtomicTopic): boolean {
    return !!(
      topic.id &&
      topic.frontmatter?.title &&
      topic.frontmatter?.domain &&
      topic.content
    );
  }

  /**
   * Normalize topic ID for consistent lookup
   */
  protected normalizeTopicId(filePath: string, basePath: string): string {
    // Normalize both paths to handle different formats
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    const normalizedBasePath = basePath.replace(/\\/g, '/');

    // Remove base path to get relative path
    let relativePath = normalizedFilePath;
    if (normalizedFilePath.startsWith(normalizedBasePath)) {
      relativePath = normalizedFilePath.substring(normalizedBasePath.length);
    }

    // Clean up the relative path to create a clean ID
    return relativePath
      .replace(/^[/\\]+/, '') // Remove leading slashes
      .replace(/\.md$/, '') // Remove .md extension
      .replace(/^domains\//, '') // Remove domains/ prefix if present
      .replace(/[\\]/g, '/'); // Normalize to forward slashes
  }

  /**
   * Get layer statistics with content type breakdown
   */
  getEnhancedStatistics(): {
    name: string;
    priority: number;
    content_counts: Record<string, number>;
    load_time_ms?: number;
    initialized: boolean;
  } {
    return {
      name: this.name,
      priority: this.priority,
      content_counts: {
        topics: this.topics.size,
        specialists: this.specialists.size,
        methodologies: this.methodologies.size
      },
      load_time_ms: this.loadResult?.loadTimeMs,
      initialized: this.initialized
    };
  }
}