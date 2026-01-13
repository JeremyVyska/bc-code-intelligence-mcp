/**
 * workflow_complete Tool - Schema Definition
 *
 * Complete the workflow and generate final report.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowCompleteTool: Tool = {
  name: 'workflow_complete',
  description: `Complete a Workflow Engine v2 session and generate the final report.

Call this when all files have been processed (next_action.type === "complete_workflow").

Options:
- generate_report: Create a summary report (default: true)
- apply_changes: Apply all auto-applicable proposed changes (default: false)
- report_format: markdown, json, or html (default: markdown)

Returns the final summary and report content.`,
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Workflow session ID'
      },
      generate_report: {
        type: 'boolean',
        description: 'Generate markdown summary report',
        default: true
      },
      apply_changes: {
        type: 'boolean',
        description: 'Apply all auto-applicable proposed changes',
        default: false
      },
      report_format: {
        type: 'string',
        enum: ['markdown', 'json', 'html'],
        description: 'Report output format',
        default: 'markdown'
      }
    },
    required: ['session_id']
  }
};
