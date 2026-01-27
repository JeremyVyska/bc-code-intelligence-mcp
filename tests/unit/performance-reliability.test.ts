import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  createToolHandlers,
  type HandlerServices,
  type WorkspaceContext,
} from "../../src/tools/handlers.js";

/**
 * Performance and Reliability Tests
 *
 * These tests ensure the MCP server meets performance requirements
 * and handles edge cases gracefully
 */
describe("Performance and Reliability Tests", () => {
  let mockServices: HandlerServices;
  let mockWorkspaceContext: WorkspaceContext;
  let handlers: Map<string, any>;

  beforeAll(() => {
    // Create mock services with realistic delays
    mockServices = {
      knowledgeService: {
        searchTopics: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10)); // 10ms delay
          return [{ id: "topic1", title: "Test Topic" }];
        }),
        getTopicContent: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 15));
          return { content: "Topic content" };
        }),
        findSpecialistsByQuery: vi.fn().mockResolvedValue([]),
        askSpecialist: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay
          return {
            specialist: { id: "test", name: "Test" },
            response: "Test response",
          };
        }),
        searchWorkflows: vi.fn().mockResolvedValue([]),
      },
      methodologyService: {
        startWorkflow: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { workflowId: "test-id" };
        }),
        getWorkflowStatus: vi.fn().mockResolvedValue({ status: "active" }),
        advanceWorkflow: vi.fn().mockResolvedValue({ status: "advanced" }),
        findWorkflowsByQuery: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return [{ name: "test-workflow", description: "Test workflow" }];
        }),
      },
      codeAnalysisService: {
        analyzeCode: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return { analysis: "Code looks good" };
        }),
        validatePerformance: vi.fn().mockResolvedValue({ score: 85 }),
      },
      workflowService: {
        getWorkflowTypes: vi.fn().mockReturnValue(["app_takeover"]),
        startWorkflow: vi.fn().mockResolvedValue({ id: "workflow-123" }),
        getWorkflow: vi.fn().mockResolvedValue({ id: "workflow-123" }),
      },
      layerService: {
        getLayerInfo: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return [{ name: "embedded", active: true }];
        }),
        resolveTopicLayers: vi.fn().mockResolvedValue({ layers: [] }),
        getConfigurationStatus: vi.fn().mockResolvedValue({ status: "ok" }),
      },
    };

    // Create mock workspace context
    mockWorkspaceContext = {
      setWorkspaceInfo: vi
        .fn()
        .mockResolvedValue({ success: true, message: "OK", reloaded: false }),
      getWorkspaceInfo: vi
        .fn()
        .mockReturnValue({ workspace_root: null, available_mcps: [] }),
    };

    handlers = createToolHandlers(mockServices, mockWorkspaceContext);
  });

  describe("Response Time Performance", () => {
    it("should respond to find_bc_knowledge within 100ms", async () => {
      const startTime = Date.now();

      const result = await handlers.get("find_bc_knowledge")({
        query: "test query",
        search_type: "topics",
        limit: 5,
      });

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it("should respond to ask_bc_expert within 100ms", async () => {
      const startTime = Date.now();

      const result = await handlers.get("ask_bc_expert")({
        question: "How to optimize performance?",
      });

      const duration = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Concurrent Request Handling", () => {
    it("should handle multiple concurrent requests without degradation", async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map(() =>
          handlers.get("find_bc_knowledge")({
            query: "concurrent test",
            search_type: "topics",
          }),
        );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should complete successfully
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.isError).not.toBe(true);
      });

      // Should not take much longer than a single request
      expect(duration).toBeLessThan(200);
    });

    it("should handle mixed tool types concurrently", async () => {
      const requests = [
        handlers.get("find_bc_knowledge")({ query: "test1" }),
        handlers.get("ask_bc_expert")({ question: "test2" }),
        handlers.get("workflow_start")({ workflow_type: "app_takeover" }),
      ];

      const results = await Promise.all(requests);

      results.forEach((result) => {
        expect(result).toBeDefined();
      });
    });
  });

  describe("Memory and Resource Management", () => {
    it("should not leak memory with repeated requests", async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Make many requests
      for (let i = 0; i < 100; i++) {
        await handlers.get("find_bc_knowledge")({
          query: `test query ${i}`,
          search_type: "topics",
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory should not increase significantly (allow for some variance)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB max increase
    });

    it("should handle large request payloads efficiently", async () => {
      const largeQuery = "test query ".repeat(1000); // ~10KB query
      const largeCode = "codeunit Test { ".repeat(500) + "}"; // Large code snippet

      const startTime = Date.now();

      const results = await Promise.all([
        handlers.get("find_bc_knowledge")({
          query: largeQuery,
          search_type: "topics",
        }),
      ]);

      const duration = Date.now() - startTime;

      results.forEach((result) => {
        expect(result).toBeDefined();
      });

      // Should still be reasonably fast
      expect(duration).toBeLessThan(200);
    });
  });

  describe("Error Recovery and Resilience", () => {
    it("should recover from service timeouts", async () => {
      // Mock a service that times out
      const slowService = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        throw new Error("Service timeout");
      });

      mockServices.knowledgeService.searchTopics = slowService;

      const result = await handlers.get("find_bc_knowledge")({
        query: "timeout test",
      });

      expect(result).toBeDefined();
      expect(result.isError).toBe(true);
    });

    it("should handle service exceptions gracefully", async () => {
      // Mock services to throw various errors
      const errorTypes = [
        new Error("Network error"),
        new TypeError("Type error"),
        new ReferenceError("Reference error"),
        "String error",
        { custom: "object error" },
        null,
        undefined,
      ];

      for (const error of errorTypes) {
        mockServices.knowledgeService.searchTopics = vi
          .fn()
          .mockRejectedValue(error);

        const result = await handlers.get("find_bc_knowledge")({
          query: "error test",
        });

        expect(result).toBeDefined();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Error");
      }
    });

    it("should handle malformed arguments without crashing", async () => {
      const malformedInputs = [
        null,
        undefined,
        "string instead of object",
        123,
        [],
        { circular: {} },
        { veryLongProperty: "x".repeat(10000) },
        { specialChars: '\\n\\r\\t\\"\\\\' },
        { unicode: "🚀🔧💻🎯" },
      ];

      // Set up circular reference
      (malformedInputs[5] as any).circular = malformedInputs[5];

      for (const input of malformedInputs) {
        try {
          const result = await handlers.get("find_bc_knowledge")(input as any);
          expect(result).toBeDefined();
          // Should either work or return error, but not crash
        } catch (error) {
          // Catching is also acceptable - just shouldn't crash the process
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe("Service Integration Reliability", () => {
    it("should continue working when some services are unavailable", async () => {
      // Disable methodology service
      mockServices.methodologyService = null;

      // Recreate handlers with partial services
      const partialHandlers = createToolHandlers(
        mockServices,
        mockWorkspaceContext,
      );

      // These should still work
      const workingResults = await Promise.all([
        partialHandlers.get("find_bc_knowledge")({ query: "test" }),
      ]);

      workingResults.forEach((result) => {
        expect(result).toBeDefined();
      });

      // This might fail gracefully
      const workflowResult = await partialHandlers.get("workflow_start")({
        workflow_type: "app_takeover",
      });

      expect(workflowResult).toBeDefined();
      // Should return error, not crash
      if (workflowResult.isError) {
        expect(workflowResult.content[0].text).toContain("Error");
      }
    });
  });

  describe("Rate Limiting and Throttling", () => {
    it("should handle rapid successive requests", async () => {
      const rapidRequests = Array(50)
        .fill(null)
        .map((_, i) =>
          handlers.get("find_bc_knowledge")({
            query: `rapid test ${i}`,
            search_type: "topics",
          }),
        );

      const results = await Promise.allSettled(rapidRequests);

      // Most should succeed, some might be rate limited but shouldn't crash
      const successes = results.filter((r) => r.status === "fulfilled");
      expect(successes.length).toBeGreaterThan(40); // At least 80% success rate
    });
  });
});
