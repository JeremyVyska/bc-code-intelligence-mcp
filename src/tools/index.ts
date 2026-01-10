/**
 * Centralized MCP Tools Registry
 *
 * ALL MCP tools exposed by the BC Code Intelligence server are defined and exported here.
 * This provides a single source of truth for:
 * - Tool definitions (schemas and descriptions)
 * - Tool handlers (implementation)
 * - Tool organization and discoverability
 *
 * Architecture: One folder per MCP tool for easy discovery and maintenance
 * - Each tool folder contains: schema.ts (tool definition) and handler.ts (implementation)
 * - Debug tools are in /debug/ subfolder (enabled via developer.enable_diagnostic_tools)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// CORE KNOWLEDGE TOOLS (8 tools)
// ============================================================================

// Knowledge Query Tools (2 tools)
export { findBcKnowledgeTool } from './find_bc_knowledge/schema.js';
export { getBcTopicTool } from './get_bc_topic/schema.js';

// Specialist Consultation (1 tool)
export { askBcExpertTool } from './ask_bc_expert/schema.js';

// Code Analysis (1 tool)
export { analyzeAlCodeTool } from './analyze_al_code/schema.js';

// Workflow Execution (3 tools)
export { startBcWorkflowTool } from './start_bc_workflow/schema.js';
export { advanceWorkflowTool } from './advance_workflow/schema.js';
export { getWorkflowHelpTool } from './get_workflow_help/schema.js';

// Specialist Listing (1 tool)
export { listSpecialistsTool } from './list_specialists/schema.js';

// ============================================================================
// WORKSPACE TOOLS (2 tools - always available)
// ============================================================================

export { setWorkspaceInfoTool } from './set_workspace_info/schema.js';
export { getWorkspaceInfoTool } from './get_workspace_info/schema.js';

// ============================================================================
// REMOVED TOOLS (never used by agents - removed to reduce context overhead)
// ============================================================================
// - discover_specialists, browse_specialists, get_specialist_info (use list_specialists instead)
// - introduce_bc_specialists, get_specialist_introduction, suggest_next_specialist (never selected)
// - handoff_to_specialist, bring_in_specialist, get_handoff_summary (never selected)

// ============================================================================
// DEBUG/DIAGNOSTIC TOOLS (6 tools - opt-in via developer.enable_diagnostic_tools)
// ============================================================================

export { diagnoseGitLayerTool } from './debug/diagnose_git_layer/schema.js';
export { validateLayerConfigTool } from './debug/validate_layer_config/schema.js';
export { testAzureDevOpsPATTool } from './debug/test_azure_devops_pat/schema.js';
export { getLayerDiagnosticsTool } from './debug/get_layer_diagnostics/schema.js';
export { diagnoseLocalLayerTool } from './debug/diagnose_local_layer/schema.js';
export { reloadLayersTool } from './debug/reload_layers/schema.js';

// ============================================================================
// AGGREGATED TOOL ARRAYS
// ============================================================================

import { findBcKnowledgeTool } from './find_bc_knowledge/schema.js';
import { getBcTopicTool } from './get_bc_topic/schema.js';
import { askBcExpertTool } from './ask_bc_expert/schema.js';
import { analyzeAlCodeTool } from './analyze_al_code/schema.js';
import { startBcWorkflowTool } from './start_bc_workflow/schema.js';
import { advanceWorkflowTool } from './advance_workflow/schema.js';
import { getWorkflowHelpTool } from './get_workflow_help/schema.js';
import { listSpecialistsTool } from './list_specialists/schema.js';
import { setWorkspaceInfoTool } from './set_workspace_info/schema.js';
import { getWorkspaceInfoTool } from './get_workspace_info/schema.js';
import { diagnoseGitLayerTool } from './debug/diagnose_git_layer/schema.js';
import { validateLayerConfigTool } from './debug/validate_layer_config/schema.js';
import { testAzureDevOpsPATTool } from './debug/test_azure_devops_pat/schema.js';
import { getLayerDiagnosticsTool } from './debug/get_layer_diagnostics/schema.js';
import { diagnoseLocalLayerTool } from './debug/diagnose_local_layer/schema.js';
import { reloadLayersTool } from './debug/reload_layers/schema.js';

/**
 * Core 8 streamlined tools (primary interface)
 */
export const coreKnowledgeTools: Tool[] = [
  findBcKnowledgeTool,
  getBcTopicTool,
  askBcExpertTool,
  analyzeAlCodeTool,
  startBcWorkflowTool,
  advanceWorkflowTool,
  getWorkflowHelpTool,
  listSpecialistsTool
];

/**
 * Workspace management tools (always available)
 */
export const workspaceTools: Tool[] = [
  setWorkspaceInfoTool,
  getWorkspaceInfoTool
];


/**
 * Debug/diagnostic tools (opt-in via config)
 */
export const debugTools: Tool[] = [
  diagnoseGitLayerTool,
  validateLayerConfigTool,
  testAzureDevOpsPATTool,
  getLayerDiagnosticsTool,
  diagnoseLocalLayerTool,
  reloadLayersTool
];

/**
 * All tools combined (for easy registration)
 */
export const allTools: Tool[] = [
  ...coreKnowledgeTools,
  ...workspaceTools
];

/**
 * All tools including debug tools
 */
export const allToolsWithDebug: Tool[] = [
  ...allTools,
  ...debugTools
];

/**
 * Legacy export for backward compatibility
 */
export const streamlinedTools = coreKnowledgeTools;

/**
 * Tool name constants for easy reference and type safety
 */
export const TOOL_NAMES = {
  // Core knowledge tools
  FIND_BC_KNOWLEDGE: 'find_bc_knowledge',
  GET_BC_TOPIC: 'get_bc_topic',
  ASK_BC_EXPERT: 'ask_bc_expert',
  ANALYZE_AL_CODE: 'analyze_al_code',
  START_BC_WORKFLOW: 'start_bc_workflow',
  ADVANCE_WORKFLOW: 'advance_workflow',
  GET_WORKFLOW_HELP: 'get_workflow_help',
  LIST_SPECIALISTS: 'list_specialists',

  // Workspace tools
  SET_WORKSPACE_INFO: 'set_workspace_info',
  GET_WORKSPACE_INFO: 'get_workspace_info',

  // Debug tools
  DIAGNOSE_GIT_LAYER: 'diagnose_git_layer',
  VALIDATE_LAYER_CONFIG: 'validate_layer_config',
  TEST_AZURE_DEVOPS_PAT: 'test_azure_devops_pat',
  GET_LAYER_DIAGNOSTICS: 'get_layer_diagnostics',
  DIAGNOSE_LOCAL_LAYER: 'diagnose_local_layer',
  RELOAD_LAYERS: 'reload_layers'
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];

/**
 * Legacy constant names for backward compatibility
 */
export const STREAMLINED_TOOL_NAMES = {
  FIND_BC_KNOWLEDGE: 'find_bc_knowledge',
  ASK_BC_EXPERT: 'ask_bc_expert',
  ANALYZE_AL_CODE: 'analyze_al_code',
  GET_BC_TOPIC: 'get_bc_topic',
  START_BC_WORKFLOW: 'start_bc_workflow',
  ADVANCE_WORKFLOW: 'advance_workflow',
  GET_WORKFLOW_HELP: 'get_workflow_help',
  LIST_SPECIALISTS: 'list_specialists'
} as const;
