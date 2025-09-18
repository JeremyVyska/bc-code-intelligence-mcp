// Streamlined tool handlers for BCKB MCP Server 1.1.0

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
        // Workspace analysis
        const analysisResult = await codeAnalysisService.analyzeWorkspace({
          workspace_path: undefined, // auto-detect
          analysis_depth: 'detailed',
          focus_area: 'understanding'
        });
        
        if (suggest_workflows) {
          // Suggest relevant workflows based on analysis
          const workflowSuggestions = await methodologyService.suggestWorkflows(analysisResult);
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
      
      const topic = await knowledgeService.getTopicContent(topic_id, include_samples);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(topic, null, 2)
        }]
      };
    },

    'start_bc_workflow': async (args: any) => {
      const { workflow_type, context, bc_version, additional_info } = args;
      
      const startRequest = {
        workflow_type,
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
            workflow_type,
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
      
      const result = await workflowService.advanceWorkflow({
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
      
      // Analyze the situation and suggest appropriate tools/workflows
      const suggestions = await knowledgeService.analyzeSituationAndSuggest({
        situation: current_situation,
        workspace_context
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            situation_analysis: suggestions.analysis,
            recommended_tools: suggestions.tools,
            suggested_workflows: suggestions.workflows,
            next_steps: suggestions.next_steps
          }, null, 2)
        }]
      };
    }
  };
}