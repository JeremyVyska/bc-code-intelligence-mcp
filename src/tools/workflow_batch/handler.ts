/**
 * workflow_batch Tool - Handler Implementation
 *
 * Apply batch operations to multiple pattern instances.
 */

import * as crypto from 'crypto';
import { WorkflowSessionManager } from '../../services/workflow-v2/workflow-session-manager.js';
import {
  WorkflowBatchDryRunOutput,
  WorkflowBatchExecuteOutput,
  BatchOperation,
  BatchFilter,
  ChecklistItem
} from '../../types/workflow-v2-types.js';

// Store confirmation tokens (in production, use session storage)
const confirmationTokens = new Map<string, { sessionId: string; operation: BatchOperation; filter: BatchFilter; instances: number }>();

export function createWorkflowBatchHandler(services: any) {
  const workflowSessionManager: WorkflowSessionManager = services.workflowSessionManager;

  return async (args: any) => {
    const {
      session_id,
      operation,
      filter = {},
      dry_run = true,
      confirmation_token
    } = args;

    try {
      // Get session
      const session = await workflowSessionManager.getSession(session_id);
      if (!session) {
        return {
          isError: true,
          error: `Session not found: ${session_id}`,
          content: [{
            type: 'text' as const,
            text: `Error: Workflow session '${session_id}' not found.`
          }]
        };
      }

      // Validate operation
      const validOperations: BatchOperation[] = ['apply_fixes', 'skip_instances', 'flag_for_review', 'group_by_type'];
      if (!validOperations.includes(operation)) {
        return {
          isError: true,
          error: `Invalid operation: ${operation}`,
          content: [{
            type: 'text' as const,
            text: `Error: Invalid operation '${operation}'. Valid: ${validOperations.join(', ')}`
          }]
        };
      }

      // Find matching instances
      const matchingInstances = findMatchingInstances(session, filter);

      // Handle group_by_type operation (always returns data, no confirmation needed)
      if (operation === 'group_by_type') {
        const grouped = groupByType(matchingInstances);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              session_id,
              operation,
              grouped_instances: grouped,
              total_instances: matchingInstances.length
            }, null, 2)
          }]
        };
      }

      // If confirmation token provided, execute the operation
      if (confirmation_token) {
        const tokenData = confirmationTokens.get(confirmation_token);
        if (!tokenData || tokenData.sessionId !== session_id) {
          return {
            isError: true,
            error: 'Invalid or expired confirmation token',
            content: [{
              type: 'text' as const,
              text: 'Error: Invalid or expired confirmation token. Run dry_run again to get a new token.'
            }]
          };
        }

        // Execute the operation
        const result = await executeBatchOperation(session, operation, matchingInstances, workflowSessionManager);

        // Remove used token
        confirmationTokens.delete(confirmation_token);

        // Get next action
        const nextAction = workflowSessionManager.getNextAction(session);

        const output: WorkflowBatchExecuteOutput = {
          session_id,
          operation,
          dry_run: false,
          result: {
            instances_modified: result.modified,
            instances_failed: result.failed,
            files_modified: result.filesModified,
            files_failed: result.filesFailed
          },
          failures: result.failures,
          next_action: nextAction
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(output, null, 2)
          }]
        };
      }

      // Dry run - preview changes
      if (dry_run) {
        // Count by type
        const byType: Record<string, number> = {};
        const filesAffected = new Set<string>();
        const sampleChanges: Array<{ file: string; line: number; before: string; after: string }> = [];

        for (const { file, item } of matchingInstances) {
          filesAffected.add(file.path);

          const instanceType = item.pattern_match?.instance_type || 'other';
          byType[instanceType] = (byType[instanceType] || 0) + 1;

          // Collect sample changes (first 5)
          if (sampleChanges.length < 5 && item.pattern_match) {
            sampleChanges.push({
              file: file.path,
              line: item.pattern_match.line_number,
              before: item.pattern_match.match_text,
              after: item.pattern_match.suggested_replacement || '(transformation pending)'
            });
          }
        }

        // Generate confirmation token
        const token = `batch-${session_id.slice(-6)}-${matchingInstances.length}-${crypto.randomBytes(4).toString('hex')}`;
        confirmationTokens.set(token, {
          sessionId: session_id,
          operation,
          filter,
          instances: matchingInstances.length
        });

        // Clean up old tokens (keep only last 100)
        if (confirmationTokens.size > 100) {
          const keys = Array.from(confirmationTokens.keys());
          for (let i = 0; i < keys.length - 100; i++) {
            confirmationTokens.delete(keys[i]);
          }
        }

        const output: WorkflowBatchDryRunOutput = {
          session_id,
          operation,
          dry_run: true,
          preview: {
            instances_affected: matchingInstances.length,
            files_affected: filesAffected.size,
            by_instance_type: byType
          },
          sample_changes: sampleChanges,
          confirmation_required: true,
          confirmation_token: token,
          confirmation_prompt: `This will ${getOperationDescription(operation)} ${matchingInstances.length} instances across ${filesAffected.size} files. Call workflow_batch again with confirmation_token="${token}" to proceed.`
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(output, null, 2)
          }]
        };
      }

      // Should not reach here
      return {
        isError: true,
        error: 'Invalid request: specify dry_run=true or provide confirmation_token',
        content: [{
          type: 'text' as const,
          text: 'Error: Use dry_run=true to preview, or provide confirmation_token to execute.'
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isError: true,
        error: errorMessage,
        content: [{
          type: 'text' as const,
          text: `Error in batch operation: ${errorMessage}`
        }]
      };
    }
  };
}

