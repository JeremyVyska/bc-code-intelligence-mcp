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
// CORE KNOWLEDGE TOOLS (5 tools)
// ============================================================================

// Knowledge Query Tools (2 tools)
export { findBcKnowledgeTool } from './find_bc_knowledge/schema.js';
export { getBcTopicTool } from './get_bc_topic/schema.js';

// Specialist Consultation (1 tool)
export { askBcExpertTool } from './ask_bc_expert/schema.js';

// Code Analysis (1 tool)
export { analyzeAlCodeTool } from './analyze_al_code/schema.js';

// Specialist Listing (1 tool)
export { listSpecialistsTool } from './list_specialists/schema.js';

// ============================================================================
// WORKFLOW TOOLS (8 tools - unified workflow_* naming)
// ============================================================================

export { workflowListTool } from './workflow_list/schema.js';
export { workflowStartTool } from './workflow_start/schema.js';
export { workflowNextTool } from './workflow_next/schema.js';
export { workflowProgressTool } from './workflow_progress/schema.js';
export { workflowStatusTool } from './workflow_status/schema.js';
export { workflowCompleteTool } from './workflow_complete/schema.js';
export { workflowBatchTool } from './workflow_batch/schema.js';
export { workflowCancelTool } from './workflow_cancel/schema.js';

// ============================================================================
// WORKSPACE TOOLS (2 tools - always available)
// ============================================================================

export { setWorkspaceInfoTool } from './set_workspace_info/schema.js';
export { getWorkspaceInfoTool } from './get_workspace_info/schema.js';

// ============================================================================
// VSCODE EXTENSION TOOLS (5 tools - for VSCode extension integration)
// ============================================================================

export { getCodelensMappingsTool } from './get_codelens_mappings/schema.js';
export { validateLayerRepoTool } from './validate_layer_repo/schema.js';
export { scaffoldLayerRepoTool } from './scaffold_layer_repo/schema.js';
export { createLayerContentTool } from './create_layer_content/schema.js';
export { listPromptsTool } from './list_prompts/schema.js';

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
import { listSpecialistsTool } from './list_specialists/schema.js';
import { setWorkspaceInfoTool } from './set_workspace_info/schema.js';
import { getWorkspaceInfoTool } from './get_workspace_info/schema.js';
import { diagnoseGitLayerTool } from './debug/diagnose_git_layer/schema.js';
import { validateLayerConfigTool } from './debug/validate_layer_config/schema.js';
import { testAzureDevOpsPATTool } from './debug/test_azure_devops_pat/schema.js';
import { getLayerDiagnosticsTool } from './debug/get_layer_diagnostics/schema.js';
import { diagnoseLocalLayerTool } from './debug/diagnose_local_layer/schema.js';
import { reloadLayersTool } from './debug/reload_layers/schema.js';
import { getCodelensMappingsTool } from './get_codelens_mappings/schema.js';
import { validateLayerRepoTool } from './validate_layer_repo/schema.js';
import { scaffoldLayerRepoTool } from './scaffold_layer_repo/schema.js';
import { createLayerContentTool } from './create_layer_content/schema.js';
import { listPromptsTool } from './list_prompts/schema.js';

// Workflow tools
import { workflowListTool } from './workflow_list/schema.js';
import { workflowStartTool } from './workflow_start/schema.js';
import { workflowNextTool } from './workflow_next/schema.js';
import { workflowProgressTool } from './workflow_progress/schema.js';
import { workflowStatusTool } from './workflow_status/schema.js';
import { workflowCompleteTool } from './workflow_complete/schema.js';
import { workflowBatchTool } from './workflow_batch/schema.js';
import { workflowCancelTool } from './workflow_cancel/schema.js';

/**
 * Core knowledge tools (primary interface)
 */
export const coreKnowledgeTools: Tool[] = [
  findBcKnowledgeTool,
  getBcTopicTool,
  askBcExpertTool,
  analyzeAlCodeTool,
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
 * Workflow tools (unified workflow_* naming)
 */
export const workflowTools: Tool[] = [
  workflowListTool,
  workflowStartTool,
  workflowNextTool,
  workflowProgressTool,
  workflowStatusTool,
  workflowCompleteTool,
  workflowBatchTool,
  workflowCancelTool
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
 * VSCode Extension Support Tools (5 tools)
 * These are specifically for the VSCode extension integration
 */
export const vscodeExtensionTools: Tool[] = [
  getCodelensMappingsTool,
  validateLayerRepoTool,
  scaffoldLayerRepoTool,
  createLayerContentTool,
  listPromptsTool
];

/**
 * All tools combined (for easy registration)
 */
export const allTools: Tool[] = [
  ...coreKnowledgeTools,
  ...workspaceTools,
  ...workflowTools,
  ...vscodeExtensionTools
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
  LIST_SPECIALISTS: 'list_specialists',

  // Workspace tools
  SET_WORKSPACE_INFO: 'set_workspace_info',
  GET_WORKSPACE_INFO: 'get_workspace_info',

  // Workflow tools
  WORKFLOW_LIST: 'workflow_list',
  WORKFLOW_START: 'workflow_start',
  WORKFLOW_NEXT: 'workflow_next',
  WORKFLOW_PROGRESS: 'workflow_progress',
  WORKFLOW_STATUS: 'workflow_status',
  WORKFLOW_COMPLETE: 'workflow_complete',
  WORKFLOW_BATCH: 'workflow_batch',
  WORKFLOW_CANCEL: 'workflow_cancel',

  // Debug tools
  DIAGNOSE_GIT_LAYER: 'diagnose_git_layer',
  VALIDATE_LAYER_CONFIG: 'validate_layer_config',
  TEST_AZURE_DEVOPS_PAT: 'test_azure_devops_pat',
  GET_LAYER_DIAGNOSTICS: 'get_layer_diagnostics',
  DIAGNOSE_LOCAL_LAYER: 'diagnose_local_layer',
  RELOAD_LAYERS: 'reload_layers',

  // VSCode Extension Tools
  GET_CODELENS_MAPPINGS: 'get_codelens_mappings',
  VALIDATE_LAYER_REPO: 'validate_layer_repo',
  SCAFFOLD_LAYER_REPO: 'scaffold_layer_repo',
  CREATE_LAYER_CONTENT: 'create_layer_content',
  LIST_PROMPTS: 'list_prompts'
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
  LIST_SPECIALISTS: 'list_specialists'
} as const;
