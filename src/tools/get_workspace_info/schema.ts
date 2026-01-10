/**
 * get_workspace_info Tool - Schema Definition
 *
 * Get the currently configured workspace root directory and available MCP servers
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const getWorkspaceInfoTool: Tool = {
  name: 'get_workspace_info',
  description: 'Get the currently configured workspace root directory and available MCP servers, if any.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};
