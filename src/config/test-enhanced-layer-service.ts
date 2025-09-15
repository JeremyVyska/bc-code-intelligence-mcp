/**
 * Test Enhanced Layer Service with Configuration System
 * Run with: npm run dev -- --test-enhanced-layers
 */

import { ConfigurationLoader } from './config-loader.js';
import { LayerService } from '../layers/layer-service.js';
import { LayerSourceType, AuthType } from '../types/index.js';

async function testEnhancedLayerService(): Promise<void> {
  console.log('🔧 Testing Enhanced Layer Service...');

  try {
    // 1. Load configuration
    console.log('📋 Loading configuration...');
    const configLoader = new ConfigurationLoader();
    const configResult = await configLoader.loadConfiguration();

    if (configResult.validation_errors.length > 0) {
      console.error('❌ Configuration validation errors:');
      configResult.validation_errors.forEach(error => {
        console.error(`   - ${error.field}: ${error.message}`);
      });
      return;
    }

    console.log(`✅ Configuration loaded with ${configResult.config.layers.length} layers`);

    // 2. Add a git layer for testing (if not in environment)
    if (!process.env['BCKB_COMPANY_KNOWLEDGE_URL']) {
      configResult.config.layers.push({
        name: 'test-git-layer',
        priority: 50,
        source: {
          type: LayerSourceType.GIT,
          url: 'https://github.com/microsoft/vscode-docs',
          branch: 'main',
          subpath: 'docs'
        },
        enabled: true
      });
      console.log('📦 Added test git layer for demonstration');
    }

    // 3. Create enhanced layer service
    console.log('🏗️  Creating enhanced layer service...');
    const layerService = new LayerService();

    // 4. Initialize from configuration
    console.log('🔄 Initializing layers from configuration...');
    const initResults = await layerService.initializeFromConfiguration(configResult.config);

    console.log('\n📋 Layer Initialization Results:');
    console.log('─'.repeat(60));

    let totalTopics = 0;
    let successfulLayers = 0;

    for (const result of initResults) {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.layer_name}:`);
      console.log(`   Type: ${result.source_info.type}`);
      console.log(`   Location: ${result.source_info.location}`);
      console.log(`   Topics: ${result.topics_loaded}`);
      console.log(`   Load time: ${result.load_time_ms}ms`);

      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }

      if (result.success) {
        totalTopics += result.topics_loaded;
        successfulLayers++;
      }
      console.log();
    }

    console.log('📊 Summary:');
    console.log(`   Successful layers: ${successfulLayers}/${initResults.length}`);
    console.log(`   Total topics loaded: ${totalTopics}`);

    // 5. Test topic resolution
    if (successfulLayers > 0) {
      console.log('\n🔍 Testing topic resolution...');

      // Test getting a topic
      const testTopic = await layerService.resolveTopic('performance/sift-optimization');
      if (testTopic) {
        console.log(`✅ Resolved topic: ${testTopic.topic.id}`);
        console.log(`   Source layer: ${testTopic.sourceLayer}`);
        console.log(`   Is override: ${testTopic.isOverride}`);
      } else {
        console.log('ℹ️  No SIFT optimization topic found (expected for test setup)');
      }

      // Test search functionality
      const searchResults = await layerService.searchTopics({
        domain: 'performance',
        limit: 3
      });

      console.log(`\n🔎 Search results for performance domain (${searchResults.length}):`);
      searchResults.slice(0, 3).forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.id}: ${result.title}`);
        console.log(`      Relevance: ${result.relevance_score?.toFixed(2) || 'N/A'}`);
      });
    }

    console.log('\n✅ Enhanced layer service test completed successfully!');
    

  } catch (error) {
    console.error('❌ Enhanced layer service test failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Export for use in other tests
export { testEnhancedLayerService };

// Run if called directly
if (process.argv.includes('--test-enhanced-layers')) {
  testEnhancedLayerService().catch(console.error);
}