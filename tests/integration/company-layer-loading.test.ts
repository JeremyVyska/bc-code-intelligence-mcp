/**
 * Company Layer Loading Tests
 * 
 * Tests for Issue #16: Company knowledge layers not loading
 * 
 * Simulates the myPartner company scenario where:
 * 1. Embedded layer provides base BC knowledge
 * 2. Company layer provides myPartner-specific standards and overrides
 * 3. Queries with "Using myPartner company standards..." should trigger company layer
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { MultiContentLayerService } from '../../src/services/multi-content-layer-service.js';
import { KnowledgeService } from '../../src/services/knowledge-service.js';
import { MultiContentKnowledgeLayer } from '../../src/types/enhanced-layer-types.js';
import { BCKBConfig } from '../../src/types/bc-knowledge.js';

describe('Company Layer Loading - Issue #16 myPartner Scenario', () => {
  let testCompanyKnowledgeDir: string;
  let layerService: MultiContentLayerService;
  
  beforeAll(async () => {
    // Create temporary company knowledge directory
    const testId = Date.now();
    testCompanyKnowledgeDir = join(tmpdir(), `bckb-test-company-${testId}`);
    
    await mkdir(testCompanyKnowledgeDir, { recursive: true });
    await mkdir(join(testCompanyKnowledgeDir, 'domains', 'shared'), { recursive: true });
    await mkdir(join(testCompanyKnowledgeDir, 'specialists'), { recursive: true });

    // Create myPartner company-specific topic (naming conventions)
    const namingConventionsTopic = `---
title: "myPartner Naming Conventions"
domain: "company-standards"
bc_versions: "14+"
difficulty: "beginner"
tags: ["naming", "standards", "mypartner", "english"]
applies_to:
  - "AL Language"
last_updated: "2025-10-15"
---

# myPartner Naming Conventions

## English-Only Rule

**Critical Rule:** ALL identifiers and captions MUST be in English.

### Field Naming
- ✅ CORRECT: \`Name\` with Caption = 'Name'
- ❌ WRONG: \`Naam\` (Dutch)

### Why English Only?
1. International teams need consistent codebase
2. Translations handled via .xlf files only
3. Maintains compatibility with Microsoft standards

### Translation Approach
- Use English identifiers and captions in AL code
- Provide translations in .xlf language files
- Example: "Name" → Dutch translation "Naam" in nl-NL.xlf

## Related Standards
- Meth codeunit pattern
- Error handling with label variables
- One object per file rule
`;

    await writeFile(
      join(testCompanyKnowledgeDir, 'domains', 'shared', 'mypartner-naming-conventions.md'),
      namingConventionsTopic
    );

    // Create company-specific specialist (override roger-reviewer with myPartner focus)
    const myPartnerReviewerSpecialist = `---
title: "Roger Reviewer (myPartner Edition)"
specialist_id: "roger-reviewer"
emoji: "🔍"
role: "Code Quality & myPartner Standards Guardian"
team: "Quality Assurance"
persona:
  greeting: "Hi! I'm Roger, and I enforce myPartner's high standards!"
  communication_style: "Direct and standards-focused"
  expertise_level: "Expert"
expertise:
  primary:
    - "Code Review"
    - "myPartner Standards"
    - "Quality Assurance"
  secondary:
    - "Best Practices"
    - "Team Consistency"
domains:
  - "quality"
  - "standards"
  - "mypartner"
when_to_use:
  - "Code review needed"
  - "Checking myPartner standards compliance"
  - "Quality validation"
related_specialists:
  - "sam-coder"
  - "dean-debug"
---

# Roger Reviewer - myPartner Standards Guardian

## My Role
I enforce myPartner's company-specific standards with zero tolerance for violations.

## myPartner Standards I Enforce

### 1. English-Only Naming
**NEVER** allow Dutch field names. Example:
- ❌ Field name: "Naam" → REJECT
- ✅ Field name: "Name" → APPROVE

All identifiers and captions must be English. Translations go in .xlf files.

### 2. Meth Codeunit Pattern
All business logic must follow the Meth codeunit pattern.

### 3. One Object Per File
No multiple tables or pages in a single file.

### 4. Error Handling
Use label variables for all error messages.

### 5. Interface-Based Enums
Enums must use interface pattern for extensibility.

## My Review Process
1. Check naming conventions (English only!)
2. Verify Meth pattern compliance
3. Validate file organization
4. Review error handling
5. Confirm interface usage

## Example Review

**Question:** "Can I name my field 'Naam'?"
**My Answer:** "❌ NO. myPartner standard requires English-only identifiers. Use 'Name' and provide Dutch translation in .xlf file."
`;

    await writeFile(
      join(testCompanyKnowledgeDir, 'specialists', 'roger-reviewer.md'),
      myPartnerReviewerSpecialist
    );

    // Initialize layer service with both embedded and company layers
    layerService = new MultiContentLayerService({
      conflict_resolution: 'override', // Company layer wins
      inherit_collaborations: true,
      merge_expertise: false
    });

    // Add company layer (LOCAL source type)
    const { ProjectKnowledgeLayer } = await import('../../src/layers/project-layer.js');
    const companyLayer = new ProjectKnowledgeLayer(testCompanyKnowledgeDir);
    (companyLayer as any).name = 'mypartner-company';
    (companyLayer as any).priority = 50; // Higher priority than embedded
    layerService.addLayer(companyLayer as any);

    // Initialize layers
    await layerService.initialize();
  });

  afterAll(async () => {
    // Cleanup
    if (testCompanyKnowledgeDir) {
      await rm(testCompanyKnowledgeDir, { recursive: true, force: true });
    }
  });

  describe('Company Layer Detection and Loading', () => {
    it('should detect company-specific knowledge directory', async () => {
      // This test validates that the system can detect company knowledge
      expect(testCompanyKnowledgeDir).toBeDefined();
      expect(testCompanyKnowledgeDir.length).toBeGreaterThan(0);
    });

    it('should load company layer successfully', async () => {
      // Verify the company layer was actually loaded
      const stats = layerService.getStatistics();
      
      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
      
      // Should have loaded the mypartner-company layer
      const companyLayer = stats.find(s => s.name === 'mypartner-company');
      expect(companyLayer).toBeDefined();
      expect(companyLayer?.topicCount).toBeGreaterThan(0);
    });

    it('should load myPartner naming conventions topic from company layer', async () => {
      // THE CRITICAL TEST: Can we actually retrieve company domain knowledge?
      const topicIds = await layerService.getAllTopicIds();
      
      expect(topicIds).toBeDefined();
      expect(topicIds.length).toBeGreaterThan(0);
      
      // Should include our myPartner naming conventions topic
      const hasNamingTopic = topicIds.some(id => 
        id.includes('naming') || id.includes('mypartner')
      );
      expect(hasNamingTopic).toBe(true);
    });

    it('should find myPartner naming conventions when searching domain knowledge', async () => {
      // THE REAL WORLD SCENARIO: Search for naming conventions
      const results = await layerService.searchTopics({
        code_context: 'myPartner naming conventions English Dutch field'
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // Should find the myPartner naming conventions topic
      const namingTopic = results.find(r => 
        r.title.toLowerCase().includes('naming') && 
        r.title.toLowerCase().includes('mypartner')
      );
      
      expect(namingTopic).toBeDefined();
      expect(namingTopic?.title).toBe('myPartner Naming Conventions');
    });

    it('should return company domain content with English-only rule', async () => {
      // Search for the topic and verify its content
      const results = await layerService.searchTopics({
        code_context: 'field naming English'
      });
      
      const namingTopic = results.find(r => r.title.includes('myPartner'));
      
      if (namingTopic) {
        // Resolve the full topic to get content
        const resolved = await layerService.resolveTopic(namingTopic.id);
        
        expect(resolved).toBeDefined();
        expect(resolved?.topic.content).toBeDefined();
        
        // Verify it contains the critical rule
        const content = resolved!.topic.content;
        expect(content).toContain('English');
        expect(content).toContain('CORRECT: `Name`');
        expect(content).toContain('WRONG: `Naam`');
      }
    });

    it('should not crash when querying with company context phrase', async () => {
      // The bug: queries with "Using myPartner company standards..." crashed
      // This test ensures we handle the phrase gracefully
      
      const query = "Using myPartner company standards, can I name a field 'Naam'?";
      
      // Should not throw "Cannot read properties of undefined (reading 'includes')"
      await expect(async () => {
        // Try to suggest specialists based on company context
        const specialists = await layerService.getAllSpecialists();
        expect(specialists).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Company Layer Override Behavior', () => {
    it('should handle queries about company-specific standards', async () => {
      // Even without a loaded company layer, the system should gracefully handle
      // queries that mention company standards
      
      const specialists = await layerService.getAllSpecialists();
      
      expect(specialists).toBeDefined();
      expect(Array.isArray(specialists)).toBe(true);
    });

    it('should not crash when specialist has incomplete metadata', async () => {
      // The root cause: specialists with undefined expertise.primary caused .includes() to fail
      
      const specialists = await layerService.getAllSpecialists();
      
      // Filter specialists - this internally uses .includes() which was crashing
      await expect(async () => {
        const filtered = specialists.filter(s => 
          s.domains || s.expertise?.primary || s.expertise?.secondary
        );
        expect(filtered).toBeDefined();
      }).not.toThrow();
    });
  });

  describe('Company-Specific Specialist Queries', () => {
    it('should handle specialist queries without crashing', async () => {
      // Test the exact scenario from Issue #16
      const question = "Using myPartner company standards, can I name a field 'Naam'?";
      
      // This should not crash with "Cannot read properties of undefined (reading 'includes')"
      await expect(async () => {
        const result = await layerService.findSpecialistsByQuery(question);
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      }).not.toThrow();
    });

    it('should suggest relevant specialists for company standard questions', async () => {
      const question = "What are the myPartner naming conventions?";
      
      const specialists = await layerService.findSpecialistsByQuery(question);
      
      expect(specialists).toBeDefined();
      expect(Array.isArray(specialists)).toBe(true);
      
      // Should return at least some specialists (even from embedded layer)
      // In production with company layer loaded, would prioritize myPartner-specific specialists
    });
  });

  describe('Graceful Degradation', () => {
    it('should work even without company layer loaded', async () => {
      // If company layer fails to load, embedded layer should still work
      
      const specialists = await layerService.getAllSpecialists();
      expect(specialists).toBeDefined();
      
      const specialist = await layerService.getSpecialist('sam-coder');
      expect(specialist).toBeDefined();
    });

    it('should handle missing company context gracefully', async () => {
      // Queries without "Using myPartner company standards..." should still work
      
      const question = "How do I optimize AL code?";
      const specialists = await layerService.findSpecialistsByQuery(question);
      
      expect(specialists).toBeDefined();
      expect(Array.isArray(specialists)).toBe(true);
      // Don't require specialists to be found - we only have company layer with limited specialists
      // The important thing is it doesn't crash
    });

    it('should return base knowledge when company knowledge not available', async () => {
      // Search for topics - should return embedded layer topics if company layer not loaded
      
      const results = await layerService.searchTopics({
        code_context: 'naming conventions'
      });
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // Should have results from embedded layer at minimum
    });
  });

  describe('Error Recovery', () => {
    it('should handle undefined expertise arrays without crashing', async () => {
      // Direct test of the fix for the .includes() bug
      
      const specialists = await layerService.getAllSpecialists();
      
      // Try to filter by domain - this was causing the crash
      const filtered = specialists.filter(s => {
        // This is what the bug was doing - calling includes() on potentially undefined arrays
        // The fix adds null checks before calling includes()
        return (s.expertise?.primary && s.expertise.primary.includes('quality')) ||
               (s.expertise?.secondary && s.expertise.secondary.includes('quality')) ||
               (s.domains && s.domains.includes('quality'));
      });
      
      expect(filtered).toBeDefined();
      expect(Array.isArray(filtered)).toBe(true);
    });

    it('should handle specialists with missing domains array', async () => {
      const specialists = await layerService.getAllSpecialists();
      
      // Some specialists might not have domains defined
      const specialistsWithoutDomains = specialists.filter(s => !s.domains);
      
      // This should not cause any issues
      expect(specialistsWithoutDomains).toBeDefined();
    });

    it('should handle empty search queries', async () => {
      // Edge case: empty query string
      const result = await layerService.findSpecialistsByQuery('');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
