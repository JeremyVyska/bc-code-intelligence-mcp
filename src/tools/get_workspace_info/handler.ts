/**
 * get_workspace_info Tool - Handler Implementation
 *
 * Get the currently configured workspace root directory and available MCP servers
 */

import { KNOWN_BC_MCPS, KnownMcpServerId, WorkspaceInfo } from '../_shared/workspace-constants.js';

export interface GetWorkspaceInfoContext {
  getWorkspaceInfo: () => WorkspaceInfo;
}

export function createGetWorkspaceInfoHandler(services: any) {
  const context = services as GetWorkspaceInfoContext;

  return async (args: any) => {
    const info = context.getWorkspaceInfo();

    const knownMcps = info.available_mcps.filter(mcp => mcp in KNOWN_BC_MCPS);
    const unknownMcps = info.available_mcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          workspace_root: info.workspace_root,
          is_set: info.workspace_root !== null,
          available_mcps: info.available_mcps,
          mcp_ecosystem: {
            total_available: info.available_mcps.length,
            known_bc_mcps: knownMcps.map(id => ({
              id,
              description: KNOWN_BC_MCPS[id as KnownMcpServerId]
            })),
            unknown_mcps: unknownMcps
          },
          message: info.workspace_root
            ? `Workspace root: ${info.workspace_root}${info.available_mcps.length > 0 ? ` | Available MCPs: ${info.available_mcps.length}` : ''}`
            : 'No workspace configured. Use set_workspace_info to configure project-local layers and MCP ecosystem.'
        }, null, 2)
      }]
    };
  };
}
