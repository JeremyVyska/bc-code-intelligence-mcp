/**
 * Base Knowledge Layer
 *
 * Abstract base class providing common functionality for all knowledge layer implementations.
 * Handles topic caching, statistics tracking, and common operations.
 */

import { AtomicTopic } from '../types/bc-knowledge.js';
import {
  IKnowledgeLayer,
  LayerPriority,
  LayerLoadResult,
  LayerStatistics
} from '../types/layer-types.js';

export abstract class BaseKnowledgeLayer implements IKnowledgeLayer {
  protected topics = new Map<string, AtomicTopic>();
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
    // Convert file path to topic ID
    return filePath
      .replace(basePath, '')
      .replace(/^[/\\]+/, '') // Remove leading slashes
      .replace(/\.md$/, '') // Remove .md extension
      .replace(/[\\]/g, '/'); // Normalize path separators to forward slashes
  }
}