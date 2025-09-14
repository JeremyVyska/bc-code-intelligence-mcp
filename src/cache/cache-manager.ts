/**
 * Advanced Cache Manager with Multi-Level Caching
 *
 * Implements intelligent caching for topics, search results, and layer data
 * with TTL, LRU eviction, memory pressure handling, and performance analytics.
 */

import { AtomicTopic, TopicSearchResult } from '../types/bc-knowledge.js';
import { CacheSettings, CacheTTLSettings } from '../types/index.js';

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  total_requests: number;
  hit_rate: number;
  memory_usage_bytes: number;
  cache_size: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  access_count: number;
  last_accessed: number;
  size_bytes: number;
}

export class AdvancedCacheManager {
  private topicCache = new Map<string, CacheEntry<AtomicTopic>>();
  private searchCache = new Map<string, CacheEntry<TopicSearchResult[]>>();
  private layerCache = new Map<string, CacheEntry<any>>();

  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    total_requests: 0
  };

  private readonly config: CacheSettings;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheSettings) {
    this.config = config;
    this.startPeriodicCleanup();
  }

  /**
   * Cache a topic with intelligent TTL based on source type
   */
  cacheTopic(key: string, topic: AtomicTopic, sourceType: keyof CacheTTLSettings): void {
    const ttl = this.getTTLForSourceType(sourceType);
    const entry: CacheEntry<AtomicTopic> = {
      data: topic,
      timestamp: Date.now(),
      ttl,
      access_count: 0,
      last_accessed: Date.now(),
      size_bytes: this.estimateSize(topic)
    };

    this.topicCache.set(key, entry);
    this.enforceMemoryLimits();
  }

  /**
   * Retrieve topic from cache with hit tracking
   */
  getTopic(key: string): AtomicTopic | null {
    this.stats.total_requests++;

    const entry = this.topicCache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.topicCache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking
    entry.access_count++;
    entry.last_accessed = Date.now();
    this.stats.hits++;

    return entry.data;
  }

  /**
   * Cache search results with query-based invalidation
   */
  cacheSearchResults(query: string, results: TopicSearchResult[], ttl: number = 5 * 60 * 1000): void {
    const cacheKey = this.generateSearchKey(query);
    const entry: CacheEntry<TopicSearchResult[]> = {
      data: results,
      timestamp: Date.now(),
      ttl,
      access_count: 0,
      last_accessed: Date.now(),
      size_bytes: this.estimateSize(results)
    };

    this.searchCache.set(cacheKey, entry);
    this.enforceMemoryLimits();
  }

  /**
   * Retrieve cached search results
   */
  getSearchResults(query: string): TopicSearchResult[] | null {
    const cacheKey = this.generateSearchKey(query);
    const entry = this.searchCache.get(cacheKey);

    if (!entry || this.isExpired(entry)) {
      if (entry) this.searchCache.delete(cacheKey);
      return null;
    }

    entry.access_count++;
    entry.last_accessed = Date.now();
    return entry.data;
  }

  /**
   * Cache layer data (indexes, metadata, etc.)
   */
  cacheLayerData(layerName: string, key: string, data: any, sourceType: keyof CacheTTLSettings): void {
    const cacheKey = `${layerName}:${key}`;
    const ttl = this.getTTLForSourceType(sourceType);

    const entry: CacheEntry<any> = {
      data,
      timestamp: Date.now(),
      ttl,
      access_count: 0,
      last_accessed: Date.now(),
      size_bytes: this.estimateSize(data)
    };

    this.layerCache.set(cacheKey, entry);
    this.enforceMemoryLimits();
  }

  /**
   * Retrieve cached layer data
   */
  getLayerData(layerName: string, key: string): any | null {
    const cacheKey = `${layerName}:${key}`;
    const entry = this.layerCache.get(cacheKey);

    if (!entry || this.isExpired(entry)) {
      if (entry) this.layerCache.delete(cacheKey);
      return null;
    }

    entry.access_count++;
    entry.last_accessed = Date.now();
    return entry.data;
  }

  /**
   * Invalidate cache entries for a specific layer
   */
  invalidateLayer(layerName: string): number {
    let invalidated = 0;

    // Remove topic cache entries from this layer
    for (const [key, entry] of this.topicCache.entries()) {
      if (key.startsWith(`${layerName}:`)) {
        this.topicCache.delete(key);
        invalidated++;
      }
    }

    // Remove layer cache entries
    for (const [key, entry] of this.layerCache.entries()) {
      if (key.startsWith(`${layerName}:`)) {
        this.layerCache.delete(key);
        invalidated++;
      }
    }

    // Clear all search results as they may be affected
    this.searchCache.clear();
    invalidated += this.searchCache.size;

    console.log(`🗑️  Cache invalidation: Removed ${invalidated} entries for layer ${layerName}`);
    return invalidated;
  }

  /**
   * Warm up cache with frequently accessed topics
   */
  async warmUpCache(topics: Array<{ key: string; topic: AtomicTopic; sourceType: keyof CacheTTLSettings }>): Promise<void> {
    console.log(`🔥 Warming up cache with ${topics.length} topics...`);

    const startTime = Date.now();
    let cached = 0;

    for (const { key, topic, sourceType } of topics) {
      // Skip if already cached and not expired
      const existing = this.topicCache.get(key);
      if (existing && !this.isExpired(existing)) {
        continue;
      }

      this.cacheTopic(key, topic, sourceType);
      cached++;
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Cache warm-up complete: ${cached} topics cached in ${duration}ms`);
  }

  /**
   * Preload critical cache entries based on usage patterns
   */
  async preloadCriticalPaths(criticalTopics: string[]): Promise<void> {
    console.log(`⚡ Preloading ${criticalTopics.length} critical topics...`);

    // This would typically fetch from layers and cache
    // For now, we'll mark these as high-priority in future requests
    for (const topicId of criticalTopics) {
      // Future implementation: fetch topic and cache with extended TTL
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalMemory = this.calculateTotalMemoryUsage();
    const totalEntries = this.topicCache.size + this.searchCache.size + this.layerCache.size;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      total_requests: this.stats.total_requests,
      hit_rate: this.stats.total_requests > 0
        ? (this.stats.hits / this.stats.total_requests * 100)
        : 0,
      memory_usage_bytes: totalMemory,
      cache_size: totalEntries
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    const clearedEntries = this.topicCache.size + this.searchCache.size + this.layerCache.size;

    this.topicCache.clear();
    this.searchCache.clear();
    this.layerCache.clear();

    console.log(`🧹 Cleared all caches: ${clearedEntries} entries removed`);
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.clearAll();
  }

  // Private helper methods

  private getTTLForSourceType(sourceType: keyof CacheTTLSettings): number {
    const ttlConfig = this.config.ttl[sourceType];

    if (ttlConfig === 'permanent') return Infinity;
    if (ttlConfig === 'immediate') return 0;

    // Parse duration strings like "1h", "30m", "24h"
    const match = ttlConfig.match(/^(\d+)(h|m|s)$/);
    if (!match) return 5 * 60 * 1000; // Default 5 minutes

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 's': return value * 1000;
      default: return 5 * 60 * 1000;
    }
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    if (entry.ttl === Infinity) return false;
    if (entry.ttl === 0) return true;

    return (Date.now() - entry.timestamp) > entry.ttl;
  }

  private generateSearchKey(query: string): string {
    // Create deterministic cache key from search parameters
    return `search:${Buffer.from(query).toString('base64')}`;
  }

  private estimateSize(obj: any): number {
    // Rough estimation of object size in bytes
    return JSON.stringify(obj).length * 2; // Unicode characters are ~2 bytes
  }

  private calculateTotalMemoryUsage(): number {
    let total = 0;

    for (const entry of this.topicCache.values()) {
      total += entry.size_bytes;
    }

    for (const entry of this.searchCache.values()) {
      total += entry.size_bytes;
    }

    for (const entry of this.layerCache.values()) {
      total += entry.size_bytes;
    }

    return total;
  }

  private enforceMemoryLimits(): void {
    const maxMemory = this.config.max_size_mb * 1024 * 1024; // Convert MB to bytes
    const currentMemory = this.calculateTotalMemoryUsage();

    if (currentMemory <= maxMemory) return;

    console.log(`💾 Memory limit exceeded (${(currentMemory / 1024 / 1024).toFixed(2)}MB / ${this.config.max_size_mb}MB), evicting entries...`);

    // Evict least recently used entries across all caches
    const allEntries: Array<{ cache: Map<string, any>, key: string, entry: CacheEntry<any> }> = [];

    for (const [key, entry] of this.topicCache.entries()) {
      allEntries.push({ cache: this.topicCache, key, entry });
    }

    for (const [key, entry] of this.searchCache.entries()) {
      allEntries.push({ cache: this.searchCache, key, entry });
    }

    for (const [key, entry] of this.layerCache.entries()) {
      allEntries.push({ cache: this.layerCache, key, entry });
    }

    // Sort by last accessed time (oldest first)
    allEntries.sort((a, b) => a.entry.last_accessed - b.entry.last_accessed);

    // Evict entries until we're under the memory limit
    let evicted = 0;
    for (const { cache, key } of allEntries) {
      cache.delete(key);
      evicted++;
      this.stats.evictions++;

      if (this.calculateTotalMemoryUsage() <= maxMemory) break;
    }

    console.log(`🗑️  Evicted ${evicted} cache entries to free memory`);
  }

  private startPeriodicCleanup(): void {
    // Clean expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    let cleaned = 0;

    // Clean topic cache
    for (const [key, entry] of this.topicCache.entries()) {
      if (this.isExpired(entry)) {
        this.topicCache.delete(key);
        cleaned++;
      }
    }

    // Clean search cache
    for (const [key, entry] of this.searchCache.entries()) {
      if (this.isExpired(entry)) {
        this.searchCache.delete(key);
        cleaned++;
      }
    }

    // Clean layer cache
    for (const [key, entry] of this.layerCache.entries()) {
      if (this.isExpired(entry)) {
        this.layerCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Periodic cleanup: Removed ${cleaned} expired cache entries`);
    }
  }
}