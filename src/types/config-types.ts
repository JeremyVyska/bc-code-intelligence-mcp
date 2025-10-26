/**
 * Configuration system types for BC Code Intelligence MCP server
 * Supports multi-source configuration with layer-based knowledge management
 */

import { SessionStorageConfig } from './session-types.js';

export interface BCCodeIntelConfiguration {
  layers: LayerConfiguration[];
  resolution: ResolutionSettings;
  cache: CacheSettings;
  security: SecuritySettings;
  performance: PerformanceSettings;
  developer: DeveloperSettings;
  
  // Session storage configuration - optional, defaults to in-memory
  sessionStorage?: SessionStorageConfig;
}

export interface LayerConfiguration {
  name: string;
  priority: number;
  source: LayerSource;
  enabled: boolean;
  patterns?: string[];
  cache_duration?: string;
  auth?: AuthConfiguration;
}

export enum LayerSourceType {
  EMBEDDED = 'embedded',  // ✅ Implemented
  GIT = 'git',            // ✅ Implemented
  LOCAL = 'local',        // ✅ Implemented
  HTTP = 'http',          // 🚧 Planned - HTTP-based knowledge sources
  NPM = 'npm'             // 🚧 Planned - NPM package knowledge sources
}

export interface LayerSource {
  type: LayerSourceType;
  path?: string;        // For embedded and local sources
  url?: string;         // For git and http sources
  branch?: string;      // For git sources
  subpath?: string;     // Path within source
  package?: string;     // For npm sources
}

export interface GitLayerSource extends LayerSource {
  type: LayerSourceType.GIT;
  url: string;
  branch?: string;
  subpath?: string;
  auth?: AuthConfiguration;
}

export interface LocalLayerSource extends LayerSource {
  type: LayerSourceType.LOCAL;
  path: string;
}

export interface EmbeddedLayerSource extends LayerSource {
  type: LayerSourceType.EMBEDDED;
  path?: string;
}

export interface HttpLayerSource extends LayerSource {
  type: LayerSourceType.HTTP;
  url: string;
  auth?: AuthConfiguration;
}

export interface NpmLayerSource extends LayerSource {
  type: LayerSourceType.NPM;
  package: string;
}

export enum AuthType {
  TOKEN = 'token',
  SSH_KEY = 'ssh',
  BASIC = 'basic',
  OAUTH = 'oauth'
}

export interface AuthConfiguration {
  type: AuthType;
  token?: string;
  token_env_var?: string;
  username?: string;
  password?: string;
  password_env_var?: string;
  key_path?: string;
  client_id?: string;
  client_secret?: string;
}

export interface ResolutionSettings {
  strategy: 'first_match' | 'best_match' | 'merge_all';
  conflict_resolution: 'priority_wins' | 'user_choice' | 'merge_smart';
  enable_fallback: boolean;
  fallback_to_embedded: boolean;
}

export interface CacheSettings {
  strategy: 'none' | 'minimal' | 'moderate' | 'aggressive';
  ttl: CacheTTLSettings;
  max_size_mb: number;
  clear_on_startup: boolean;
  background_refresh: boolean;
}

export interface CacheTTLSettings {
  git: string;          // e.g., "1h", "30m", "24h"
  local: string;        // e.g., "immediate", "5m"
  http: string;         // e.g., "30m", "2h"
  embedded: string;     // e.g., "permanent", "session"
  npm: string;          // e.g., "24h", "1w"
}

export interface SecuritySettings {
  validate_sources: boolean;
  allow_local_paths: boolean;
  allow_http_sources: boolean;
  trusted_domains: string[];
  max_download_size_mb: number;
  scan_for_malicious_content: boolean;
}

export interface PerformanceSettings {
  max_concurrent_loads: number;
  load_timeout_ms: number;
  max_layers: number;
  lazy_loading: boolean;
  preload_embedded: boolean;
  memory_limit_mb: number;
}

export interface DeveloperSettings {
  debug_layers: boolean;
  hot_reload: boolean;
  log_level: 'error' | 'warn' | 'info' | 'debug';
  profile_performance: boolean;
  validate_on_startup: boolean;
  export_config_schema: boolean;
  enable_diagnostic_tools: boolean; // Load git/config diagnostic tools (for advanced layer users)
}

