/**
 * Contract Validation Script
 *
 * Validates that every tool schema option has a corresponding implementation.
 * Run this during CI/CD and at server startup to catch dead ends early.
 */

import { allTools } from "../src/tools/index.ts";
import {
  createToolHandlers,
  type HandlerServices,
  type WorkspaceContext,
} from "../src/tools/handlers.ts";

interface ValidationResult {
  toolName: string;
  issues: string[];
  warnings: string[];
}

async function validateContracts(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  console.log("Creating mock services...");

  // Create mock services for validation
  console.log("  - Creating mockKnowledgeService");
  const mockServices = {
    knowledgeService: createMockKnowledgeService(),
    methodologyService: createMockMethodologyService(),
    codeAnalysisService: createMockCodeAnalysisService(),
    workflowService: createMockWorkflowService(),
    layerService: createMockLayerService(),
    workflowSessionManager: createMockWorkflowSessionManager(),
  };
  console.log("  ✅ All mock services created");

  try {
    // Create mock workspace context
    console.log("Creating mock workspace context...");
    const mockWorkspaceContext: WorkspaceContext = {
      setWorkspaceInfo: async () => ({
        success: true,
        message: "test",
        reloaded: false,
      }),
      getWorkspaceInfo: () => ({ workspace_root: null, available_mcps: [] }),
    };
    console.log("  ✅ Mock workspace context created");

    console.log("Creating tool handlers...");
    const handlers = createToolHandlers(mockServices, mockWorkspaceContext);
    console.log(`  ✅ Created ${handlers.size} handlers`);

    console.log("\nValidating tools...");
    for (const tool of allTools) {
      console.log(`  Validating: ${tool.name}`);
      const validation: ValidationResult = {
        toolName: tool.name,
        issues: [],
        warnings: [],
      };

      // Check if handler exists
      const handler = handlers.get(tool.name);
      if (!handler) {
        validation.issues.push(`No handler found for tool: ${tool.name}`);
        results.push(validation);
        continue;
      }

      // Validate enum options in schema
      await validateEnumOptions(tool, handler, validation);

      // Test basic handler execution
      await testHandlerExecution(tool, handler, validation);

      results.push(validation);
    }
  } catch (error) {
    results.push({
      toolName: "SYSTEM",
      issues: [`Failed to create handlers: ${error}`],
      warnings: [],
    });
  }

  return results;
}

async function validateEnumOptions(
  tool: any,
  handler: Function,
  validation: ValidationResult,
) {
  const schema = tool.inputSchema;

  if (schema?.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as any;

      if (prop.enum) {
        // For workflow_type, validate against actual service capabilities
        if (propName === "workflow_type") {
          await validateWorkflowTypes(prop.enum, validation);
        }

        // For analysis_type, validate against service implementation
        if (propName === "analysis_type") {
          await validateAnalysisTypes(prop.enum, validation);
        }

        // For search_type, validate against service methods
        if (propName === "search_type") {
          await validateSearchTypes(prop.enum, validation);
        }
      }
    }
  }
}

async function validateWorkflowTypes(
  enumValues: string[],
  validation: ValidationResult,
) {
  // Expected types for v1 WorkflowService
  const v1Types = [
    "new-bc-app",
    "enhance-bc-app",
    "review-bc-code",
    "debug-bc-issues",
    "modernize-bc-code",
    "onboard-developer",
    "upgrade-bc-version",
    "add-ecosystem-features",
    "document-bc-solution",
  ];

  // Built-in types for WorkflowSessionManager (v2 workflow system)
  // Note: The workflow system also supports custom workflow types from company/project layers,
  // which are registered at runtime and cannot be validated statically
  const v2BuiltInTypes = [
    "code-review",
    "proposal-review",
    "performance-audit",
    "security-audit",
    "onboarding",
    "error-to-errorinfo-migration",
    "bc-version-upgrade",
  ];

  // Combine both for validation - tool can use either system
  const allKnownTypes = [...v1Types, ...v2BuiltInTypes];

  for (const enumValue of enumValues) {
    if (!allKnownTypes.includes(enumValue)) {
      // Only warn, don't error - could be a custom type from a layer
      validation.warnings.push(
        `Workflow type '${enumValue}' is not a built-in type. ` +
          `Ensure it's registered as a custom workflow in a company/project layer.`,
      );
    }
  }
}

async function validateAnalysisTypes(
  enumValues: string[],
  validation: ValidationResult,
) {
  // These should match the filterPatternsByAnalysisType method
  const expectedTypes = [
    "performance",
    "quality",
    "security",
    "patterns",
    "optimization",
    "general",
    "comprehensive",
  ];

  for (const enumValue of enumValues) {
    if (!expectedTypes.includes(enumValue)) {
      validation.issues.push(
        `Analysis type '${enumValue}' not implemented in CodeAnalysisService`,
      );
    }
  }
}

async function validateSearchTypes(
  enumValues: string[],
  validation: ValidationResult,
) {
  // These should correspond to actual search capabilities
  const validTypes = ["topics", "specialists", "workflows", "all"];

  for (const enumValue of enumValues) {
    if (!validTypes.includes(enumValue)) {
      validation.issues.push(`Search type '${enumValue}' not supported`);
    }
  }
}

