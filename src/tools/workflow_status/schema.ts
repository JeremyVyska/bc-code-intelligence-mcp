/**
 * workflow_status Tool - Schema Definition
 *
 * Get current workflow status without advancing.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowStatusTool: Tool = {
  name: 'workflow_status',
  description: `Get current workflow v2 session status without advancing.

Returns:
- Overall progress (phase, percent complete)
- Summary of findings by severity
- Summary of proposed changes
- Optionally: status of all files

Use this to check on workflow progress or recover context after interruption.`,
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Workflow session ID'
      },
      include_all_files: {
        type: 'boolean',
        description: 'Include status of all files (can be large for big workspaces)',
        default: false
      }
    },
    required: ['session_id']
  }
};
