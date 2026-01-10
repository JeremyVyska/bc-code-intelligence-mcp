import { describe, it, expect, beforeEach } from 'vitest';
import { KNOWN_BC_MCPS } from '../../src/tools/_shared/workspace-constants.js';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';
import { EmbeddedKnowledgeLayer } from '../../src/layers/embedded-layer.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

describe('MCP Ecosystem Awareness', () => {
  describe('KNOWN_BC_MCPS Registry', () => {
    it('should contain 8 known BC MCP servers', () => {
      const knownMcps = Object.keys(KNOWN_BC_MCPS);
      expect(knownMcps).toHaveLength(8);
    });

    it('should provide descriptions for known MCPs', () => {
      const expectedMcps = {
        'bc-code-intelligence-mcp': 'BC development knowledge',
        'al-dependency-mcp-server': 'AL workspace symbol',
        'serena-mcp': 'Multi-language LSP',
        'al-objid-mcp-server': 'AL object ID collision',
        'bc-telemetry-buddy': 'BC telemetry collection',
        'azure-devops-mcp': 'Azure DevOps integration',
        'clockify-mcp': 'Clockify time tracking',
        'nab-al-tools-mcp': 'XLIFF/XLF translation'
      };

      for (const [mcpId, expectedSubstring] of Object.entries(expectedMcps)) {
        expect(KNOWN_BC_MCPS).toHaveProperty(mcpId);
        const description = KNOWN_BC_MCPS[mcpId as keyof typeof KNOWN_BC_MCPS];
        expect(description).toBeDefined();
        expect(description.length).toBeGreaterThan(0);
        expect(description.toLowerCase()).toContain(expectedSubstring.toLowerCase());
      }
    });

    it('should handle registry lookups correctly', () => {
      // Test specific registry entries
      expect(KNOWN_BC_MCPS['bc-telemetry-buddy']).toContain('telemetry');
      expect(KNOWN_BC_MCPS['al-objid-mcp-server']).toContain('Object ID');
      expect(KNOWN_BC_MCPS['azure-devops-mcp']).toContain('Azure DevOps');
      expect(KNOWN_BC_MCPS['serena-mcp']).toContain('LSP');
    });

    it('should not contain duplicate entries', () => {
      const mcpIds = Object.keys(KNOWN_BC_MCPS);
      const uniqueIds = new Set(mcpIds);
      expect(mcpIds.length).toBe(uniqueIds.size);
    });

    it('should have meaningful descriptions', () => {
      for (const [mcpId, description] of Object.entries(KNOWN_BC_MCPS)) {
        // Description should be more than just the ID
        expect(description.length).toBeGreaterThan(mcpId.length);
        // Should not just be the ID repeated
        expect(description.toLowerCase()).not.toBe(mcpId.toLowerCase());
      }
    });
  });

  describe('MCP Categorization Logic', () => {
    it('should categorize known MCPs with descriptions', () => {
      const availableMcps = ['bc-telemetry-buddy', 'al-objid-mcp-server', 'azure-devops-mcp'];

      const knownMcps = availableMcps.filter(mcp => mcp in KNOWN_BC_MCPS);
      const unknownMcps = availableMcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

      expect(knownMcps).toHaveLength(3);
      expect(unknownMcps).toHaveLength(0);

      // Each known MCP should have a description
      for (const mcpId of knownMcps) {
        const description = KNOWN_BC_MCPS[mcpId as keyof typeof KNOWN_BC_MCPS];
        expect(description).toBeDefined();
        expect(description.length).toBeGreaterThan(0);
      }
    });

    it('should list unknown MCPs separately', () => {
      const availableMcps = ['unknown-tool-1', 'unknown-tool-2', 'custom-company-mcp'];

      const knownMcps = availableMcps.filter(mcp => mcp in KNOWN_BC_MCPS);
      const unknownMcps = availableMcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

      expect(knownMcps).toHaveLength(0);
      expect(unknownMcps).toHaveLength(3);
      expect(unknownMcps).toContain('unknown-tool-1');
      expect(unknownMcps).toContain('unknown-tool-2');
      expect(unknownMcps).toContain('custom-company-mcp');
    });

    it('should handle empty available_mcps array', () => {
      const availableMcps: string[] = [];

      const knownMcps = availableMcps.filter(mcp => mcp in KNOWN_BC_MCPS);
      const unknownMcps = availableMcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

      expect(knownMcps).toHaveLength(0);
      expect(unknownMcps).toHaveLength(0);
    });

    it('should handle mixed known/unknown MCPs', () => {
      const availableMcps = [
        'bc-telemetry-buddy',      // Known
        'custom-company-tool',     // Unknown
        'al-objid-mcp-server',     // Known
        'experimental-mcp',        // Unknown
        'azure-devops-mcp'         // Known
      ];

      const knownMcps = availableMcps.filter(mcp => mcp in KNOWN_BC_MCPS);
      const unknownMcps = availableMcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

      expect(knownMcps).toHaveLength(3);
      expect(unknownMcps).toHaveLength(2);

      expect(knownMcps).toContain('bc-telemetry-buddy');
      expect(knownMcps).toContain('al-objid-mcp-server');
      expect(knownMcps).toContain('azure-devops-mcp');

      expect(unknownMcps).toContain('custom-company-tool');
      expect(unknownMcps).toContain('experimental-mcp');
    });
  });

  describe('WorkspaceInfo Interface', () => {
    it('should support workspace_root and available_mcps structure', () => {
      // Test the expected structure
      const workspaceInfo = {
        workspace_root: 'C:/projects/my-bc-app',
        available_mcps: ['bc-telemetry-buddy', 'al-objid-mcp-server']
      };

      expect(workspaceInfo.workspace_root).toBeDefined();
      expect(workspaceInfo.available_mcps).toBeDefined();
      expect(Array.isArray(workspaceInfo.available_mcps)).toBe(true);
    });

    it('should handle null workspace_root', () => {
      const workspaceInfo = {
        workspace_root: null,
        available_mcps: []
      };

      expect(workspaceInfo.workspace_root).toBeNull();
      expect(workspaceInfo.available_mcps).toEqual([]);
    });

    it('should handle empty available_mcps', () => {
      const workspaceInfo = {
        workspace_root: 'C:/projects/my-bc-app',
        available_mcps: []
      };

      expect(workspaceInfo.workspace_root).toBeDefined();
      expect(workspaceInfo.available_mcps).toHaveLength(0);
    });
  });

  describe('Conditional Knowledge Topics', () => {
    let layerService: MultiContentLayerService;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const embeddedPath = join(__dirname, '../../embedded-knowledge');

    // Helper function to get topic from layer service
    async function getTopic(topicId: string) {
      const layers = layerService.getLayers();
      for (const layer of layers) {
        const topic = await layer.getContent('topics', topicId);
        if (topic) return topic;
      }
      return null;
    }

    beforeEach(async () => {
      layerService = new MultiContentLayerService();
      const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
      layerService.addLayer(embeddedLayer as any);
      await layerService.initialize();
    });

    it('should have Alex Object ID Ninja integration topic', async () => {
      const searchString = 'object-id-ninja-integration';
      const allTopics = layerService.getAllTopicIds();

      // Topic IDs include domain path prefix
      const matchingTopics = allTopics.filter(id => id.includes(searchString));
      expect(matchingTopics.length).toBeGreaterThan(0);

      const fullTopicId = matchingTopics[0];
      const topic = await getTopic(fullTopicId);

      expect(topic).toBeDefined();
      if (topic) {
        expect(topic.id).toContain(searchString);
        // Check conditional_mcp in frontmatter if it exists
        if (topic.frontmatter) {
          expect(topic.frontmatter.conditional_mcp).toBe('al-objid-mcp-server');
        } else if ((topic as any).conditional_mcp) {
          expect((topic as any).conditional_mcp).toBe('al-objid-mcp-server');
        }
      }
    });

    it('should have Dean Telemetry Buddy integration topic', async () => {
      const searchString = 'bc-telemetry-buddy-integration';
      const allTopics = layerService.getAllTopicIds();

      // Topic IDs include domain path prefix
      const matchingTopics = allTopics.filter(id => id.includes(searchString));
      expect(matchingTopics.length).toBeGreaterThan(0);

      const fullTopicId = matchingTopics[0];
      const topic = await getTopic(fullTopicId);

      expect(topic).toBeDefined();
      if (topic) {
        expect(topic.id).toContain(searchString);
        // Check conditional_mcp in frontmatter if it exists
        if (topic.frontmatter) {
          expect(topic.frontmatter.conditional_mcp).toBe('bc-telemetry-buddy');
        } else if ((topic as any).conditional_mcp) {
          expect((topic as any).conditional_mcp).toBe('bc-telemetry-buddy');
        }
      }
    });

    it('should validate conditional_mcp frontmatter format', async () => {
      const conditionalTopics = [
        'object-id-ninja-integration',
        'bc-telemetry-buddy-integration'
      ];

      for (const topicId of conditionalTopics) {
        const topic = await getTopic(topicId);
        expect(topic).toBeDefined();

        if (topic) {
          // Should have conditional_mcp in frontmatter
          expect(topic.frontmatter.conditional_mcp).toBeDefined();
          expect(typeof topic.frontmatter.conditional_mcp).toBe('string');

          // Should reference a known MCP
          const conditionalMcp = topic.frontmatter.conditional_mcp as string;
          expect(conditionalMcp in KNOWN_BC_MCPS).toBe(true);
        }
      }
    });

    it('should have proper topic structure for conditional topics', async () => {
      const alexTopic = await getTopic('object-id-ninja-integration');

      expect(alexTopic).toBeDefined();
      if (alexTopic) {
        // Standard topic fields
        expect(alexTopic.id).toBeDefined();
        expect(alexTopic.title).toBeDefined();
        expect(alexTopic.content).toBeDefined();

        // Conditional MCP specific
        expect(alexTopic.frontmatter.conditional_mcp).toBe('al-objid-mcp-server');

        // Should have BC version info
        expect(alexTopic.frontmatter.bc_versions).toBeDefined();

        // Should have tags
        expect(Array.isArray(alexTopic.frontmatter.tags)).toBe(true);
        expect(alexTopic.frontmatter.tags).toContain('mcp-integration');
      }
    });

    it('should include conditional topics in search results', async () => {
      const allTopics = layerService.getAllTopicIds();

      // Topic IDs include domain path prefix
      const hasAlexTopic = allTopics.some(id => id.includes('object-id-ninja-integration'));
      const hasDeanTopic = allTopics.some(id => id.includes('bc-telemetry-buddy-integration'));

      expect(hasAlexTopic).toBe(true);
      expect(hasDeanTopic).toBe(true);
    });

    it('should not break when conditional_mcp field is missing', async () => {
      // Most topics don't have conditional_mcp - that's normal
      const standardTopic = await getTopic('posting-performance-patterns');

      expect(standardTopic).toBeDefined();
      if (standardTopic) {
        // Should not have conditional_mcp
        expect(standardTopic.frontmatter.conditional_mcp).toBeUndefined();
        // Should still be a valid topic
        expect(standardTopic.id).toBe('posting-performance-patterns');
        expect(standardTopic.content).toBeDefined();
      }
    });
  });

  describe('Ecosystem Context in Responses', () => {
    it('should provide categorized MCP information', () => {
      const availableMcps = [
        'bc-telemetry-buddy',
        'al-objid-mcp-server',
        'custom-company-mcp'
      ];

      const knownMcps = availableMcps
        .filter(mcp => mcp in KNOWN_BC_MCPS)
        .map(id => ({
          id,
          description: KNOWN_BC_MCPS[id as keyof typeof KNOWN_BC_MCPS]
        }));

      const unknownMcps = availableMcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

      const ecosystemInfo = {
        total_available: availableMcps.length,
        known_bc_mcps: knownMcps,
        unknown_mcps: unknownMcps
      };

      expect(ecosystemInfo.total_available).toBe(3);
      expect(ecosystemInfo.known_bc_mcps).toHaveLength(2);
      expect(ecosystemInfo.unknown_mcps).toHaveLength(1);

      // Known MCPs should have descriptions
      for (const mcp of ecosystemInfo.known_bc_mcps) {
        expect(mcp.id).toBeDefined();
        expect(mcp.description).toBeDefined();
        expect(mcp.description.length).toBeGreaterThan(0);
      }
    });

    it('should handle all MCPs being known', () => {
      const availableMcps = ['bc-telemetry-buddy', 'al-objid-mcp-server', 'azure-devops-mcp'];

      const knownMcps = availableMcps.filter(mcp => mcp in KNOWN_BC_MCPS);
      const unknownMcps = availableMcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

      expect(knownMcps).toHaveLength(3);
      expect(unknownMcps).toHaveLength(0);
    });

    it('should handle all MCPs being unknown', () => {
      const availableMcps = ['custom-tool-1', 'custom-tool-2', 'experimental'];

      const knownMcps = availableMcps.filter(mcp => mcp in KNOWN_BC_MCPS);
      const unknownMcps = availableMcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

      expect(knownMcps).toHaveLength(0);
      expect(unknownMcps).toHaveLength(3);
    });
  });

  describe('Conditional Knowledge Integration Scenarios', () => {
    let layerService: MultiContentLayerService;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const embeddedPath = join(__dirname, '../../embedded-knowledge');

    // Helper function to get topic from layer service
    async function getTopic(topicId: string) {
      const layers = layerService.getLayers();
      for (const layer of layers) {
        const topic = await layer.getContent('topics', topicId);
        if (topic) return topic;
      }
      return null;
    }

    beforeEach(async () => {
      layerService = new MultiContentLayerService();
      const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
      layerService.addLayer(embeddedLayer as any);
      await layerService.initialize();
    });

    it('should load conditional topics regardless of available_mcps (content exists)', async () => {
      // Conditional topics exist in embedded knowledge regardless of MCP availability
      // Filtering based on available_mcps would happen at query/response time
      const alexTopic = await getTopic('object-id-ninja-integration');
      const deanTopic = await getTopic('bc-telemetry-buddy-integration');

      expect(alexTopic).toBeDefined();
      expect(deanTopic).toBeDefined();
    });

    it('should provide topic content with MCP tool documentation', async () => {
      const deanTopic = await getTopic('bc-telemetry-buddy-integration');

      expect(deanTopic).toBeDefined();
      if (deanTopic) {
        // Should document BC Telemetry Buddy tools
        expect(deanTopic.content).toContain('bctb_');
        expect(deanTopic.content).toContain('KQL');
        expect(deanTopic.content).toContain('Application Insights');
      }
    });

    it('should provide fallback guidance for when MCP not available', async () => {
      const alexTopic = await getTopic('object-id-ninja-integration');

      expect(alexTopic).toBeDefined();
      if (alexTopic) {
        // Should have fallback strategy documented
        expect(alexTopic.content.toLowerCase()).toContain('fallback');
      }
    });

    it('should validate MCP ecosystem frontmatter completeness', async () => {
      const conditionalTopics = [
        { id: 'object-id-ninja-integration', mcp: 'al-objid-mcp-server' },
        { id: 'bc-telemetry-buddy-integration', mcp: 'bc-telemetry-buddy' }
      ];

      for (const { id, mcp } of conditionalTopics) {
        const topic = await getTopic(id);
        expect(topic).toBeDefined();

        if (topic) {
          // Validate conditional_mcp matches expected
          expect(topic.frontmatter.conditional_mcp).toBe(mcp);

          // Validate it's a known MCP
          expect(mcp in KNOWN_BC_MCPS).toBe(true);

          // Validate tags include mcp-integration
          expect(Array.isArray(topic.frontmatter.tags)).toBe(true);
          expect(topic.frontmatter.tags).toContain('mcp-integration');
        }
      }
    });
  });

  describe('Conditional Topic Filtering Logic', () => {
    let layerService: MultiContentLayerService;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const embeddedPath = join(__dirname, '../../embedded-knowledge');

    beforeEach(async () => {
      layerService = new MultiContentLayerService();
      const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
      layerService.addLayer(embeddedLayer as any);
      await layerService.initialize();
    });

    it('should include conditional topics when MCP is available', async () => {
      // Set available MCPs
      layerService.setAvailableMcps(['bc-telemetry-buddy']);

      // Search for Dean's topics
      const results = await layerService.searchTopics({ domain: 'dean-debug', limit: 50 });
      
      // Should include telemetry integration topic (conditional_mcp: "bc-telemetry-buddy")
      const hasTelemetryTopic = results.some(r => r.id.includes('bc-telemetry-buddy-integration'));
      expect(hasTelemetryTopic).toBe(true);

      // Should NOT include recommendation topic (conditional_mcp_missing: "bc-telemetry-buddy")
      const hasRecommendationTopic = results.some(r => r.id.includes('recommend-bc-telemetry-buddy'));
      expect(hasRecommendationTopic).toBe(false);
    });

    it('should exclude conditional topics when MCP is missing', async () => {
      // No MCPs available
      layerService.setAvailableMcps([]);

      // Search for Dean's topics
      const results = await layerService.searchTopics({ domain: 'dean-debug', limit: 50 });
      
      // Should NOT include integration topic (requires bc-telemetry-buddy)
      const hasTelemetryTopic = results.some(r => r.id.includes('bc-telemetry-buddy-integration'));
      expect(hasTelemetryTopic).toBe(false);

      // Should include recommendation topic (shows when MCP missing)
      const hasRecommendationTopic = results.some(r => r.id.includes('recommend-bc-telemetry-buddy'));
      expect(hasRecommendationTopic).toBe(true);
    });

    it('should dynamically update filtering when MCPs change', async () => {
      // Start with no MCPs
      layerService.setAvailableMcps([]);
      
      let results = await layerService.searchTopics({ domain: 'dean-debug', limit: 50 });
      let hasTelemetryTopic = results.some(r => r.id.includes('bc-telemetry-buddy-integration'));
      expect(hasTelemetryTopic).toBe(false);

      // Add telemetry buddy
      layerService.setAvailableMcps(['bc-telemetry-buddy']);
      
      // Should immediately see the topic (no restart needed)
      results = await layerService.searchTopics({ domain: 'dean-debug', limit: 50 });
      hasTelemetryTopic = results.some(r => r.id.includes('bc-telemetry-buddy-integration'));
      expect(hasTelemetryTopic).toBe(true);
    });

    it('should handle multiple conditional topics for different MCPs', async () => {
      // Set both MCPs available
      layerService.setAvailableMcps(['bc-telemetry-buddy', 'al-objid-mcp-server']);

      // Should see both integration topics
      const deanResults = await layerService.searchTopics({ domain: 'dean-debug', limit: 50 });
      const alexResults = await layerService.searchTopics({ domain: 'alex-architect', limit: 50 });

      expect(deanResults.some(r => r.id.includes('bc-telemetry-buddy-integration'))).toBe(true);
      expect(alexResults.some(r => r.id.includes('object-id-ninja-integration'))).toBe(true);

      // Should NOT see recommendation topics
      expect(deanResults.some(r => r.id.includes('recommend-bc-telemetry-buddy'))).toBe(false);
      expect(alexResults.some(r => r.id.includes('recommend-object-id-ninja'))).toBe(false);
    });

    it('should always include topics without conditional fields', async () => {
      // Even with no MCPs
      layerService.setAvailableMcps([]);

      const results = await layerService.searchTopics({ domain: 'dean-debug', limit: 50 });
      
      // Standard topics (without conditionals) should always be present
      const hasStandardTopics = results.some(r => 
        r.id.includes('sift-technology-fundamentals') || 
        r.id.includes('setloadfields-performance-optimization')
      );
      expect(hasStandardTopics).toBe(true);
    });
  });


  describe('Edge Cases and Error Handling', () => {
    it('should handle case-sensitive MCP IDs correctly', () => {
      const availableMcps = ['bc-telemetry-buddy', 'BC-TELEMETRY-BUDDY'];

      const knownMcps = availableMcps.filter(mcp => mcp in KNOWN_BC_MCPS);

      // Registry uses lowercase with hyphens
      expect(knownMcps).toContain('bc-telemetry-buddy');
      expect(knownMcps).not.toContain('BC-TELEMETRY-BUDDY');
    });

    it('should handle duplicate MCP IDs in available_mcps', () => {
      const availableMcps = [
        'bc-telemetry-buddy',
        'al-objid-mcp-server',
        'bc-telemetry-buddy'  // Duplicate
      ];

      const uniqueMcps = Array.from(new Set(availableMcps));
      expect(uniqueMcps).toHaveLength(2);
    });

    it('should handle malformed MCP IDs gracefully', () => {
      const availableMcps = [
        '',                    // Empty string
        'bc-telemetry-buddy',
        '   ',                 // Whitespace
        'al-objid-mcp-server'
      ];

      const validMcps = availableMcps.filter(mcp => mcp && mcp.trim().length > 0);
      const knownMcps = validMcps.filter(mcp => mcp in KNOWN_BC_MCPS);

      expect(knownMcps).toHaveLength(2);
    });
  });
});
