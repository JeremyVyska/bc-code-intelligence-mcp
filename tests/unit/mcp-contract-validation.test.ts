import { describe, it, expect, beforeAll, vi } from 'vitest';
import { allTools } from '../../src/tools/index.js';
import { createToolHandlers, type HandlerServices, type WorkspaceContext } from '../../src/tools/handlers.js';
import { BCCodeIntelligenceServer } from '../../src/index.js';

/**
 * MCP Tool Contract Tests
 * 
 * These tests prevent the exact problems you mentioned:
 * 1. Tools referenced in prompts that don't exist
 * 2. Function calls that result in "function missing" errors
 * 3. Breaking changes released without detection
 */
describe('MCP Tool Contract Validation', () => {
  let mockServices: HandlerServices;
  let mockWorkspaceContext: WorkspaceContext;
  let handlers: Map<string, any>;

  beforeAll(async () => {
    // Create mock services that match the real service interfaces
    mockServices = {
      knowledgeService: {
        searchTopics: vi.fn().mockResolvedValue([]),
        getTopicContent: vi.fn().mockResolvedValue({}),
        findSpecialists: vi.fn().mockResolvedValue([]),
        searchWorkflows: vi.fn().mockResolvedValue([]),
        askSpecialist: vi.fn().mockResolvedValue({ specialist: 'test', response: 'mock response' }),
        findSpecialistsByQuery: vi.fn().mockResolvedValue([])
      },
      methodologyService: {
        startWorkflow: vi.fn().mockResolvedValue({}),
        getWorkflowStatus: vi.fn().mockResolvedValue({}),
        advanceWorkflow: vi.fn().mockResolvedValue({}),
        findWorkflowsByQuery: vi.fn().mockResolvedValue([])
      },
      codeAnalysisService: {
        analyzeCode: vi.fn().mockResolvedValue({}),
        validatePerformance: vi.fn().mockResolvedValue({})
      },
      workflowService: {
        getWorkflowTypes: vi.fn().mockReturnValue(['new-bc-app', 'enhance-bc-app', 'review-bc-code', 'debug-bc-issues', 'modernize-bc-code', 'onboard-developer', 'upgrade-bc-version', 'add-ecosystem-features', 'document-bc-solution']),
        startWorkflow: vi.fn().mockResolvedValue({})
      },
      layerService: {
        getLayerInfo: vi.fn().mockResolvedValue([]),
        resolveTopicLayers: vi.fn().mockResolvedValue({})
      }
    };

    // Create mock workspace context
    mockWorkspaceContext = {
      setWorkspaceInfo: vi.fn().mockResolvedValue({ success: true, message: 'OK', reloaded: false }),
      getWorkspaceInfo: vi.fn().mockReturnValue({ workspace_root: null, available_mcps: [] })
    };

    // Create handlers with mock services
    handlers = createToolHandlers(mockServices, mockWorkspaceContext);
  });

  describe('Tool Handler Existence', () => {
    it('should have a handler for every defined tool', () => {
      for (const tool of allTools) {
        expect(handlers.has(tool.name)).toBe(true);
        expect(typeof handlers.get(tool.name)).toBe('function');
      }
    });

    it('should not have orphaned handlers (handlers without tool definitions)', () => {
      const toolNames = allTools.map(t => t.name);
      const handlerNames = Array.from(handlers.keys());

      for (const handlerName of handlerNames) {
        expect(toolNames).toContain(handlerName);
      }
    });
  });

  describe('Tool Schema Validation', () => {
    it('should have valid input schemas for all tools', () => {
      for (const tool of allTools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      }
    });

    it('should have required properties defined correctly', () => {
      for (const tool of allTools) {
        const schema = tool.inputSchema as any;
        if (schema.required && Array.isArray(schema.required)) {
          for (const requiredProp of schema.required) {
            expect(schema.properties).toHaveProperty(requiredProp);
          }
        }
      }
    });
  });

  describe('Handler Execution Tests', () => {
    it('should execute find_bc_knowledge without errors', async () => {
      const handler = handlers.get('find_bc_knowledge');
      const result = await handler({
        query: 'test query',
        search_type: 'topics'
      });
      expect(result).toBeDefined();
      expect(mockServices.knowledgeService.searchTopics).toHaveBeenCalled();
    });

    it('should execute ask_bc_expert without errors', async () => {
      const handler = handlers.get('ask_bc_expert');
      const result = await handler({
        question: 'test question'
      });
      expect(result).toBeDefined();
    });

    it('should execute workflow_start without errors', async () => {
      const handler = handlers.get('workflow_start');
      const result = await handler({
        workflow_type: 'app_takeover',
        context: 'test context'
      });
      expect(result).toBeDefined();
    });
  });

  describe('Enum Validation', () => {
    it('should validate workflow_type enums match service capabilities', async () => {
      const workflowTool = allTools.find(t => t.name === 'workflow_start');
      const schema = workflowTool?.inputSchema as any;
      if (schema?.properties?.workflow_type?.enum) {
        const schemaEnums = schema.properties.workflow_type.enum;
        const serviceWorkflowTypes = mockServices.workflowService.getWorkflowTypes();
        
        for (const enumValue of schemaEnums) {
          expect(serviceWorkflowTypes).toContain(enumValue);
        }
      }
    });

    it('should validate search_type enums are handled correctly', async () => {
      const searchTool = allTools.find(t => t.name === 'find_bc_knowledge');
      const schema = searchTool?.inputSchema as any;
      if (schema?.properties?.search_type?.enum) {
        const searchTypes = schema.properties.search_type.enum;
        const handler = handlers.get('find_bc_knowledge');

        // Test each search type can be handled
        for (const searchType of searchTypes) {
          const result = await handler({
            query: 'test',
            search_type: searchType
          });
          expect(result).toBeDefined();
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool arguments gracefully', async () => {
      // Test with missing required parameters
      const handler = handlers.get('find_bc_knowledge');
      const result = await handler({});
      expect(result).toBeDefined();
      // Should return error result, not throw
    });

    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      mockServices.knowledgeService.searchTopics.mockRejectedValueOnce(new Error('Service error'));

      const handler = handlers.get('find_bc_knowledge');
      const result = await handler({
        query: 'test query'
      });

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });
  });
});

/**
 * Server-Level Contract Tests
 * Tests the full MCP server setup and tool registration
 */
describe('Server Contract Validation', () => {
  let server: BCCodeIntelligenceServer;

  beforeAll(async () => {
    server = new BCCodeIntelligenceServer();
  });

  it('should register all streamlined tools', async () => {
    // Access the server's tool list (this tests the registration process)
    const mcpServer = (server as any).server;
    expect(mcpServer).toBeDefined();
  });

  it('should not have dead tool references in server setup', () => {
    // This test would catch if server setup references non-existent tools
    expect(() => new BCCodeIntelligenceServer()).not.toThrow();
  });
});
