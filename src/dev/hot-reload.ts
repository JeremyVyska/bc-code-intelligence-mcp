/**
 * Hot Reload System for Development Experience
 *
 * Watches for configuration changes, layer updates, and code modifications
 * to provide instant feedback during development without server restart.
 */

import { watch, FSWatcher } from 'chokidar';
import { readFile, stat } from 'fs/promises';
import { EventEmitter } from 'events';
import { LayerService } from '../layers/layer-service.js';
import { ConfigurationLoader } from '../config/config-loader.js';
import { BCKBConfiguration } from '../types/index.js';

export interface HotReloadEvent {
  type: 'config_changed' | 'layer_updated' | 'topic_changed' | 'index_rebuilt';
  source: string;
  timestamp: number;
  details?: any;
}

export interface DevServerStats {
  uptime: number;
  reload_count: number;
  last_reload: number;
  watched_files: number;
  active_watchers: number;
  performance_impact: 'low' | 'medium' | 'high';
}

export class HotReloadSystem extends EventEmitter {
  private watchers: FSWatcher[] = [];
  private layerService?: LayerService;
  private configLoader?: ConfigurationLoader;
  private currentConfig?: BCKBConfiguration;
  private reloadCount = 0;
  private startTime = Date.now();
  private lastReload = 0;
  private watchedPaths = new Set<string>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly enabled: boolean = false,
    private readonly debounceMs: number = 1000,
    private readonly verboseLogging: boolean = true
  ) {
    super();

    if (this.enabled) {
      console.log('🔥 Hot reload system initialized');
    }
  }

  /**
   * Initialize hot reload with layer service and config loader
   */
  async initialize(layerService: LayerService, configLoader: ConfigurationLoader): Promise<void> {
    if (!this.enabled) {
      console.log('⏭️  Hot reload disabled, skipping initialization');
      return;
    }

    this.layerService = layerService;
    this.configLoader = configLoader;

    // Load initial configuration
    const configResult = await configLoader.loadConfiguration();
    this.currentConfig = configResult.config;

    // Setup watchers
    await this.setupConfigurationWatcher();
    await this.setupLayerWatchers();

    console.log(`🔥 Hot reload system active with ${this.watchers.length} watchers`);

    // Emit initial ready event
    this.emitReloadEvent('config_changed', 'system', { message: 'Hot reload system ready' });
  }

  /**
   * Add custom file path to watch
   */
  watchPath(path: string, eventType: HotReloadEvent['type'] = 'topic_changed'): void {
    if (!this.enabled || this.watchedPaths.has(path)) return;

    const watcher = watch(path, { ignoreInitial: true })
      .on('change', (changedPath) => this.handleFileChange(changedPath, eventType))
      .on('add', (addedPath) => this.handleFileChange(addedPath, eventType))
      .on('unlink', (removedPath) => this.handleFileChange(removedPath, eventType))
      .on('error', (error) => console.error(`🔥 Watcher error for ${path}:`, error));

    this.watchers.push(watcher);
    this.watchedPaths.add(path);

    if (this.verboseLogging) {
      console.log(`👀 Now watching: ${path}`);
    }
  }

  /**
   * Trigger manual reload for testing or forced updates
   */
  async triggerReload(reason: string = 'manual'): Promise<void> {
    if (!this.layerService || !this.configLoader) {
      console.warn('🔥 Cannot trigger reload: services not initialized');
      return;
    }

    console.log(`🔄 Triggering manual reload: ${reason}`);

    try {
      // Reload configuration
      const configResult = await this.configLoader.loadConfiguration();

      // Check if configuration changed
      if (JSON.stringify(configResult.config) !== JSON.stringify(this.currentConfig)) {
        await this.handleConfigurationChange(configResult.config);
      } else {
        // Force layer refresh
        await this.layerService.refreshCache();
        this.emitReloadEvent('layer_updated', 'manual', { reason });
      }

    } catch (error) {
      console.error('🔥 Manual reload failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get development server statistics
   */
  getStats(): DevServerStats {
    const uptime = Date.now() - this.startTime;

    // Simple performance impact calculation
    let performanceImpact: 'low' | 'medium' | 'high' = 'low';
    if (this.watchers.length > 50) {
      performanceImpact = 'high';
    } else if (this.watchers.length > 20) {
      performanceImpact = 'medium';
    }

    return {
      uptime,
      reload_count: this.reloadCount,
      last_reload: this.lastReload,
      watched_files: this.watchedPaths.size,
      active_watchers: this.watchers.length,
      performance_impact: performanceImpact
    };
  }

  /**
   * Shutdown hot reload system and cleanup watchers
   */
  async shutdown(): Promise<void> {
    console.log('🔥 Shutting down hot reload system...');

    // Close all watchers
    await Promise.all(this.watchers.map(watcher => watcher.close()));
    this.watchers = [];
    this.watchedPaths.clear();

    // Clear any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    console.log('✅ Hot reload system shutdown complete');
  }

  // Private implementation methods

  /**
   * Setup configuration file watcher
   */
  private async setupConfigurationWatcher(): Promise<void> {
    // Watch common configuration file locations
    const configPaths = [
      './bckb-config.json',
      './bckb-config.yaml',
      './.bckb/config.json',
      './package.json' // For environment changes
    ];

    for (const configPath of configPaths) {
      try {
        // Check if file exists before watching
        await stat(configPath);

        const watcher = watch(configPath, { ignoreInitial: true })
          .on('change', () => this.handleConfigurationFileChange(configPath))
          .on('error', (error) => {
            if (this.verboseLogging) {
              console.log(`📝 Config file watcher error for ${configPath}:`, (error as Error).message);
            }
          });

        this.watchers.push(watcher);
        this.watchedPaths.add(configPath);

      } catch (error) {
        // File doesn't exist, skip watching
        if (this.verboseLogging) {
          console.log(`📝 Config file not found, skipping: ${configPath}`);
        }
      }
    }
  }

  /**
   * Setup layer-specific watchers based on current configuration
   */
  private async setupLayerWatchers(): Promise<void> {
    if (!this.currentConfig) return;

    for (const layerConfig of this.currentConfig.layers.filter(l => l.enabled)) {
      try {
        let watchPath: string;

        switch (layerConfig.source.type) {
          case 'local':
            if ('path' in layerConfig.source && layerConfig.source.path) {
              watchPath = layerConfig.source.path;
            } else {
              continue;
            }
            break;

          case 'embedded':
            watchPath = 'embedded-knowledge'; // Default embedded path
            break;

          case 'git':
            // Watch the local git cache directory
            watchPath = '.bckb-cache/git-repos';
            break;

          default:
            continue; // Skip unsupported source types for watching
        }

        const watcher = watch(watchPath, {
          ignoreInitial: true,
          persistent: true,
          depth: 3 // Reasonable depth to avoid performance issues
        })
          .on('change', (path) => this.handleLayerChange(layerConfig.name, path, 'changed'))
          .on('add', (path) => this.handleLayerChange(layerConfig.name, path, 'added'))
          .on('unlink', (path) => this.handleLayerChange(layerConfig.name, path, 'removed'))
          .on('error', (error) => {
            if (this.verboseLogging) {
              console.warn(`🔥 Layer watcher error for ${layerConfig.name}:`, (error as Error).message);
            }
          });

        this.watchers.push(watcher);
        this.watchedPaths.add(watchPath);

        if (this.verboseLogging) {
          console.log(`👀 Watching layer ${layerConfig.name}: ${watchPath}`);
        }

      } catch (error) {
        console.warn(`🔥 Failed to setup watcher for layer ${layerConfig.name}:`, error);
      }
    }
  }

  /**
   * Handle configuration file changes
   */
  private async handleConfigurationFileChange(configPath: string): Promise<void> {
    if (!this.configLoader) return;

    this.debounceAction(`config:${configPath}`, async () => {
      try {
        if (this.verboseLogging) {
          console.log(`📝 Configuration file changed: ${configPath}`);
        }

        // Reload configuration
        const configResult = await this.configLoader!.loadConfiguration();

        // Check if configuration actually changed
        if (JSON.stringify(configResult.config) !== JSON.stringify(this.currentConfig)) {
          await this.handleConfigurationChange(configResult.config);
        }

      } catch (error) {
        console.error(`🔥 Failed to reload configuration from ${configPath}:`, error);
        this.emit('error', error);
      }
    });
  }

  /**
   * Handle layer file changes
   */
  private handleLayerChange(layerName: string, filePath: string, changeType: 'changed' | 'added' | 'removed'): void {
    // Only watch markdown files and relevant files
    if (!filePath.match(/\.(md|yaml|yml|json)$/i)) {
      return;
    }

    this.debounceAction(`layer:${layerName}:${filePath}`, async () => {
      try {
        if (this.verboseLogging) {
          console.log(`📄 Layer file ${changeType}: ${filePath} in ${layerName}`);
        }

        if (this.layerService) {
          // Invalidate cache for the specific layer
          const cacheStats = this.layerService.getCacheStats();
          if ('advanced_cache_enabled' in cacheStats && cacheStats.advanced_cache_enabled) {
            // Could invalidate specific layer cache here
          }

          // Refresh the entire layer service (could be optimized to refresh only affected layer)
          await this.layerService.refreshCache();

          this.emitReloadEvent('layer_updated', filePath, {
            layer_name: layerName,
            change_type: changeType,
            file_path: filePath
          });
        }

      } catch (error) {
        console.error(`🔥 Failed to handle layer change in ${layerName}:`, error);
        this.emit('error', error);
      }
    });
  }

  /**
   * Handle any file change with generic handling
   */
  private handleFileChange(filePath: string, eventType: HotReloadEvent['type']): void {
    this.debounceAction(`file:${filePath}`, async () => {
      if (this.verboseLogging) {
        console.log(`📁 File changed: ${filePath}`);
      }

      this.emitReloadEvent(eventType, filePath, { file_path: filePath });
    });
  }

  /**
   * Handle configuration changes and trigger appropriate reloads
   */
  private async handleConfigurationChange(newConfig: BCKBConfiguration): Promise<void> {
    try {
      console.log('🔧 Configuration changed, reinitializing services...');

      const oldConfig = this.currentConfig;
      this.currentConfig = newConfig;

      // Reinitialize layer service with new configuration
      if (this.layerService) {
        await this.layerService.initializeFromConfiguration(newConfig);
      }

      // Update watchers if layer configuration changed
      const layersChanged = !oldConfig ||
        JSON.stringify(oldConfig.layers) !== JSON.stringify(newConfig.layers);

      if (layersChanged) {
        // Close existing layer watchers
        await Promise.all(this.watchers.map(w => w.close()));
        this.watchers = [];
        this.watchedPaths.clear();

        // Setup new watchers
        await this.setupConfigurationWatcher();
        await this.setupLayerWatchers();
      }

      this.emitReloadEvent('config_changed', 'configuration', {
        layers_changed: layersChanged,
        new_layer_count: newConfig.layers.filter(l => l.enabled).length
      });

      console.log('✅ Configuration reload complete');

    } catch (error) {
      console.error('🔥 Configuration reload failed:', error);
      this.emit('error', error);
    }
  }

  /**
   * Debounce actions to prevent excessive reloading
   */
  private debounceAction(key: string, action: () => Promise<void>): void {
    // Clear existing timer
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      await action();
    }, this.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Emit reload event with consistent structure
   */
  private emitReloadEvent(type: HotReloadEvent['type'], source: string, details?: any): void {
    this.reloadCount++;
    this.lastReload = Date.now();

    const event: HotReloadEvent = {
      type,
      source,
      timestamp: this.lastReload,
      details
    };

    this.emit('reload', event);

    if (this.verboseLogging) {
      console.log(`🔥 Hot reload event: ${type} from ${source}`);
    }
  }
}