/**
 * create_layer_content Tool - Schema Definition
 *
 * Create a new topic, specialist, or prompt in a BC Code Intelligence layer.
 * Used by VSCode extension setup wizard.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const createLayerContentTool: Tool = {
  name: 'create_layer_content',
  description: 'Create a new topic, specialist, or prompt in a BC Code Intelligence layer with proper frontmatter formatting.',
  inputSchema: {
    type: 'object',
    properties: {
      layer_path: {
        type: 'string',
        description: 'Absolute path to the layer'
      },
      content_type: {
        type: 'string',
        enum: ['topic', 'specialist', 'prompt'],
        description: 'Type of content to create'
      },
      name: {
        type: 'string',
        description: 'Name/ID for the content (used in filename and identifiers)'
      },
      title: {
        type: 'string',
        description: 'Display title for the content'
      },
      domain: {
        type: 'string',
        description: 'For topics: domain folder name (e.g., "security", "performance")'
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata specific to content type'
      }
    },
    required: ['layer_path', 'content_type', 'name', 'title']
  }
};
