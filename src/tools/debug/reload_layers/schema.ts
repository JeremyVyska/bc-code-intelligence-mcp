/**
 * Schema for reload_layers tool
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const reloadLayersTool: Tool = {
  name: 'reload_layers',
  description: 'Reload layers after configuration changes without restarting MCP server. Useful for testing configuration changes.',
  inputSchema: {
    type: 'object',
    properties: {
      layer_name: {
        type: 'string',
        description: 'Specific layer to reload (optional - omit to reload all layers)'
      },
      reload_config: {
        type: 'boolean',
        description: 'Reload configuration file before reloading layers',
        default: true
      }
    },
    required: []
  }
};
