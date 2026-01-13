/**
 * Enhanced Layer Types for Multi-Content Support
 * 
 * Extends the existing layer system to support specialists alongside
 * atomic topics, enabling layered override system for both knowledge
 * content and specialist personas.
 */

import { AtomicTopic } from './bc-knowledge.js';
import { SpecialistDefinition } from '../services/specialist-loader.js';

/**
 * Content types supported by the layer system
 */
export type LayerContentType = 'topics' | 'specialists' | 'workflows';

/**
 * Generic content item that can be stored in layers
 */
export interface LayerContent {
  id: string;
  type: LayerContentType;
  source_layer: string;
  loaded_at: Date;
}

/**
 * Topic content for backward compatibility
 */
export interface TopicContent extends LayerContent {
  type: 'topics';
  topic: AtomicTopic;
}

/**
 * Specialist content for the new specialist system
 */
export interface SpecialistContent extends LayerContent {
  type: 'specialists';
  specialist: SpecialistDefinition;
}

/**
 * Enhanced layer load result with content type breakdown
 */
export interface EnhancedLayerLoadResult {
  success: boolean;
  layer_name: string;
  load_time_ms: number;
  content_counts: Record<LayerContentType, number>;
  error?: string;
  
  // Backward compatibility
  topics_loaded: number;
  indexes_loaded: number;
}

/**
 * Enhanced layer interface supporting multiple content types
 */
export interface MultiContentKnowledgeLayer {
  readonly name: string;
  readonly priority: number;
  readonly enabled: boolean;
  readonly supported_content_types: LayerContentType[];

  /**
   * Initialize the layer with all supported content types
   */
  initialize(): Promise<EnhancedLayerLoadResult>;

  /**
   * Check if content exists by type and ID
   */
  hasContent<T extends LayerContentType>(type: T, id: string): boolean;

  /**
   * Get content by type and ID
   */
  getContent<T extends LayerContentType>(
    type: T, 
    id: string
  ): Promise<T extends 'topics' ? AtomicTopic | null : 
             T extends 'specialists' ? SpecialistDefinition | null : 
             any>;

  /**
   * Get all content IDs for a specific type
   */
  getContentIds<T extends LayerContentType>(type: T): string[];

  /**
   * Search content within this layer by type
   */
  searchContent<T extends LayerContentType>(
    type: T, 
    query: string, 
    limit?: number
  ): Array<T extends 'topics' ? AtomicTopic : 
            T extends 'specialists' ? SpecialistDefinition : 
            any>;

  /**
   * Get layer statistics with content type breakdown
   */
  getEnhancedStatistics(): {
    name: string;
    priority: number;
    content_counts: Record<LayerContentType, number>;
    load_time_ms?: number;
    initialized: boolean;
  };

  /**
   * Cleanup resources
   */
  dispose(): Promise<void>;

  // Backward compatibility methods
  hasTopic(topicId: string): boolean;
  getTopic(topicId: string): Promise<AtomicTopic | null>;
  getTopicSync(topicId: string): AtomicTopic | null;
  getTopicIds(): string[];
  searchTopics(query: string, limit?: number): AtomicTopic[];
}

/**
 * Configuration for specialist layer sources
 */
export interface SpecialistLayerConfig {
  specialists_path?: string;        // Path to specialists directory
  auto_load?: boolean;             // Auto-load specialists on init
  custom_specialist_schema?: any;  // Custom validation schema
  collaboration_enabled?: boolean; // Enable collaboration features
}

/**
 * Enhanced layer source configuration
 */
export interface EnhancedLayerSource {
  name: string;
  priority: number;
  type: 'embedded' | 'git' | 'local' | 'http';
  enabled: boolean;
  supported_content_types: LayerContentType[];
  
  // Content-specific configurations
  topics_config?: {
    domains_path?: string;
    auto_load?: boolean;
  };
  
  specialists_config?: SpecialistLayerConfig;
  
  workflows_config?: {
    workflows_path?: string;
    auto_load?: boolean;
  };
}

/**
 * Specialist layer resolution strategy
 */
export interface SpecialistResolutionStrategy {
  /**
   * How to handle specialist conflicts across layers
   */
  conflict_resolution: 'override' | 'merge' | 'extend';
  
  /**
   * Whether to inherit collaboration links from lower priority layers
   */
  inherit_collaborations: boolean;
  
  /**
   * Whether to merge expertise from multiple layers
   */
  merge_expertise: boolean;
  
  /**
   * Custom fields to preserve during override
   */
  preserve_fields?: string[];
}

/**
 * Layer service configuration for multi-content support
 */
export interface MultiContentLayerServiceConfig {
  layers: EnhancedLayerSource[];
  
  specialist_resolution?: SpecialistResolutionStrategy;
  
  // Global settings
  enable_caching?: boolean;
  cache_ttl_ms?: number;
  max_cache_size?: number;
  
  // Content type priorities
  content_type_priorities?: Partial<Record<LayerContentType, number>>;
}

/**
 * Query context for specialist suggestions
 */
export interface SpecialistQueryContext {
  problem_type?: string;
  domain?: string;
  urgency?: 'low' | 'medium' | 'high';
  collaboration_needed?: boolean;
  expertise_level?: 'beginner' | 'intermediate' | 'advanced';
  bc_version?: string;
}

/**
 * Specialist suggestion result with layer information
 */
export interface LayerSpecialistSuggestion {
  specialist: SpecialistDefinition;
  source_layer: string;
  confidence_score: number;
  match_reasons: string[];
  collaboration_options: {
    available_handoffs: SpecialistDefinition[];
    recommended_consultations: SpecialistDefinition[];
  };
}

/**
 * Multi-layer specialist query result
 */
export interface MultiLayerSpecialistResult {
  primary_suggestions: LayerSpecialistSuggestion[];
  alternative_specialists: LayerSpecialistSuggestion[];
  cross_layer_collaboration: {
    layer_name: string;
    specialists: SpecialistDefinition[];
  }[];
  resolution_strategy_used: SpecialistResolutionStrategy;
}