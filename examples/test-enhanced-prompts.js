#!/usr/bin/env node

/**
 * Test script for enhanced prompts with specialist routing
 */

import { EnhancedPromptService } from '../dist/services/enhanced-prompt-service.js';
import { SpecialistDiscoveryService } from '../dist/services/specialist-discovery.js';
import { SpecialistSessionManager } from '../dist/services/specialist-session-manager.js';
import { WorkflowService } from '../dist/services/workflow-service.js';
import { MultiContentLayerService } from '../dist/services/multi-content-layer-service.js';
import { EmbeddedKnowledgeLayer } from '../dist/layers/embedded-layer.js';
import { KnowledgeService } from '../dist/services/knowledge-service.js';
import { MethodologyService } from '../dist/services/methodology-service.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testEnhancedPrompts() {
  console.log('🎯 Testing Enhanced Prompts with Specialist Routing...\n');

  try {
    // Initialize services
    const layerService = new MultiContentLayerService();
    const embeddedPath = join(__dirname, '..', 'embedded-knowledge');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    layerService.addLayer(embeddedLayer);
    await layerService.initialize();

    // Initialize other required services
    const knowledgeService = new KnowledgeService(layerService);
    const methodologyService = new MethodologyService(layerService);
    
    // Get session storage config (simplified for test)
    const sessionStorageConfig = { 
      type: 'memory',
      enabled: true
    };
    
    const sessionManager = new SpecialistSessionManager(layerService, sessionStorageConfig);
    const discoveryService = new SpecialistDiscoveryService(layerService);
    
    // Initialize workflow service with persona registry
    const { PersonaRegistry } = await import('../dist/types/persona-types.js');
    const personaRegistry = PersonaRegistry.getInstance();
    const workflowService = new WorkflowService(knowledgeService, methodologyService, personaRegistry);

    const enhancedPromptService = new EnhancedPromptService(
      discoveryService,
      sessionManager,
      workflowService
    );

    // Test different workflow scenarios
    const testScenarios = [
      {
        workflowType: 'workflow_performance_analysis',
        userContext: 'My Business Central reports are loading slowly and users are complaining',
        description: 'Performance Analysis Workflow'
      },
      {
        workflowType: 'workflow_security_audit',
        userContext: 'Need to review our BC application security before production deployment',
        description: 'Security Audit Workflow'
      },
      {
        workflowType: 'workflow_testing_strategy',
        userContext: 'Setting up comprehensive testing for new AL extensions',
        description: 'Testing Strategy Workflow'
      },
      {
        workflowType: 'workflow_architecture_review',
        userContext: 'Large BC customization with multiple integrations needs review',
        description: 'Architecture Review Workflow'
      }
    ];

    for (const scenario of testScenarios) {
      console.log(`\n📋 **${scenario.description}**`);
      console.log(`Context: "${scenario.userContext}"`);
      console.log('─'.repeat(80));

      // Simulate basic workflow guidance (normally from WorkflowService)
      const mockGuidance = `# ${scenario.description}

Welcome to the ${scenario.description.toLowerCase()} workflow! This systematic approach will help you achieve optimal results.

## Phase 1: Analysis
- Gather requirements and understand current state
- Identify key areas for improvement
- Document findings and recommendations

## Phase 2: Planning
- Create detailed implementation plan
- Define success criteria and metrics
- Establish timeline and milestones

## Phase 3: Implementation
- Execute planned changes systematically
- Monitor progress and adjust as needed
- Validate results against success criteria

Let's begin with the analysis phase...`;

      const enhanced = await enhancedPromptService.enhanceWorkflowPrompt(
        scenario.workflowType,
        scenario.userContext,
        mockGuidance
      );

      console.log('\n🎯 **Enhanced Content:**');
      console.log(enhanced.enhancedContent);
      
      console.log('\n🚀 **Routing Options:**');
      enhanced.routingOptions.forEach((option, index) => {
        console.log(`   ${index + 1}. ${option}`);
      });

      if (enhanced.specialistSuggestions && enhanced.specialistSuggestions.length > 0) {
        console.log('\n👥 **Specialist Suggestions:**');
        enhanced.specialistSuggestions.forEach(suggestion => {
          console.log(`   • ${suggestion.title} (${suggestion.confidence}% match)`);
          console.log(`     Reason: ${suggestion.reason}`);
        });
      }

      console.log('\n' + '═'.repeat(80));
    }

    console.log('\n✅ Enhanced prompts test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testEnhancedPrompts().catch(console.error);