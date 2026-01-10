/**
 * get_workflow_help Tool - Schema Definition
 *
 * Get guidance for current workflow phase
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const getWorkflowHelpTool: Tool = {
  name: 'get_workflow_help',
  description: 'Get guidance for current workflow phase, check status, or understand next steps.',
  inputSchema: {
    type: 'object',
    properties: {
      workflow_id: {
        type: 'string',
        description: 'ID of the workflow session (optional - will list active workflows if not provided)'
      },
      help_type: {
        type: 'string',
        enum: ['status', 'guidance', 'next-steps', 'methodology'],
        description: 'Type of help to provide',
        default: 'guidance'
      }
    }
  }
};
