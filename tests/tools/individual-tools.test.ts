import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStreamlinedHandlers } from '../../src/streamlined-handlers.js';

/**
 * Individual MCP Tool Tests
 * 
 * Tests each tool individually to catch "function missing" errors
 * and ensure proper error handling
 */
describe('Individual MCP Tool Tests', () => {
  let mockServices: any;
  let handlers: any;

  beforeEach(() => {
    // Create comprehensive mock services
    mockServices = {
      knowledgeService: {
        searchTopics: vi.fn().mockResolvedValue([
          { id: 'test-topic', title: 'Test Topic', domain: 'testing' }
        ]),
        getTopicContent: vi.fn().mockResolvedValue({
          content: 'Test content',
          metadata: {}
        }),
        findSpecialistsByQuery: vi.fn().mockResolvedValue([
          { id: 'sam-coder', name: 'Sam Coder', expertise: ['coding'] }
        ]),
        askSpecialist: vi.fn().mockResolvedValue({
          specialist: { id: 'sam-coder', name: 'Sam Coder' },
          response: 'Test specialist response'
        }),
        searchWorkflows: vi.fn().mockResolvedValue([
          { id: 'test-workflow', name: 'Test Workflow' }
        ])
      },
      methodologyService: {
        startWorkflow: vi.fn().mockResolvedValue({
          workflowId: 'test-id',
          status: 'started'
        }),
        getWorkflowStatus: vi.fn().mockResolvedValue({
          status: 'in-progress',
          currentStep: 1
        }),
        advanceWorkflow: vi.fn().mockResolvedValue({
          status: 'advanced',
          nextStep: 2
        })
      },
      codeAnalysisService: {
        analyzeCode: vi.fn().mockResolvedValue({
          analysis: 'Code analysis results',
          suggestions: []
        }),
        validatePerformance: vi.fn().mockResolvedValue({
          score: 85,
          issues: []
        })
      },
      workflowService: {
        getWorkflowTypes: vi.fn().mockReturnValue([
          'app_takeover', 'bug_investigation', 'spec_analysis', 
          'monolith_to_modules', 'data_flow_tracing'
        ]),
        startWorkflow: vi.fn().mockResolvedValue({
          id: 'workflow-123',
          type: 'app_takeover',
          status: 'active'
        }),
        getWorkflow: vi.fn().mockResolvedValue({
          id: 'workflow-123',
          steps: []
        }),
        advancePhase: vi.fn().mockResolvedValue({
          workflow_id: 'workflow-123',
          status: 'advanced',
          next_phase: 2
        })
      },
      layerService: {
        getLayerInfo: vi.fn().mockResolvedValue([
          { name: 'embedded', active: true, priority: 1 }
        ]),
        resolveTopicLayers: vi.fn().mockResolvedValue({
          topic: 'test-topic',
          layers: ['embedded']
        }),
        getConfigurationStatus: vi.fn().mockResolvedValue({
          status: 'configured',
          layers: 1
        })
      }
    };

    handlers = createStreamlinedHandlers(null, mockServices);
  });

  describe('find_bc_knowledge Tool', () => {
    it('should handle topic search correctly', async () => {
      const result = await handlers.find_bc_knowledge({
        query: 'posting routines',
        search_type: 'topics',
        limit: 5
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(mockServices.knowledgeService.searchTopics).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'posting routines',
          limit: 5
        })
      );
    });

    it('should handle specialist search correctly', async () => {
      const result = await handlers.find_bc_knowledge({
        query: 'performance expert',
        search_type: 'specialists'
      });

      expect(result).toBeDefined();
      expect(mockServices.knowledgeService.findSpecialistsByQuery).toHaveBeenCalled();
    });

    it('should handle missing query parameter', async () => {
      const result = await handlers.find_bc_knowledge({});

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });

    it('should handle invalid search_type', async () => {
      const result = await handlers.find_bc_knowledge({
        query: 'test',
        search_type: 'invalid_type'
      });

      expect(result).toBeDefined();
      // Should either handle gracefully or return error
    });
  });

  describe('ask_bc_expert Tool', () => {
    it('should handle expert consultation correctly', async () => {
      const result = await handlers.ask_bc_expert({
        question: 'How do I optimize posting routines?',
        context: 'Working on BC22 performance'
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should handle missing question parameter', async () => {
      const result = await handlers.ask_bc_expert({});

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });
  });

  describe('start_bc_workflow Tool', () => {
    it('should start workflow correctly', async () => {
      const result = await handlers.start_bc_workflow({
        workflow_type: 'app_takeover',
        context: 'Taking over legacy BC app'
      });

      expect(result).toBeDefined();
      expect(mockServices.workflowService.startWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          workflow_type: 'app_takeover',
          project_context: 'Taking over legacy BC app'
        })
      );
    });

    it('should handle invalid workflow_type', async () => {
      const result = await handlers.start_bc_workflow({
        workflow_type: 'invalid_workflow',
        context: 'test'
      });

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });

    it('should handle missing required parameters', async () => {
      const result = await handlers.start_bc_workflow({});

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });
  });

  describe('advance_workflow Tool', () => {
    it('should advance workflow correctly', async () => {
      const result = await handlers.advance_workflow({
        workflow_id: 'test-workflow-id',
        completed_step: 'Analysis completed'
      });

      expect(result).toBeDefined();
      expect(mockServices.workflowService.advancePhase).toHaveBeenCalled();
    });

    it('should handle missing workflow_id', async () => {
      const result = await handlers.advance_workflow({});

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });
  });

  describe('get_workflow_status Tool', () => {
    it('should get workflow status correctly', async () => {
      const result = await handlers.get_workflow_status({
        workflow_id: 'test-workflow-id'
      });

      expect(result).toBeDefined();
      expect(mockServices.workflowService.getWorkflow).toHaveBeenCalledWith(
        'test-workflow-id'
      );
    });
  });

  describe('analyze_bc_code Tool', () => {
    it('should analyze code correctly', async () => {
      const result = await handlers.analyze_bc_code({
        code_snippet: 'codeunit 50100 Test { }',
        analysis_type: 'performance'
      });

      expect(result).toBeDefined();
      expect(mockServices.codeAnalysisService.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'codeunit 50100 Test { }',
          analysisType: 'performance'
        })
      );
    });

    it('should handle missing code_snippet', async () => {
      const result = await handlers.analyze_bc_code({
        analysis_type: 'performance'
      });

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });
  });

  describe('get_layer_info Tool', () => {
    it('should get layer information correctly', async () => {
      const result = await handlers.get_layer_info({});

      expect(result).toBeDefined();
      expect(mockServices.layerService.getLayerInfo).toHaveBeenCalled();
    });
  });

  describe('resolve_topic_layers Tool', () => {
    it('should resolve topic layers correctly', async () => {
      const result = await handlers.resolve_topic_layers({
        topic_id: 'test-topic-id'
      });

      expect(result).toBeDefined();
      expect(mockServices.layerService.resolveTopicLayers).toHaveBeenCalledWith(
        'test-topic-id'
      );
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle service errors consistently across all tools', async () => {
      // Make all services throw errors
      Object.values(mockServices).forEach((service: any) => {
        Object.values(service).forEach((method: any) => {
          if (typeof method === 'function' && method.mockRejectedValue) {
            method.mockRejectedValue(new Error('Service error'));
          }
        });
      });

      const toolTests = [
        { name: 'find_bc_knowledge', args: { query: 'test' } },
        { name: 'ask_bc_expert', args: { question: 'test' } },
        { name: 'start_bc_workflow', args: { workflow_type: 'app_takeover' } },
        { name: 'analyze_bc_code', args: { code_snippet: 'test', analysis_type: 'performance' } }
      ];

      for (const test of toolTests) {
        const result = await handlers[test.name](test.args);
        
        expect(result).toBeDefined();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('Error');
      }
    });
  });
});
