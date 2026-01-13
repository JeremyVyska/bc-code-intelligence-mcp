/**
 * Schema for get_layer_diagnostics tool
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const getLayerDiagnosticsTool: Tool = {
  name: 'get_layer_diagnostics',
  description: 'Get detailed diagnostics for all configured layers including load status, errors, and performance metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      layer_name: {
        type: 'string',
        description: 'Specific layer name to diagnose (optional - omit for all layers)'
      },
      include_metrics: {
        type: 'boolean',
        description: 'Include performance metrics',
        default: true
      }
    },
    required: []
  }
};
