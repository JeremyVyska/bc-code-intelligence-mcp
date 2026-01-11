/**
 * workflow_progress Tool - Handler Implementation
 *
 * Report progress on current action and get next action.
 */

import * as path from 'path';
import { WorkflowSessionManager } from '../../services/workflow-v2/workflow-session-manager.js';
import { Finding, ProposedChange, WorkflowNextOutput } from '../../types/workflow-v2-types.js';

export function createWorkflowProgressHandler(services: any) {
  const workflowSessionManager: WorkflowSessionManager = services.workflowSessionManager;

  return async (args: any) => {
    const {
      session_id,
      completed_action,
      findings = [],
      proposed_changes = [],
      expand_checklist = []
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

      // Validate completed_action
      if (!completed_action || !completed_action.action || !completed_action.status) {
        return {
          isError: true,
          error: 'Invalid completed_action: must include action and status',
          content: [{
            type: 'text' as const,
            text: 'Error: completed_action must include action and status fields'
          }]
        };
      }

      // Normalize findings to include file path if not provided
      const normalizedFindings: Finding[] = findings.map((f: any) => ({
        file: f.file || session.file_inventory[session.current_file_index]?.path || 'unknown',
        line: f.line,
        severity: f.severity,
        category: f.category,
        description: f.description,
        suggestion: f.suggestion,
        related_topic: f.related_topic
      }));

      // Normalize proposed changes
      const normalizedChanges: ProposedChange[] = proposed_changes.map((c: any) => ({
        file: c.file || session.file_inventory[session.current_file_index]?.path || 'unknown',
        line_start: c.line_start,
        line_end: c.line_end,
        original_code: c.original_code,
        proposed_code: c.proposed_code,
        rationale: c.rationale,
        impact: c.impact || 'medium',
        auto_applicable: c.auto_applicable ?? false
      }));

      // Report progress and get next action
      const nextAction = await workflowSessionManager.reportProgress(
        session,
        {
          action: completed_action.action,
          file: completed_action.file,
          checklist_item_id: completed_action.checklist_item_id,
          status: completed_action.status,
          skip_reason: completed_action.skip_reason,
          error: completed_action.error
        },
        normalizedFindings,
        normalizedChanges,
        expand_checklist
      );

      // Get updated session
      const updatedSession = await workflowSessionManager.getSession(session_id);
      if (!updatedSession) {
        return {
          isError: true,
          error: 'Session lost during update',
          content: [{
            type: 'text' as const,
            text: 'Error: Session was lost during progress update'
          }]
        };
      }

      // Get current file
      const currentFile = updatedSession.file_inventory[updatedSession.current_file_index];

      // Calculate progress
      const percentComplete = updatedSession.files_total > 0
        ? Math.round((updatedSession.files_completed / updatedSession.files_total) * 100)
        : 0;

      // Build response
      const output: WorkflowNextOutput = {
        session_id: updatedSession.id,
        status: updatedSession.status,

        progress: {
          phase: updatedSession.current_phase,
          files_completed: updatedSession.files_completed,
          files_total: updatedSession.files_total,
          percent_complete: percentComplete,
          current_file: currentFile?.path
        },

        current_file: currentFile ? {
          path: currentFile.path,
          status: currentFile.status,
          checklist: currentFile.checklist
        } : undefined,

        next_action: nextAction,

        agent_instructions: generateAgentInstructions(updatedSession, nextAction, completed_action)
      };

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
          text: `Error reporting progress: ${errorMessage}`
        }]
      };
    }
  };
}

/**
 * Generate agent instructions based on completed action and next action
 */
function generateAgentInstructions(session: any, nextAction: any, completedAction: any): string {
  const parts: string[] = [];

  // Acknowledge completion
  if (completedAction.status === 'completed') {
    parts.push(`Action '${completedAction.action}' completed successfully.`);
  } else if (completedAction.status === 'skipped') {
    parts.push(`Action '${completedAction.action}' skipped: ${completedAction.skip_reason || 'no reason provided'}.`);
  } else if (completedAction.status === 'failed') {
    parts.push(`Action '${completedAction.action}' failed: ${completedAction.error || 'unknown error'}.`);
  }

  // Add progress summary
  parts.push(`Progress: ${session.files_completed}/${session.files_total} files.`);

  // Add next action guidance
  if (nextAction.type === 'complete_workflow') {
    parts.push('All files processed. Call workflow_complete to finish.');
  } else {
    parts.push(nextAction.instruction || 'Continue with the next action.');
  }

  return parts.join(' ');
}
