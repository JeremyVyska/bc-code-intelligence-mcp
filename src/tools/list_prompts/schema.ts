/**
 * list_prompts Tool - Schema Definition
 *
 * List all available prompts from all active layers.
 * Used by VSCode extension tree view and Quick Pick.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const listPromptsTool: Tool = {
  name: 'list_prompts',
  description: 'List all available prompts from all active layers. Returns prompt metadata for UI display.',
  inputSchema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['workflow', 'quick-action', 'template', 'all'],
        description: 'Filter by prompt type',
        default: 'all'
      },
      include_content: {
        type: 'boolean',
        description: 'Include full prompt content (for sync to .github/prompts/)',
        default: false
      }
    },
    required: []
  }
};
