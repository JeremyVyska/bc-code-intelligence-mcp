/**
 * advance_workflow Tool - Handler Implementation
 *
 * Progress to the next phase of an active workflow
 */

export function createAdvanceWorkflowHandler(services: any) {
  const { workflowService } = services;

  return async (args: any) => {
    const { workflow_id, phase_results, next_focus, check_status_only } = args;

    // Validate required parameters
    if (!workflow_id) {
      return {
        isError: true,
        error: 'workflow_id parameter is required',
        content: [{
          type: 'text' as const,
          text: 'Error: workflow_id parameter is required'
        }]
      };
    }

    try {
      const result = await workflowService.advancePhase({
        workflow_id,
        phase_results,
        specialist_notes: next_focus,
        check_status_only
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Workflow session not found')) {
        return {
          isError: true,
          error: 'Workflow session not found',
          content: [{
            type: 'text' as const,
            text: `Error: Workflow session '${workflow_id}' not found. Use start_bc_workflow to create a new workflow.`
          }]
        };
      }

      return {
        isError: true,
        error: errorMessage,
        content: [{
          type: 'text' as const,
          text: `Error: ${errorMessage}`
        }]
      };
    }
  };
}
