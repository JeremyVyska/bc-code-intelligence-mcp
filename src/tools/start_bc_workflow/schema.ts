/**
 * start_bc_workflow Tool - Schema Definition
 *
 * Start long-running analytical workflows
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const startBcWorkflowTool: Tool = {
  name: 'start_bc_workflow',
  description: 'Start a multi-phase BC development workflow (helping track todo/tasks across lengthy development sessions) with progress tracking and checkpoint resume support. For large-scale analysis, audits, or systematic reviews spanning multiple files or sessions. Returns workflow ID and phase guidance. Set execution_mode=autonomous for structured action plans.',
  inputSchema: {
    type: 'object',
    properties: {
      workflow_type: {
        type: 'string',
        enum: ['new-bc-app', 'enhance-bc-app', 'review-bc-code', 'debug-bc-issues', 'modernize-bc-code', 'onboard-developer', 'upgrade-bc-version', 'add-ecosystem-features', 'document-bc-solution'],
        description: 'Type of workflow to start'
      },
      context: {
        type: 'string',
        description: 'Project context, code location, or description of what needs to be worked on'
      },
      bc_version: {
        type: 'string',
        description: 'Business Central version'
      },
      execution_mode: {
        type: 'string',
        enum: ['interactive', 'autonomous'],
        description: 'Execution mode: "interactive" (human-in-loop with prompts) or "autonomous" (returns structured next action for automated workflows)',
        default: 'interactive'
      },
      checkpoint_id: {
        type: 'string',
        description: 'Resume from saved workflow checkpoint (for multi-session execution). Enables stateful workflow progression across multiple invocations.'
      },
      additional_info: {
        type: 'object',
        description: 'Additional context specific to the workflow type'
      }
    },
    required: ['workflow_type', 'context']
  }
};
