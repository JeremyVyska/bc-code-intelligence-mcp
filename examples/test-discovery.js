#!/usr/bin/env node

/**
 * Quick test script for specialist discovery functionality
 */

import { SpecialistDiscoveryService } from '../dist/services/specialist-discovery.js';
import { MultiContentLayerService } from '../dist/services/multi-content-layer-service.js';
import { EmbeddedKnowledgeLayer } from '../dist/layers/embedded-layer.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testDiscovery() {
  console.log('🧪 Testing Specialist Discovery System...\n');

  try {
    // Initialize services
    const layerService = new MultiContentLayerService();
    const embeddedPath = join(__dirname, '..', 'embedded-knowledge');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    layerService.addLayer(embeddedLayer);
    await layerService.initialize();

    const discoveryService = new SpecialistDiscoveryService(layerService);

    // Test queries
    const testQueries = [
      "I have performance issues with my Business Central system",
      "Need help with API design for secure integration",
      "Error handling strategies for table validation",
      "Testing approach for AL code quality",
      "User experience design for custom pages"
    ];

    for (const query of testQueries) {
      console.log(`📝 Query: "${query}"`);
      
      const suggestions = await discoveryService.suggestSpecialists({ query }, 2);
      
      if (suggestions.length > 0) {
        console.log('✅ Suggested specialists:');
        suggestions.forEach((suggestion, index) => {
          console.log(`   ${index + 1}. ${suggestion.specialist.title} (${suggestion.specialist.specialist_id})`);
          console.log(`      Confidence: ${(suggestion.confidence * 100).toFixed(1)}%`);
          if (suggestion.reasons && suggestion.reasons.length > 0) {
            console.log(`      Reasons: ${suggestion.reasons.join(', ')}`);
          }
          if (suggestion.keywords_matched && suggestion.keywords_matched.length > 0) {
            console.log(`      Keywords: ${suggestion.keywords_matched.join(', ')}`);
          }
        });
      } else {
        console.log('❌ No specialists found');
      }
      
      console.log('');
    }

    // Test browsing all specialists
    console.log('📋 All available specialists:');
    const allSpecialists = await layerService.getAllSpecialists();
    allSpecialists.forEach(specialist => {
      console.log(`   • ${specialist.title} (${specialist.specialist_id})`);
      if (specialist.domains && specialist.domains.length > 0) {
        console.log(`     Domains: ${specialist.domains.join(', ')}`);
      }
    });

    console.log('\n✅ Discovery system test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDiscovery().catch(console.error);