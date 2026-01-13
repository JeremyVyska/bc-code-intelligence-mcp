/**
 * list_specialists Tool - Schema Definition
 *
 * Browse available BC specialists
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const listSpecialistsTool: Tool = {
  name: 'list_specialists',
  description: 'Browse available BC specialists and their expertise areas. Useful for discovering the specialist team and understanding who helps with what. After browsing, use ask_bc_expert with preferred_specialist parameter to connect with a specific specialist.',
  inputSchema: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: 'Filter by domain (e.g., performance, security, api-design) - optional'
      },
      expertise: {
        type: 'string',
        description: 'Filter by expertise area (e.g., caching, authentication) - optional'
      }
    },
    required: []
  }
};
