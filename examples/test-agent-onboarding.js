#!/usr/bin/env node

/**
 * Test Agent Onboarding System
 * 
 * Demonstrates how coding agents will naturally discover and introduce BC specialists
 */

import { AgentOnboardingService } from '../dist/services/agent-onboarding-service.js';
import { SpecialistDiscoveryService } from '../dist/services/specialist-discovery.js';
import { MultiContentLayerService } from '../dist/services/multi-content-layer-service.js';
import { EmbeddedKnowledgeLayer } from '../dist/layers/embedded-layer.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testAgentOnboarding() {
  console.log('🤖 Testing Agent Onboarding System...\n');
  console.log('Simulating how different coding agents will discover BC specialists\n');

  try {
    // Initialize services
    const layerService = new MultiContentLayerService();
    const embeddedPath = join(__dirname, '..', 'embedded-knowledge');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    layerService.addLayer(embeddedLayer);
    await layerService.initialize();

    const discoveryService = new SpecialistDiscoveryService(layerService);
    const onboardingService = new AgentOnboardingService(discoveryService, layerService);

    // Test scenarios that agents would encounter
    const agentScenarios = [
      {
        title: "GitHub Copilot - User has AL file open",
        conversation_context: "User is working on a Business Central AL extension with performance issues in report generation",
        specific_problem: "Reports taking 30+ seconds to load",
        description: "Agent detects .al files and BC context"
      },
      {
        title: "Claude - User asks BC security question", 
        conversation_context: "User needs to secure their Business Central API endpoints before production deployment",
        specific_problem: "Configuring proper authentication and authorization",
        description: "Agent recognizes security + BC context"
      },
      {
        title: "ChatGPT - User mentions BC testing",
        conversation_context: "User wants to set up comprehensive testing for AL extensions and customizations",
        specific_problem: "No current testing strategy in place",
        description: "Agent identifies testing + AL development context"
      },
      {
        title: "Any Agent - User working on BC integration",
        conversation_context: "User is building integrations between Business Central and external systems using APIs",
        specific_problem: "Complex data synchronization requirements",
        description: "Agent sees integration + BC keywords"
      }
    ];

    for (const scenario of agentScenarios) {
      console.log(`\n🎯 **${scenario.title}**`);
      console.log(`Scenario: ${scenario.description}`);
      console.log(`Context: "${scenario.conversation_context}"`);
      console.log('─'.repeat(80));

      // Simulate agent calling introduce_bc_specialists
      const request = {
        params: {
          name: 'introduce_bc_specialists',
          arguments: {
            conversation_context: scenario.conversation_context,
            specific_problem: scenario.specific_problem,
            user_expertise_level: 'intermediate'
          }
        }
      };

      const result = await onboardingService.handleToolCall(request);
      
      console.log('\n📤 **Agent receives this guidance:**');
      console.log(result.content[0].text);
      console.log('\n' + '═'.repeat(80));
    }

    // Test specific specialist introduction
    console.log('\n\n🎭 **Testing Specific Specialist Introduction**');
    console.log('Agent wants to introduce Dean Debug specifically...\n');

    const introRequest = {
      params: {
        name: 'get_specialist_introduction',
        arguments: {
          specialist_id: 'dean-debug',
          conversation_context: 'User has slow BC reports and needs performance optimization',
          include_handoff_phrase: true
        }
      }
    };

    const introResult = await onboardingService.handleToolCall(introRequest);
    console.log('📤 **Agent gets ready-to-use introduction:**');
    console.log(introResult.content[0].text);

    console.log('\n\n✅ Agent onboarding system test completed!');
    console.log('\n🎯 **Key Benefits for Agents:**');
    console.log('• Automatic detection of when BC specialists are needed');
    console.log('• Natural conversation flow for introducing specialists');
    console.log('• Ready-to-use content that agents can present directly');
    console.log('• Clear guidance on which specialist to choose');
    console.log('• Smooth handoff mechanisms to specialist sessions');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testAgentOnboarding().catch(console.error);