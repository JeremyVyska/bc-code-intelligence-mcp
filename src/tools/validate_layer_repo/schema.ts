/**
 * validate_layer_repo Tool - Schema Definition
 *
 * Check if a directory has valid BC Code Intelligence layer structure.
 * Used by VSCode extension setup wizard.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const validateLayerRepoTool: Tool = {
  name: 'validate_layer_repo',
  description: 'Check if a directory has valid BC Code Intelligence layer structure. Returns validation status, missing items, and suggestions for fixing.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path to the directory to validate'
      }
    },
    required: ['path']
  }
};
