/**
 * workflow_status Tool - Handler Implementation
 *
 * Get current workflow status without advancing.
 */

import { WorkflowSessionManager } from '../../services/workflow-v2/workflow-session-manager.js';
import { WorkflowStatusOutput, FindingSeverity } from '../../types/workflow-v2-types.js';

export function createWorkflowStatusHandler(services: any) {
  const workflowSessionManager: WorkflowSessionManager = services.workflowSessionManager;

  return async (args: any) => {
    const { session_id, include_all_files = false } = args;

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

      // Calculate findings by severity
      const findingsBySeverity: Record<FindingSeverity, number> = {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0
      };

      session.findings.forEach(f => {
        findingsBySeverity[f.severity]++;
      });

      // Count topics
      let topicsApplied = 0;
      let topicsPending = 0;

      session.file_inventory.forEach(file => {
        file.checklist.forEach(item => {
          if (item.type === 'topic_application') {
            if (item.status === 'completed') {
              topicsApplied++;
            } else if (item.status === 'pending' || item.status === 'in_progress') {
              topicsPending++;
            }
          }
        });
      });

      // Calculate progress
      const filesInProgress = session.file_inventory.filter(f => f.status === 'in_progress').length;
      const filesPending = session.file_inventory.filter(f => f.status === 'pending').length;
      const percentComplete = session.files_total > 0
        ? Math.round((session.files_completed / session.files_total) * 100)
        : 0;

      // Build response
      const output: WorkflowStatusOutput = {
        session_id: session.id,
        workflow_type: session.workflow_type,
        status: session.status,
        created_at: session.created_at,
        updated_at: session.updated_at,

        progress: {
          phase: session.current_phase,
          files_completed: session.files_completed,
          files_total: session.files_total,
          files_in_progress: filesInProgress,
          files_pending: filesPending,
          percent_complete: percentComplete
        },

        summary: {
          total_findings: session.findings.length,
          findings_by_severity: findingsBySeverity,
          total_proposed_changes: session.proposed_changes.length,
          topics_applied: topicsApplied,
          topics_pending: topicsPending
        }
      };

      // Include file list if requested
      if (include_all_files) {
        output.files = session.file_inventory.map(f => ({
          path: f.path,
          status: f.status,
          findings_count: f.findings.length,
          proposed_changes_count: f.proposed_changes.length,
          checklist_complete: f.checklist.every(c =>
            c.status === 'completed' || c.status === 'skipped' || c.status === 'failed'
          )
        }));
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(output, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isError: true,
        error: errorMessage,
        content: [{
          type: 'text' as const,
          text: `Error getting workflow status: ${errorMessage}`
        }]
      };
    }
  };
}
