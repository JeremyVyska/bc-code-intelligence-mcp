/**
 * Specialist Auto-Detection Integration Tests
 * 
 * Tests for Issue #17: ask_bc_expert Auto-Detection Fails for Complex/Compound Questions
 * https://github.com/JeremyVyska/bc-code-intelligence-mcp/issues/17
 * 
 * Validates that token-based matching allows specialist discovery with compound queries
 * containing multiple domain-specific terms.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';
import { SpecialistDiscoveryService } from '../../src/services/specialist-discovery.js';

describe('Specialist Auto-Detection - Issue #17', () => {
  let layerService: MultiContentLayerService;
  let discoveryService: SpecialistDiscoveryService;
  
  beforeAll(async () => {
    // Initialize with embedded knowledge layer
    const embeddedKnowledgePath = resolve(__dirname, '../../embedded-knowledge');
    
    layerService = new MultiContentLayerService({
      conflict_resolution: 'override',
      inherit_collaborations: true,
      merge_expertise: false
    });
    
    // Load the embedded layer
    const { EmbeddedKnowledgeLayer } = await import('../../src/layers/embedded-layer.js');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedKnowledgePath);
    layerService.addLayer(embeddedLayer as any);
    
    await layerService.initialize();
    
    // Initialize discovery service
    discoveryService = new SpecialistDiscoveryService(layerService);
    await discoveryService.initialize();
  });

  describe('Token-Based Matching - findSpecialistsByQuery', () => {
    it('should find Roger Reviewer with "review" keyword (partial match)', async () => {
      const results = await layerService.findSpecialistsByQuery('review my code');
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Should include roger-reviewer
      const rogerReviewer = results.find(s => s.specialist_id === 'roger-reviewer');
      expect(rogerReviewer).toBeDefined();
    });

    it('should find specialists with compound query containing multiple terms', async () => {
      const query = 'code review standards compliance best practices naming conventions';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Roger should be in results (matches "review", "standards", "best practices")
      const rogerReviewer = results.find(s => s.specialist_id === 'roger-reviewer');
      expect(rogerReviewer).toBeDefined();
    });

    it('should find Dean Debug with performance-related compound query', async () => {
      const query = 'performance issues database queries SIFT optimization';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Dean should be in results (matches "performance", "database", "optimization")
      const deanDebug = results.find(s => s.specialist_id === 'dean-debug');
      expect(deanDebug).toBeDefined();
    });

    it('should find Eva Errors with error handling compound query', async () => {
      const query = 'error handling validation patterns label variables exception management';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Eva should be in results (matches "error", "validation", "exception")
      const evaErrors = results.find(s => s.specialist_id === 'eva-errors');
      expect(evaErrors).toBeDefined();
    });

    it('should find Alex Architect with architecture-related query', async () => {
      const query = 'architecture review solution design patterns facade pattern';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Alex should be in results (matches "architecture", "design patterns", "facade")
      const alexArchitect = results.find(s => s.specialist_id === 'alex-architect');
      expect(alexArchitect).toBeDefined();
    });

    it('should handle the original bug report query from Issue #17', async () => {
      const query = 'Using company standards review AL code naming conventions Meth codeunit error handling label variables file organization';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find Roger Reviewer (code review specialist)
      const rogerReviewer = results.find(s => s.specialist_id === 'roger-reviewer');
      expect(rogerReviewer).toBeDefined();
    });
  });

  describe('Token-Based Confidence Calculation - suggestSpecialist', () => {
    it('should suggest Roger Reviewer for code review query with confidence > 0.15', async () => {
      const suggestions = await discoveryService.suggestSpecialists({
        query: 'Review my AL code for best practices'
      });
      
      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Roger should be suggested
      const rogerSuggestion = suggestions.find((s: any) => s.specialist.specialist_id === 'roger-reviewer');
      expect(rogerSuggestion).toBeDefined();
      expect(rogerSuggestion?.confidence).toBeGreaterThan(0.15);
    });

    it('should suggest specialist for compound query with multiple domain terms', async () => {
      const query = 'code review standards compliance naming conventions error handling best practices';
      const suggestions = await discoveryService.suggestSpecialists({ query });
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Should suggest at least one relevant specialist (Roger, Eva, or similar)
      const hasRelevantSpecialist = suggestions.some((s: any) => 
        ['roger-reviewer', 'eva-errors', 'sam-coder'].includes(s.specialist.specialist_id)
      );
      expect(hasRelevantSpecialist).toBe(true);
    });

    it('should suggest Dean Debug for performance query', async () => {
      const suggestions = await discoveryService.suggestSpecialists({
        query: 'Performance issues with database queries and SIFT indexing'
      });
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Dean should be suggested
      const deanSuggestion = suggestions.find((s: any) => s.specialist.specialist_id === 'dean-debug');
      expect(deanSuggestion).toBeDefined();
      expect(deanSuggestion?.confidence).toBeGreaterThan(0.15);
    });

    it('should suggest Eva Errors for error handling query', async () => {
      const suggestions = await discoveryService.suggestSpecialists({
        query: 'Error handling validation patterns with label variables'
      });
      
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
      
      // Eva should be suggested
      const evaSuggestion = suggestions.find((s: any) => s.specialist.specialist_id === 'eva-errors');
      expect(evaSuggestion).toBeDefined();
      expect(evaSuggestion?.confidence).toBeGreaterThan(0.15);
    });

    it('should NOT suggest specialists for completely unrelated queries', async () => {
      const suggestions = await discoveryService.suggestSpecialists({
        query: 'weather forecast precipitation temperature'
      });
      
      // Should return empty or very low confidence results
      // (No BC specialist deals with weather!)
      expect(suggestions.length).toBe(0);
    });
  });

  describe('Edge Cases and Robustness', () => {
    it('should handle queries with punctuation and special characters', async () => {
      const query = 'Review code: naming conventions, error handling & best practices!';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle very short queries gracefully', async () => {
      const query = 'review';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      // May or may not find results, but should not crash
    });

    it('should handle very long compound queries', async () => {
      const query = 'Using company standards review AL code for compliance with patterns including table with field naming OnValidate triggers CalculateScore procedure calling Meth codeunit ValidateCustomerExists with label variables check naming conventions English versus Dutch Meth codeunit pattern usage error handling with label variables file organization one object per file standard';
      const results = await layerService.findSpecialistsByQuery(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle case variations in queries', async () => {
      const queries = [
        'REVIEW CODE STANDARDS',
        'Review Code Standards',
        'review code standards'
      ];
      
      for (const query of queries) {
        const results = await layerService.findSpecialistsByQuery(query);
        expect(results.length).toBeGreaterThan(0);
      }
    });
  });

  describe('askSpecialist Integration - End-to-End', () => {
    it('should successfully answer compound query via askSpecialist without throwing', async () => {
      const query = 'Review my AL code for naming conventions and best practices';
      
      // askSpecialist should now work with compound queries (Issue #17 fix)
      // The main bug was: "No suitable specialist found for this question"
      const answer = await layerService.askSpecialist(query);
      
      expect(answer).toBeDefined();
      expect(answer.specialist).toBeDefined();
      expect(answer.response).toBeDefined();
      expect(answer.response.length).toBeGreaterThan(0);
    });

    it('should answer the original Issue #17 bug report query without throwing', async () => {
      const query = 'Using company standards, review this AL code for compliance. Check: naming conventions (English vs Dutch), Meth codeunit pattern usage, error handling with label variables';
      
      // This was failing before the fix with "No suitable specialist found"
      // Now with token-based matching, it should find a specialist
      const answer = await layerService.askSpecialist(query);
      
      expect(answer).toBeDefined();
      expect(answer.specialist).toBeDefined();
      expect(answer.response).toBeDefined();
      expect(answer.response.length).toBeGreaterThan(100); // Should have substantial answer
    });
  });
});
