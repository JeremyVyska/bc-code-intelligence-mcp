/**
 * workflow_start_v2 Tool - Schema Definition
 *
 * Initialize a new workflow v2 session with stateful checklist management.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowStartV2Tool: Tool = {
  name: 'workflow_start_v2',
  description: `Start a Workflow Engine v2 session - a stateful checklist management system that drives agents through systematic, file-by-file processing.

Unlike simple workflows, v2 provides:
- File inventory with per-file checklists
- Dynamic checklist expansion based on analysis
- Pattern scanning for migrations (e.g., Error→ErrorInfo)
- Batch operations for large-scale changes
- Progress tracking and session persistence

The workflow drives the agent with explicit next-action instructions.

Example usage:
- Start a code review: workflow_type="code-review"
- Start an error migration: workflow_type="error-to-errorinfo-migration"
- Start a BC upgrade: workflow_type="bc-version-upgrade" with source_version and target_version`,
  inputSchema: {
    type: 'object',
    properties: {
      workflow_type: {
        type: 'string',
        description: `Type of workflow to start. Built-in types: code-review, proposal-review, performance-audit, security-audit, onboarding, error-to-errorinfo-migration, bc-version-upgrade. Custom workflow types defined in company/project layers are also supported.`
      },
      scope: {
        type: 'string',
        enum: ['workspace', 'directory', 'files'],
        description: 'Scope of files to include. "workspace" scans entire workspace, "directory" scans a specific path, "files" targets specific files.',
        default: 'workspace'
      },
      path: {
        type: 'string',
        description: 'Directory path (if scope=directory) or comma-separated file paths (if scope=files)'
      },
      options: {
        type: 'object',
        properties: {
          bc_version: {
            type: 'string',
            description: 'Business Central version (e.g., "BC26")'
          },
          include_patterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns to include (overrides workflow defaults)'
          },
          exclude_patterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Glob patterns to exclude (adds to workflow defaults)'
          },
          max_files: {
            type: 'number',
            description: 'Limit number of files to process (for large workspaces)'
          },
          priority_patterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Process files matching these patterns first'
          },
          source_version: {
            type: 'string',
            description: 'For bc-version-upgrade: Starting BC version (e.g., "BC21")'
          },
          target_version: {
            type: 'string',
            description: 'For bc-version-upgrade: Target BC version (e.g., "BC27")'
          }
        },
        description: 'Workflow-specific options'
      },
      initial_processing: {
        type: 'object',
        properties: {
          run_autonomous_phases: {
            type: 'boolean',
            description: 'Run autonomous phases (inventory, scanning) before returning',
            default: true
          },
          scan_all_patterns: {
            type: 'boolean',
            description: 'For pattern-based workflows: scan all files for patterns server-side',
            default: true
          },
          timeout_ms: {
            type: 'number',
            description: 'Time limit for initial processing in milliseconds',
            default: 30000
          }
        },
        description: 'Control server-side autonomous processing before returning'
      }
    },
    required: ['workflow_type']
  }
};
