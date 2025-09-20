#!/usr/bin/env node

/**
 * Test Script for Specialist Handoff Service
 * 
 * Validates seamless specialist transitions and context preservation
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MultiContentLayerService } from '../dist/services/multi-content-layer-service.js';
import { SpecialistSessionManager } from '../dist/services/specialist-session-manager.js';
import { SpecialistDiscoveryService } from '../dist/services/specialist-discovery.js';
import { SpecialistHandoffService } from '../dist/services/specialist-handoff-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testHandoffService() {
  console.log('🔄 Testing Specialist Handoff Service...\n');

  try {
    // Initialize services
    const multiContentLayerService = new MultiContentLayerService();
    
    // Add embedded layer
    const embeddedPath = join(__dirname, '../embedded-knowledge');
    const { EmbeddedKnowledgeLayer } = await import('../dist/layers/embedded-layer.js');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    multiContentLayerService.addLayer(embeddedLayer);
    await multiContentLayerService.initialize();
    
    const sessionManager = new SpecialistSessionManager(multiContentLayerService);
    const discoveryService = new SpecialistDiscoveryService(multiContentLayerService);
    const handoffService = new SpecialistHandoffService(
      sessionManager,
      discoveryService,
      multiContentLayerService
    );

    console.log('✅ Services initialized\n');

    // Create test session
    const session = await sessionManager.startSession(
      'dean-debug',
      'test-user',
      'I have a performance issue with my Business Central code'
    );
    
    console.log(`📝 Started session: ${session.sessionId} with ${session.specialistId}`);
    
    // Set current session for handoff service
    handoffService.setCurrentSession(session.sessionId);
    
    // Add some work to the session
    await sessionManager.updateContext(session.sessionId, {
      solutions: ['Added caching to reduce database calls'],
      recommendations: ['Use SetLoadFields for better performance', 'Consider table extension optimization'],
      nextSteps: ['Implement batch processing', 'Add performance monitoring']
    });

    // Test 1: Transfer handoff
    console.log('\n🔄 Test 1: Transfer handoff to Alex Architect...');
    const transferRequest = {
      params: {
        name: 'handoff_to_specialist',
        arguments: {
          target_specialist_id: 'alex-architect',
          handoff_type: 'transfer',
          handoff_reason: 'Performance issue requires architectural review and design recommendations',
          problem_summary: 'AL code has performance bottlenecks in database queries and table operations',
          work_completed: [
            'Identified slow queries using AL profiler',
            'Added SetLoadFields optimization',
            'Implemented basic caching strategy'
          ],
          current_challenges: [
            'Complex table relationships causing N+1 queries',
            'Memory usage growing with large datasets'
          ],
          continuation_points: [
            'Review overall data architecture',
            'Design scalable caching strategy',
            'Optimize table extension patterns'
          ]
        }
      }
    };

    const transferResult = await handoffService.handleToolCall(transferRequest);
    console.log('Transfer Result:', transferResult.content[0].text);

    // Test 2: Collaboration handoff
    console.log('\n🤝 Test 2: Bring in Seth Security for consultation...');
    const consultationRequest = {
      params: {
        name: 'bring_in_specialist',
        arguments: {
          specialist_id: 'seth-security',
          consultation_reason: 'Need security review of performance optimization changes',
          specific_question: 'Are the new caching mechanisms exposing any sensitive data or creating security vulnerabilities?',
          current_context: 'Implemented caching for AL queries and table operations to improve performance',
          collaboration_type: 'review'
        }
      }
    };

    const consultationResult = await handoffService.handleToolCall(consultationRequest);
    console.log('Consultation Result:', consultationResult.content[0].text);

    // Test 3: Get handoff summary
    console.log('\n📋 Test 3: Get handoff summary...');
    const summaryRequest = {
      params: {
        name: 'get_handoff_summary',
        arguments: {
          include_recommendations: true
        }
      }
    };

    const summaryResult = await handoffService.handleToolCall(summaryRequest);
    console.log('Summary Result:', summaryResult.content[0].text);

    // Test 4: Error handling - invalid specialist
    console.log('\n❌ Test 4: Error handling - invalid specialist...');
    const errorRequest = {
      params: {
        name: 'handoff_to_specialist',
        arguments: {
          target_specialist_id: 'invalid-specialist',
          handoff_type: 'transfer',
          handoff_reason: 'Test error handling',
          problem_summary: 'Test problem',
          work_completed: ['Test work']
        }
      }
    };

    const errorResult = await handoffService.handleToolCall(errorRequest);
    console.log('Error Result:', errorResult.content[0].text);
    console.log('Is Error:', errorResult.isError);

    console.log('\n🎉 All handoff service tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testHandoffService().catch(console.error);