/**
 * Find instances matching the filter criteria
 */
function findMatchingInstances(
  session: any,
  filter: BatchFilter
): Array<{ file: any; item: ChecklistItem }> {
  const results: Array<{ file: any; item: ChecklistItem }> = [];

  for (const file of session.file_inventory) {
    // Check file pattern filter
    if (filter.file_patterns && filter.file_patterns.length > 0) {
      const matchesPattern = filter.file_patterns.some(pattern =>
        file.path.toLowerCase().includes(pattern.toLowerCase())
      );
      if (!matchesPattern) continue;
    }

    for (const item of file.checklist) {
      // Only pattern instances
      if (item.type !== 'pattern_instance') continue;

      // Check status filter
      if (filter.status && item.status !== filter.status) continue;

      // Check instance type filter
      if (filter.instance_types && filter.instance_types.length > 0) {
        const instanceType = item.pattern_match?.instance_type || 'other';
        if (!filter.instance_types.includes(instanceType)) continue;
      }

      // Check auto-fixable filter
      if (filter.auto_fixable_only) {
        if (item.pattern_match?.requires_manual_review) continue;
      }

      results.push({ file, item });
    }
  }

  return results;
}

/**
 * Group instances by type
 */
function groupByType(instances: Array<{ file: any; item: ChecklistItem }>): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const { file, item } of instances) {
    const type = item.pattern_match?.instance_type || 'other';
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push({
      file: file.path,
      line: item.pattern_match?.line_number,
      match: item.pattern_match?.match_text,
      status: item.status
    });
  }

  return grouped;
}

/**
 * Execute the batch operation
 */
async function executeBatchOperation(
  session: any,
  operation: BatchOperation,
  instances: Array<{ file: any; item: ChecklistItem }>,
  manager: WorkflowSessionManager
): Promise<{ modified: number; failed: number; filesModified: number; filesFailed: number; failures: any[] }> {
  let modified = 0;
  let failed = 0;
  const filesModified = new Set<string>();
  const filesFailed = new Set<string>();
  const failures: any[] = [];

  for (const { file, item } of instances) {
    try {
      switch (operation) {
        case 'apply_fixes':
          // Mark as completed (actual file modification would happen here)
          item.status = 'completed';
          item.result = {
            applied: true,
            replacement: item.pattern_match?.suggested_replacement
          };
          modified++;
          filesModified.add(file.path);
          break;

        case 'skip_instances':
          item.status = 'skipped';
          modified++;
          filesModified.add(file.path);
          break;

        case 'flag_for_review':
          // Keep as pending but mark for review
          if (item.pattern_match) {
            item.pattern_match.requires_manual_review = true;
          }
          modified++;
          filesModified.add(file.path);
          break;
      }

      // Update instance counts
      if (operation === 'apply_fixes') {
        session.instances_completed = (session.instances_completed || 0) + 1;
        session.instances_auto_fixed = (session.instances_auto_fixed || 0) + 1;
      }
    } catch (error) {
      failed++;
      filesFailed.add(file.path);
      failures.push({
        file: file.path,
        line: item.pattern_match?.line_number,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Save session
  await manager.updateSession(session);

  return {
    modified,
    failed,
    filesModified: filesModified.size,
    filesFailed: filesFailed.size,
    failures
  };
}

/**
 * Get human-readable operation description
 */
function getOperationDescription(operation: BatchOperation): string {
  switch (operation) {
    case 'apply_fixes':
      return 'apply auto-fixes to';
    case 'skip_instances':
      return 'skip';
    case 'flag_for_review':
      return 'flag for manual review';
    default:
      return 'process';
  }
}
