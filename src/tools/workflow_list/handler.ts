/**
 * workflow_list Tool - Handler Implementation
 *
 * Lists all available workflows from the methodology service
 */

export function createWorkflowListHandler(services: any) {
  const { methodologyService } = services;

  return async (_args: any) => {
    try {
      // Get workflow mappings from methodology service
      const indexData = methodologyService.getIndexData?.() || {};
      const workflowMappings = indexData.workflow_mappings || {};
      const intents = indexData.intents || {};

      const workflows = Object.entries(workflowMappings).map(([type, mapping]: [string, any]) => {
        const intent = intents[type] || {};
        return {
          workflow_type: type,
          name: mapping.description || type,
          description: mapping.description || `Workflow for ${type}`,
          specialist: mapping.specialist || intent.specialist || null,
          phases: mapping.phases || [],
          keywords: intent.keywords || []
        };
      });

      if (workflows.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              message: 'No workflows currently available',
              suggestion: 'Workflows are defined in the embedded-knowledge/workflows directory'
            }, null, 2)
          }]
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            available_workflows: workflows,
            usage: 'To start a workflow, call workflow_start({ workflow_type: "<type>" })',
            tip: 'Match user intent to workflow keywords to suggest the right workflow'
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: 'text' as const,
          text: `Error listing workflows: ${(error as Error).message}`
        }]
      };
    }
  };
}
