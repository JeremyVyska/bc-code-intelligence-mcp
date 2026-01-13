/**
 * get_bc_topic Tool - Handler Implementation
 *
 * Get detailed content for specific BC knowledge topics
 */

export function createGetBcTopicHandler(services: any) {
  const { knowledgeService } = services;

  return async (args: any) => {
    const { topic_id, include_samples = true, specialist_context } = args;

    // Extract domain from specialist_context if provided
    const contextDomain = specialist_context?.replace(/^(.*?)-.*/, '$1-$2')?.toLowerCase();

    const topic = await knowledgeService.getTopic(topic_id, include_samples, contextDomain);

    // Add workflow_integration for v2 workflows
    const result = {
      ...topic,
      workflow_integration: {
        instruction: 'Apply this topic\'s guidance to the current file. After review, call workflow_progress with any findings or proposed_changes.',
        finding_template: {
          severity: 'warning|error|info',
          category: topic?.category || 'best-practice',
          description: 'Describe the specific issue found',
          suggestion: 'Describe the recommended fix',
          related_topic: topic_id
        }
      }
    };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2)
      }]
    };
  };
}