export interface ConfigurationSource {
  type: 'file' | 'environment' | 'default';
  path?: string;
  format?: 'json' | 'yaml';
  priority: number;
}

export interface ConfigurationLoadResult {
  config: BCCodeIntelConfiguration;
  sources: ConfigurationSource[];
  warnings: ConfigurationWarning[];
  validation_errors: ValidationError[];
}

export interface ConfigurationWarning {
  type: 'deprecated' | 'invalid_value' | 'missing_optional' | 'security';
  message: string;
  source?: string;
  suggestion?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  source?: string;
  suggestion?: string;
}

export interface LayerLoadResult {
  layer_name: string;
  success: boolean;
  topics_loaded: number;
  load_time_ms: number;
  errors: string[];
  warnings: string[];
  source_info: LayerSourceInfo;
}

export interface LayerSourceInfo {
  type: LayerSourceType;
  location: string;
  last_updated?: Date;
  version?: string;
  size_bytes?: number;
}

// Default configuration template
export const DEFAULT_BC_CODE_INTEL_CONFIG: BCCodeIntelConfiguration = {
  layers: [
    {
      name: 'embedded',
      priority: 0,
      source: {
        type: LayerSourceType.EMBEDDED,
        path: 'embedded-knowledge'
      },
      enabled: true
    },
    {
      name: 'project',
      priority: 100,
      source: {
        type: LayerSourceType.LOCAL,
        path: './bc-code-intel-overrides'
      },
      enabled: true,
      patterns: ['*']
    }
  ],
  resolution: {
    strategy: 'best_match',
    conflict_resolution: 'priority_wins',
    enable_fallback: true,
    fallback_to_embedded: true
  },
  cache: {
    strategy: 'moderate',
    ttl: {
      git: '1h',
      local: 'immediate',
      http: '30m',
      embedded: 'permanent',
      npm: '24h'
    },
    max_size_mb: 100,
    clear_on_startup: false,
    background_refresh: true
  },
  security: {
    validate_sources: true,
    allow_local_paths: true,
    allow_http_sources: false,
    trusted_domains: [],
    max_download_size_mb: 50,
    scan_for_malicious_content: true
  },
  performance: {
    max_concurrent_loads: 5,
    load_timeout_ms: 30000,
    max_layers: 20,
    lazy_loading: true,
    preload_embedded: true,
    memory_limit_mb: 500
  },
  developer: {
    debug_layers: false,
    hot_reload: false,
    log_level: 'info',
    profile_performance: false,
    validate_on_startup: true,
    export_config_schema: false,
    enable_diagnostic_tools: false // Disabled by default to minimize token overhead
  }
};

// Environment variable mappings
export const ENV_VAR_MAPPINGS = {
  'BC_CODE_INTEL_CONFIG_PATH': 'config_file_path',
  'BC_CODE_INTEL_DEBUG_LAYERS': 'developer.debug_layers',
  'BC_CODE_INTEL_ENABLE_DIAGNOSTICS': 'developer.enable_diagnostic_tools',
  'BC_CODE_INTEL_HOT_RELOAD': 'developer.hot_reload',
  'BC_CODE_INTEL_LOG_LEVEL': 'developer.log_level',
  'BC_CODE_INTEL_CACHE_STRATEGY': 'cache.strategy',
  'BC_CODE_INTEL_CACHE_TTL_GIT': 'cache.ttl.git',
  'BC_CODE_INTEL_CACHE_TTL_LOCAL': 'cache.ttl.local',
  'BC_CODE_INTEL_ALLOW_HTTP_SOURCES': 'security.allow_http_sources',
  'BC_CODE_INTEL_MAX_LAYERS': 'performance.max_layers',
  'BC_CODE_INTEL_MEMORY_LIMIT_MB': 'performance.memory_limit_mb',

  // Quick git layer setup
  'BC_CODE_INTEL_COMPANY_KNOWLEDGE_URL': 'layers[company].source.url',
  'BC_CODE_INTEL_COMPANY_KNOWLEDGE_TOKEN': 'layers[company].auth.token',
  'BC_CODE_INTEL_COMPANY_KNOWLEDGE_BRANCH': 'layers[company].source.branch'
} as const;

export type ConfigurationPath = typeof ENV_VAR_MAPPINGS[keyof typeof ENV_VAR_MAPPINGS];
