/**
 * BC Version Range Filtering Tests
 * 
 * REGRESSION TEST: Ensures BC version ranges like "14+" correctly match specific versions
 * like "BC20", "BC18", etc. This prevents the bug where naive string matching failed to
 * recognize that "BC20" satisfies "14+" requirement.
 * 
 * Critical requirement: Version range parsing must handle:
 * - "14+" format (numeric with plus)
 * - "BC18+" format (BC prefix with numeric and plus)
 * - Numerical comparison (20 >= 14, not string comparison)
 * 
 * The bug: "14+".includes("BC20") returned false, filtering out ALL topics.
 * The fix: Parse version numbers and compare numerically: parseInt("20") >= parseInt("14")
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';

describe('BC Version Range Filtering - Regression Test', () => {
  let layerService: MultiContentLayerService;

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
  });

  describe('Version Range Parsing - Core Regression Tests', () => {
    it('should find topics when searching with BC20 (must match "14+" requirements)', async () => {
      // REGRESSION TEST: This was returning 0 results due to naive string matching
      // "14+".includes("BC20") = false, so all "14+" topics were filtered out
      const results = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC20',
        limit: 50
      });

      // CRITICAL: BC20 should match topics with "14+" requirements
      // If this fails, version range parsing is broken (bug has returned)
      expect(results.length).toBeGreaterThan(0);
      
      // Should find performance-related topics
      expect(results.some(r => r.tags.includes('performance'))).toBe(true);
    });

    it('should find topics when searching with BC18 (must match "14+" requirements)', async () => {
      const results = await layerService.searchTopics({
        tags: ['caching'],
        bc_version: 'BC18',
        limit: 50
      });

      // BC18 >= BC14, so "14+" topics should be included
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find more topics with BC22 than BC18 (newer versions match more ranges)', async () => {
      const bc18Results = await layerService.searchTopics({
        domain: 'performance',
        bc_version: 'BC18',
        limit: 100
      });

      const bc22Results = await layerService.searchTopics({
        domain: 'performance',
        bc_version: 'BC22',
        limit: 100
      });

      // BC22 should match all "14+", "18+", and newer ranges
      // BC18 only matches "14+", "18+"
      // So BC22 should have >= results (likely more if there are "20+" topics)
      expect(bc22Results.length).toBeGreaterThanOrEqual(bc18Results.length);
    });

    it('should handle "BC" prefix in version strings', async () => {
      const resultsWithPrefix = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC20', // With prefix
        limit: 50
      });

      const resultsWithoutPrefix = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: '20', // Without prefix
        limit: 50
      });

      // Both formats should work and return results
      expect(resultsWithPrefix.length).toBeGreaterThan(0);
      expect(resultsWithoutPrefix.length).toBeGreaterThan(0);
      
      // Should return similar number of results (same version, different format)
      expect(Math.abs(resultsWithPrefix.length - resultsWithoutPrefix.length)).toBeLessThan(5);
    });

    it('should include topics without version requirements for all BC versions', async () => {
      const results = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC14',
        limit: 50
      });

      // Topics without bc_versions should always be included
      // BC14 is minimum supported version, so should still get results
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle minimum supported version (BC14) correctly', async () => {
      const results = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC14',
        limit: 50
      });

      // Should get topics with "14+" requirement (minimum version)
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle latest versions (BC25+) and match all ranges', async () => {
      const results = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC25',
        limit: 100
      });

      // BC25 should match ALL version requirements (14+, 18+, 20+, etc.)
      // Should have most results of any version
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Version Comparison Logic', () => {
    it('should use numerical comparison not string comparison', async () => {
      // This was the bug: "14+".includes("BC20") = false
      // The fix: Parse numbers and compare: 20 >= 14 = true

      const bc20Results = await layerService.searchTopics({
        tags: ['optimization'],
        bc_version: 'BC20',
        limit: 50
      });

      const bc14Results = await layerService.searchTopics({
        tags: ['optimization'],
        bc_version: 'BC14',
        limit: 50
      });

      // BC20 should have at least as many results as BC14
      // (BC20 matches all "14+", "18+" requirements; BC14 only matches "14+" exactly)
      expect(bc20Results.length).toBeGreaterThanOrEqual(bc14Results.length);
    });

    it('should correctly order versions numerically (BC20 >= BC18 >= BC14)', async () => {
      const bc14Count = (await layerService.searchTopics({
        domain: 'performance',
        bc_version: 'BC14',
        limit: 100
      })).length;

      const bc18Count = (await layerService.searchTopics({
        domain: 'performance',
        bc_version: 'BC18',
        limit: 100
      })).length;

      const bc20Count = (await layerService.searchTopics({
        domain: 'performance',
        bc_version: 'BC20',
        limit: 100
      })).length;

      // Newer versions should have >= results (match more version ranges)
      expect(bc20Count).toBeGreaterThanOrEqual(bc18Count);
      expect(bc18Count).toBeGreaterThanOrEqual(bc14Count);
    });

    it('should work with conditional recommendation topics', async () => {
      // Set up MCP context where BC Telemetry Buddy is NOT available
      layerService.setAvailableMcps([]);

      const results = await layerService.searchTopics({
        tags: ['telemetry', 'diagnostic'],
        bc_version: 'BC20',
        limit: 10
      });

      // Should find recommendation topic for BC Telemetry Buddy
      // AND version filtering should work correctly with conditional topics
      expect(results.length).toBeGreaterThan(0);
      
      // Verify telemetry recommendation topic appears
      const telemetryTopic = results.find(r => 
        r.id.includes('recommend-bc-telemetry-buddy') || 
        r.title.toLowerCase().includes('telemetry')
      );
      
      // Should find telemetry-related topics
      expect(telemetryTopic).toBeDefined();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle topics with multiple version requirements', async () => {
      // Some topics may have multiple version strings in bc_versions array
      const results = await layerService.searchTopics({
        tags: ['api'],
        bc_version: 'BC20',
        limit: 50
      });

      // Should still match if ANY version requirement is satisfied
      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle exact version matches (not just ranges)', async () => {
      // Topics might specify exact version "BC18" or "18"
      const results = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC18',
        limit: 50
      });

      // Should include topics for exact version AND ranges like "14+"
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return consistent results across multiple searches', async () => {
      const results1 = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC20',
        limit: 50
      });

      const results2 = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC20',
        limit: 50
      });

      // Same search should return same number of results (deterministic)
      expect(results1.length).toBe(results2.length);
    });

    it('should handle version filtering with no version specified (should include all)', async () => {
      const resultsWithVersion = await layerService.searchTopics({
        tags: ['performance'],
        bc_version: 'BC20',
        limit: 50
      });

      const resultsNoVersion = await layerService.searchTopics({
        tags: ['performance'],
        // No bc_version specified
        limit: 50
      });

      // Without version filter, should return >= results (no filtering)
      expect(resultsNoVersion.length).toBeGreaterThanOrEqual(resultsWithVersion.length);
    });
  });
});
