/**
 * Real Knowledge Validation Tests
 * 
 * Tests for Issue #16: Cannot read properties of undefined (reading 'includes')
 * https://github.com/JeremyVyska/bc-code-intelligence-mcp/issues/16
 * 
 * These tests validate that the MCP server tools return REAL answers from the
 * knowledge base, not just mock responses. Tests load actual specialists and
 * topics from embedded-knowledge and validate proper responses.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';
import { SpecialistDiscoveryService } from '../../src/services/specialist-discovery.js';
import { KnowledgeService } from '../../src/services/knowledge-service.js';
import { BCKBConfig } from '../../src/types/bc-knowledge.js';

describe('Real Knowledge Validation - Issue #16', () => {
  let layerService: MultiContentLayerService;
  let discoveryService: SpecialistDiscoveryService;
  let knowledgeService: KnowledgeService;
  
  beforeAll(async () => {
    // Use the REAL embedded-knowledge submodule
    const embeddedKnowledgePath = resolve(__dirname, '../../embedded-knowledge');
    
    const config: BCKBConfig = {
      knowledge_base_path: embeddedKnowledgePath,
      indexes_path: resolve(embeddedKnowledgePath, 'indexes'),
      cache_size: 1000,
      max_search_results: 50,
      default_bc_version: 'BC22',
      enable_fuzzy_search: true,
      search_threshold: 0.5
    };

    // Initialize with REAL knowledge base
    layerService = new MultiContentLayerService({
      conflict_resolution: 'override',
      inherit_collaborations: true,
      merge_expertise: false
    });
    
    // Load the embedded layer (CRITICAL: this was missing!)
    const { EmbeddedKnowledgeLayer } = await import('../../src/layers/embedded-layer.js');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedKnowledgePath);
    layerService.addLayer(embeddedLayer as any);
    
    await layerService.initialize();
    
    discoveryService = new SpecialistDiscoveryService(layerService);
    await discoveryService.initialize();
    
    knowledgeService = new KnowledgeService(config);
    await knowledgeService.initialize();
  });

  describe('Real Specialist Loading and Queries', () => {
    it('should load real specialists from embedded-knowledge', async () => {
      const specialists = await layerService.getAllSpecialists();
      
      expect(specialists).toBeDefined();
      expect(Array.isArray(specialists)).toBe(true);
      expect(specialists.length).toBeGreaterThan(0);
      
      // Verify specialists have required properties
      const firstSpecialist = specialists[0];
      expect(firstSpecialist).toHaveProperty('specialist_id');
      expect(firstSpecialist).toHaveProperty('title');
      expect(firstSpecialist).toHaveProperty('content');
    });

    it('should handle specialists with missing expertise.primary without crashing', async () => {
      // This test specifically validates the fix for the .includes() bug
      const specialists = await layerService.getAllSpecialists();
      
      // Try to get specialists by domain - this should not crash
      const result = await discoveryService.getSpecialistsByDomain('performance');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should return specialists even if some have incomplete data
    });

    it('should return actual specialist content when queried', async () => {
      // Find a known specialist (sam-coder is in the embedded knowledge)
      const specialist = await layerService.getSpecialist('sam-coder');
      
      expect(specialist).toBeDefined();
      expect(specialist?.specialist_id).toBe('sam-coder');
      expect(specialist?.title).toBeDefined();
      expect(specialist?.content).toBeDefined();
      expect(specialist?.content.length).toBeGreaterThan(100); // Should have real content
    });

    it('should provide real specialist suggestions based on query', async () => {
      const suggestions = await discoveryService.suggestSpecialists({
        query: 'performance optimization in Business Central'
      });
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      
      if (suggestions.length > 0) {
        const firstSuggestion = suggestions[0];
        expect(firstSuggestion).toHaveProperty('specialist');
        expect(firstSuggestion).toHaveProperty('confidence');
        expect(firstSuggestion.specialist).toHaveProperty('specialist_id');
        expect(firstSuggestion.specialist).toHaveProperty('content');
        // Verify it's REAL content, not a mock
        expect(firstSuggestion.specialist.content).not.toBe('Test content');
        expect(firstSuggestion.specialist.content).not.toBe('Mock specialist response');
      }
    });

    it('should return real specialist answer (not just instructions)', async () => {
      // This validates that askSpecialist returns actual consultation guidance
      const result = await layerService.askSpecialist(
        'How do I optimize AL code performance?',
        'dean-debug' // Dean is the performance specialist
      );
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('specialist');
      expect(result).toHaveProperty('response');
      expect(result.specialist.id).toBeDefined();
      
      // Validate it's not a mock response
      expect(result.response).not.toBe('Test specialist response');
      expect(result.response).not.toBe('Mock response');
      expect(result.response.length).toBeGreaterThan(50); // Should be meaningful
    });
  });

  describe('Real Knowledge Topic Queries', () => {
    it('should load real topics from embedded-knowledge', async () => {
      const topicIds = await layerService.getAllTopicIds();
      
      expect(topicIds).toBeDefined();
      expect(Array.isArray(topicIds)).toBe(true);
      expect(topicIds.length).toBeGreaterThan(0);
    });

    it('should search topics and return real content', async () => {
      const results = await layerService.searchTopics({
        code_context: 'table extension performance'
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      if (results.length > 0) {
        const firstResult = results[0];
        expect(firstResult).toHaveProperty('id');
        expect(firstResult).toHaveProperty('title');
        expect(firstResult).toHaveProperty('summary');
        // Verify it's REAL content
        expect(firstResult.summary).not.toBe('Test content');
        expect(firstResult.summary.length).toBeGreaterThan(10);
      }
    });

    it('should resolve topics with actual markdown content', async () => {
      const topicIds = await layerService.getAllTopicIds();
      
      if (topicIds.length > 0) {
        const topicId = topicIds[0];
        const resolved = await layerService.resolveTopic(topicId);
        
        expect(resolved).toBeDefined();
        expect(resolved?.topic).toBeDefined();
        expect(resolved?.topic.content).toBeDefined();
        expect(resolved?.topic.content.length).toBeGreaterThan(0);
        
        // Should contain markdown-like content
        const content = resolved!.topic.content;
        const hasMarkdownFeatures = 
          content.includes('#') || 
          content.includes('```') || 
          content.includes('**') ||
          content.includes('- ');
        expect(hasMarkdownFeatures).toBe(true);
      }
    });
  });

  describe('Edge Cases - Missing or Incomplete Data', () => {
    it('should gracefully handle specialists with undefined domains array', async () => {
      // Get all specialists and filter by domain - should not crash
      const result = await discoveryService.getSpecialistsByDomain('testing');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // No crash = success!
    });

    it('should gracefully handle specialists with undefined expertise', async () => {
      const specialists = await layerService.getAllSpecialists();
      
      // Try to suggest specialist based on query - should not crash even if some have undefined expertise
      const suggestions = await discoveryService.suggestSpecialists({
        query: 'help with code review'
      });
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle empty or malformed queries without crashing', async () => {
      // Empty query
      const result1 = await discoveryService.suggestSpecialists({ query: '' });
      expect(result1).toBeDefined();
      expect(Array.isArray(result1)).toBe(true);
      
      // Very short query
      const result2 = await discoveryService.suggestSpecialists({ query: 'a' });
      expect(result2).toBeDefined();
      expect(Array.isArray(result2)).toBe(true);
      
      // Query with special characters
      const result3 = await discoveryService.suggestSpecialists({ query: '!@#$%^&*()' });
      expect(result3).toBeDefined();
      expect(Array.isArray(result3)).toBe(true);
    });
  });

  describe('Performance with Real Data', () => {
    it('should load specialists within reasonable time', async () => {
      const startTime = Date.now();
      await layerService.getAllSpecialists();
      const duration = Date.now() - startTime;
      
      // Should load within 1 second even with real file I/O
      expect(duration).toBeLessThan(1000);
    });

    it('should search topics within reasonable time', async () => {
      const startTime = Date.now();
      await layerService.searchTopics({ code_context: 'performance optimization' });
      const duration = Date.now() - startTime;
      
      // Should search within 200ms
      expect(duration).toBeLessThan(200);
    });

    it('should suggest specialists within reasonable time', async () => {
      const startTime = Date.now();
      await discoveryService.suggestSpecialists({
        query: 'I need help with API design in Business Central'
      });
      const duration = Date.now() - startTime;
      
      // Should suggest within 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
