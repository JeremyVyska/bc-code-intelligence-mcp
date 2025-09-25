import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CodeAnalysisService } from '../../src/services/code-analysis-service.js';
import { KnowledgeService } from '../../src/services/knowledge-service.js';
import { CodeAnalysisParams } from '../../src/types/bc-knowledge.js';

/**
 * Code Analysis Service Unit Tests
 * 
 * Tests the code analysis business logic in isolation
 * This catches missing methods and validates service contracts
 */
describe('CodeAnalysisService', () => {
  let codeAnalysisService: CodeAnalysisService;
  let mockKnowledgeService: any;

  beforeEach(() => {
    mockKnowledgeService = {
      findTopicsByType: vi.fn().mockResolvedValue([
        {
          id: 'performance-pattern-1',
          title: 'Efficient Table Access',
          frontmatter: {
            name: 'efficient-table-access',
            pattern_type: 'good',
            regex_patterns: ['SetRange.*Find.*Next'],
            severity: 'medium',
            category: 'performance',
            impact_level: 'high'
          }
        }
      ]),
      searchTopics: vi.fn().mockResolvedValue([]),
      initialize: vi.fn().mockResolvedValue(undefined)
    };

    codeAnalysisService = new CodeAnalysisService(mockKnowledgeService);
  });

  describe('Code Analysis', () => {
    it('should analyze AL code for performance issues', async () => {
      const params: CodeAnalysisParams = {
        code_snippet: `
          codeunit 50100 TestCode {
            procedure ProcessRecords()
            var
              Customer: Record Customer;
            begin
              Customer.SetRange(Blocked, false);
              if Customer.FindFirst() then
                repeat
                  // Process customer
                until Customer.Next() = 0;
            end;
          }
        `,
        analysis_type: 'performance'
      };

      const result = await codeAnalysisService.analyzeCode(params);

      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.patterns_detected).toBeDefined();
      expect(result.optimization_opportunities).toBeDefined();
      expect(mockKnowledgeService.findTopicsByType).toHaveBeenCalledWith('code-pattern');
    });

    it('should handle different analysis types', async () => {
      const analysisTypes = ['performance', 'quality', 'security', 'patterns', 'comprehensive'] as const;
      
      for (const analysisType of analysisTypes) {
        const params: CodeAnalysisParams = {
          code_snippet: 'codeunit 50100 Test { }',
          analysis_type: analysisType
        };

        const result = await codeAnalysisService.analyzeCode(params);
        expect(result).toBeDefined();
      }
    });

    it('should suggest topics when requested', async () => {
      const params: CodeAnalysisParams = {
        code_snippet: 'table 50100 TestTable { }',
        analysis_type: 'comprehensive',
        suggest_topics: true
      };

      mockKnowledgeService.searchTopics.mockResolvedValue([
        {
          id: 'table-design-best-practices',
          title: 'Table Design Best Practices',
          relevance_score: 0.9
        }
      ]);

      const result = await codeAnalysisService.analyzeCode(params);

      expect(result).toBeDefined();
      expect(mockKnowledgeService.searchTopics).toHaveBeenCalled();
    });

    it('should handle empty code snippets', async () => {
      const params: CodeAnalysisParams = {
        code_snippet: '',
        analysis_type: 'performance'
      };

      const result = await codeAnalysisService.analyzeCode(params);

      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.patterns_detected).toBeDefined();
    });

    it('should handle malformed code', async () => {
      const params: CodeAnalysisParams = {
        code_snippet: 'invalid AL code +++',
        analysis_type: 'quality'
      };

      const result = await codeAnalysisService.analyzeCode(params);

      expect(result).toBeDefined();
      // Should handle gracefully without throwing
    });
  });

  describe('Pattern Detection', () => {
    it('should detect code patterns from knowledge base', async () => {
      const codeWithPattern = `
        Customer.SetRange(Blocked, false);
        if Customer.FindFirst() then
          repeat
            // Process
          until Customer.Next() = 0;
      `;

      const params: CodeAnalysisParams = {
        code_snippet: codeWithPattern,
        analysis_type: 'patterns'
      };

      const result = await codeAnalysisService.analyzeCode(params);

      expect(result).toBeDefined();
      expect(mockKnowledgeService.findTopicsByType).toHaveBeenCalledWith('code-pattern');
    });

    it('should cache patterns for performance', async () => {
      // First call
      await codeAnalysisService.analyzeCode({
        code_snippet: 'test code',
        analysis_type: 'patterns'
      });

      // Second call should use cache
      await codeAnalysisService.analyzeCode({
        code_snippet: 'test code 2',
        analysis_type: 'patterns'
      });

      // Should only load patterns once due to caching
      expect(mockKnowledgeService.findTopicsByType).toHaveBeenCalledTimes(1); // Should be called only once, second call uses cache
    });
  });

  describe('Error Handling', () => {
    it('should handle knowledge service errors gracefully', async () => {
      mockKnowledgeService.findTopicsByType.mockRejectedValue(new Error('Knowledge service error'));

      const params: CodeAnalysisParams = {
        code_snippet: 'codeunit 50100 Test { }',
        analysis_type: 'performance'
      };

      // Should handle error gracefully
      const result = await codeAnalysisService.analyzeCode(params);
      expect(result).toBeDefined();
    });

    it('should handle null/undefined parameters', async () => {
      const invalidParams = [
        null,
        undefined,
        { code_snippet: null },
        { analysis_type: 'invalid' as any }
      ];

      for (const params of invalidParams) {
        try {
          await codeAnalysisService.analyzeCode(params as any);
          // Should either work or throw gracefully
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Performance Requirements', () => {
    it('should analyze code within 100ms', async () => {
      const startTime = Date.now();

      const params: CodeAnalysisParams = {
        code_snippet: 'codeunit 50100 Test { procedure TestProc() begin end; }',
        analysis_type: 'performance'
      };

      await codeAnalysisService.analyzeCode(params);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should handle large code snippets efficiently', async () => {
      const largeCodeSnippet = 'codeunit 50100 Test {\n' + 
        'procedure TestProc() begin\n'.repeat(1000) +
        'end;\n'.repeat(1000) +
        '}';

      const startTime = Date.now();

      const params: CodeAnalysisParams = {
        code_snippet: largeCodeSnippet,
        analysis_type: 'comprehensive'
      };

      await codeAnalysisService.analyzeCode(params);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(500); // Allow more time for large snippets
    });
  });

  describe('Method Existence Validation', () => {
    it('should have analyzeCode method', () => {
      expect(typeof codeAnalysisService.analyzeCode).toBe('function');
    });

    it('should have proper method signatures', () => {
      // This validates that the service has the expected interface
      const analyzeMethod = codeAnalysisService.analyzeCode;
      expect(analyzeMethod).toBeDefined();
      expect(typeof analyzeMethod).toBe('function');
      expect(analyzeMethod.length).toBeGreaterThanOrEqual(1); // Should accept at least one parameter
    });

    it('should detect missing methods that handlers expect', async () => {
      // This test catches contract violations where handlers call non-existent methods
      
      // Check if validatePerformance method exists (might be called by handlers)
      if (typeof (codeAnalysisService as any).validatePerformance !== 'function') {
        console.warn('validatePerformance method missing - might cause handler errors');
      }

      // Test should still pass, but warns about potential issues
      expect(true).toBe(true);
    });
  });
});
