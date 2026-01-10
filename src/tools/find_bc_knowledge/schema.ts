/**
 * find_bc_knowledge Tool - Schema Definition
 *
 * Search BC knowledge topics, specialists, and workflows
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const findBcKnowledgeTool: Tool = {
  name: 'find_bc_knowledge',
  description: 'Search BC knowledge topics, find specialists, or discover workflows. Use this when users want to find information about BC development.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query or question about BC development'
      },
      search_type: {
        type: 'string',
        enum: ['topics', 'specialists', 'workflows', 'all'],
        description: 'Type of search to perform',
        default: 'all'
      },
      bc_version: {
        type: 'string',
        description: 'Business Central version (e.g., "BC22", "BC20")'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return',
        default: 10
      }
    },
    required: ['query']
  }
};
