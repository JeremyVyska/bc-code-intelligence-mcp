/**
 * get_codelens_mappings Tool - Schema Definition
 *
 * Get merged CodeLens pattern-to-specialist mappings from all active layers.
 * Used by VSCode extension to show inline specialist suggestions in AL code.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const getCodelensMappingsTool: Tool = {
  name: 'get_codelens_mappings',
  description: 'Get merged CodeLens pattern-to-specialist mappings from all active layers. Used by VSCode extension to show inline specialist suggestions in AL code.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
};
