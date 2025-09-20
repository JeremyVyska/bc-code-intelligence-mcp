/**
 * Layer System Types
 *
 * Defines interfaces for the layered knowledge architecture where different
 * sources can provide and override knowledge content.
 */

import { AtomicTopic } from './bc-knowledge.js';

/**
 * Layer priorities - lower numbers = higher priority (override earlier layers)
 */
export const enum LayerPriority {
  EMBEDDED = 0,      // Embedded knowledge from submodule (base layer)
  COMPANY = 100,     // Company-wide standards from git repo
  TEAM = 200,        // Team-specific overrides from git repo
  PROJECT = 300      // Project-local overrides from ./bc-code-intel-overrides/
}

/**
 * Layer source configuration
 */
export interface LayerSource {
  name: string;
  priority: LayerPriority;
  type: 'embedded' | 'git' | 'local' | 'http';
  enabled: boolean;
}

/**
 * Embedded layer source (git submodule)
 */
export interface EmbeddedLayerSource extends LayerSource {
  type: 'embedded';
  path: string;  // Path to embedded-knowledge/ submodule
}

/**
 * Git repository layer source
 */
export interface GitLayerSource extends LayerSource {
  type: 'git';
  url: string;
  branch?: string;
  path?: string;  // Path within repo
  credentials?: {
    username?: string;
    token?: string;
  };
}

/**
 * Local directory layer source
 */
export interface LocalLayerSource extends LayerSource {
  type: 'local';
  path: string;  // Local filesystem path
}

/**
 * HTTP endpoint layer source
 */
export interface HttpLayerSource extends LayerSource {
  type: 'http';
  baseUrl: string;
  headers?: Record<string, string>;
}

/**
 * Union of all layer source types
 */
export type AnyLayerSource = EmbeddedLayerSource | GitLayerSource | LocalLayerSource | HttpLayerSource;

/**
 * Layer resolution result
 */
export interface LayerResolutionResult {
  topic: AtomicTopic;
  sourceLayer: string;  // Name of layer that provided this topic
  isOverride: boolean;  // True if this topic overrides a lower-priority layer
  overriddenLayers: string[];  // Names of layers this topic overrides
}

/**
 * Layer loading result
 */
export interface LayerLoadResult {
  layerName: string;
  success: boolean;
  topicsLoaded: number;
  indexesLoaded: number;
  error?: string;
  loadTimeMs: number;
}

/**
 * Base interface for knowledge layer implementations
 */
export interface IKnowledgeLayer {
  readonly name: string;
  readonly priority: LayerPriority;
  readonly enabled: boolean;

  /**
   * Initialize the layer (load topics, indexes, etc.)
   */
  initialize(): Promise<LayerLoadResult>;

  /**
   * Check if the layer has a specific topic
   */
  hasTopic(topicId: string): boolean;

  /**
   * Get a topic from this layer
   */
  getTopic(topicId: string): Promise<AtomicTopic | null>;

  /**
   * Get a topic from this layer synchronously (for already loaded topics)
   */
  getTopicSync(topicId: string): AtomicTopic | null;

  /**
   * Get all topic IDs available in this layer
   */
  getTopicIds(): string[];

  /**
   * Search for topics within this layer
   */
  searchTopics(query: string, limit?: number): AtomicTopic[];

  /**
   * Get layer statistics
   */
  getStatistics(): LayerStatistics;

  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;
}

/**
 * Layer statistics
 */
export interface LayerStatistics {
  name: string;
  priority: LayerPriority;
  enabled: boolean;
  topicCount: number;
  indexCount: number;
  lastLoaded?: Date;
  loadTimeMs?: number;
  memoryUsage?: {
    topics: number;
    indexes: number;
    total: number;
  };
}

/**
 * Layer system configuration
 */
export interface LayerSystemConfig {
  layers: AnyLayerSource[];
  defaultSearchLimit: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  enableParallelLoading: boolean;
  loadTimeoutMs: number;
}

/**
 * Override resolution strategy
 */
export const enum OverrideStrategy {
  REPLACE = 'replace',           // Higher priority layer completely replaces lower
  MERGE_CONTENT = 'merge_content', // Merge markdown content sections
  MERGE_FRONTMATTER = 'merge_frontmatter', // Merge YAML frontmatter fields
  APPEND_CONTENT = 'append_content'  // Append content to existing topic
}

/**
 * Override configuration for specific topics or domains
 */
export interface OverrideConfig {
  topicPattern?: string;  // Glob pattern for topic IDs
  domain?: string;        // Domain name
  strategy: OverrideStrategy;
  preserveOriginal?: boolean;  // Keep reference to original content
}
