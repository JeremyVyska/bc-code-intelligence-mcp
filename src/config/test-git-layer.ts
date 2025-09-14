/**
 * Test the Git Knowledge Layer with configuration system
 * Run with: npm run dev -- --test-git
 */

import { ConfigurationLoader } from './config-loader.js';
import { GitKnowledgeLayer } from '../layers/git-layer.js';
import { LayerSourceType, AuthType } from '../types/index.js';

async function testGitLayer() {
  console.log('🔧 Testing Git Knowledge Layer...');

  // Create a test git layer configuration
  const gitConfig = {
    name: 'test-git',
    priority: 50,
    source: {
      type: LayerSourceType.GIT as LayerSourceType.GIT,
      url: 'https://github.com/microsoft/AL-Go',
      branch: 'main',
      subpath: 'Templates'
    },
    enabled: true
  };

  console.log(`📦 Testing Git layer: ${gitConfig.source.url}`);

  try {
    // Create git layer
    const gitLayer = new GitKnowledgeLayer(
      'test-git',
      50,
      gitConfig.source,
      undefined, // No auth for public repo
      '.bckb-cache-test'
    );

    console.log('🔄 Initializing Git layer...');

    // Initialize (this will clone/pull the repo)
    const result = await gitLayer.initialize();

    console.log('📋 Git Layer Result:');
    console.log('─'.repeat(50));
    console.log(`   Success: ${result.success}`);
    console.log(`   Topics loaded: ${result.topicsLoaded}`);
    console.log(`   Indexes loaded: ${result.indexesLoaded}`);
    console.log(`   Load time: ${result.loadTimeMs}ms`);

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    // Show source info
    const sourceInfo = gitLayer.getSourceInfo();
    console.log('\n📁 Source Information:');
    console.log(`   Type: ${sourceInfo.type}`);
    console.log(`   URL: ${sourceInfo.url}`);
    console.log(`   Branch: ${sourceInfo.branch}`);
    console.log(`   Local path: ${sourceInfo.localPath}`);
    console.log(`   Has auth: ${sourceInfo.hasAuth}`);

    // Show some topics if loaded
    console.log(`\n📚 Topics loaded: ${result.topicsLoaded}`);
    if (result.topicsLoaded > 0) {
      console.log('   (Topics are loaded but getAllTopics method needs to be added to git layer)');
    } else {
      console.log('   (No markdown topics found - AL-Go repo contains mostly templates)');
    }

    console.log('\n✅ Git layer test completed!');
    return result;

  } catch (error) {
    console.error('❌ Git layer test failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Export for use in other tests
export { testGitLayer };

// Run if called directly
if (process.argv.includes('--test-git')) {
  testGitLayer().catch(console.error);
}