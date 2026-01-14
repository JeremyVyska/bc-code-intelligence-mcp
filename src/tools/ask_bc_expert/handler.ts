/**
 * ask_bc_expert Tool - Handler Implementation
 *
 * Direct specialist consultation handlers
 */

export function createAskBcExpertHandler(services: any) {
  const { knowledgeService, workflowService, codeAnalysisService } = services;

  return async (args: any) => {
    try {
      const { question, context, preferred_specialist, autonomous_mode = false } = args;

      // Validate required parameters
      if (!question) {
        return {
          isError: true,
          error: 'question parameter is required',
          content: [{
            type: 'text' as const,
            text: 'Error: question parameter is required'
          }]
        };
      }

      // Auto-detect if this is a "took over app" scenario
      const isOnboardingScenario = /took over|inherited|new to|understand.*app|unfamiliar/i.test(question + ' ' + (context || ''));

      if (isOnboardingScenario && !preferred_specialist) {
        // Start onboarding workflow automatically
        const startRequest = {
          workflow_type: 'onboard-developer',
          project_context: context || question,
          bc_version: 'BC22' // default
        };

        const session = await workflowService.startWorkflow(startRequest);
        const guidance = await workflowService.getPhaseGuidance(session.id);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              response_type: 'workflow_started',
              workflow_id: session.id,
              workflow_type: 'developer_onboarding',
              message: 'I detected this is a new developer onboarding scenario. Starting the systematic onboarding workflow.',
              guidance
            }, null, 2)
          }]
        };
      }

      // Normal specialist consultation
      const specialist = await knowledgeService.askSpecialist(question, preferred_specialist);

      // AUTONOMOUS MODE: Return structured action plan
      if (autonomous_mode) {
        const actionPlan = {
          response_type: 'autonomous_action_plan',
          specialist: {
            id: specialist.specialist.id,
            name: specialist.specialist.name,
            expertise: specialist.specialist.expertise
          },
          action_plan: {
            primary_action: specialist.consultation.response.split('\n')[0],
            steps: specialist.consultation.response
              .split('\n')
              .filter((line: string) => /^\d+\.|^-|^•/.test(line.trim()))
              .map((step: string) => step.trim()),
            required_tools: specialist.recommended_topics
              .filter((t: any) => t.domain === 'tools' || t.domain === 'workflows')
              .map((t: any) => t.id),
            confidence: specialist.consultation.confidence || 0.85,
            blocking_issues: specialist.consultation.blocking_issues || [],
            alternatives: specialist.consultation.alternatives || []
          },
          recommended_topics: specialist.recommended_topics,
          next_specialist: specialist.consultation.hand_off_to || null,
          context: context
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(actionPlan, null, 2)
          }]
        };
      }

      // INTERACTIVE MODE: Return full specialist content as agent instructions
      let agentInstructions = '';

      agentInstructions += `SPECIALIST DEFINITION AND INSTRUCTIONS:\n\n`;
      agentInstructions += specialist.specialist_full_content || specialist.consultation_guidance || '';
      agentInstructions += `\n\n${'='.repeat(80)}\n\n`;
      agentInstructions += `USER QUESTION: ${question}\n`;
      if (context) {
        agentInstructions += `CONTEXT: ${context}\n`;
      }
      agentInstructions += `\n`;
      agentInstructions += `GUIDANCE: ${specialist.response}\n\n`;
      agentInstructions += `CRITICAL: You ARE ${specialist.specialist.name}. Respond directly as this specialist, not as an AI assistant describing what they would say. Use their communication style, expertise, and personality.\n\n`;

      if (specialist.follow_up_suggestions && specialist.follow_up_suggestions.length > 0) {
        agentInstructions += `HANDOFF OPPORTUNITIES:\n`;
        specialist.follow_up_suggestions.forEach((s: string) => {
          agentInstructions += `- Consider involving ${s} if needed\n`;
        });
      }

      // If context contains code, analyze it for relevant topics
      let recommendedTopics: any[] = [];
      if (context && codeAnalysisService) {
        try {
          const analysisResult = await codeAnalysisService.analyzeCode({
            code_snippet: context,
            analysis_type: 'comprehensive',
            suggest_topics: true
          });

          // Extract relevant knowledge topics
          const relevanceMatches = codeAnalysisService.getLastRelevanceMatches?.() || [];
          recommendedTopics = relevanceMatches.slice(0, 5).map((match: any) => ({
            topic_id: match.topicId,
            title: match.title,
            relevance_score: match.relevanceScore,
            domain: match.domain,
            matched_signals: match.matchedSignals || []
          }));

          // Also include suggested_topics from analysis if relevance matches are empty
          if (recommendedTopics.length === 0 && analysisResult.suggested_topics) {
            recommendedTopics = analysisResult.suggested_topics.slice(0, 5).map((topic: any) => ({
              topic_id: topic.id || topic.topic_id,
              title: topic.title || topic.description,
              relevance_score: topic.relevance_score || 0.7,
              domain: topic.domain || specialist.specialist?.id
            }));
          }
        } catch (analysisError) {
          // Code analysis failed - continue without topics
          console.error('Code analysis for ask_bc_expert failed:', analysisError);
        }
      }

      // Add recommended topics to instructions if found
      if (recommendedTopics.length > 0) {
        agentInstructions += `\nRECOMMENDED TOPICS (use get_bc_topic to retrieve full content):\n`;
        recommendedTopics.forEach((topic: any) => {
          agentInstructions += `- ${topic.topic_id}: ${topic.title} (relevance: ${(topic.relevance_score * 100).toFixed(0)}%)\n`;
        });
        agentInstructions += `\nThese topics are directly relevant to the code context provided. Consider fetching them to inform your response.\n`;
      }

      return {
        content: [{
          type: 'text' as const,
          text: agentInstructions
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
