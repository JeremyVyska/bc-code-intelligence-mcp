#!/usr/bin/env node

/**
 * Simplified test for enhanced prompt service functionality
 */

import { SpecialistDiscoveryService } from '../dist/services/specialist-discovery.js';
import { MultiContentLayerService } from '../dist/services/multi-content-layer-service.js';
import { EmbeddedKnowledgeLayer } from '../dist/layers/embedded-layer.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testPromptEnhancement() {
  console.log('🎯 Testing Prompt Enhancement with Specialist Routing...\n');

  try {
    // Initialize minimal services needed
    const layerService = new MultiContentLayerService();
    const embeddedPath = join(__dirname, '..', 'embedded-knowledge');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    layerService.addLayer(embeddedLayer);
    await layerService.initialize();

    const discoveryService = new SpecialistDiscoveryService(layerService);

    // Test enhancement logic directly
    const testScenarios = [
      {
        workflowType: 'workflow_performance_analysis',
        userContext: 'My Business Central reports are loading slowly',
        description: 'Performance Analysis'
      },
      {
        workflowType: 'workflow_security_audit', 
        userContext: 'Need to secure our BC application before production',
        description: 'Security Audit'
      },
      {
        workflowType: 'workflow_testing_strategy',
        userContext: 'Setting up testing for AL extensions',
        description: 'Testing Strategy'
      }
    ];

    for (const scenario of testScenarios) {
      console.log(`\n📋 **${scenario.description}**`);
      console.log(`Context: "${scenario.userContext}"`);
      console.log('─'.repeat(70));

      // Get specialist suggestions directly
      const suggestions = await discoveryService.suggestSpecialists({
        query: `${scenario.workflowType} ${scenario.userContext}`,
        current_domain: extractDomainFromWorkflow(scenario.workflowType)
      }, 2);

      console.log('\n🎯 **Recommended Specialists:**');
      
      if (suggestions.length > 0) {
        suggestions.forEach((suggestion, index) => {
          const emoji = getSpecialistEmoji(suggestion.specialist.specialist_id);
          console.log(`**${index + 1}. ${emoji} ${suggestion.specialist.title}** (${Math.round(suggestion.confidence * 100)}% match)`);
          console.log(`   💡 **Why:** ${suggestion.reasons.join(', ') || 'Good match for this workflow'}`);
          console.log(`   💬 **Try asking:** "${generateExampleQuery(suggestion.specialist, scenario.workflowType)}"`);
          console.log(`   🎯 **Start session:** \`suggest_specialist ${suggestion.specialist.specialist_id}\`\n`);
        });

        console.log('### 🚀 How to Proceed\n');
        console.log('1. **For targeted expertise:** Use `suggest_specialist [specialist-id]` to start a focused session');
        console.log('2. **For systematic approach:** Continue with the workflow using `advance_workflow`');
        console.log('3. **For exploration:** Ask "discover specialists for [your specific question]"');
      } else {
        console.log('No specific specialist suggestions found. Try Casey Copilot for general guidance!');
      }

      console.log('\n' + '═'.repeat(70));
    }

    console.log('\n✅ Prompt enhancement test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Helper functions
function extractDomainFromWorkflow(workflowType) {
  const domainMap = {
    'workflow_performance_analysis': 'performance',
    'workflow_security_audit': 'security',
    'workflow_testing_strategy': 'testing',
    'workflow_architecture_review': 'architecture',
    'workflow_integration_design': 'api-design'
  };
  return domainMap[workflowType] || 'general';
}

function getSpecialistEmoji(specialistId) {
  const emojiMap = {
    'dean-debug': '🔍',
    'eva-errors': '⚠️',
    'alex-architect': '🏗️',
    'sam-coder': '💻',
    'quinn-tester': '🧪',
    'seth-security': '🔒',
    'uma-ux': '🎨',
    'jordan-bridge': '🌉',
    'logan-legacy': '🏛️',
    'roger-reviewer': '📝',
    'maya-mentor': '👩‍🏫',
    'taylor-docs': '📚',
    'casey-copilot': '🤖',
    'morgan-market': '🏪'
  };
  return emojiMap[specialistId] || '👤';
}

function generateExampleQuery(specialist, workflowType) {
  const workflowContext = getWorkflowContext(workflowType);
  const examples = {
    'dean-debug': `Help me analyze ${workflowContext} performance bottlenecks`,
    'eva-errors': `Review ${workflowContext} error handling patterns`,
    'alex-architect': `Design architecture for ${workflowContext}`,
    'sam-coder': `Implement best practices for ${workflowContext}`,
    'quinn-tester': `Create testing strategy for ${workflowContext}`,
    'seth-security': `Secure ${workflowContext} implementation`,
    'uma-ux': `Improve user experience in ${workflowContext}`,
    'jordan-bridge': `Design integrations for ${workflowContext}`,
    'logan-legacy': `Modernize legacy code in ${workflowContext}`,
    'roger-reviewer': `Review code quality in ${workflowContext}`,
    'maya-mentor': `Learn best practices for ${workflowContext}`,
    'taylor-docs': `Document ${workflowContext} solution`,
    'casey-copilot': `Get AI assistance with ${workflowContext}`,
    'morgan-market': `Prepare ${workflowContext} for AppSource`
  };
  return examples[specialist.specialist_id] || `Help me with ${workflowContext}`;
}

function getWorkflowContext(workflowType) {
  const contextMap = {
    'workflow_performance_analysis': 'performance analysis',
    'workflow_security_audit': 'security audit',
    'workflow_testing_strategy': 'testing strategy',
    'workflow_architecture_review': 'architecture review',
    'workflow_integration_design': 'integration design'
  };
  return contextMap[workflowType] || 'this workflow';
}

testPromptEnhancement().catch(console.error);