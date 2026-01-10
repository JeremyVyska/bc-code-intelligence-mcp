/**
 * find_bc_knowledge Tool - Handler Implementation
 *
 * Search BC knowledge topics, specialists, and workflows
 */

export function createFindBcKnowledgeHandler(services: any) {
  const { knowledgeService, methodologyService } = services;

  return async (args: any) => {
    try {
      const { query, search_type = 'all', bc_version, limit = 10 } = args;

      // Validate required parameters
      if (!query) {
        return {
          isError: true,
          error: 'query parameter is required',
          content: [{
            type: 'text' as const,
            text: 'Error: query parameter is required'
          }]
        };
      }

      const results: any = {
        query,
        search_type,
        results: []
      };

      if (search_type === 'topics' || search_type === 'all') {
        const topics = await knowledgeService.searchTopics({
          code_context: query,
          bc_version,
          limit: search_type === 'topics' ? limit : Math.ceil(limit / 3)
        });
        results.results.push({
          type: 'topics',
          items: topics
        });
      }

      if (search_type === 'specialists' || search_type === 'all') {
        const specialists = await knowledgeService.findSpecialistsByQuery(query);
        results.results.push({
          type: 'specialists',
          items: specialists.slice(0, search_type === 'specialists' ? limit : Math.ceil(limit / 3))
        });
      }

      if (search_type === 'workflows' || search_type === 'all') {
        const workflows = await methodologyService.findWorkflowsByQuery(query);
        results.results.push({
          type: 'workflows',
          items: workflows.slice(0, search_type === 'workflows' ? limit : Math.ceil(limit / 3))
        });
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(results, null, 2)
        }]
      };
    } catch (error) {
      return {
        isError: true,
        error: (error && (error as any).message) ? (error as any).message : 'Service error occurred',
        content: [{
          type: 'text' as const,
          text: `Error: ${(error && (error as any).message) ? (error as any).message : 'Service error occurred'}`
        }]
      };
    }
  };
}
