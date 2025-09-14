/**
 * Configuration loader for BCKB MCP server
 * Supports multiple configuration sources with precedence order
 */

import { readFile, access, constants } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { homedir } from 'os';
import { parse as parseYAML } from 'yaml';
import { fileURLToPath } from 'url';

import {
  BCKBConfiguration,
  DEFAULT_BCKB_CONFIG,
  ENV_VAR_MAPPINGS,
  ConfigurationLoadResult,
  ConfigurationSource,
  ConfigurationWarning,
  ValidationError,
  LayerConfiguration,
  AuthConfiguration,
  LayerSourceType,
  AuthType
} from '../types/config-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ConfigurationLoader {
  private readonly CONFIG_PATHS = [
    './bckb-config.json',
    './bckb-config.yaml',
    './bckb-config.yml',
    './.bckb/config.json',
    './.bckb/config.yaml',
    './.bckb/config.yml',
    join(homedir(), '.bckb/config.json'),
    join(homedir(), '.bckb/config.yaml'),
    join(homedir(), '.bckb/config.yml'),
    ...(process.platform === 'win32'
      ? [join(process.env['ProgramData'] || 'C:\\ProgramData', 'bckb', 'config.json')]
      : ['/etc/bckb/config.json', '/usr/local/etc/bckb/config.json']
    )
  ];

  async loadConfiguration(): Promise<ConfigurationLoadResult> {
    const sources: ConfigurationSource[] = [];
    const warnings: ConfigurationWarning[] = [];
    const validationErrors: ValidationError[] = [];

    try {
      // 1. Start with default configuration
      let config = this.deepClone(DEFAULT_BCKB_CONFIG);
      sources.push({
        type: 'default',
        priority: 0
      });

      // 2. Load from environment variable specified config file
      const customConfigPath = process.env['BCKB_CONFIG_PATH'];
      if (customConfigPath) {
        const customConfig = await this.loadFromFile(customConfigPath);
        if (customConfig.success && customConfig.config) {
          config = this.mergeConfigurations(config, customConfig.config);
          sources.push({
            type: 'file',
            path: customConfigPath,
            format: this.getFileFormat(customConfigPath),
            priority: 50
          });
        } else {
          validationErrors.push({
            field: 'BCKB_CONFIG_PATH',
            message: `Failed to load configuration from ${customConfigPath}: ${customConfig.error}`,
            source: 'environment'
          });
        }
      }

      // 3. Search for config files in standard locations
      const fileConfig = await this.loadFromFiles();
      if (fileConfig.config) {
        config = this.mergeConfigurations(config, fileConfig.config);
        sources.push(...fileConfig.sources);
      }
      warnings.push(...fileConfig.warnings);

      // 4. Apply environment variable overrides
      const envConfig = this.loadFromEnvironment();
      if (envConfig.config) {
        config = this.applyEnvironmentOverrides(config, envConfig.config);
        sources.push({
          type: 'environment',
          priority: 100
        });
      }
      warnings.push(...envConfig.warnings);

      // 5. Perform basic validation
      const validation = this.validateConfiguration(config);
      validationErrors.push(...validation.errors);
      warnings.push(...validation.warnings);

      return {
        config,
        sources: sources.sort((a, b) => a.priority - b.priority),
        warnings,
        validation_errors: validationErrors
      };
    } catch (error) {
      validationErrors.push({
        field: 'configuration',
        message: `Configuration loading failed: ${error instanceof Error ? error.message : String(error)}`,
        source: 'loader'
      });

      return {
        config: DEFAULT_BCKB_CONFIG,
        sources,
        warnings,
        validation_errors: validationErrors
      };
    }
  }

  private async loadFromFiles(): Promise<{
    config?: Partial<BCKBConfiguration>;
    sources: ConfigurationSource[];
    warnings: ConfigurationWarning[];
  }> {
    const sources: ConfigurationSource[] = [];
    const warnings: ConfigurationWarning[] = [];
    let config: Partial<BCKBConfiguration> | undefined;

    for (const configPath of this.CONFIG_PATHS) {
      const result = await this.loadFromFile(configPath);

      if (result.success) {
        config = result.config;
        sources.push({
          type: 'file',
          path: resolve(configPath),
          format: this.getFileFormat(configPath),
          priority: this.getFilePriority(configPath)
        });
        break; // Use first found config file
      } else if (result.error && !result.error.includes('ENOENT')) {
        // File exists but couldn't be loaded
        warnings.push({
          type: 'invalid_value',
          message: `Failed to load configuration from ${configPath}: ${result.error}`,
          source: configPath,
          suggestion: 'Check file format and permissions'
        });
      }
    }

    return { config, sources, warnings };
  }

  private async loadFromFile(filePath: string): Promise<{
    success: boolean;
    config?: Partial<BCKBConfiguration>;
    error?: string;
  }> {
    try {
      await access(filePath, constants.R_OK);
      const content = await readFile(filePath, 'utf-8');

      let parsed: any;
      const format = this.getFileFormat(filePath);

      if (format === 'yaml') {
        parsed = parseYAML(content);
      } else {
        parsed = JSON.parse(content);
      }

      return {
        success: true,
        config: parsed as Partial<BCKBConfiguration>
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private loadFromEnvironment(): {
    config?: Partial<BCKBConfiguration>;
    warnings: ConfigurationWarning[];
  } {
    const warnings: ConfigurationWarning[] = [];
    const overrides: Record<string, any> = {};

    // Process standard environment variables
    for (const [envVar, configPath] of Object.entries(ENV_VAR_MAPPINGS)) {
      const value = process.env[envVar];
      if (value !== undefined) {
        this.setNestedValue(overrides, configPath, this.parseEnvironmentValue(value));
      }
    }

    // Handle special case for quick git layer setup
    const gitUrl = process.env['BCKB_COMPANY_KNOWLEDGE_URL'];
    const gitToken = process.env['BCKB_COMPANY_KNOWLEDGE_TOKEN'];
    const gitBranch = process.env['BCKB_COMPANY_KNOWLEDGE_BRANCH'];

    if (gitUrl) {
      const companyLayer: LayerConfiguration = {
        name: 'company',
        priority: 20,
        source: {
          type: LayerSourceType.GIT,
          url: gitUrl,
          branch: gitBranch || 'main'
        },
        enabled: true
      };

      if (gitToken) {
        companyLayer.auth = {
          type: AuthType.TOKEN,
          token: gitToken
        };
      }

      if (!overrides['layers']) {
        overrides['layers'] = [];
      }
      overrides['layers'].push(companyLayer);

      warnings.push({
        type: 'deprecated',
        message: 'Using legacy environment variable BCKB_COMPANY_KNOWLEDGE_URL',
        suggestion: 'Consider using a configuration file for better control'
      });
    }

    return {
      config: Object.keys(overrides).length > 0 ? overrides : undefined,
      warnings
    };
  }

  private parseEnvironmentValue(value: string): any {
    // Try to parse as boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num) && isFinite(num)) return num;

    // Return as string
    return value;
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!part) continue;

      const match = part.match(/^(.+)\[(\w+)\]$/);

      if (match) {
        // Handle array notation like layers[company]
        const arrayName = match[1];
        const key = match[2];
        if (!arrayName || !key) continue;

        if (!current[arrayName]) {
          current[arrayName] = [];
        }
        // Find existing item or create new one
        let item = current[arrayName].find((item: any) => item.name === key);
        if (!item) {
          item = { name: key };
          current[arrayName].push(item);
        }
        current = item;
      } else {
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  private mergeConfigurations(
    base: BCKBConfiguration,
    override: Partial<BCKBConfiguration>
  ): BCKBConfiguration {
    const result = this.deepClone(base);

    // Handle layers specially - merge by name
    if (override.layers) {
      const layerMap = new Map<string, LayerConfiguration>();

      // Add base layers
      result.layers.forEach(layer => layerMap.set(layer.name, layer));

      // Add/override with new layers
      override.layers.forEach(layer => {
        layerMap.set(layer.name, { ...layerMap.get(layer.name), ...layer });
      });

      result.layers = Array.from(layerMap.values()).sort((a, b) => a.priority - b.priority);
    }

    // Merge other properties
    if (override.resolution) {
      result.resolution = { ...result.resolution, ...override.resolution };
    }
    if (override.cache) {
      result.cache = { ...result.cache, ...override.cache };
      if (override.cache.ttl) {
        result.cache.ttl = { ...result.cache.ttl, ...override.cache.ttl };
      }
    }
    if (override.security) {
      result.security = { ...result.security, ...override.security };
    }
    if (override.performance) {
      result.performance = { ...result.performance, ...override.performance };
    }
    if (override.developer) {
      result.developer = { ...result.developer, ...override.developer };
    }

    return result;
  }

  private applyEnvironmentOverrides(
    config: BCKBConfiguration,
    overrides: Partial<BCKBConfiguration>
  ): BCKBConfiguration {
    return this.mergeConfigurations(config, overrides);
  }

  private validateConfiguration(config: BCKBConfiguration): {
    errors: ValidationError[];
    warnings: ConfigurationWarning[];
  } {
    const errors: ValidationError[] = [];
    const warnings: ConfigurationWarning[] = [];

    // Validate layers
    if (!config.layers || config.layers.length === 0) {
      errors.push({
        field: 'layers',
        message: 'At least one layer must be configured'
      });
    } else {
      // Check for duplicate layer names
      const names = new Set<string>();
      config.layers.forEach((layer, index) => {
        if (names.has(layer.name)) {
          errors.push({
            field: `layers[${index}].name`,
            message: `Duplicate layer name: ${layer.name}`,
            value: layer.name
          });
        }
        names.add(layer.name);

        // Validate layer source
        if (!layer.source.type) {
          errors.push({
            field: `layers[${index}].source.type`,
            message: 'Layer source type is required'
          });
        }

        // Validate git sources
        if (layer.source.type === LayerSourceType.GIT) {
          if (!('url' in layer.source) || !layer.source.url) {
            errors.push({
              field: `layers[${index}].source.url`,
              message: 'Git layer source requires URL'
            });
          }
        }

        // Validate local sources
        if (layer.source.type === LayerSourceType.LOCAL) {
          if (!('path' in layer.source) || !layer.source.path) {
            errors.push({
              field: `layers[${index}].source.path`,
              message: 'Local layer source requires path'
            });
          }
        }

        // Check for security issues
        if (layer.auth?.token && !layer.auth.token.startsWith('$')) {
          warnings.push({
            type: 'security',
            message: `Layer ${layer.name} has hardcoded token`,
            suggestion: 'Use environment variable or token_env_var instead'
          });
        }
      });
    }

    // Validate cache settings
    if (config.cache.max_size_mb < 10) {
      warnings.push({
        type: 'invalid_value',
        message: 'Cache size is very low, may impact performance',
        suggestion: 'Consider increasing cache.max_size_mb to at least 50MB'
      });
    }

    // Validate performance settings
    if (config.performance.max_concurrent_loads > 20) {
      warnings.push({
        type: 'invalid_value',
        message: 'High concurrent load limit may cause resource exhaustion',
        suggestion: 'Consider reducing performance.max_concurrent_loads'
      });
    }

    return { errors, warnings };
  }

  private getFileFormat(filePath: string): 'json' | 'yaml' {
    return filePath.endsWith('.json') ? 'json' : 'yaml';
  }

  private getFilePriority(filePath: string): number {
    // Higher priority (lower number) for more specific/local configs
    if (filePath.includes('./bckb-config')) return 10;
    if (filePath.includes('./.bckb')) return 20;
    if (filePath.includes(homedir())) return 30;
    return 40; // System configs
  }

  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as any;
    if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as any;
    if (typeof obj === 'object') {
      const cloned = {} as any;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  }
}