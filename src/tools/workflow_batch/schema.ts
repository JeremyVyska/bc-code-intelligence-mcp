/**
 * workflow_batch Tool - Schema Definition
 *
 * Apply batch operations to multiple pattern instances.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowBatchTool: Tool = {
  name: 'workflow_batch',
  description: `Apply batch operations to multiple pattern instances in a Workflow Engine v2 session.

For pattern-based workflows (like error-to-errorinfo-migration), this allows efficient bulk operations:
- apply_fixes: Apply auto-fixes to matching instances
- skip_instances: Mark instances as skipped
- flag_for_review: Mark instances for manual review
- group_by_type: Get instances grouped by type

Use dry_run=true (default) to preview changes before applying.
Use confirmation_token from dry_run to execute the operation.`,
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Workflow session ID'
      },
      operation: {
        type: 'string',
        enum: ['apply_fixes', 'skip_instances', 'flag_for_review', 'group_by_type'],
        description: 'Batch operation to perform'
      },
      filter: {
        type: 'object',
        properties: {
          instance_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only instances of these types (e.g., ["literal", "strsubstno"])'
          },
          file_patterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Only files matching these patterns'
          },
          auto_fixable_only: {
            type: 'boolean',
            description: 'Only auto-fixable instances'
          },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'failed'],
            description: 'Only instances with this status'
          },
          guide: {
            type: 'string',
            description: 'For bc-version-upgrade: Only instances from this conversion guide'
          },
          version_step: {
            type: 'string',
            description: 'For bc-version-upgrade: Only instances from this version step (e.g., "BC23-BC24")'
          }
        },
        description: 'Filter criteria for selecting instances'
      },
      dry_run: {
        type: 'boolean',
        description: 'Preview changes without applying (default: true)',
        default: true
      },
      confirmation_token: {
        type: 'string',
        description: 'Token from dry_run to confirm actual execution'
      }
    },
    required: ['session_id', 'operation']
  }
};
