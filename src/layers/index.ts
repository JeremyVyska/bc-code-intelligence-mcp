/**
 * Knowledge Layers Export Module
 *
 * Exports all layer-related classes and interfaces for the layered knowledge system.
 */

export { BaseKnowledgeLayer } from './base-layer.js';
export { EmbeddedKnowledgeLayer } from './embedded-layer.js';
export { ProjectKnowledgeLayer } from './project-layer.js';
export { GitKnowledgeLayer } from './git-layer.js';
export { MultiContentLayerService } from '../services/multi-content-layer-service.js';

export type {
  LayerPriority,
  LayerSource,
  EmbeddedLayerSource,
  GitLayerSource,
  LocalLayerSource,
  HttpLayerSource,
  AnyLayerSource,
  LayerResolutionResult,
  LayerLoadResult,
  IKnowledgeLayer,
  LayerStatistics,
  LayerSystemConfig,
  OverrideStrategy,
  OverrideConfig
} from '../types/layer-types.js';