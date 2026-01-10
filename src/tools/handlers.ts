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
import { createStartBcWorkflowHandler } from './start_bc_workflow/handler.js';
import { createAdvanceWorkflowHandler } from './advance_workflow/handler.js';
import { createGetWorkflowHelpHandler } from './get_workflow_help/handler.js';
import { createListSpecialistsHandler } from './list_specialists/handler.js';
import { createSetWorkspaceInfoHandler } from './set_workspace_info/handler.js';
import { createGetWorkspaceInfoHandler } from './get_workspace_info/handler.js';
// Removed discovery, onboarding, and handoff tool handlers (never used by agents)

// Debug tool handlers
import { createDiagnoseGitLayerHandler } from './debug/diagnose_git_layer/handler.js';
import { createValidateLayerConfigHandler } from './debug/validate_layer_config/handler.js';
import { createTestAzureDevOpsPATHandler } from './debug/test_azure_devops_pat/handler.js';
import { createGetLayerDiagnosticsHandler } from './debug/get_layer_diagnostics/handler.js';
import { createDiagnoseLocalLayerHandler } from './debug/diagnose_local_layer/handler.js';
import { createReloadLayersHandler } from './debug/reload_layers/handler.js';

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
  handlers.set('start_bc_workflow', createStartBcWorkflowHandler(services));
  handlers.set('advance_workflow', createAdvanceWorkflowHandler(services));
  handlers.set('get_workflow_help', createGetWorkflowHelpHandler(services));
  handlers.set('list_specialists', createListSpecialistsHandler(services));

  // Workspace tools
  handlers.set('set_workspace_info', createSetWorkspaceInfoHandler(workspaceContext));
  handlers.set('get_workspace_info', createGetWorkspaceInfoHandler(workspaceContext));

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
