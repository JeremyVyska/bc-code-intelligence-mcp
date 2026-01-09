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

// Cache for specialist name mappings
let cachedSpecialistMappings: Map<string, string> | null = null;

// Build specialist name lookup from loaded specialists
async function buildSpecialistNameLookup(layerService: any): Promise<Map<string, string>> {
  try {
    const specialists = await layerService.getAllSpecialists();
    const lookup = new Map<string, string>();
    
    for (const specialist of specialists) {
      const id = specialist.specialist_id || specialist.id;
      if (!id) continue;
      
      // Extract first name from specialist ID (e.g., "sam-coder" -> "sam", "chris-config" -> "chris")
      const firstName = id.split('-')[0].toLowerCase();
      
      // Map first name to full ID
      lookup.set(firstName, id);
      
      // Also map full ID to itself for exact matches
      lookup.set(id.toLowerCase(), id);
      
      // Map specialist name if available
      if (specialist.name) {
        const nameFirstWord = specialist.name.split(' ')[0].toLowerCase();
        lookup.set(nameFirstWord, id);
      }
    }
    
    return lookup;
  } catch (error) {
    console.error('Error building specialist lookup:', error);
    return new Map();
  }
}

// Extract specialist reference from text and return specialist ID
async function extractSpecialistFromText(
  text: string,
  layerService: any
): Promise<string | null> {
  
  // Build specialist lookup (cached)
  if (!cachedSpecialistMappings) {
    cachedSpecialistMappings = await buildSpecialistNameLookup(layerService);
  }
  
  const lowerText = text.toLowerCase();
  
  // Check each specialist name to see if it's mentioned
  for (const [name, specialistId] of cachedSpecialistMappings.entries()) {
    if (lowerText.includes(name)) {
      return specialistId;
    }
  }
  
  return null;
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
      try {
        const { query, search_type = 'all', bc_version, limit = 10 } = args;
        
        // Validate required parameters
        if (!query) {
          return {
            isError: true,
            error: 'query parameter is required',
            content: [{
              type: 'text',
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
            code_context: query,  // FIX: Use code_context instead of query
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
            type: 'text',
            text: JSON.stringify(results, null, 2)
          }]
        };
      } catch (error) {
        return {
          isError: true,
          error: (error && error.message) ? error.message : 'Service error occurred',
          content: [{
            type: 'text',
            text: `Error: ${(error && error.message) ? error.message : 'Service error occurred'}`
          }]
        };
      }
    },

    'ask_bc_expert': async (args: any) => {
      try {
        const { question, context, preferred_specialist, autonomous_mode = false } = args;
        
        // Validate required parameters
        if (!question) {
          return {
            isError: true,
            error: 'question parameter is required',
            content: [{
              type: 'text',
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
        
        // AUTONOMOUS MODE: Return structured action plan
        if (autonomous_mode) {
          // Extract actionable steps from consultation
          const actionPlan = {
            response_type: 'autonomous_action_plan',
            specialist: {
              id: specialist.specialist.id,
              name: specialist.specialist.name,
              expertise: specialist.specialist.expertise
            },
            action_plan: {
              primary_action: specialist.consultation.response.split('\n')[0], // First line is usually the main recommendation
              steps: specialist.consultation.response
                .split('\n')
                .filter((line: string) => /^\d+\.|^-|^•/.test(line.trim())) // Extract numbered/bulleted steps
                .map((step: string) => step.trim()),
              required_tools: specialist.recommended_topics
                .filter((t: any) => t.domain === 'tools' || t.domain === 'methodologies')
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
              type: 'text',
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
        
        return {
          content: [{
            type: 'text',
            text: agentInstructions
          }]
        };
      } catch (error) {
        return {
          isError: true,
          error: (error && error.message) ? error.message : 'Service error occurred',
          content: [{
            type: 'text',
            text: `Error: ${(error && error.message) ? error.message : 'Service error occurred'}`
          }]
        };
      }
    },

    'analyze_al_code': async (args: any) => {
      const { code, analysis_type = 'comprehensive', operation = 'analyze', bc_version, suggest_workflows = true } = args;
      
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
        
        // VALIDATE OPERATION: Return compliance issues + auto-fix suggestions
        if (operation === 'validate') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                response_type: 'validation_report',
                compliance_issues: analysisResult.issues || [],
                auto_fix_suggestions: analysisResult.patterns
                  ?.filter((p: any) => p.auto_fixable === true)
                  .map((p: any) => ({
                    issue: p.pattern,
                    fix_action: p.recommended_action,
                    code_snippet: p.code_snippet,
                    confidence: p.confidence || 0.9
                  })) || [],
                blocking_issues: analysisResult.issues?.filter((i: any) => i.severity === 'critical') || [],
                warnings: analysisResult.issues?.filter((i: any) => i.severity === 'warning') || [],
                bc_version: bc_version,
                analysis_type: analysis_type
              }, null, 2)
            }]
          };
        }
        
        // SUGGEST_FIXES OPERATION: Return code transformations
        if (operation === 'suggest_fixes') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                response_type: 'code_transformations',
                transformations: analysisResult.patterns
                  ?.map((p: any) => ({
                    pattern: p.pattern,
                    transformation: p.recommended_action,
                    before_code: p.code_snippet,
                    after_code: p.suggested_code || '// Auto-generation not available',
                    impact: p.impact || 'medium',
                    confidence: p.confidence || 0.85
                  })) || [],
                recommended_workflow: analysisResult.suggested_workflows?.[0] || null,
                bc_version: bc_version
              }, null, 2)
            }]
          };
        }
        
        // ANALYZE OPERATION: Return conversational analysis
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
        
        // VALIDATE OPERATION: Return compliance issues + auto-fix suggestions
        if (operation === 'validate') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                response_type: 'validation_report',
                compliance_issues: analysisResult.issues || [],
                auto_fix_suggestions: analysisResult.patterns
                  ?.filter((p: any) => p.auto_fixable === true)
                  .map((p: any) => ({
                    issue: p.pattern,
                    fix_action: p.recommended_action,
                    code_snippet: p.code_snippet,
                    confidence: p.confidence || 0.9
                  })) || [],
                blocking_issues: analysisResult.issues?.filter((i: any) => i.severity === 'critical') || [],
                warnings: analysisResult.issues?.filter((i: any) => i.severity === 'warning') || [],
                bc_version: bc_version,
                analysis_type: analysis_type
              }, null, 2)
            }]
          };
        }
        
        // SUGGEST_FIXES OPERATION: Return code transformations
        if (operation === 'suggest_fixes') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                response_type: 'code_transformations',
                transformations: analysisResult.patterns
                  ?.map((p: any) => ({
                    pattern: p.pattern,
                    transformation: p.recommended_action,
                    before_code: p.code_snippet,
                    after_code: p.suggested_code || '// Auto-generation not available',
                    impact: p.impact || 'medium',
                    confidence: p.confidence || 0.85
                  })) || [],
                recommended_workflow: suggest_workflows ? await methodologyService.findWorkflowsByQuery('code optimization') : null,
                bc_version: bc_version
              }, null, 2)
            }]
          };
        }
        
        // ANALYZE OPERATION: Return conversational analysis
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(analysisResult, null, 2)
          }]
        };
      }
    },

    'get_bc_topic': async (args: any) => {
      const { topic_id, include_samples = true, specialist_context } = args;
      
      // Extract domain from specialist_context if provided (e.g., "sam-coder" -> "sam-coder")
      const contextDomain = specialist_context?.replace(/^(.*?)-.*/, '$1-$2')?.toLowerCase();
      
      const topic = await knowledgeService.getTopic(topic_id, include_samples, contextDomain);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(topic, null, 2)
        }]
      };
    },

    'start_bc_workflow': async (args: any) => {
      const { workflow_type, context, bc_version, execution_mode = 'interactive', checkpoint_id, additional_info } = args;
      
      // Resume from checkpoint if provided
      if (checkpoint_id) {
        try {
          const session = await workflowService.resumeWorkflow(checkpoint_id);
          const guidance = await workflowService.getPhaseGuidance(session.id);
          
          if (execution_mode === 'autonomous') {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  response_type: 'workflow_next_action',
                  workflow_id: session.id,
                  checkpoint_id: checkpoint_id,
                  current_phase: session.current_phase,
                  next_action: {
                    action_type: 'execute_phase',
                    phase: session.current_phase,
                    specialist: session.current_specialist,
                    required_inputs: guidance.required_inputs || [],
                    expected_outputs: guidance.expected_outputs || [],
                    guidance: guidance.description
                  },
                  can_proceed: !guidance.blocking_issues || guidance.blocking_issues.length === 0,
                  blocking_issues: guidance.blocking_issues || [],
                  progress: session.progress || 0
                }, null, 2)
              }]
            };
          }
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                workflow_id: session.id,
                status: 'resumed',
                current_phase: session.current_phase,
                specialist: session.current_specialist,
                guidance
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            isError: true,
            error: `Failed to resume workflow from checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
            content: [{
              type: 'text',
              text: `Error resuming workflow: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          };
        }
      }
      
      // Check if this looks like a specialist conversation request - if so, auto-route to ask_bc_expert
      const specialistId = await extractSpecialistFromText(`${workflow_type} ${context || ''}`, layerService);
      if (specialistId) {
        // User wants to talk to a specialist - route to ask_bc_expert automatically
        const question = context || workflow_type;
        
        try {
          const specialist = await knowledgeService.askSpecialist(question, specialistId);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                response_type: 'specialist_consultation',
                note: `Detected request for ${specialistId} - automatically routed to specialist consultation`,
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
        } catch (error) {
          return {
            isError: true,
            error: `Failed to consult specialist ${specialistId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            content: [{
              type: 'text',
              text: `Error consulting specialist: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          };
        }
      }
      
      // Map streamlined workflow type to existing workflow type
      const mappedWorkflowType = mapWorkflowType(workflow_type);
      
      try {
        const session = await workflowService.startWorkflow({
          workflow_type: mappedWorkflowType,
          project_context: context,
          bc_version: bc_version || 'BC22',
          additional_context: additional_info
        });
        const guidance = await workflowService.getPhaseGuidance(session.id);
        
        // AUTONOMOUS MODE: Return next action instead of interactive guidance
        if (execution_mode === 'autonomous') {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                response_type: 'workflow_next_action',
                workflow_id: session.id,
                workflow_type: workflow_type,
                checkpoint_id: session.id, // Use session ID as checkpoint for resumption
                current_phase: session.current_phase,
                next_action: {
                  action_type: 'execute_phase',
                  phase: session.current_phase,
                  specialist: session.current_specialist,
                  required_inputs: guidance.required_inputs || [],
                  expected_outputs: guidance.expected_outputs || [],
                  guidance: guidance.description,
                  estimated_duration: guidance.estimated_duration || 'unknown'
                },
                can_proceed: !guidance.blocking_issues || guidance.blocking_issues.length === 0,
                blocking_issues: guidance.blocking_issues || [],
                total_phases: session.total_phases || 5,
                progress: 0
              }, null, 2)
            }]
          };
        }
        
        // INTERACTIVE MODE: Return conversational workflow guidance
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
      } catch (error) {
        // Enhanced error handling with suggestions
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        if (errorMessage.includes('Unknown workflow type')) {
          return {
            isError: true,
            error: 'Invalid workflow type',
            content: [{
              type: 'text',
              text: `Error: Invalid workflow type '${workflow_type}'. Use ask_bc_expert for specialist conversations.`
            }]
          };
        }
        
        return {
          isError: true,
          error: errorMessage,
          content: [{
            type: 'text',
            text: `Error: ${errorMessage}`
          }]
        };
      }
    },

    'advance_workflow': async (args: any) => {
      const { workflow_id, phase_results, next_focus, check_status_only } = args;
      
      // Validate required parameters
      if (!workflow_id) {
        return {
          isError: true,
          error: 'workflow_id parameter is required',
          content: [{
            type: 'text',
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
            type: 'text',
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
              type: 'text',
              text: `Error: Workflow session '${workflow_id}' not found. Use start_bc_workflow to create a new workflow.`
            }]
          };
        }
        
        return {
          isError: true,
          error: errorMessage,
          content: [{
            type: 'text',
            text: `Error: ${errorMessage}`
          }]
        };
      }
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

    'list_specialists': async (args: any) => {
      const { domain, expertise } = args;
      
      const specialists = await layerService.getAllSpecialists();
      
      // Apply filters
      let filteredSpecialists = specialists;
      
      if (domain) {
        filteredSpecialists = specialists.filter(s => 
          s.domains.some(d => d.toLowerCase().includes(domain.toLowerCase()))
        );
      }
      
      if (expertise) {
        filteredSpecialists = filteredSpecialists.filter(s =>
          [...s.expertise.primary, ...s.expertise.secondary].some(e =>
            e.toLowerCase().includes(expertise.toLowerCase())
          )
        );
      }

      if (filteredSpecialists.length === 0) {
        return {
          content: [{
            type: 'text',
            text: '❌ No specialists found matching your criteria. Try different filters or remove them to see all specialists.'
          }]
        };
      }

      // Group by domain for better organization
      const specialistsByDomain = new Map();
      
      filteredSpecialists.forEach(specialist => {
        specialist.domains.forEach(d => {
          if (!specialistsByDomain.has(d)) {
            specialistsByDomain.set(d, []);
          }
          if (!specialistsByDomain.get(d).includes(specialist)) {
            specialistsByDomain.get(d).push(specialist);
          }
        });
      });

      let response = `👥 **BC Code Intelligence Specialists** ${domain || expertise ? '(filtered)' : ''}\\n\\n`;
      
      // Show specialists organized by domain
      for (const [domainName, domainSpecialists] of specialistsByDomain.entries()) {
        response += `## 🏷️ ${domainName.charAt(0).toUpperCase() + domainName.slice(1)}\\n\\n`;
        
        for (const specialist of domainSpecialists) {
          response += `**${specialist.title}** (\`${specialist.specialist_id}\`)\\n`;
          response += `💬 ${specialist.persona.greeting}\\n`;
          response += `🎯 **Primary Expertise:** ${specialist.expertise.primary.join(', ')}\\n`;
          if (specialist.expertise.secondary.length > 0) {
            response += `🔧 **Also helps with:** ${specialist.expertise.secondary.slice(0, 3).join(', ')}\\n`;
          }
          response += `\\n`;
        }
      }

      response += `\\n💡 **Getting Started:**\\n`;
      response += `• Use \`ask_bc_expert\` with preferred_specialist parameter to connect with a specific specialist\\n`;
      response += `• Example: ask_bc_expert({ question: "Help with caching", preferred_specialist: "sam-coder" })\\n`;
      response += `• Or let ask_bc_expert auto-route based on your question`;

      // Check if workspace is configured - company/project specialists might be missing
      const layersInfo = layerService.getLayers();
      const hasProjectOrCompanyLayers = layersInfo.some(layer => 
        layer.name.includes('company') || layer.name.includes('project') || layer.name.includes('team')
      );

      if (!hasProjectOrCompanyLayers) {
        response += `\\n\\n⚠️ **Note:** Only embedded specialists shown. Company/project specialists require workspace configuration.`;
      }

      return {
        content: [{ type: 'text', text: response }]
      };
    }
  };
}