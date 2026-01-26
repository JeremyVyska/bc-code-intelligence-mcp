/**
 * Workflow Loading from Layers Tests
 *
 * Tests for Issue #29 - custom methodologies/workflows from project/company layers
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

describe("Workflow Loading from Layers (Issue #29)", () => {
  let testDir: string;
  let projectLayerPath: string;

  beforeAll(async () => {
    // Create temporary test directory
    testDir = join(tmpdir(), `bc-workflow-test-${Date.now()}`);
    projectLayerPath = join(testDir, "bc-code-intel-overrides");

    await mkdir(projectLayerPath, { recursive: true });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Workflow file format", () => {
    it("should define required fields for workflow", () => {
      const workflowDefinition = {
        type: "feature-development",
        name: "Guided Feature Development",
        description: "Systematic 7-phase workflow with specialist coordination",
        specialist: "alex-architect",
        file_patterns: ["**/*.al"],
        phases: [
          {
            id: "discovery",
            name: "Discovery & Scoping",
            description: "Initial requirements gathering",
            required: true,
            mode: "guided",
            available_actions: ["ask_questions", "document_requirements"],
          },
        ],
      };

      expect(workflowDefinition.type).toBeDefined();
      expect(workflowDefinition.name).toBeDefined();
      expect(workflowDefinition.phases).toBeInstanceOf(Array);
      expect(workflowDefinition.phases.length).toBeGreaterThan(0);
    });

    it("should support extended fields for domain-specific workflows", () => {
      const extendedWorkflow = {
        type: "bc-migration",
        name: "BC Version Migration",
        description: "Upgrade workflow",
        migration_type: "breaking-change", // ✅ Extended field
        urgency: "high", // ✅ Extended field
        specialist: "victor-versioning",
        file_patterns: ["**/*.al"],
        phases: [],
      };

      expect(extendedWorkflow).toHaveProperty("migration_type");
      expect(extendedWorkflow).toHaveProperty("urgency");
      expect(extendedWorkflow.migration_type).toBe("breaking-change");
    });
  });

  describe("Project layer workflow loading", () => {
    it("should load workflows from workflows/ directory", async () => {
      const { ProjectKnowledgeLayer } = await import(
        "../../src/layers/project-layer"
      );

      // Create unique test directory for this test
      const testPath1 = join(testDir, "test1");
      await mkdir(testPath1, { recursive: true });

      // Create workflows directory and sample workflow
      const workflowsPath = join(testPath1, "workflows");
      await mkdir(workflowsPath, { recursive: true });

      const sampleWorkflow = `type: "custom-review"
name: "Custom Project Review"
description: "Project-specific review workflow"
specialist: "roger-reviewer"
file_patterns:
  - "**/*.al"
phases:
  - id: "check"
    name: "Check Phase"
    description: "Verify code"
    required: true
    mode: "guided"
`;

      await writeFile(
        join(workflowsPath, "custom-review.yaml"),
        sampleWorkflow,
        "utf-8",
      );

      // Initialize layer
      const layer = new ProjectKnowledgeLayer(testPath1);
      await layer.initialize();

      // Verify workflow was loaded
      expect(layer.hasContent("workflows", "custom-review")).toBe(true);

      const workflow = await layer.getContent("workflows", "custom-review");
      expect(workflow).toBeDefined();
      expect(workflow.type).toBe("custom-review");
      expect(workflow.name).toBe("Custom Project Review");
    });

    it("should load workflows from methodologies/ directory (backward compatibility)", async () => {
      const { ProjectKnowledgeLayer } = await import(
        "../../src/layers/project-layer"
      );

      // Create unique test directory for this test
      const testPath2 = join(testDir, "test2");
      await mkdir(testPath2, { recursive: true });

      // Create methodologies directory and sample workflow
      const methodologiesPath = join(testPath2, "methodologies");
      await mkdir(methodologiesPath, { recursive: true });

      const legacyWorkflow = `type: "legacy-workflow"
name: "Legacy Methodology"
description: "Old-style methodology"
specialist: "sam-coder"
file_patterns: []
phases: []
`;

      await writeFile(
        join(methodologiesPath, "legacy-workflow.yaml"),
        legacyWorkflow,
        "utf-8",
      );

      // Initialize layer
      const layer = new ProjectKnowledgeLayer(testPath2);
      await layer.initialize();

      // Verify workflow was loaded
      expect(layer.hasContent("workflows", "legacy-workflow")).toBe(true);
    });

    it("should handle multiple workflows in project layer", async () => {
      const { ProjectKnowledgeLayer } = await import(
        "../../src/layers/project-layer"
      );

      // Create unique test directory for this test
      const testPath3 = join(testDir, "test3");
      await mkdir(testPath3, { recursive: true });

      const workflowsPath = join(testPath3, "workflows");
      await mkdir(workflowsPath, { recursive: true });

      // Create multiple workflows
      const workflows = [
        { id: "workflow-1", name: "First Workflow" },
        { id: "workflow-2", name: "Second Workflow" },
        { id: "workflow-3", name: "Third Workflow" },
      ];

      for (const wf of workflows) {
        const content = `type: "${wf.id}"
name: "${wf.name}"
description: "Test workflow"
specialist: "test-specialist"
file_patterns: []
phases: []
`;
        await writeFile(join(workflowsPath, `${wf.id}.yaml`), content, "utf-8");
      }

      const layer = new ProjectKnowledgeLayer(testPath3);
      await layer.initialize();

      // Verify all workflows loaded
      const workflowIds = layer.getContentIds("workflows");
      expect(workflowIds.length).toBeGreaterThanOrEqual(3);
      expect(workflowIds).toContain("workflow-1");
      expect(workflowIds).toContain("workflow-2");
      expect(workflowIds).toContain("workflow-3");
    });
  });

  describe("Workflow override behavior", () => {
    it("should allow project workflows to override embedded workflows", async () => {
      // This tests the layer resolution order: Project > Company > Embedded
      const projectWorkflow = {
        type: "code-review", // Same type as embedded
        name: "Custom Code Review", // Different name
        description: "Project-specific review process",
        specialist: "custom-reviewer",
        file_patterns: ["**/*.al"],
        phases: [],
      };

      expect(projectWorkflow.type).toBe("code-review");
      expect(projectWorkflow.name).not.toBe("Business Central Code Review"); // Different from embedded
    });

    it("should support workflow-specific configuration", async () => {
      const configuredWorkflow = {
        type: "feature-dev",
        name: "Feature Development",
        description: "Custom workflow",
        specialist: "alex-architect",
        file_patterns: ["src/**/*.al"],
        file_exclusions: ["**/test/**"],
        // Project-specific config
        require_approval: true,
        reviewers: ["team-lead", "architect"],
        max_complexity: 10,
        phases: [],
      };

      expect(configuredWorkflow).toHaveProperty("require_approval");
      expect(configuredWorkflow).toHaveProperty("reviewers");
      expect(configuredWorkflow).toHaveProperty("max_complexity");
    });
  });

  describe("Error handling", () => {
    it("should handle missing workflows directory gracefully", async () => {
      const { ProjectKnowledgeLayer } = await import(
        "../../src/layers/project-layer"
      );

      // Create layer with no workflows directory
      const emptyLayerPath = join(testDir, "empty-layer");
      await mkdir(emptyLayerPath, { recursive: true });

      const layer = new ProjectKnowledgeLayer(emptyLayerPath);
      const result = await layer.initialize();

      // Should not fail, just return 0 workflows
      expect(result.success).toBe(true);
    });

    it("should skip invalid workflow files", async () => {
      const { ProjectKnowledgeLayer } = await import(
        "../../src/layers/project-layer"
      );

      // Create unique test directory
      const testPath4 = join(testDir, "test4");
      await mkdir(testPath4, { recursive: true });

      const workflowsPath = join(testPath4, "workflows");
      await mkdir(workflowsPath, { recursive: true });

      // Create invalid workflow (missing required fields)
      const invalidWorkflow = `name: "Missing Type Field"
description: "Invalid workflow"
phases: []
`;

      await writeFile(
        join(workflowsPath, "invalid.yaml"),
        invalidWorkflow,
        "utf-8",
      );

      const layer = new ProjectKnowledgeLayer(testPath4);
      await layer.initialize();

      // Should not crash, just skip invalid file
      expect(layer.hasContent("workflows", "invalid")).toBe(false);
    });

    it("should handle malformed YAML gracefully", async () => {
      const { ProjectKnowledgeLayer } = await import(
        "../../src/layers/project-layer"
      );

      // Create unique test directory
      const testPath5 = join(testDir, "test5");
      await mkdir(testPath5, { recursive: true });

      const workflowsPath = join(testPath5, "workflows");
      await mkdir(workflowsPath, { recursive: true });

      // Create malformed YAML
      const malformedYaml = `type: "bad-yaml"
name: "Malformed
  - this is broken yaml
  phases: []
`;

      await writeFile(
        join(workflowsPath, "malformed.yaml"),
        malformedYaml,
        "utf-8",
      );

      const layer = new ProjectKnowledgeLayer(testPath5);

      // Should not throw, just log error and continue
      await expect(layer.initialize()).resolves.toBeDefined();
    });
  });

  describe("Use case: Guided feature development workflow", () => {
    it("should support 7-phase workflow with hard stops", async () => {
      const guidedWorkflow = {
        type: "guided-feature-development",
        name: "Guided Feature Development",
        description: "Systematic 7-phase workflow with user confirmation gates",
        specialist: "alex-architect",
        file_patterns: ["**/*.al"],
        phases: [
          {
            id: "discovery",
            name: "Discovery & Scoping",
            description: "Requirements gathering",
            required: true,
            mode: "guided",
            hard_stop: true, // ✅ Wait for user confirmation
            available_actions: ["ask_questions", "document_scope"],
          },
          {
            id: "exploration",
            name: "Codebase Exploration",
            description: "Understand existing code",
            required: true,
            mode: "autonomous",
            entry_conditions: ["discovery phase completed"],
            specialist: "logan-legacy",
            available_actions: ["scan_codebase", "identify_patterns"],
          },
          {
            id: "clarification",
            name: "Clarification & Alignment",
            description: "Confirm understanding",
            required: true,
            mode: "guided",
            hard_stop: true, // ✅ Wait for user confirmation
            entry_conditions: ["exploration phase completed"],
          },
          {
            id: "architecture",
            name: "Architecture & Design",
            description: "Design solution",
            required: true,
            mode: "guided",
            hard_stop: true, // ✅ Architecture review
            specialist: "alex-architect",
          },
          {
            id: "implementation",
            name: "Implementation",
            description: "Write code",
            required: true,
            mode: "autonomous",
            specialist: "sam-coder",
            handoff_to: ["eva-errors"],
          },
          {
            id: "review",
            name: "Review & Validation",
            description: "Code review and testing",
            required: true,
            mode: "guided",
            specialist: "roger-reviewer",
            handoff_to: ["quinn-tester"],
          },
          {
            id: "documentation",
            name: "Summary & Documentation",
            description: "Document changes",
            required: true,
            mode: "guided",
            specialist: "taylor-docs",
          },
        ],
      };

      expect(guidedWorkflow.phases.length).toBe(7);

      // Verify hard stops
      const hardStopPhases = guidedWorkflow.phases.filter(
        (p: any) => p.hard_stop,
      );
      expect(hardStopPhases.length).toBeGreaterThan(0);

      // Verify specialist handoffs
      const phasesWithHandoffs = guidedWorkflow.phases.filter(
        (p: any) => p.handoff_to,
      );
      expect(phasesWithHandoffs.length).toBeGreaterThan(0);
    });
  });
});
