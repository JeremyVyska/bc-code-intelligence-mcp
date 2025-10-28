/**
 * Specialist Instructions Completeness Tests
 * 
 * REGRESSION TEST: Ensures specialists receive their FULL markdown content as instructions,
 * not summaries or generated responses. This prevents the bug where Phase 0 workflows and
 * detailed instructions were never transmitted to AI agents.
 * 
 * Critical requirement: When get_specialist_advice is called, the agent MUST receive the
 * complete specialist markdown file including all phases, workflows, and specific markers.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';

describe('Specialist Instructions Completeness - Regression Test', () => {
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

  describe('Specialist Content Loading', () => {
    it('should load Dean Debug with complete markdown content including Phase 0', async () => {
      const dean = await layerService.getSpecialist('dean-debug');
      
      expect(dean).toBeDefined();
      expect(dean?.content).toBeDefined();
      expect(dean?.content.length).toBeGreaterThan(5000); // Full markdown is substantial
      
      // CRITICAL MARKERS: These MUST be present in the full specialist content
      const content = dean!.content;
      
      // 1. Phase 0 header must be present
      expect(content).toContain('Phase 0: Diagnostic Tool Inventory');
      
      // 2. Critical first step emphasis
      expect(content).toContain('CRITICAL FIRST STEP');
      
      // 3. Tool inventory instruction (generic, not tool-specific)
      expect(content).toContain('INVENTORY DIAGNOSTIC TOOLS FIRST');
      
      // 4. Response format template
      expect(content).toContain('⚠️ **DIAGNOSTIC LIMITATION DETECTED**');
      
      // 5. Knowledge layer awareness instruction
      expect(content).toContain('Company/team layers may define required diagnostic tools');
      
      // 6. How to identify recommendation topics
      expect(content).toContain('Look for topics in your search results about missing tools');
    });

    it('should include complete diagnostic process phases (0-3) for Dean', async () => {
      const dean = await layerService.getSpecialist('dean-debug');
      const content = dean!.content;

      // All phases must be present in full specialist content
      expect(content).toContain('Phase 0: Diagnostic Tool Inventory');
      expect(content).toContain('Phase 1: Problem Assessment');
      expect(content).toContain('Phase 2: Systematic Investigation');
      expect(content).toContain('Phase 3: Optimization Implementation');
    });

    it('should include specific markdown formatting and code blocks for Dean', async () => {
      const dean = await layerService.getSpecialist('dean-debug');
      const content = dean!.content;

      // Markdown formatting must be preserved (not converted to plain text)
      expect(content).toContain('```'); // Code blocks
      expect(content).toContain('🔍'); // Emoji markers
      expect(content).toContain('##'); // Markdown headers
      expect(content).toContain('**'); // Bold text
      expect(content).toContain('⚙️'); // Process emoji
    });

    it('should include tool-agnostic language for Dean (no hard-coded tool names in instructions)', async () => {
      const dean = await layerService.getSpecialist('dean-debug');
      const content = dean!.content;

      // Should use placeholders, not specific tool names in instructions
      expect(content).toContain('[DIAGNOSTIC TOOL NAME]');
      expect(content).toContain('Search your knowledge for topics tagged');
      
      // Generic instructions section should NOT hard-code specific tools
      // (Tool-specific content is fine in recommendation topics, not specialist persona)
      const phaseZeroSection = content.substring(
        content.indexOf('Phase 0'),
        content.indexOf('Phase 1')
      );
      
      // Phase 0 should reference generic diagnostic tools, not specific MCPs
      expect(phaseZeroSection).toContain('diagnostic');
      expect(phaseZeroSection).toContain('tooling');
    });

    it('should load Sam Coder with complete content', async () => {
      const sam = await layerService.getSpecialist('sam-coder');
      
      expect(sam).toBeDefined();
      expect(sam?.content).toBeDefined();
      expect(sam?.content.length).toBeGreaterThan(3000); // Substantial content
      expect(sam?.content).toContain('Sam Coder');
      expect(sam?.content).toContain('##'); // Markdown headers
    });

    it('should load Alex Architect with complete content', async () => {
      const alex = await layerService.getSpecialist('alex-architect');
      
      expect(alex).toBeDefined();
      expect(alex?.content).toBeDefined();
      expect(alex?.content.length).toBeGreaterThan(3000); // Substantial content
      expect(alex?.content).toContain('Alex Architect');
      expect(alex?.content).toContain('##'); // Markdown headers
    });

    it('should load ALL specialists with markdown content (not empty)', async () => {
      const specialists = await layerService.getAllSpecialists();
      
      expect(specialists.length).toBeGreaterThan(10); // We have 14 specialists
      
      for (const specialist of specialists) {
        expect(specialist.content).toBeDefined();
        expect(specialist.content.length).toBeGreaterThan(100); // At minimum
        expect(specialist.content).toContain('##'); // Should have markdown headers
      }
    });
  });
});
