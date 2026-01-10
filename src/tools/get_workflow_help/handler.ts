/**
 * get_workflow_help Tool - Handler Implementation
 *
 * Get guidance for current workflow phase
 */

export function createGetWorkflowHelpHandler(services: any) {
  const { workflowService } = services;

  return async (args: any) => {
    const { workflow_id, help_type = 'guidance' } = args;

    if (!workflow_id) {
      // List active workflows
      const activeWorkflows = await workflowService.getActiveWorkflows();
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            help_type: 'active_workflows',
            active_workflows: activeWorkflows
          }, null, 2)
        }]
      };
    }

    switch (help_type) {
      case 'status':
        const status = await workflowService.getWorkflowStatus(workflow_id);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(status, null, 2)
          }]
        };

      case 'guidance':
      case 'next-steps':
        const guidance = await workflowService.getPhaseGuidance(workflow_id);
        return {
          content: [{
            type: 'text' as const,
            text: guidance
          }]
        };

      case 'methodology':
        const methodology = await workflowService.getWorkflowMethodology(workflow_id);
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(methodology, null, 2)
          }]
        };

      default:
        throw new Error(`Unknown help type: ${help_type}`);
    }
  };
}