async function testHandlerExecution(
  tool: any,
  handler: Function,
  validation: ValidationResult,
) {
  // Skip execution test for tools that perform file I/O operations
  // These would fail with mock/test data and shouldn't be executed during validation
  const skipExecutionTest = [
    "extract_bc_snapshot", // Tries to extract ZIP files
    "scaffold_layer_repo", // Creates directories
    "create_layer_content", // Creates files
  ];

  if (skipExecutionTest.includes(tool.name)) {
    validation.warnings.push(`Skipping execution test for file I/O tool`);
    return;
  }

  try {
    // Create minimal valid arguments based on required fields
    const testArgs = createTestArgs(tool);

    // Try to execute handler (should not throw)
    const result = await handler(testArgs);

    if (!result) {
      validation.warnings.push(`Handler returned falsy value`);
    }

    if (!result.content && !result.error) {
      validation.warnings.push(`Handler returned unexpected result format`);
    }
  } catch (error) {
    validation.issues.push(`Handler execution failed: ${error}`);
  }
}

function createTestArgs(tool: any): any {
  const args: any = {};
  const schema = tool.inputSchema;

  if (schema?.required) {
    for (const requiredField of schema.required) {
      const propSchema = schema.properties?.[requiredField];

      if (propSchema) {
        args[requiredField] = createTestValue(propSchema);
      }
    }
  }

  return args;
}

function createTestValue(propSchema: any): any {
  if (propSchema.type === "string") {
    if (propSchema.enum) {
      return propSchema.enum[0]; // Use first enum value
    }
    return "test-value";
  }

  if (propSchema.type === "array") {
    // For arrays, return empty array or array with test items based on item schema
    if (propSchema.items?.type === "string") {
      return ["test-item"];
    }
    return [];
  }

  if (propSchema.type === "number") {
    return propSchema.default || 10;
  }

  if (propSchema.type === "boolean") {
    return propSchema.default || false;
  }

  if (propSchema.type === "object") {
    return {};
  }

  return "test";
}

// Mock service factories
function createMockKnowledgeService() {
  return {
    searchTopics: async () => [],
    getTopic: async () => null,
    findSpecialistsByQuery: () => [],
    askSpecialist: async () => ({
      specialist: {},
      question: "",
      relevant_knowledge: [],
      consultation_guidance: "",
      follow_up_suggestions: [],
    }),
  };
}

function createMockMethodologyService() {
  return {
    findWorkflowsByQuery: async () => [],
  };
}

function createMockCodeAnalysisService() {
  return {
    analyzeCode: async () => ({
      issues: [],
      patterns_detected: [],
      optimization_opportunities: [],
      suggested_topics: [],
    }),
  };
}

function createMockWorkflowService() {
  return {
    startWorkflow: async () => ({
      id: "test",
      type: "test",
      current_phase: 0,
      specialist_pipeline: [],
    }),
    getPhaseGuidance: async () => "test guidance",
    advancePhase: async () => ({ session: {}, progress_percentage: 0 }),
    getActiveWorkflows: async () => [],
    getWorkflowStatus: async () => ({ session: {}, progress_percentage: 0 }),
    getWorkflowMethodology: async () => ({ workflow_id: "test", phases: [] }),
  };
}

function createMockLayerService() {
  return {
    getAllSpecialists: async () => [],
    getLayers: () => [],
  };
}

function createMockWorkflowSessionManager() {
  const mockSession = {
    id: "wf-test-session",
    workflow_type: "code-review",
    status: "in_progress",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    file_inventory: [],
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
    files_total: 0,
    findings: [],
    proposed_changes: [],
    options: {},
  };

  return {
    setWorkspaceRoot: () => {},
    getSession: async () => mockSession,
    createSession: async () => {},
    updateSession: async () => {},
    deleteSession: async () => {},
    startWorkflow: async () => ({
      session: mockSession,
      analysisSummary: undefined,
      duration_ms: 100,
    }),
    getNextAction: () => ({
      type: "complete_workflow",
      instruction: "Test instruction",
    }),
    expandChecklist: () => {},
    reportProgress: async () => ({
      type: "complete_workflow",
      instruction: "Test instruction",
    }),
    generateReport: async () => "# Test Report",
  };
}

// Main execution
export async function runContractValidation(): Promise<boolean> {
  console.log("🔍 Validating MCP Tool Contracts...\n");

  const results = await validateContracts();
  let hasIssues = false;

  for (const result of results) {
    if (result.issues.length > 0 || result.warnings.length > 0) {
      console.log(`📋 ${result.toolName}:`);

      for (const issue of result.issues) {
        console.log(`  ❌ ${issue}`);
        hasIssues = true;
      }

      for (const warning of result.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }

      console.log("");
    }
  }

  if (!hasIssues) {
    console.log("✅ All tool contracts validated successfully!");
  } else {
    console.log("💥 Contract validation failed! Fix issues before release.");
  }

  return !hasIssues;
}

// CLI execution
const isMainModule =
  process.argv[1] && process.argv[1].includes("validate-contracts");
if (isMainModule) {
  console.log("🚀 Starting contract validation...");
  runContractValidation()
    .then((success) => {
      console.log(`\n📊 Validation ${success ? "PASSED" : "FAILED"}`);
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Contract validation crashed:", error);
      process.exit(1);
    });
}
