/**
 * workflow_next Tool - Handler Implementation
 *
 * Get the next action to perform in a workflow v2 session.
 */

import * as path from 'path';
import { WorkflowSessionManagerV2 } from '../../services/workflow-v2/workflow-session-manager.js';
import { WorkflowNextOutput } from '../../types/workflow-v2-types.js';

export function createWorkflowNextHandler(services: any) {
  const workflowSessionManager: WorkflowSessionManagerV2 = services.workflowSessionManagerV2;

  return async (args: any) => {
    const { session_id } = args;

    try {
      // Get session
      const session = await workflowSessionManager.getSession(session_id);
      if (!session) {
        return {
          isError: true,
          error: `Session not found: ${session_id}`,
          content: [{
            type: 'text' as const,
            text: `Error: Workflow session '${session_id}' not found. It may have expired or been completed.`
          }]
        };
      }

      // Get current file
      const currentFile = session.file_inventory[session.current_file_index];

      // Get next action
      const nextAction = workflowSessionManager.getNextAction(session);

      // Calculate progress
      const phaseIndex = session.phases.findIndex(p => p.id === session.current_phase);
      const percentComplete = session.files_total > 0
        ? Math.round((session.files_completed / session.files_total) * 100)
        : 0;

      // Build response
      const output: WorkflowNextOutput = {
        session_id: session.id,
        status: session.status,

        progress: {
          phase: session.current_phase,
          files_completed: session.files_completed,
          files_total: session.files_total,
          percent_complete: percentComplete,
          current_file: currentFile?.path
        },

        current_file: currentFile ? {
          path: currentFile.path,
          status: currentFile.status,
          checklist: currentFile.checklist
        } : undefined,

        next_action: nextAction,

        agent_instructions: generateAgentInstructions(session, nextAction)
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
          text: `Error getting next action: ${errorMessage}`
        }]
      };
    }
  };
}

/**
 * Generate agent instructions based on workflow state and next action
 */
function generateAgentInstructions(session: any, nextAction: any): string {
  if (nextAction.type === 'complete_workflow') {
    return 'All files have been processed. Call workflow_complete to generate the final report and end the workflow.';
  }

  if (nextAction.type === 'analyze_file') {
    return `Analyze ${path.basename(nextAction.file || '')}. After analysis, call workflow_progress with any findings and the suggested_topics from analyze_al_code to expand the checklist.`;
  }

  if (nextAction.type === 'apply_topic') {
    return `Apply topic '${nextAction.topic_id}' to the current file. Call retrieve_bc_knowledge to get the topic content, review it against the file, and report findings via workflow_progress.`;
  }

  if (nextAction.type === 'convert_instance') {
    return `Review the pattern instance at line ${nextAction.instance?.line_number}. ${nextAction.instance?.requires_manual_review ? 'This requires manual review - apply your judgment.' : 'This can be auto-fixed.'} Report result via workflow_progress.`;
  }

  return nextAction.instruction || 'Follow the next_action instructions to continue the workflow.';
}
