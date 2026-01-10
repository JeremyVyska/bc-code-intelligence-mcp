/**
 * Schema for diagnose_local_layer tool
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const diagnoseLocalLayerTool: Tool = {
  name: 'diagnose_local_layer',
  description: 'Diagnose local layer (project overrides) path and content issues. Use when local layers fail to load or have 0 topics.',
  inputSchema: {
    type: 'object',
    properties: {
      layer_path: {
        type: 'string',
        description: 'Path to local layer directory (e.g., ./bc-code-intel-overrides)',
        default: './bc-code-intel-overrides'
      }
    },
    required: []
  }
};
