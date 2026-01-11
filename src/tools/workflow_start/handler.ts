/**
 * workflow_start Tool - Handler Implementation
 *
 * Initialize a new workflow session.
 */

import { WorkflowSessionManager } from '../../services/workflow-v2/workflow-session-manager.js';
import {
  getWorkflowDefinition,
  isWorkflowTypeAvailable,
  getAvailableWorkflowTypes
} from '../../services/workflow-v2/workflow-definitions.js';
import {
  WorkflowType,
  WorkflowOptions,
  WorkflowStartOutput
} from '../../types/workflow-v2-types.js';

export function createWorkflowStartHandler(services: any) {
  const workflowSessionManager: WorkflowSessionManager = services.workflowSessionManager;

  return async (args: any) => {
    const {
      workflow_type,
      scope = 'workspace',
      path,
      options = {},
      initial_processing = {}
    } = args;

    try {
      // Validate workflow type (supports both built-in and custom types from layers)
      if (!isWorkflowTypeAvailable(workflow_type)) {
        const availableTypes = getAvailableWorkflowTypes();
        return {
          isError: true,
          error: `Invalid workflow type: ${workflow_type}`,
          content: [{
            type: 'text' as const,
            text: `Error: Invalid workflow type '${workflow_type}'. Available types: ${availableTypes.join(', ')}`
          }]
        };
      }

      // Validate bc-version-upgrade requirements
      if (workflow_type === 'bc-version-upgrade') {
        if (!options.source_version || !options.target_version) {
          return {
            isError: true,
            error: 'bc-version-upgrade requires source_version and target_version',
            content: [{
              type: 'text' as const,
              text: 'Error: bc-version-upgrade workflow requires options.source_version and options.target_version'
            }]
          };
        }
      }

      // Get workflow definition
      const definition = getWorkflowDefinition(workflow_type);

      // Prepare options
      const workflowOptions: WorkflowOptions = {
        bc_version: options.bc_version,
        include_patterns: options.include_patterns,
        exclude_patterns: options.exclude_patterns,
        max_files: options.max_files,
        priority_patterns: options.priority_patterns,
        source_version: options.source_version,
        target_version: options.target_version
      };

      // Prepare initial processing options
      const processingOptions = {
        run_autonomous_phases: initial_processing.run_autonomous_phases ?? true,
        scan_all_patterns: initial_processing.scan_all_patterns ?? true,
        timeout_ms: initial_processing.timeout_ms ?? 30000
      };

      // Start the workflow
      const { session, analysisSummary, duration_ms } = await workflowSessionManager.startWorkflow(
        workflow_type,
        scope,
        path,
        workflowOptions,
        processingOptions
      );

      // Get next action
      const nextAction = workflowSessionManager.getNextAction(session);

      // Build file inventory summary
      const filesByType: Record<string, number> = {};
      for (const file of session.file_inventory) {
        const type = file.object_type || 'Other';
        filesByType[type] = (filesByType[type] || 0) + 1;
      }

      // Build response
      const output: WorkflowStartOutput = {
        session_id: session.id,
        workflow_type: session.workflow_type,
        status: session.status,

        autonomous_processing: processingOptions.run_autonomous_phases ? {
          completed: true,
          phases_run: session.phases
            .filter(p => p.status === 'completed')
            .map(p => p.id),
          duration_ms
        } : undefined,

        file_inventory: {
          total: session.files_total,
          with_matches: analysisSummary?.files_with_matches,
          by_type: filesByType,
          files: session.file_inventory.slice(0, 10).map(f => ({
            path: f.path,
            size: f.size,
            priority: f.priority
          }))
        },

        analysis_summary: analysisSummary,

        phases: session.phases.map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          mode: p.mode
        })),

        next_action: nextAction,

        agent_instructions: generateAgentInstructions(session, analysisSummary)
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
          text: `Error starting workflow: ${errorMessage}`
        }]
      };
    }
  };
}

/**
 * Generate agent instructions based on workflow state
 */
function generateAgentInstructions(session: any, analysisSummary: any): string {
  if (analysisSummary && analysisSummary.total_instances > 0) {
    const autoFixable = Object.entries(analysisSummary.by_type)
      .filter(([_, info]: any) => info.auto_fixable)
      .reduce((sum, [_, info]: any) => sum + info.count, 0);

    return `Autonomous analysis complete. Found ${analysisSummary.total_instances} pattern instances across ${analysisSummary.files_with_matches} files. ` +
      `${autoFixable} are auto-fixable. Present the summary to the user and ask for their preferred approach. ` +
      `Do NOT start processing files until user confirms approach.`;
  }

  return `You have started a ${session.workflow_type} workflow. You MUST follow the next_action instructions exactly. ` +
    `After each action, call workflow_progress to report results and get the next action. ` +
    `Do NOT skip files or actions. Do NOT proceed without calling workflow_progress.`;
}
