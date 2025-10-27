/**
 * Workspace management tools
 * Handles workspace root configuration and MCP ecosystem awareness
 */

import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

/**
 * Known Business Central MCP servers and their capabilities
 */
export const KNOWN_BC_MCPS = {
  // AL & Business Central MCPs
  'bc-code-intelligence-mcp': 'BC development knowledge with 14 specialist AI personas',
  'al-dependency-mcp-server': 'AL workspace symbol and dependency analysis from .app files',
  'serena-mcp': 'Multi-language LSP-based coding assistant with AL Language Server support',
  'al-objid-mcp-server': 'AL object ID collision prevention and management (Object ID Ninja)',
  'bc-telemetry-buddy': 'BC telemetry collection, KQL query generation, and performance analysis',
  
  // DevOps & Productivity MCPs
  'azure-devops-mcp': 'Azure DevOps integration (work items, repos, pipelines, wiki)',
  'clockify-mcp': 'Clockify time tracking and project management integration',
  'nab-al-tools-mcp': 'XLIFF/XLF translation tooling for AL projects'
} as const;

export type KnownMcpServerId = keyof typeof KNOWN_BC_MCPS;

export interface WorkspaceInfo {
  workspace_root: string | null;
  available_mcps: string[];
}

export interface WorkspaceToolsContext {
  setWorkspaceInfo: (path: string, availableMcps?: string[]) => Promise<{ success: boolean; message: string; reloaded: boolean }>;
  getWorkspaceInfo: () => WorkspaceInfo;
}

export class WorkspaceTools {
  constructor(private context: WorkspaceToolsContext) {}

  getToolDefinitions() {
    return [
      {
        name: 'set_workspace_info',
        description: 'Set workspace root directory and optionally provide information about available MCP servers in the environment. This enables specialists to recommend appropriate tools and integrations. Call this before other tools if you need project-specific knowledge layers or ecosystem-aware guidance.',
        inputSchema: {
          type: 'object',
          properties: {
            workspace_root: {
              type: 'string',
              description: 'Absolute path to the workspace/project root directory (e.g., C:/projects/my-bc-app or /home/user/projects/my-bc-app)'
            },
            available_mcps: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional: List of MCP server IDs available in the environment (e.g., ["bc-telemetry-buddy", "al-objid-mcp-server"]). Enables specialists to provide ecosystem-aware recommendations.'
            }
          },
          required: ['workspace_root']
        }
      },
      {
        name: 'get_workspace_info',
        description: 'Get the currently configured workspace root directory and available MCP servers, if any.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  async handleToolCall(request: CallToolRequest): Promise<any> {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'set_workspace_info':
        return await this.handleSetWorkspaceInfo(args as { workspace_root: string; available_mcps?: string[] });
      
      case 'get_workspace_info':
        return await this.handleGetWorkspaceInfo();
      
      default:
        throw new Error(`Unknown workspace tool: ${name}`);
    }
  }

  private async handleSetWorkspaceInfo(args: { workspace_root: string; available_mcps?: string[] }) {
    const { workspace_root, available_mcps = [] } = args;

    if (!workspace_root) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'workspace_root is required'
          }, null, 2)
        }]
      };
    }

    // Validate and categorize MCPs
    const knownMcps = available_mcps.filter(mcp => mcp in KNOWN_BC_MCPS);
    const unknownMcps = available_mcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

    const result = await this.context.setWorkspaceInfo(workspace_root, available_mcps);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          message: result.message,
          reloaded: result.reloaded,
          workspace_root,
          mcp_ecosystem: {
            total_available: available_mcps.length,
            known_bc_mcps: knownMcps.length,
            unknown_mcps: unknownMcps.length,
            known: knownMcps.map(id => ({
              id,
              description: KNOWN_BC_MCPS[id as KnownMcpServerId]
            })),
            unknown: unknownMcps
          }
        }, null, 2)
      }]
    };
  }

  private async handleGetWorkspaceInfo() {
    const info = this.context.getWorkspaceInfo();

    const knownMcps = info.available_mcps.filter(mcp => mcp in KNOWN_BC_MCPS);
    const unknownMcps = info.available_mcps.filter(mcp => !(mcp in KNOWN_BC_MCPS));

    return {
      content: [{
        type: 'text',
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
  }
}
