// Streamlined tool handlers for BCKB MCP Server 1.0.2

// Map streamlined workflow types to existing workflow types
function mapWorkflowType(streamlinedType: string): string {
  const workflowMapping: Record<string, string> = {
    'code-optimization': 'enhance-bc-app',
    'architecture-review': 'review-bc-code', 
    'security-audit': 'review-bc-code',
    'performance-analysis': 'enhance-bc-app',
    'integration-design': 'enhance-bc-app',
    'upgrade-planning': 'upgrade-bc-version',
    'testing-strategy': 'enhance-bc-app',
    'developer-onboarding': 'onboard-developer',
    'pure-review': 'review-bc-code'
  };
  
  return workflowMapping[streamlinedType] || streamlinedType;
}

export function createStreamlinedHandlers(server: any, services: any) {
  const {
    knowledgeService,
    codeAnalysisService,
    methodologyService,
    workflowService,
    layerService
  } = services;

  return {
    'find_bc_knowledge': async (args: any) => {
      const { query, search_type = 'all', bc_version, limit = 10 } = args;
      
      const results: any = {
        query,
        search_type,
        results: []
      };

      if (search_type === 'topics' || search_type === 'all') {
        const topics = await knowledgeService.searchTopics({ 
          query, 
          bc_version, 
          limit: search_type === 'topics' ? limit : Math.ceil(limit / 3)
        });
        results.results.push({
          type: 'topics',
          items: topics
        });
      }

      if (search_type === 'specialists' || search_type === 'all') {
        const specialists = knowledgeService.findSpecialistsByQuery(query);
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
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }]
      };
    },

    'ask_bc_expert': async (args: any) => {
      const { question, context, preferred_specialist } = args;
      
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
            type: 'text',
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
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            response_type: 'specialist_consultation',
            specialist: {
              id: specialist.specialist.id,
              name: specialist.specialist.name,
              expertise: specialist.specialist.expertise
            },
            consultation: specialist.consultation,
            recommended_topics: specialist.recommended_topics,
            context: context
          }, null, 2)
        }]
      };
    },

    'analyze_al_code': async (args: any) => {
      const { code, analysis_type = 'comprehensive', bc_version, suggest_workflows = true } = args;
      
      if (code.toLowerCase() === 'workspace') {
        // Workspace analysis using existing method
        const analysisResult = await codeAnalysisService.analyzeCode({
          code_snippet: "// Workspace analysis requested", 
          analysis_type: 'workspace_overview',
          suggest_topics: suggest_workflows,
          bc_version
        });
        
        if (suggest_workflows) {
          // Suggest relevant workflows based on analysis
          const workflowSuggestions = await methodologyService.findWorkflowsByQuery('code analysis optimization');
          analysisResult.suggested_workflows = workflowSuggestions;
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(analysisResult, null, 2)
          }]
        };
      } else {
        // Code snippet analysis
        const analysisResult = await codeAnalysisService.analyzeCode({
          code_snippet: code,
          analysis_type,
          suggest_topics: suggest_workflows,
          bc_version
        });
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(analysisResult, null, 2)
          }]
        };
      }
    },

    'get_bc_topic': async (args: any) => {
      const { topic_id, include_samples = true } = args;
      
      const topic = await knowledgeService.getTopic(topic_id, include_samples);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(topic, null, 2)
        }]
      };
    },

    'start_bc_workflow': async (args: any) => {
      const { workflow_type, context, bc_version, additional_info } = args;
      
      // Map streamlined workflow type to existing workflow type
      const mappedWorkflowType = mapWorkflowType(workflow_type);
      
      const startRequest = {
        workflow_type: mappedWorkflowType,
        project_context: context,
        bc_version: bc_version || 'BC22',
        additional_context: additional_info
      };
      
      const session = await workflowService.startWorkflow(startRequest);
      const guidance = await workflowService.getPhaseGuidance(session.id);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            workflow_id: session.id,
            workflow_type: workflow_type, // Return original type for clarity
            mapped_to: mappedWorkflowType,
            status: 'started',
            current_phase: session.current_phase,
            specialist: session.current_specialist,
            guidance
          }, null, 2)
        }]
      };
    },

    'advance_workflow': async (args: any) => {
      const { workflow_id, phase_results, next_focus } = args;
      
      const result = await workflowService.advancePhase({
        workflow_id,
        phase_results,
        specialist_notes: next_focus
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    },

    'get_workflow_help': async (args: any) => {
      const { workflow_id, help_type = 'guidance' } = args;
      
      if (!workflow_id) {
        // List active workflows
        const activeWorkflows = await workflowService.getActiveWorkflows();
        return {
          content: [{
            type: 'text',
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
              type: 'text',
              text: JSON.stringify(status, null, 2)
            }]
          };
          
        case 'guidance':
        case 'next-steps':
          const guidance = await workflowService.getPhaseGuidance(workflow_id);
          return {
            content: [{
              type: 'text',
              text: guidance
            }]
          };
          
        case 'methodology':
          const methodology = await workflowService.getWorkflowMethodology(workflow_id);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(methodology, null, 2)
            }]
          };
          
        default:
          throw new Error(`Unknown help type: ${help_type}`);
      }
    },

    'get_bc_help': async (args: any) => {
      const { current_situation, workspace_context } = args;
      
      // Basic situation analysis using existing methods
      const searchResults = await knowledgeService.searchTopics({ 
        query: current_situation, 
        limit: 5 
      });
      
      const specialists = knowledgeService.findSpecialistsByQuery(current_situation);
      const workflows = await methodologyService.findWorkflowsByQuery(current_situation);
      
      // Basic analysis and suggestions
      const suggestions = {
        analysis: `Based on your situation: "${current_situation}", I've analyzed available resources.`,
        tools: [
          {
            tool: 'find_bc_knowledge',
            reason: 'Search for specific BC topics related to your situation',
            usage: `find_bc_knowledge({ query: "${current_situation}" })`
          },
          {
            tool: 'ask_bc_expert', 
            reason: 'Get expert consultation with automatic specialist selection',
            usage: `ask_bc_expert({ question: "${current_situation}" })`
          }
        ],
        workflows: workflows.slice(0, 3),
        specialists: specialists.slice(0, 3),
        related_topics: searchResults,
        next_steps: [
          'Start with ask_bc_expert for immediate consultation',
          'Use find_bc_knowledge to explore related topics',
          'Consider starting a workflow if this is a complex task'
        ]
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            situation_analysis: suggestions.analysis,
            recommended_tools: suggestions.tools,
            suggested_workflows: suggestions.workflows,
            available_specialists: suggestions.specialists,
            related_topics: suggestions.related_topics,
            next_steps: suggestions.next_steps
          }, null, 2)
        }]
      };
    }
  };
}