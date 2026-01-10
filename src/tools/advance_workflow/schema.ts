/**
 * advance_workflow Tool - Schema Definition
 *
 * Progress to the next phase of an active workflow
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const advanceWorkflowTool: Tool = {
  name: 'advance_workflow',
  description: 'Progress to the next phase of an active workflow with your results and feedback.',
  inputSchema: {
    type: 'object',
    properties: {
      workflow_id: {
        type: 'string',
        description: 'ID of the workflow session to advance'
      },
      phase_results: {
        type: 'string',
        description: 'Results from the current phase, decisions made, or feedback'
      },
      next_focus: {
        type: 'string',
        description: 'Optional: specific focus area for the next phase'
      }
    },
    required: ['workflow_id', 'phase_results']
  }
};
