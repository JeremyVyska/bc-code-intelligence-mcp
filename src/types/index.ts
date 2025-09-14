// Type exports for BCKB MCP server

export * from './bc-knowledge.js';

// Export layer types with prefixes to avoid conflicts
export * from './layer-types.js';

// Export config types (these take precedence for configuration system)
export {
  LayerSourceType,
  AuthType,
  DEFAULT_BCKB_CONFIG,
  ENV_VAR_MAPPINGS
} from './config-types.js';

export type {
  BCKBConfiguration,
  LayerConfiguration,
  LayerSource as ConfigLayerSource,
  GitLayerSource as ConfigGitLayerSource,
  LocalLayerSource as ConfigLocalLayerSource,
  EmbeddedLayerSource as ConfigEmbeddedLayerSource,
  HttpLayerSource as ConfigHttpLayerSource,
  NpmLayerSource,
  AuthConfiguration,
  ResolutionSettings,
  CacheSettings,
  CacheTTLSettings,
  SecuritySettings,
  PerformanceSettings,
  DeveloperSettings,
  ConfigurationSource,
  ConfigurationLoadResult,
  ConfigurationWarning,
  ValidationError,
  LayerLoadResult as ConfigLayerLoadResult,
  LayerSourceInfo,
  ConfigurationPath
} from './config-types.js';