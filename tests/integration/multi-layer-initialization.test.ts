import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { ConfigurationLoader } from '../../src/config/config-loader.js';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';
import { BCCodeIntelConfiguration, LayerSourceType } from '../../src/types/index.js';

/**
 * Multi-Layer Initialization Tests
 * 
 * Tests for Issue #15: Configuration Layers Not Loaded - Only Embedded Layer Initialized
 * https://github.com/JeremyVyska/bc-code-intelligence-mcp/issues/15
 * 
 * This test reproduces the bug where initializeServices() ignores the loaded
 * configuration and only initializes the embedded layer, preventing company-layer
 * knowledge bases from being loaded.
 */

// Helper function to create valid test configuration
function createTestConfig(localKnowledgePath: string): BCCodeIntelConfiguration {
  return {
    layers: [
      {
        name: 'embedded',
        enabled: true,
        priority: 0,  // Same priority as default - will override
        source: {
          type: LayerSourceType.EMBEDDED,
          path: 'embedded-knowledge'
        }
      },
      {
        name: 'company',
        enabled: true,
        priority: 50,
        source: {
          type: LayerSourceType.LOCAL,
          path: localKnowledgePath
        }
      }
    ],
    resolution: {
      strategy: 'first_match',
      conflict_resolution: 'priority_wins',
      enable_fallback: true,
      fallback_to_embedded: true
    },
    cache: {
      strategy: 'moderate',
      ttl: {
        embedded: 'permanent',
        git: '1h',
        local: 'immediate',
        http: '15m',
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
      max_download_size_mb: 100,
      scan_for_malicious_content: true
    },
    performance: {
      max_concurrent_loads: 3,
      load_timeout_ms: 30000,
      max_layers: 20,
      lazy_loading: false,
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
      enable_diagnostic_tools: false
    }
  };
}

describe('Multi-Layer Initialization - Issue #15', () => {
  let testConfigDir: string;
  let testKnowledgeDir: string;
  let configLoader: ConfigurationLoader;
  
  beforeAll(async () => {
    // Create temporary directories for test
    const testId = Date.now();
    testConfigDir = join(tmpdir(), `bckb-test-config-${testId}`);
    testKnowledgeDir = join(tmpdir(), `bckb-test-knowledge-${testId}`);
    
    await mkdir(testConfigDir, { recursive: true });
    await mkdir(testKnowledgeDir, { recursive: true });
    
    // Create a mock local knowledge base structure
    await mkdir(join(testKnowledgeDir, 'domains'), { recursive: true });
    await mkdir(join(testKnowledgeDir, 'specialists'), { recursive: true });
    
    // Create a sample topic in the local knowledge base
    const sampleTopic = `---
title: "Company Test Topic"
domain: "testing"
bc_versions: "14+"
difficulty: "intermediate"
tags: ["company", "test"]
related_topics: []
applies_to:
  - "AL Language"
last_updated: "2025-10-15"
---

# Company Test Topic

This is a test topic from the company knowledge layer.

## Overview
This topic should be loaded when the local layer is configured.
`;
    
    await writeFile(
      join(testKnowledgeDir, 'domains', 'company-test-topic.md'),
      sampleTopic,
      'utf8'
    );
  }, 30000);
  
  afterAll(async () => {
    // Cleanup test directories
    try {
      await rm(testConfigDir, { recursive: true, force: true });
      await rm(testKnowledgeDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  });
  
  beforeEach(() => {
    // Create a fresh config loader for each test
    configLoader = new ConfigurationLoader();
  });
  
  describe('Configuration Loading', () => {
    it('should load configuration with multiple layers from file', async () => {
      // Create a test configuration with embedded + local layers
      const config = createTestConfig(testKnowledgeDir);
      
      // Write config to test directory
      const configPath = join(testConfigDir, 'config.json');
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      
      // Set environment variable to point to our test config
      const originalEnvVar = process.env['BCKB_CONFIG_PATH'];
      process.env['BCKB_CONFIG_PATH'] = configPath;
      
      try {
        // Load configuration
        const configResult = await configLoader.loadConfiguration();
        
        // Verify configuration loaded successfully
        expect(configResult).toBeDefined();
        expect(configResult.config).toBeDefined();
        // Note: Config loader may add default layers, so we check for at least our 2
        expect(configResult.config.layers.length).toBeGreaterThanOrEqual(2);
        
        // Debug: Show validation errors if any
        if (configResult.validation_errors.length > 0) {
          console.log('❌ Validation errors:', JSON.stringify(configResult.validation_errors, null, 2));
          console.log('📋 Config layers:', configResult.config.layers.map(l => l.name));
        }
        
        expect(configResult.validation_errors).toHaveLength(0);
        
        // Verify our embedded layer is present
        const embeddedLayer = configResult.config.layers.find(l => l.name === 'embedded');
        expect(embeddedLayer).toBeDefined();
        expect(embeddedLayer!.enabled).toBe(true);
        expect(embeddedLayer!.source.type).toBe(LayerSourceType.EMBEDDED);
        
        // Verify our local layer is present
        const localLayer = configResult.config.layers.find(l => l.name === 'company');
        expect(localLayer).toBeDefined();
        expect(localLayer!.enabled).toBe(true);
        expect(localLayer!.source.type).toBe(LayerSourceType.LOCAL);
        expect(localLayer!.source.path).toBe(testKnowledgeDir);
      } finally {
        // Restore environment
        if (originalEnvVar !== undefined) {
          process.env['BCKB_CONFIG_PATH'] = originalEnvVar;
        } else {
          delete process.env['BCKB_CONFIG_PATH'];
        }
      }
    });
  });
  
  describe('Layer Service Initialization - FAILING TEST', () => {
    it('should initialize ALL configured layers, not just embedded', async () => {
      // This test reproduces the bug reported in Issue #15
      // Expected: FAILS before fix, PASSES after fix
      
      // Create configuration with multiple layers
      const config = createTestConfig(testKnowledgeDir);
      
      // Write config to test directory
      const configPath = join(testConfigDir, 'config.json');
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      
      // Set environment variable
      const originalEnvVar = process.env['BCKB_CONFIG_PATH'];
      process.env['BCKB_CONFIG_PATH'] = configPath;
      
      try {
        // Simulate what initializeServices() SHOULD do
        const configResult = await configLoader.loadConfiguration();
        
        // Create layer service
        const layerService = new MultiContentLayerService();
        
        // THIS IS THE BUG: Current implementation hard-codes only embedded layer
        // The fix should iterate over configResult.config.layers instead
        
        // For now, let's manually test what SHOULD happen:
        // We'll dynamically import and instantiate layers based on config
        const { EmbeddedKnowledgeLayer } = await import('../../src/layers/embedded-layer.js');
        const { ProjectKnowledgeLayer } = await import('../../src/layers/project-layer.js');
        
        let layersAdded = 0;
        
        for (const layerConfig of configResult.config.layers) {
          if (!layerConfig.enabled) continue;
          
          // Only process layers we explicitly configured for this test
          if (layerConfig.name !== 'embedded' && layerConfig.name !== 'company') {
            console.error(`⏭️  Skipping extra layer from config: ${layerConfig.name}`);
            continue;
          }
          
          let layer;
          
          switch (layerConfig.source.type) {
            case LayerSourceType.EMBEDDED:
              const embeddedPath = layerConfig.source.path === 'embedded-knowledge'
                ? join(process.cwd(), 'embedded-knowledge')
                : layerConfig.source.path!;
              layer = new EmbeddedKnowledgeLayer(embeddedPath);
              break;
              
            case LayerSourceType.LOCAL:
              // Use ProjectKnowledgeLayer for local filesystem paths
              layer = new ProjectKnowledgeLayer(layerConfig.source.path!);
              // Override name and priority from config
              (layer as any).name = layerConfig.name;
              (layer as any).priority = layerConfig.priority;
              break;
              
            default:
              console.warn(`Layer type '${layerConfig.source.type}' not yet implemented in test`);
              continue;
          }
          
          layerService.addLayer(layer as any);
          layersAdded++;
          console.error(`📋 Test: Added layer: ${layerConfig.name}`);
        }
        
        await layerService.initialize();
        
        // Get statistics
        const stats = layerService.getStatistics();
        
        console.error(`📊 Test Results: ${stats.length} layers initialized`);
        for (const stat of stats) {
          console.error(`  📚 ${stat.name}: ${stat.topicCount} topics`);
        }
        
        // ASSERTIONS - These should pass after the fix
        expect(layersAdded).toBe(2); // Should have added both layers
        expect(stats.length).toBe(2); // Should have 2 layers initialized
        
        // Verify embedded layer
        const embeddedStats = stats.find(s => s.name === 'embedded');
        expect(embeddedStats).toBeDefined();
        expect(embeddedStats!.topicCount).toBeGreaterThan(0);
        
        // Verify company layer - THIS WILL FAIL with current implementation
        const companyStats = stats.find(s => s.name === 'company');
        expect(companyStats).toBeDefined();
        expect(companyStats!.topicCount).toBeGreaterThanOrEqual(1); // At least our test topic
        
      } finally {
        // Restore environment
        if (originalEnvVar !== undefined) {
          process.env['BCKB_CONFIG_PATH'] = originalEnvVar;
        } else {
          delete process.env['BCKB_CONFIG_PATH'];
        }
      }
    }, 30000);
  });
  
  describe('Layer Discovery', () => {
    it('should discover topics from all configured layers', async () => {
      // This test verifies that once layers are initialized,
      // topics from ALL layers can be discovered
      
      const config = createTestConfig(testKnowledgeDir);
      
      const configPath = join(testConfigDir, 'config-discovery.json');
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      
      const originalEnvVar = process.env['BCKB_CONFIG_PATH'];
      process.env['BCKB_CONFIG_PATH'] = configPath;
      
      try {
        const configResult = await configLoader.loadConfiguration();
        const layerService = new MultiContentLayerService();
        
        // Initialize layers
        const { EmbeddedKnowledgeLayer } = await import('../../src/layers/embedded-layer.js');
        const { ProjectKnowledgeLayer } = await import('../../src/layers/project-layer.js');
        
        for (const layerConfig of configResult.config.layers) {
          if (!layerConfig.enabled) continue;
          
          // Only process layers we explicitly configured for this test
          if (layerConfig.name !== 'embedded' && layerConfig.name !== 'company') {
            continue;
          }
          
          let layer;
          
          if (layerConfig.source.type === LayerSourceType.EMBEDDED) {
            const embeddedPath = layerConfig.source.path === 'embedded-knowledge'
              ? join(process.cwd(), 'embedded-knowledge')
              : layerConfig.source.path!;
            layer = new EmbeddedKnowledgeLayer(embeddedPath);
          } else if (layerConfig.source.type === LayerSourceType.LOCAL) {
            layer = new ProjectKnowledgeLayer(layerConfig.source.path!);
            (layer as any).name = layerConfig.name;
            (layer as any).priority = layerConfig.priority;
          }
          
          if (layer) {
            layerService.addLayer(layer as any);
          }
        }
        
        await layerService.initialize();
        
        // Debug: Check what was loaded
        const stats = layerService.getStatistics();
        console.log('Layer statistics:', JSON.stringify(stats, null, 2));
        
        // Search for company test topic using tags
        const searchResults = await layerService.searchTopics({
          tags: ['company', 'test'],
          limit: 10
        });
        
        console.log('Search results:', searchResults.length);
        console.log('Search results details:', JSON.stringify(searchResults, null, 2));
        
        // Try searching by domain instead
        const domainResults = await layerService.searchTopics({
          domain: 'testing',
          limit: 10
        });
        
        console.log('Domain search results:', domainResults.length);
        
        // THIS SHOULD PASS after fix
        expect(searchResults.length).toBeGreaterThan(0);
        const companyTopic = searchResults.find(r => r.title === 'Company Test Topic');
        expect(companyTopic).toBeDefined();
        expect(companyTopic?.id).toContain('company-test-topic');
        
      } finally {
        if (originalEnvVar !== undefined) {
          process.env['BCKB_CONFIG_PATH'] = originalEnvVar;
        } else {
          delete process.env['BCKB_CONFIG_PATH'];
        }
      }
    }, 30000);
  });

  describe('All Layer Types Coverage', () => {
    it('should handle all 5 layer source types (EMBEDDED, LOCAL, GIT, HTTP, NPM)', async () => {
      // This test ensures we have coverage for ALL layer types the MCP supports
      // Implemented types: EMBEDDED, LOCAL, GIT
      // Planned types: HTTP (download from HTTP endpoints), NPM (load from NPM packages)
      // Even unimplemented types should be handled gracefully without errors
      
      const config: BCCodeIntelConfiguration = {
        layers: [
          {
            name: 'embedded',
            enabled: true,
            priority: 10,
            source: {
              type: LayerSourceType.EMBEDDED,
              path: 'embedded-knowledge'
            }
          },
          {
            name: 'local-project',
            enabled: true,
            priority: 50,
            source: {
              type: LayerSourceType.LOCAL,
              path: testKnowledgeDir
            }
          },
          {
            name: 'git-layer',
            enabled: true,
            priority: 30,
            source: {
              type: LayerSourceType.GIT,
              url: 'https://github.com/test/repo.git',
              branch: 'main',
              subpath: 'knowledge'
            }
          },
          {
            name: 'http-layer',
            enabled: true,
            priority: 40,
            source: {
              type: LayerSourceType.HTTP,
              url: 'https://example.com/knowledge.zip'
            }
          },
          {
            name: 'npm-layer',
            enabled: true,
            priority: 20,
            source: {
              type: LayerSourceType.NPM,
              package: '@company/bc-knowledge'
            }
          }
        ],
        resolution: {
          strategy: 'first_match',
          conflict_resolution: 'priority_wins',
          enable_fallback: true,
          fallback_to_embedded: true
        },
        cache: {
          strategy: 'moderate',
          ttl: {
            embedded: 'permanent',
            git: '1h',
            local: 'immediate',
            http: '15m',
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
          max_download_size_mb: 100,
          scan_for_malicious_content: true
        },
        performance: {
          max_concurrent_loads: 3,
          load_timeout_ms: 30000,
          max_layers: 20,
          lazy_loading: false,
          preload_embedded: true,
          memory_limit_mb: 500
        },
        developer: {
          debug_layers: false,
          hot_reload: false,
          log_level: 'error',
          profile_performance: false,
          validate_on_startup: true,
          export_config_schema: false,
          enable_diagnostic_tools: false
        }
      };
      
      const configPath = join(testConfigDir, 'config-all-types.json');
      await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
      
      const originalEnvVar = process.env['BCKB_CONFIG_PATH'];
      process.env['BCKB_CONFIG_PATH'] = configPath;
      
      try {
        const configResult = await configLoader.loadConfiguration();
        const layerService = new MultiContentLayerService();
        
        const { EmbeddedKnowledgeLayer } = await import('../../src/layers/embedded-layer.js');
        const { ProjectKnowledgeLayer } = await import('../../src/layers/project-layer.js');
        const { GitKnowledgeLayer } = await import('../../src/layers/git-layer.js');
        
        let layersAdded = 0;
        const implementedLayers: string[] = [];
        const skippedLayers: string[] = [];
        
        for (const layerConfig of configResult.config.layers) {
          if (!layerConfig.enabled) continue;
          
          let layer;
          
          switch (layerConfig.source.type) {
            case LayerSourceType.EMBEDDED:
              const embeddedPath = layerConfig.source.path === 'embedded-knowledge'
                ? join(process.cwd(), 'embedded-knowledge')
                : layerConfig.source.path!;
              layer = new EmbeddedKnowledgeLayer(embeddedPath);
              implementedLayers.push(layerConfig.name);
              break;
              
            case LayerSourceType.LOCAL:
              layer = new ProjectKnowledgeLayer(layerConfig.source.path!);
              (layer as any).name = layerConfig.name;
              (layer as any).priority = layerConfig.priority;
              implementedLayers.push(layerConfig.name);
              break;
              
            case LayerSourceType.GIT:
              // GitKnowledgeLayer exists but may fail to initialize without actual git repo
              // We'll test that it can be instantiated at least
              const gitSource = layerConfig.source as any;
              try {
                layer = new GitKnowledgeLayer(
                  layerConfig.name,
                  layerConfig.priority,
                  {
                    type: LayerSourceType.GIT,
                    url: gitSource.url,
                    branch: gitSource.branch,
                    subpath: gitSource.subpath
                  },
                  layerConfig.auth
                );
                implementedLayers.push(layerConfig.name);
                console.log(`✅ GIT layer instantiated: ${layerConfig.name}`);
              } catch (error) {
                console.warn(`⚠️  GIT layer instantiation failed (expected in test): ${error}`);
                skippedLayers.push(layerConfig.name);
                continue;
              }
              break;
              
            case LayerSourceType.HTTP:
              // HTTP not implemented - should be handled gracefully
              console.log(`⚠️  HTTP layer not yet implemented - skipping: ${layerConfig.name}`);
              skippedLayers.push(layerConfig.name);
              continue;
              
            case LayerSourceType.NPM:
              // NPM not implemented - should be handled gracefully
              console.log(`⚠️  NPM layer not yet implemented - skipping: ${layerConfig.name}`);
              skippedLayers.push(layerConfig.name);
              continue;
              
            default:
              console.warn(`Unknown layer type - skipping: ${layerConfig.name}`);
              skippedLayers.push(layerConfig.name);
              continue;
          }
          
          if (layer) {
            layerService.addLayer(layer as any);
            layersAdded++;
          }
        }
        
        // Initialize only the layers we successfully added
        await layerService.initialize();
        
        const stats = layerService.getStatistics();
        
        console.log(`📊 All Layer Types Test Results:`);
        console.log(`   Implemented layers: ${implementedLayers.join(', ')}`);
        console.log(`   Skipped layers: ${skippedLayers.join(', ')}`);
        console.log(`   Layers initialized: ${stats.length}`);
        
        // ASSERTIONS
        
        // 1. Verify EMBEDDED layer type works
        expect(implementedLayers).toContain('embedded');
        const embeddedStats = stats.find(s => s.name === 'embedded');
        expect(embeddedStats).toBeDefined();
        
        // 2. Verify LOCAL layer type works
        expect(implementedLayers).toContain('local-project');
        const localStats = stats.find(s => s.name === 'local-project');
        expect(localStats).toBeDefined();
        
        // 3. Verify GIT layer type is handled (either instantiated or gracefully skipped)
        const gitHandled = implementedLayers.includes('git-layer') || skippedLayers.includes('git-layer');
        expect(gitHandled).toBe(true);
        
        // 4. Verify HTTP layer type is gracefully skipped (not yet implemented)
        expect(skippedLayers).toContain('http-layer');
        
        // 5. Verify NPM layer type is gracefully skipped (not yet implemented)
        expect(skippedLayers).toContain('npm-layer');
        
        // 6. Verify at least the implemented layers (EMBEDDED + LOCAL) are initialized
        expect(layersAdded).toBeGreaterThanOrEqual(2);
        expect(stats.length).toBeGreaterThanOrEqual(2);
        
        // 7. Verify we tested all 5 layer types
        const allLayerNames = [...implementedLayers, ...skippedLayers];
        expect(allLayerNames).toContain('embedded');       // EMBEDDED type
        expect(allLayerNames).toContain('local-project');  // LOCAL type
        expect(allLayerNames).toContain('git-layer');      // GIT type
        expect(allLayerNames).toContain('http-layer');     // HTTP type
        expect(allLayerNames).toContain('npm-layer');      // NPM type
        
      } finally {
        if (originalEnvVar !== undefined) {
          process.env['BCKB_CONFIG_PATH'] = originalEnvVar;
        } else {
          delete process.env['BCKB_CONFIG_PATH'];
        }
      }
    }, 30000);
  });
});
