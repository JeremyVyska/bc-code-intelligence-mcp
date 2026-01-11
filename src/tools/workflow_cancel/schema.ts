/**
 * workflow_cancel Tool - Schema Definition
 *
 * Cancel or reset workflow sessions.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowCancelTool: Tool = {
  name: 'workflow_cancel',
  description: `Cancel a workflow session or clear all workflow sessions.

Use cases:
- Cancel a stale/orphaned workflow from a previous session
- Reset workflow state when restarting work
- Clear all workflows to start fresh

Options:
- session_id: Cancel a specific workflow session
- cancel_all: true to cancel ALL active workflow sessions`,
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Specific workflow session ID to cancel. If not provided and cancel_all is false, lists active sessions.'
      },
      cancel_all: {
        type: 'boolean',
        description: 'Set to true to cancel ALL active workflow sessions',
        default: false
      }
    },
    required: []
  }
};
