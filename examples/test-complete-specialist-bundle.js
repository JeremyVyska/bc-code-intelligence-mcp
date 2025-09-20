#!/usr/bin/env node

/**
 * Complete Specialist Bundle Integration Test
 * 
 * Demonstrates the full agent-driven specialist experience:
 * 1. Agent onboarding and specialist discovery
 * 2. Smart specialist routing and engagement
 * 3. Seamless handoffs with context preservation
 * 4. Multi-specialist collaboration workflows
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MultiContentLayerService } from '../dist/services/multi-content-layer-service.js';
import { SpecialistSessionManager } from '../dist/services/specialist-session-manager.js';
import { SpecialistDiscoveryService } from '../dist/services/specialist-discovery.js';
import { SpecialistHandoffService } from '../dist/services/specialist-handoff-service.js';
import { AgentOnboardingService } from '../dist/services/agent-onboarding-service.js';
import { SpecialistTools } from '../dist/tools/specialist-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function demonstrateSpecialistBundle() {
  console.log('🎯 BC Specialist Bundle - Complete Integration Demo\n');

  try {
    // Initialize core services
    console.log('⚙️ Initializing services...');
    const multiContentLayerService = new MultiContentLayerService();
    
    // Add embedded layer
    const embeddedPath = join(__dirname, '../embedded-knowledge');
    const { EmbeddedKnowledgeLayer } = await import('../dist/layers/embedded-layer.js');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    multiContentLayerService.addLayer(embeddedLayer);
    await multiContentLayerService.initialize();
    
    const sessionManager = new SpecialistSessionManager(multiContentLayerService);
    const discoveryService = new SpecialistDiscoveryService(multiContentLayerService);
    const handoffService = new SpecialistHandoffService(sessionManager, discoveryService, multiContentLayerService);
    const onboardingService = new AgentOnboardingService(discoveryService, multiContentLayerService);

    console.log('✅ All services initialized\n');

    // === PHASE 1: AGENT ONBOARDING ===
    console.log('🤖 === PHASE 1: AGENT ONBOARDING ===');
    console.log('Agent discovers the BC specialist team...\n');

    const onboardingRequest = {
      params: {
        name: 'introduce_bc_specialists',
        arguments: {
          context: 'Business Central AL development',
          focus_areas: ['performance', 'security', 'testing', 'architecture']
        }
      }
    };

    const onboardingResult = await onboardingService.handleToolCall(onboardingRequest);
    console.log('Agent Onboarding Result:');
    console.log(onboardingResult.content[0].text);
    console.log('\n' + '='.repeat(80) + '\n');

    // === PHASE 2: SMART DISCOVERY ===
    console.log('🔍 === PHASE 2: SMART SPECIALIST DISCOVERY ===');
    console.log('Agent analyzes user problem and discovers appropriate specialists...\n');

    const discoveryRequest = {
      params: {
        name: 'discover_specialists',
        arguments: {
          query: 'My Business Central extension has performance issues. Database queries are slow and users are complaining about response times. I need help optimizing AL code.',
          include_reasoning: true,
          max_suggestions: 3
        }
      }
    };

    const { SpecialistDiscoveryTools } = await import('../dist/tools/specialist-discovery-tools.js');
    const discoveryTools = new SpecialistDiscoveryTools(discoveryService, sessionManager, multiContentLayerService);
    
    const discoveryResult = await discoveryTools.handleToolCall(discoveryRequest);
    console.log('Specialist Discovery Result:');
    console.log(discoveryResult.content[0].text);
    console.log('\n' + '='.repeat(80) + '\n');

    // === PHASE 3: SPECIALIST ENGAGEMENT ===
    console.log('👨‍💻 === PHASE 3: SPECIALIST ENGAGEMENT ===');
    console.log('Agent engages with Dean Debug for performance troubleshooting...\n');

    // Create a session manually for this demo
    const session = await sessionManager.startSession(
      'dean-debug',
      'test-user',
      'My AL extension has performance issues. Database queries are taking too long and users are experiencing slow response times.'
    );

    console.log(`📝 Started session: ${session.sessionId} with ${session.specialistId}`);
    console.log('🔍 Dean Debug is now analyzing your performance issues...');

    // Get the session ID for handoff service
    handoffService.setCurrentSession(session.sessionId);

    // Simulate work completion
    await sessionManager.updateContext(session.sessionId, {
      solutions: [
        'Identified N+1 query patterns in customer lookup',
        'Added SetLoadFields optimization for large tables',
        'Implemented caching for frequently accessed data'
      ],
      recommendations: [
        'Use batch operations for bulk data processing',
        'Consider table extension optimization patterns',
        'Implement proper indexing strategies'
      ],
      nextSteps: [
        'Architectural review of data access patterns',
        'Security review of caching implementation',
        'Performance testing validation'
      ]
    });

    console.log('\n' + '='.repeat(80) + '\n');

    // === PHASE 4: SEAMLESS HANDOFF ===
    console.log('🔄 === PHASE 4: SEAMLESS SPECIALIST HANDOFF ===');
    console.log('Performance work complete - handing off to Alex Architect for design review...\n');

    const handoffRequest = {
      params: {
        name: 'handoff_to_specialist',
        arguments: {
          target_specialist_id: 'alex-architect',
          handoff_type: 'transfer',
          handoff_reason: 'Performance optimizations complete. Need architectural review to ensure scalable design and identify systemic improvements.',
          problem_summary: 'AL extension performance issues resolved at code level, but requires architectural analysis for long-term scalability',
          work_completed: [
            'Identified and fixed N+1 query patterns',
            'Implemented SetLoadFields optimization',
            'Added intelligent caching layer',
            'Optimized database access patterns'
          ],
          current_challenges: [
            'Need to ensure changes align with overall system architecture',
            'Verify scalability for larger datasets',
            'Validate against BC best practices'
          ],
          continuation_points: [
            'Review data access architecture patterns',
            'Design scalable caching strategy',
            'Evaluate table extension design',
            'Plan for future performance monitoring'
          ]
        }
      }
    };

    const handoffResult = await handoffService.handleToolCall(handoffRequest);
    console.log('Specialist Handoff Result:');
    console.log(handoffResult.content[0].text);
    console.log('\n' + '='.repeat(80) + '\n');

    // === PHASE 5: COLLABORATION ===
    console.log('🤝 === PHASE 5: MULTI-SPECIALIST COLLABORATION ===');
    console.log('Bringing in Seth Security for security review of performance changes...\n');

    const collaborationRequest = {
      params: {
        name: 'bring_in_specialist',
        arguments: {
          specialist_id: 'seth-security',
          consultation_reason: 'Security review required for performance optimization changes, particularly caching implementation',
          specific_question: 'Are the new caching mechanisms secure? Could they expose sensitive customer data or create permission bypass vulnerabilities?',
          current_context: 'Implemented caching layer and optimized database queries for performance. Need to ensure security compliance.',
          collaboration_type: 'review'
        }
      }
    };

    const collaborationResult = await handoffService.handleToolCall(collaborationRequest);
    console.log('Collaboration Request Result:');
    console.log(collaborationResult.content[0].text);
    console.log('\n' + '='.repeat(80) + '\n');

    // === PHASE 6: SESSION SUMMARY ===
    console.log('📋 === PHASE 6: SESSION SUMMARY & ANALYTICS ===');
    console.log('Getting complete handoff summary and session analytics...\n');

    const summaryRequest = {
      params: {
        name: 'get_handoff_summary',
        arguments: {
          include_recommendations: true
        }
      }
    };

    const summaryResult = await handoffService.handleToolCall(summaryRequest);
    console.log('Session Summary:');
    console.log(summaryResult.content[0].text);
    console.log('\n' + '='.repeat(80) + '\n');

    // === PHASE 7: NEXT SPECIALIST SUGGESTION ===
    console.log('🎯 === PHASE 7: INTELLIGENT NEXT STEPS ===');
    console.log('Agent gets suggestions for next specialist in workflow...\n');

    const nextSpecialistRequest = {
      params: {
        name: 'suggest_next_specialist',
        arguments: {
          current_work: 'Completed performance optimization and architectural review, security review in progress',
          context: 'Business Central extension development - performance, architecture, and security addressed',
          work_stage: 'optimization-complete'
        }
      }
    };

    const nextSpecialistResult = await onboardingService.handleToolCall(nextSpecialistRequest);
    console.log('Next Specialist Suggestions:');
    console.log(nextSpecialistResult.content[0].text);

    console.log('\n' + '🎉'.repeat(20));
    console.log('🎯 SPECIALIST BUNDLE INTEGRATION DEMO COMPLETE');
    console.log('🎉'.repeat(20) + '\n');

    console.log('✨ Key Features Demonstrated:');
    console.log('   🤖 Agent-friendly onboarding and specialist discovery');
    console.log('   🔍 Intelligent routing based on problem analysis');
    console.log('   👨‍💻 Contextual specialist engagement');
    console.log('   🔄 Seamless handoffs with complete context preservation');
    console.log('   🤝 Multi-specialist collaboration workflows');
    console.log('   📋 Comprehensive session tracking and analytics');
    console.log('   🎯 Intelligent next-step recommendations');
    console.log('\n💡 The BC Specialist Bundle provides a complete, agent-driven');
    console.log('   expert consultation experience for Business Central development!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the complete integration demo
demonstrateSpecialistBundle().catch(console.error);