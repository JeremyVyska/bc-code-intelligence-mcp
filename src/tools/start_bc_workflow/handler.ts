/**
 * start_bc_workflow Tool - Handler Implementation
 *
 * Start long-running analytical workflows
 */

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

export function createStartBcWorkflowHandler(services: any) {
  const { workflowService, knowledgeService, layerService } = services;

  return async (args: any) => {
    const { workflow_type, context, bc_version, execution_mode = 'interactive', checkpoint_id, additional_info } = args;

    // Resume from checkpoint if provided
    if (checkpoint_id) {
      try {
        const session = await workflowService.resumeWorkflow(checkpoint_id);
        const guidance = await workflowService.getPhaseGuidance(session.id);

        if (execution_mode === 'autonomous') {
          return {
            content: [{
              type: 'text' as const,
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
            type: 'text' as const,
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
            type: 'text' as const,
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
            type: 'text' as const,
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
            type: 'text' as const,
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
            type: 'text' as const,
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
          type: 'text' as const,
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
            type: 'text' as const,
            text: `Error: Invalid workflow type '${workflow_type}'. Use ask_bc_expert for specialist conversations.`
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
