/**
 * scaffold_layer_repo Tool - Schema Definition
 *
 * Create BC Code Intelligence layer folder structure with templates.
 * Used by VSCode extension setup wizard to bootstrap new layers.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const scaffoldLayerRepoTool: Tool = {
  name: 'scaffold_layer_repo',
  description: 'Create BC Code Intelligence layer folder structure with templates. Use this to bootstrap a new company, team, or project layer.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute path where layer structure should be created'
      },
      layer_type: {
        type: 'string',
        enum: ['company', 'team', 'project'],
        description: 'Type of layer being created'
      },
      layer_name: {
        type: 'string',
        description: 'Display name for the layer (e.g., "Acme Corp Standards")'
      },
      include_examples: {
        type: 'boolean',
        description: 'Include example content files to demonstrate structure',
        default: true
      }
    },
    required: ['path', 'layer_type', 'layer_name']
  }
};
