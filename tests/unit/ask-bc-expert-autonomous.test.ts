/**
 * ask_bc_expert Tool Tests - Autonomous Mode
 *
 * Tests for the autonomous_mode parameter (Issue #28)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAskBcExpertHandler } from "../../src/tools/ask_bc_expert/handler";

describe("ask_bc_expert autonomous_mode (Issue #28)", () => {
  let mockServices: any;
  let handler: any;

  beforeEach(() => {
    // Mock services with proper structure matching askSpecialist return type
    mockServices = {
      knowledgeService: {
        askSpecialist: vi.fn().mockResolvedValue({
          specialist: {
            id: "sam-coder",
            name: "Sam Coder",
            role: "Code Quality Specialist",
            expertise: {
              primary: ["AL code quality", "refactoring"],
            },
          },
          response: `Here's how to approach this:
1. First, analyze the current code structure
2. Identify refactoring opportunities
3. Apply best practices`,
          specialist_full_content: "Full specialist instructions here...",
          consultation_guidance: "Brief guidance snippet",
          follow_up_suggestions: ["roger-reviewer"],
          domains: ["sam-coder"],
        }),
      },
      workflowService: {
        startWorkflow: vi.fn(),
        getPhaseGuidance: vi.fn(),
      },
      codeAnalysisService: {
        analyzeCode: vi.fn(),
        getLastRelevanceMatches: vi.fn(),
      },
    };

    handler = createAskBcExpertHandler(mockServices);
  });

  describe("Basic autonomous_mode functionality", () => {
    it("should succeed with autonomous_mode=true", async () => {
      const result = await handler({
        question: "How do I refactor this code?",
        autonomous_mode: true,
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const response = JSON.parse(result.content[0].text);
      expect(response.response_type).toBe("autonomous_action_plan");
    });

    it("should succeed with autonomous_mode=false", async () => {
      const result = await handler({
        question: "How do I refactor this code?",
        autonomous_mode: false,
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      // In non-autonomous mode, returns agent instructions (text format, not structured JSON)
      const text = result.content[0].text;
      expect(text).toContain("SPECIALIST DEFINITION AND INSTRUCTIONS");
    });

    it("should succeed with autonomous_mode omitted (defaults to false)", async () => {
      const result = await handler({
        question: "How do I refactor this code?",
      });

      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
    });
  });

  describe("Autonomous mode response structure", () => {
    it("should return structured action plan with all required fields", async () => {
      const result = await handler({
        question: "Optimize performance",
        autonomous_mode: true,
      });

      const actionPlan = JSON.parse(result.content[0].text);

      // Top-level structure
      expect(actionPlan.response_type).toBe("autonomous_action_plan");
      expect(actionPlan.specialist).toBeDefined();
      expect(actionPlan.action_plan).toBeDefined();
      expect(actionPlan.recommended_topics).toBeDefined();

      // Specialist info
      expect(actionPlan.specialist.id).toBe("sam-coder");
      expect(actionPlan.specialist.name).toBe("Sam Coder");
      expect(actionPlan.specialist.expertise).toBeDefined();

      // Action plan structure
      expect(actionPlan.action_plan.primary_action).toBeDefined();
      expect(Array.isArray(actionPlan.action_plan.steps)).toBe(true);
      expect(actionPlan.action_plan.confidence).toBeGreaterThanOrEqual(0);
      expect(actionPlan.action_plan.confidence).toBeLessThanOrEqual(1);
    });

    it("should extract numbered steps from response text", async () => {
      const result = await handler({
        question: "How to implement feature?",
        autonomous_mode: true,
      });

      const actionPlan = JSON.parse(result.content[0].text);

      // Should extract the 3 numbered steps from mock response
      expect(actionPlan.action_plan.steps.length).toBeGreaterThan(0);
      expect(actionPlan.action_plan.steps[0]).toContain("analyze");
    });

    it("should handle empty response gracefully", async () => {
      // Mock empty response
      mockServices.knowledgeService.askSpecialist.mockResolvedValueOnce({
        specialist: {
          id: "test-specialist",
          name: "Test Specialist",
          expertise: {},
        },
        response: "", // Empty response
        recommended_topics: [],
      });

      const result = await handler({
        question: "Test question",
        autonomous_mode: true,
      });

      expect(result.isError).toBeFalsy();
      const actionPlan = JSON.parse(result.content[0].text);

      // Should handle empty response without crashing
      expect(actionPlan.action_plan.primary_action).toBe("");
      expect(actionPlan.action_plan.steps).toEqual([]);
    });
  });

  describe("Backward compatibility with consultation object", () => {
    it("should handle legacy response structure with consultation object", async () => {
      // Mock old-style response with nested consultation object
      mockServices.knowledgeService.askSpecialist.mockResolvedValueOnce({
        specialist: {
          id: "legacy-specialist",
          name: "Legacy Specialist",
          expertise: {},
        },
        consultation: {
          response: "Legacy response format",
          confidence: 0.9,
          blocking_issues: ["issue1"],
          alternatives: ["alt1"],
          hand_off_to: "another-specialist",
        },
        recommended_topics: [{ id: "topic1", domain: "tools" }],
      });

      const result = await handler({
        question: "Test legacy format",
        autonomous_mode: true,
      });

      expect(result.isError).toBeFalsy();
      const actionPlan = JSON.parse(result.content[0].text);

      expect(actionPlan.action_plan.primary_action).toBe(
        "Legacy response format",
      );
      expect(actionPlan.action_plan.confidence).toBe(0.9);
      expect(actionPlan.action_plan.blocking_issues).toEqual(["issue1"]);
      expect(actionPlan.next_specialist).toBe("another-specialist");
    });
  });

  describe("Error handling", () => {
    it("should return error when question is missing", async () => {
      const result = await handler({
        autonomous_mode: true,
      });

      expect(result.isError).toBe(true);
      expect(result.error).toContain("required");
    });

    it("should handle service errors gracefully", async () => {
      mockServices.knowledgeService.askSpecialist.mockRejectedValueOnce(
        new Error("Service unavailable"),
      );

      const result = await handler({
        question: "Test question",
        autonomous_mode: true,
      });

      expect(result.isError).toBe(true);
      expect(result.error).toContain("Service unavailable");
    });

    it("should handle missing recommended_topics gracefully", async () => {
      mockServices.knowledgeService.askSpecialist.mockResolvedValueOnce({
        specialist: {
          id: "test-specialist",
          name: "Test",
          expertise: {},
        },
        response: "Test response",
        // recommended_topics intentionally missing
      });

      const result = await handler({
        question: "Test",
        autonomous_mode: true,
      });

      expect(result.isError).toBeFalsy();
      const actionPlan = JSON.parse(result.content[0].text);
      expect(actionPlan.recommended_topics).toEqual([]);
    });
  });
});
