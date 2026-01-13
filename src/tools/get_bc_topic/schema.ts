/**
 * get_bc_topic Tool - Schema Definition
 *
 * Get detailed content for specific BC knowledge topics
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const getBcTopicTool: Tool = {
  name: 'get_bc_topic',
  description: 'Get detailed content for a specific BC knowledge topic with examples and best practices.',
  inputSchema: {
    type: 'object',
    properties: {
      topic_id: {
        type: 'string',
        description: 'Unique topic identifier (e.g., "sift-technology-fundamentals")'
      },
      include_samples: {
        type: 'boolean',
        description: 'Include companion AL code samples if available',
        default: true
      },
      specialist_context: {
        type: 'string',
        description: 'Optional: Current specialist ID (e.g., "sam-coder", "chris-config") to provide domain-specific suggestions if topic is not found'
      }
    },
    required: ['topic_id']
  }
};
