import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import { WorkflowSessionManager } from "../../src/services/workflow-v2/workflow-session-manager.js";
import {
  WorkflowType,
  WorkflowSession,
  WorkflowOptions,
} from "../../src/types/workflow-v2-types.js";

// Mock fs module
vi.mock("fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  stat: vi.fn(),
}));

// Mock glob module
vi.mock("glob", () => ({
  glob: vi.fn(),
}));

describe("WorkflowSessionManagerV2", () => {
  let manager: WorkflowSessionManager;
  const testWorkspaceRoot = "/test/workspace";

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new WorkflowSessionManager();
    manager.setWorkspaceRoot(testWorkspaceRoot);

    // Setup default mocks
    (fs.mkdir as any).mockResolvedValue(undefined);
    (fs.writeFile as any).mockResolvedValue(undefined);
    (fs.stat as any).mockResolvedValue({ size: 1000 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Session Lifecycle", () => {
    it("should create a new session", async () => {
      const session: WorkflowSession = {
        id: "test-session-1",
        workflow_type: "code-review",
        status: "initializing",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [],
        file_glob_pattern: "**/*.al",
        phases: [],
        current_phase: "inventory",
        current_file_index: 0,
        files_completed: 0,
        files_total: 0,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);

      const retrieved = await manager.getSession("test-session-1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe("test-session-1");
      expect(retrieved?.workflow_type).toBe("code-review");
    });

    it("should update an existing session", async () => {
      const session: WorkflowSession = {
        id: "test-session-2",
        workflow_type: "code-review",
        status: "initializing",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [],
        file_glob_pattern: "**/*.al",
        phases: [],
        current_phase: "inventory",
        current_file_index: 0,
        files_completed: 0,
        files_total: 10,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);

      session.status = "in_progress";
      session.files_completed = 5;
      await manager.updateSession(session);

      const retrieved = await manager.getSession("test-session-2");
      expect(retrieved?.status).toBe("in_progress");
      expect(retrieved?.files_completed).toBe(5);
    });

    it("should delete a session", async () => {
      const session: WorkflowSession = {
        id: "test-session-3",
        workflow_type: "code-review",
        status: "initializing",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [],
        file_glob_pattern: "**/*.al",
        phases: [],
        current_phase: "inventory",
        current_file_index: 0,
        files_completed: 0,
        files_total: 0,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);
      await manager.deleteSession("test-session-3");

      const retrieved = await manager.getSession("test-session-3");
      expect(retrieved).toBeNull();
    });

    it("should return null for non-existent session", async () => {
      const retrieved = await manager.getSession("non-existent-session");
      expect(retrieved).toBeNull();
    });
  });

  describe("Workflow Types", () => {
    const workflowTypes: WorkflowType[] = [
      "code-review",
      "proposal-review",
      "performance-audit",
      "security-audit",
      "onboarding",
      "error-to-errorinfo-migration",
      "bc-version-upgrade",
    ];

    it.each(workflowTypes)(
      "should support workflow type: %s",
      async (workflowType) => {
        const session: WorkflowSession = {
          id: `test-${workflowType}`,
          workflow_type: workflowType,
          status: "initializing",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          file_inventory: [],
          file_glob_pattern: "**/*.al",
          phases: [],
          current_phase: "inventory",
          current_file_index: 0,
          files_completed: 0,
          files_total: 0,
          findings: [],
          proposed_changes: [],
          options: {},
        };

        await manager.createSession(session);
        const retrieved = await manager.getSession(`test-${workflowType}`);
        expect(retrieved?.workflow_type).toBe(workflowType);
      },
    );
  });

  describe("Next Action Generation", () => {
    it("should return analyze_file action for pending analysis", async () => {
      const session: WorkflowSession = {
        id: "test-next-action",
        workflow_type: "code-review",
        status: "in_progress",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [
          {
            path: "/test/file.al",
            status: "in_progress",
            checklist: [
              {
                id: "analyze",
                type: "analysis",
                description: "Analyze file",
                status: "pending",
              },
            ],
            findings: [],
            proposed_changes: [],
          },
        ],
        file_glob_pattern: "**/*.al",
        phases: [
          {
            id: "analysis",
            name: "Analysis",
            description: "",
            status: "in_progress",
            mode: "guided",
            required: true,
          },
        ],
        current_phase: "analysis",
        current_file_index: 0,
        files_completed: 0,
        files_total: 1,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);
      const nextAction = manager.getNextAction(session);

      expect(nextAction.type).toBe("analyze_file");
      expect(nextAction.file).toBe("/test/file.al");
    });

    it("should return complete_workflow when all files processed", async () => {
      const session: WorkflowSession = {
        id: "test-complete",
        workflow_type: "code-review",
        status: "in_progress",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [
          {
            path: "/test/file.al",
            status: "completed",
            checklist: [
              {
                id: "analyze",
                type: "analysis",
                description: "Analyze file",
                status: "completed",
              },
            ],
            findings: [],
            proposed_changes: [],
          },
        ],
        file_glob_pattern: "**/*.al",
        phases: [
          {
            id: "analysis",
            name: "Analysis",
            description: "",
            status: "completed",
            mode: "guided",
            required: true,
          },
        ],
        current_phase: "analysis",
        current_file_index: 0,
        files_completed: 1,
        files_total: 1,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);
      const nextAction = manager.getNextAction(session);

      expect(nextAction.type).toBe("complete_workflow");
    });

    it("should return apply_topic action for topic_application checklist items", async () => {
      const session: WorkflowSession = {
        id: "test-topic-action",
        workflow_type: "code-review",
        status: "in_progress",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [
          {
            path: "/test/file.al",
            status: "in_progress",
            checklist: [
              {
                id: "analyze",
                type: "analysis",
                description: "Analyze file",
                status: "completed",
              },
              {
                id: "topic-1",
                type: "topic_application",
                description: "Apply SIFT patterns",
                status: "pending",
                topic_id: "dean-debug/sift-patterns",
              },
            ],
            findings: [],
            proposed_changes: [],
          },
        ],
        file_glob_pattern: "**/*.al",
        phases: [
          {
            id: "analysis",
            name: "Analysis",
            description: "",
            status: "in_progress",
            mode: "guided",
            required: true,
          },
        ],
        current_phase: "analysis",
        current_file_index: 0,
        files_completed: 0,
        files_total: 1,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);
      const nextAction = manager.getNextAction(session);

      expect(nextAction.type).toBe("apply_topic");
      expect(nextAction.topic_id).toBe("dean-debug/sift-patterns");
    });
  });

  describe("Checklist Expansion", () => {
    it("should expand checklist with new topic items", async () => {
      const session: WorkflowSession = {
        id: "test-expand",
        workflow_type: "code-review",
        status: "in_progress",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [
          {
            path: "/test/file.al",
            status: "in_progress",
            checklist: [
              {
                id: "analyze",
                type: "analysis",
                description: "Analyze file",
                status: "completed",
              },
              {
                id: "validate",
                type: "validation",
                description: "Complete review",
                status: "pending",
              },
            ],
            findings: [],
            proposed_changes: [],
          },
        ],
        file_glob_pattern: "**/*.al",
        phases: [
          {
            id: "analysis",
            name: "Analysis",
            description: "",
            status: "in_progress",
            mode: "guided",
            required: true,
          },
        ],
        current_phase: "analysis",
        current_file_index: 0,
        files_completed: 0,
        files_total: 1,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);

      manager.expandChecklist(session, "/test/file.al", [
        {
          topic_id: "dean-debug/sift-patterns",
          relevance_score: 0.9,
          description: "SIFT optimization",
        },
        {
          topic_id: "dean-debug/setloadfields",
          relevance_score: 0.8,
          description: "SetLoadFields usage",
        },
      ]);

      const file = session.file_inventory[0];
      expect(file.checklist.length).toBe(4); // analyze + 2 topics + validate
      expect(file.checklist[1].type).toBe("topic_application");
      expect(file.checklist[1].topic_id).toBe("dean-debug/sift-patterns");
    });
  });

  describe("Progress Reporting", () => {
    it("should update checklist item status and accumulate findings", async () => {
      const session: WorkflowSession = {
        id: "test-progress",
        workflow_type: "code-review",
        status: "in_progress",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [
          {
            path: "/test/file.al",
            status: "in_progress",
            checklist: [
              {
                id: "analyze",
                type: "analysis",
                description: "Analyze file",
                status: "in_progress",
              },
              {
                id: "validate",
                type: "validation",
                description: "Complete review",
                status: "pending",
              },
            ],
            findings: [],
            proposed_changes: [],
          },
        ],
        file_glob_pattern: "**/*.al",
        phases: [
          {
            id: "analysis",
            name: "Analysis",
            description: "",
            status: "in_progress",
            mode: "guided",
            required: true,
          },
        ],
        current_phase: "analysis",
        current_file_index: 0,
        files_completed: 0,
        files_total: 1,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);

      const findings = [
        {
          file: "/test/file.al",
          line: 10,
          severity: "warning" as const,
          category: "performance",
          description: "Manual loop summation detected",
        },
      ];

      await manager.reportProgress(
        session,
        { action: "analyze_file", status: "completed" },
        findings,
      );

      expect(session.file_inventory[0].findings.length).toBe(1);
      expect(session.findings.length).toBe(1);
      expect(session.file_inventory[0].checklist[0].status).toBe("completed");
    });
  });

  describe("Report Generation", () => {
    it("should generate markdown report", async () => {
      const session: WorkflowSession = {
        id: "test-report",
        workflow_type: "code-review",
        status: "completed",
        created_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        updated_at: new Date().toISOString(),
        file_inventory: [
          {
            path: "/test/file.al",
            status: "completed",
            checklist: [],
            findings: [],
            proposed_changes: [],
          },
        ],
        file_glob_pattern: "**/*.al",
        phases: [],
        current_phase: "summary",
        current_file_index: 0,
        files_completed: 1,
        files_total: 1,
        findings: [
          {
            file: "/test/file.al",
            line: 10,
            severity: "warning",
            category: "performance",
            description: "Test warning",
          },
          {
            file: "/test/file.al",
            line: 20,
            severity: "error",
            category: "bug",
            description: "Test error",
          },
        ],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);
      const report = await manager.generateReport(session, "markdown");

      expect(report).toContain("# Code Review Report");
      expect(report).toContain("Session ID");
      expect(report).toContain("Warning: 1");
      expect(report).toContain("Error: 1");
    });

    it("should generate JSON report", async () => {
      const session: WorkflowSession = {
        id: "test-json-report",
        workflow_type: "code-review",
        status: "completed",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: [],
        file_glob_pattern: "**/*.al",
        phases: [],
        current_phase: "summary",
        current_file_index: 0,
        files_completed: 0,
        files_total: 0,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      await manager.createSession(session);
      const report = await manager.generateReport(session, "json");

      const parsed = JSON.parse(report);
      expect(parsed.session_id).toBe("test-json-report");
      expect(parsed.workflow_type).toBe("code-review");
    });
  });

  describe("Error Handling", () => {
    it("should throw error if workspace root not set", async () => {
      const newManager = new WorkflowSessionManager();

      expect(() => {
        // Access private method indirectly
        (newManager as any).getSessionsDir();
      }).toThrow("Workspace root not set");
    });
  });

  describe("Performance", () => {
    it("should handle large file inventories", async () => {
      const files = Array.from({ length: 100 }, (_, i) => ({
        path: `/test/file${i}.al`,
        status: "pending" as const,
        checklist: [
          {
            id: `analyze-${i}`,
            type: "analysis" as const,
            description: "Analyze",
            status: "pending" as const,
          },
        ],
        findings: [],
        proposed_changes: [],
      }));

      const session: WorkflowSession = {
        id: "test-large",
        workflow_type: "code-review",
        status: "in_progress",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        file_inventory: files,
        file_glob_pattern: "**/*.al",
        phases: [
          {
            id: "analysis",
            name: "Analysis",
            description: "",
            status: "in_progress",
            mode: "guided",
            required: true,
          },
        ],
        current_phase: "analysis",
        current_file_index: 0,
        files_completed: 0,
        files_total: 100,
        findings: [],
        proposed_changes: [],
        options: {},
      };

      const startTime = Date.now();
      await manager.createSession(session);
      const nextAction = manager.getNextAction(session);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(nextAction).toBeDefined();
    });
  });
});

/**
 * Tests for custom workflow type registration
 * These test the extensibility features for company/project layers
 */
import {
  registerWorkflowDefinition,
  unregisterWorkflowDefinition,
  clearCustomWorkflowDefinitions,
  isWorkflowTypeAvailable,
  getAvailableWorkflowTypes,
  getBuiltInWorkflowTypes,
  getCustomWorkflowTypes,
  getWorkflowDefinition,
} from "../../src/services/workflow-v2/workflow-definitions.js";
import { WorkflowDefinition } from "../../src/types/workflow-v2-types.js";

describe("Custom Workflow Type Registration", () => {
  // Clean up custom definitions after each test
  afterEach(() => {
    clearCustomWorkflowDefinitions();
  });

  it("should register a custom workflow type", () => {
    const customWorkflow: WorkflowDefinition = {
      type: "custom-company-audit",
      name: "Company Audit Workflow",
      description: "Custom audit workflow for company-specific checks",
      file_patterns: ["**/*.al"],
      phases: [
        {
          id: "scan",
          name: "Scan",
          description: "Scan files",
          required: true,
          mode: "autonomous",
        },
      ],
      per_file_checklist: [
        {
          id: "check",
          type: "analysis",
          description: "Check file",
          required: true,
        },
      ],
      topic_discovery: {
        enabled: false,
        tool: "analyze_al_code",
        auto_expand_checklist: false,
        min_relevance_score: 0.5,
      },
      completion_rules: {
        require_all_files: true,
        require_all_checklist_items: true,
        allow_skip_with_reason: true,
      },
    };

    registerWorkflowDefinition(customWorkflow);

    expect(isWorkflowTypeAvailable("custom-company-audit")).toBe(true);
    expect(getCustomWorkflowTypes()).toContain("custom-company-audit");
    expect(getAvailableWorkflowTypes()).toContain("custom-company-audit");
  });

  it("should retrieve a registered custom workflow definition", () => {
    const customWorkflow: WorkflowDefinition = {
      type: "my-custom-review",
      name: "My Custom Review",
      description: "A custom code review workflow",
      file_patterns: ["**/*.al"],
      phases: [],
      per_file_checklist: [],
      topic_discovery: {
        enabled: false,
        tool: "analyze_al_code",
        auto_expand_checklist: false,
        min_relevance_score: 0.5,
      },
      completion_rules: {
        require_all_files: true,
        require_all_checklist_items: true,
        allow_skip_with_reason: true,
      },
    };

    registerWorkflowDefinition(customWorkflow);

    const retrieved = getWorkflowDefinition("my-custom-review");
    expect(retrieved.name).toBe("My Custom Review");
    expect(retrieved.description).toBe("A custom code review workflow");
  });

  it("should not allow overriding built-in types without explicit flag", () => {
    const overrideWorkflow: WorkflowDefinition = {
      type: "code-review", // Built-in type
      name: "Overridden Code Review",
      description: "Attempting to override",
      file_patterns: ["**/*.al"],
      phases: [],
      per_file_checklist: [],
      topic_discovery: {
        enabled: false,
        tool: "analyze_al_code",
        auto_expand_checklist: false,
        min_relevance_score: 0.5,
      },
      completion_rules: {
        require_all_files: true,
        require_all_checklist_items: true,
        allow_skip_with_reason: true,
      },
    };

    // Should not override without flag
    registerWorkflowDefinition(overrideWorkflow, false);

    // Should still get the built-in definition
    const definition = getWorkflowDefinition("code-review");
    expect(definition.name).toBe("Business Central Code Review");
    expect(definition.name).not.toBe("Overridden Code Review");
  });

  it("should allow overriding built-in types with explicit flag", () => {
    const overrideWorkflow: WorkflowDefinition = {
      type: "code-review", // Built-in type
      name: "Company-Specific Code Review",
      description: "Custom code review with company standards",
      file_patterns: ["**/*.al"],
      phases: [],
      per_file_checklist: [],
      topic_discovery: {
        enabled: false,
        tool: "analyze_al_code",
        auto_expand_checklist: false,
        min_relevance_score: 0.5,
      },
      completion_rules: {
        require_all_files: true,
        require_all_checklist_items: true,
        allow_skip_with_reason: true,
      },
    };

    // Should override with flag
    registerWorkflowDefinition(overrideWorkflow, true);

    // Should get the overridden definition
    const definition = getWorkflowDefinition("code-review");
    expect(definition.name).toBe("Company-Specific Code Review");
  });

  it("should unregister custom workflow types", () => {
    const customWorkflow: WorkflowDefinition = {
      type: "temporary-workflow",
      name: "Temporary",
      description: "Will be removed",
      file_patterns: [],
      phases: [],
      per_file_checklist: [],
      topic_discovery: {
        enabled: false,
        tool: "analyze_al_code",
        auto_expand_checklist: false,
        min_relevance_score: 0.5,
      },
      completion_rules: {
        require_all_files: true,
        require_all_checklist_items: true,
        allow_skip_with_reason: true,
      },
    };

    registerWorkflowDefinition(customWorkflow);
    expect(isWorkflowTypeAvailable("temporary-workflow")).toBe(true);

    const result = unregisterWorkflowDefinition("temporary-workflow");
    expect(result).toBe(true);
    expect(isWorkflowTypeAvailable("temporary-workflow")).toBe(false);
  });

  it("should clear all custom workflow definitions", () => {
    // Register multiple custom workflows
    for (let i = 1; i <= 3; i++) {
      registerWorkflowDefinition({
        type: `custom-workflow-${i}`,
        name: `Custom ${i}`,
        description: `Custom workflow ${i}`,
        file_patterns: [],
        phases: [],
        per_file_checklist: [],
        topic_discovery: {
          enabled: false,
          tool: "analyze_al_code",
          auto_expand_checklist: false,
          min_relevance_score: 0.5,
        },
        completion_rules: {
          require_all_files: true,
          require_all_checklist_items: true,
          allow_skip_with_reason: true,
        },
      });
    }

    expect(getCustomWorkflowTypes().length).toBe(3);

    clearCustomWorkflowDefinitions();

    expect(getCustomWorkflowTypes().length).toBe(0);
    // Built-in types should still be available
    expect(getBuiltInWorkflowTypes().length).toBeGreaterThan(0);
  });

  it("should keep built-in types separate from custom types", () => {
    const builtInTypes = getBuiltInWorkflowTypes();
    expect(builtInTypes).toContain("code-review");
    expect(builtInTypes).toContain("security-audit");
    expect(builtInTypes).toContain("error-to-errorinfo-migration");

    // No custom types initially
    expect(getCustomWorkflowTypes().length).toBe(0);

    // Register a custom type
    registerWorkflowDefinition({
      type: "my-custom",
      name: "My Custom",
      description: "Custom",
      file_patterns: [],
      phases: [],
      per_file_checklist: [],
      topic_discovery: {
        enabled: false,
        tool: "analyze_al_code",
        auto_expand_checklist: false,
        min_relevance_score: 0.5,
      },
      completion_rules: {
        require_all_files: true,
        require_all_checklist_items: true,
        allow_skip_with_reason: true,
      },
    });

    // Built-in count unchanged
    expect(getBuiltInWorkflowTypes().length).toBe(builtInTypes.length);
    // Custom count is 1
    expect(getCustomWorkflowTypes().length).toBe(1);
    // Total available includes both
    expect(getAvailableWorkflowTypes().length).toBe(builtInTypes.length + 1);
  });
});
