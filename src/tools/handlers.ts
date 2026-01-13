/**
 * Centralized Tool Handler Registry
 *
 * Maps all MCP tool names to their handler functions.
 * Handlers are created with proper service dependencies.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// Import all handler factories
import { createFindBcKnowledgeHandler } from './find_bc_knowledge/handler.js';
import { createGetBcTopicHandler } from './get_bc_topic/handler.js';
import { createAskBcExpertHandler } from './ask_bc_expert/handler.js';
import { createAnalyzeAlCodeHandler } from './analyze_al_code/handler.js';
import { createListSpecialistsHandler } from './list_specialists/handler.js';
import { createSetWorkspaceInfoHandler } from './set_workspace_info/handler.js';
import { createGetWorkspaceInfoHandler } from './get_workspace_info/handler.js';

// VSCode Extension tool handlers
import { createGetCodelensMappingsHandler } from './get_codelens_mappings/handler.js';
import { createValidateLayerRepoHandler } from './validate_layer_repo/handler.js';
import { createScaffoldLayerRepoHandler } from './scaffold_layer_repo/handler.js';
import { createCreateLayerContentHandler } from './create_layer_content/handler.js';
import { createListPromptsHandler } from './list_prompts/handler.js';

// Debug tool handlers
import { createDiagnoseGitLayerHandler } from './debug/diagnose_git_layer/handler.js';
import { createValidateLayerConfigHandler } from './debug/validate_layer_config/handler.js';
import { createTestAzureDevOpsPATHandler } from './debug/test_azure_devops_pat/handler.js';
import { createGetLayerDiagnosticsHandler } from './debug/get_layer_diagnostics/handler.js';
import { createDiagnoseLocalLayerHandler } from './debug/diagnose_local_layer/handler.js';
import { createReloadLayersHandler } from './debug/reload_layers/handler.js';

// Workflow tool handlers (unified workflow_* naming)
import { createWorkflowStartHandler } from './workflow_start/handler.js';
import { createWorkflowListHandler } from './workflow_list/handler.js';
import { createWorkflowNextHandler } from './workflow_next/handler.js';
import { createWorkflowProgressHandler } from './workflow_progress/handler.js';
import { createWorkflowStatusHandler } from './workflow_status/handler.js';
import { createWorkflowCompleteHandler } from './workflow_complete/handler.js';
import { createWorkflowBatchHandler } from './workflow_batch/handler.js';
import { createWorkflowCancelHandler } from './workflow_cancel/handler.js';

/**
 * Service dependencies for handlers
 */
export interface HandlerServices {
  knowledgeService: any;
  codeAnalysisService: any;
  methodologyService: any;
  workflowService: any;
  layerService: any;
  sessionManager?: any;
  discoveryService?: any;
  configLoader?: any;
  workflowSessionManager?: any;  // Workflow session manager
}

/**
 * Workspace tool context
 */
export interface WorkspaceContext {
  setWorkspaceInfo: (path: string, availableMcps?: string[]) => Promise<{ success: boolean; message: string; reloaded: boolean }>;
  getWorkspaceInfo: () => { workspace_root: string | null; available_mcps: string[] };
}

/**
 * Handler function type
 */
export type ToolHandler = (args: any) => Promise<CallToolResult>;

/**
 * Create all tool handlers with dependencies
 */
export function createToolHandlers(services: HandlerServices, workspaceContext: WorkspaceContext): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  // Core knowledge tools
  handlers.set('find_bc_knowledge', createFindBcKnowledgeHandler(services));
  handlers.set('get_bc_topic', createGetBcTopicHandler(services));
  handlers.set('ask_bc_expert', createAskBcExpertHandler(services));
  handlers.set('analyze_al_code', createAnalyzeAlCodeHandler(services));
  handlers.set('list_specialists', createListSpecialistsHandler(services));

  // Workspace tools
  handlers.set('set_workspace_info', createSetWorkspaceInfoHandler(workspaceContext));
  handlers.set('get_workspace_info', createGetWorkspaceInfoHandler(workspaceContext));

  // VSCode Extension tools
  handlers.set('get_codelens_mappings', createGetCodelensMappingsHandler(services));
  handlers.set('validate_layer_repo', createValidateLayerRepoHandler());
  handlers.set('scaffold_layer_repo', createScaffoldLayerRepoHandler());
  handlers.set('create_layer_content', createCreateLayerContentHandler());
  handlers.set('list_prompts', createListPromptsHandler(services));

  // Workflow tools (unified workflow_* naming)
  handlers.set('workflow_list', createWorkflowListHandler(services));
  handlers.set('workflow_start', createWorkflowStartHandler(services));
  handlers.set('workflow_next', createWorkflowNextHandler(services));
  handlers.set('workflow_progress', createWorkflowProgressHandler(services));
  handlers.set('workflow_status', createWorkflowStatusHandler(services));
  handlers.set('workflow_complete', createWorkflowCompleteHandler(services));
  handlers.set('workflow_batch', createWorkflowBatchHandler(services));
  handlers.set('workflow_cancel', createWorkflowCancelHandler(services));

  return handlers;
}

/**
 * Create debug tool handlers (opt-in)
 */
export function createDebugToolHandlers(services: HandlerServices): Map<string, ToolHandler> {
  const handlers = new Map<string, ToolHandler>();

  handlers.set('diagnose_git_layer', createDiagnoseGitLayerHandler());
  handlers.set('validate_layer_config', createValidateLayerConfigHandler());
  handlers.set('test_azure_devops_pat', createTestAzureDevOpsPATHandler());
  handlers.set('get_layer_diagnostics', createGetLayerDiagnosticsHandler(services.layerService));
  handlers.set('diagnose_local_layer', createDiagnoseLocalLayerHandler());
  handlers.set('reload_layers', createReloadLayersHandler(services.layerService, services.configLoader));

  return handlers;
}
