/**
 * Test Configuration Loader and Validation System
 * Run with: npm run dev -- --test-config
 */

import { ConfigurationLoader } from './config-loader.js';
import { ConfigurationValidator } from './config-validator.js';
import { LayerSourceType, AuthType } from '../types/index.js';

async function testConfigurationSystem() {
  console.log('🔧 Testing Configuration System...');

  try {
    // 1. Load configuration
    console.log('\n📋 Loading configuration...');
    const configLoader = new ConfigurationLoader();
    const configResult = await configLoader.loadConfiguration();

    console.log(`✅ Configuration loaded from: ${configResult.sources.join(', ')}`);
    console.log(`   Layers: ${configResult.config.layers.length}`);
    console.log(`   Warnings: ${configResult.warnings.length}`);

    if (configResult.warnings.length > 0) {
      console.log('\n⚠️  Configuration Warnings:');
      configResult.warnings.forEach(warning => {
        console.log(`   - ${warning.type}: ${warning.message}`);
      });
    }

    // 2. Validate configuration
    console.log('\n🔍 Validating configuration...');
    const validator = new ConfigurationValidator();
    const validation = await validator.validate(configResult.config);

    console.log(`   Validation result: ${validation.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`   Quality score: ${validation.score}/100`);

    if (validation.errors.length > 0) {
      console.log('\n❌ Validation Errors:');
      validation.errors.forEach(error => {
        console.log(`   - ${error.field}: ${error.message}`);
        if (error.suggestion) {
          console.log(`     💡 Suggestion: ${error.suggestion}`);
        }
      });
    }

    if (validation.warnings.length > 0) {
      console.log('\n⚠️  Validation Warnings:');
      validation.warnings.forEach(warning => {
        console.log(`   - ${warning.type}: ${warning.message}`);
        if (warning.suggestion) {
          console.log(`     💡 Suggestion: ${warning.suggestion}`);
        }
      });
    }

    // 3. Test with enhanced configuration
    console.log('\n🧪 Testing with enhanced configuration...');

    // Add a test git layer if environment var is set
    if (process.env['BCKB_COMPANY_KNOWLEDGE_URL']) {
      configResult.config.layers.push({
        name: 'company-standards',
        priority: 200,
        source: {
          type: LayerSourceType.GIT,
          url: process.env['BCKB_COMPANY_KNOWLEDGE_URL'],
          branch: 'main'
        },
        auth: {
          type: AuthType.TOKEN,
          token: process.env['GITHUB_TOKEN'] || 'test-token'
        },
        enabled: true
      });
      console.log('📦 Added company knowledge layer from environment');
    }

    // Add a local override layer
    configResult.config.layers.push({
      name: 'local-overrides',
      priority: 400,
      source: {
        type: LayerSourceType.LOCAL,
        path: './bckb-overrides'
      },
      enabled: true
    });
    console.log('📁 Added local override layer');

    // 4. Re-validate enhanced configuration
    console.log('\n🔍 Validating enhanced configuration...');
    const enhancedValidation = await validator.validate(configResult.config);

    console.log(`   Enhanced validation: ${enhancedValidation.valid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`   Enhanced quality score: ${enhancedValidation.score}/100`);
    console.log(`   Total layers: ${configResult.config.layers.length}`);

    // 5. Display layer priority order
    console.log('\n📊 Layer Priority Order (lowest to highest):');
    console.log('─'.repeat(60));

    const sortedLayers = [...configResult.config.layers]
      .filter(layer => layer.enabled)
      .sort((a, b) => a.priority - b.priority);

    sortedLayers.forEach((layer, index) => {
      const typeIcon = {
        [LayerSourceType.EMBEDDED]: '📦',
        [LayerSourceType.GIT]: '🌐',
        [LayerSourceType.LOCAL]: '📁',
        [LayerSourceType.HTTP]: '🔗',
        [LayerSourceType.NPM]: '📋'
      }[layer.source.type] || '❓';

      console.log(`   ${index + 1}. ${typeIcon} ${layer.name} (Priority: ${layer.priority})`);
      console.log(`      Type: ${layer.source.type}`);

      if (layer.source.type === LayerSourceType.GIT && 'url' in layer.source) {
        console.log(`      URL: ${layer.source.url}`);
      } else if (layer.source.type === LayerSourceType.LOCAL && 'path' in layer.source) {
        console.log(`      Path: ${layer.source.path}`);
      } else if (layer.source.type === LayerSourceType.EMBEDDED && 'path' in layer.source) {
        console.log(`      Path: ${layer.source.path || 'default'}`);
      }

      if (layer.auth) {
        console.log(`      Auth: ${layer.auth.type}`);
      }
      console.log();
    });

    // 6. Configuration diagnostics
    console.log('🔧 Configuration Diagnostics:');
    console.log(`   Cache settings: ${JSON.stringify(configResult.config.cache.ttl, null, 2)}`);
    console.log(`   Performance limits: ${configResult.config.performance.max_layers} layers, ${configResult.config.performance.max_concurrent_loads} concurrent`);
    console.log(`   Security: Sources validation ${configResult.config.security.validate_sources ? 'enabled' : 'disabled'}`);
    console.log(`   Developer mode: Debug ${configResult.config.developer.debug_layers ? 'ON' : 'OFF'}, Hot reload ${configResult.config.developer.hot_reload ? 'ON' : 'OFF'}`);

    console.log('\n✅ Configuration system test completed successfully!');
    return { configResult, validation: enhancedValidation };

  } catch (error) {
    console.error('❌ Configuration system test failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Export for use in other tests
export { testConfigurationSystem };

// Run if called directly
if (process.argv.includes('--test-config')) {
  testConfigurationSystem().catch(console.error);
}