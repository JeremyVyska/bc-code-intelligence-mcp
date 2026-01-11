/**
 * workflow_list Tool - Schema Definition
 *
 * Lists all available workflows that can help guide structured processes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowListTool: Tool = {
  name: 'workflow_list',
  description: `List all available BC Code Intelligence workflows.

Use this tool to discover structured workflows that can guide the user through complex processes like code reviews, debugging, or app development.

Returns a list of available workflows with:
- workflow_type: The ID to pass to workflow_start
- name: Human-readable workflow name
- description: What the workflow helps with
- specialist: The recommended specialist for this workflow
- phases: The phases/steps in the workflow

Call this early in conversations to see if a workflow matches the user's intent.`,
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [] as string[]
  }
};
