/**
 * Workspace management tools
 * Handles workspace root configuration for project-local layers
 */

import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

export interface WorkspaceToolsContext {
  setWorkspaceRoot: (path: string) => Promise<{ success: boolean; message: string; reloaded: boolean }>;
  getWorkspaceRoot: () => string | null;
}

export class WorkspaceTools {
  constructor(private context: WorkspaceToolsContext) {}

  getToolDefinitions() {
    return [
      {
        name: 'set_workspace_root',
        description: 'Set the workspace root directory for project-local configuration and layer discovery. Required when VS Code workspace folder cannot be auto-detected. Call this before other tools if you need project-specific knowledge layers.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Absolute path to the workspace/project root directory (e.g., C:/projects/my-bc-app or /home/user/projects/my-bc-app)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'get_workspace_root',
        description: 'Get the currently configured workspace root directory, if any.',
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
      case 'set_workspace_root':
        return await this.handleSetWorkspaceRoot(args as { path: string });
      
      case 'get_workspace_root':
        return await this.handleGetWorkspaceRoot();
      
      default:
        throw new Error(`Unknown workspace tool: ${name}`);
    }
  }

  private async handleSetWorkspaceRoot(args: { path: string }) {
    const { path } = args;

    if (!path) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Path is required'
          }, null, 2)
        }]
      };
    }

    const result = await this.context.setWorkspaceRoot(path);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: result.success,
          message: result.message,
          reloaded: result.reloaded,
          workspace_root: path
        }, null, 2)
      }]
    };
  }

  private async handleGetWorkspaceRoot() {
    const workspaceRoot = this.context.getWorkspaceRoot();

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          workspace_root: workspaceRoot,
          is_set: workspaceRoot !== null,
          message: workspaceRoot 
            ? `Workspace root is set to: ${workspaceRoot}`
            : 'No workspace root configured. Use set_workspace_root to configure project-local layers.'
        }, null, 2)
      }]
    };
  }
}
