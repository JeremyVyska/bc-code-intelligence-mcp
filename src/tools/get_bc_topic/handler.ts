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

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(topic, null, 2)
      }]
    };
  };
}
