/**
 * workflow_next Tool - Schema Definition
 *
 * Get the next action to perform in a workflow session.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowNextTool: Tool = {
  name: 'workflow_next',
  description: `Get the next action to perform in a workflow session.

Call this when you're ready for the next task. The engine returns:
- Current progress (phase, files completed, percent)
- Current file's checklist status
- Next action with explicit instructions
- Tool call suggestions for the action

The agent MUST follow the next_action instructions exactly.`,
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Workflow session ID from workflow_start'
      }
    },
    required: ['session_id']
  }
};
