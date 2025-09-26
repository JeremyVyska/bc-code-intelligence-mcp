/**
 * MCP Tools for BC Specialist Interactions
 * 
 * Provides a focused set of tools for AI-assisted Business Central development
 * through personality-driven specialist consultations.
 */

import { CallToolRequest, CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { MultiContentLayerService } from '../services/multi-content-layer-service.js';
import { SpecialistSessionManager } from '../services/specialist-session-manager.js';
import { BCSpecialistRoleplayEngine } from '../services/roleplay-engine.js';
import { KnowledgeService } from '../services/knowledge-service.js';
import { z } from 'zod';

// Input validation schemas
const SuggestSpecialistSchema = z.object({
  question: z.string().min(10, 'Question must be at least 10 characters'),
  context: z.string().optional().describe('Additional context about the problem')
});

const GetSpecialistAdviceSchema = z.object({
  specialist_id: z.string().min(1, 'Specialist ID is required'),
  message: z.string().min(1, 'Message is required'),
  session_id: z.string().optional().describe('Session ID for multi-turn conversations'),
  problem_context: z.string().optional().describe('Overall problem being solved')
});

const ListSpecialistsSchema = z.object({
  domain: z.string().optional().describe('Filter by domain (e.g., performance, security)'),
  expertise: z.string().optional().describe('Filter by expertise area')
});

export class SpecialistTools {
  private roleplayEngine: BCSpecialistRoleplayEngine;

  constructor(
    private readonly layerService: MultiContentLayerService,
    private readonly sessionManager: SpecialistSessionManager,
    private readonly knowledgeService: KnowledgeService
  ) {
    this.roleplayEngine = new BCSpecialistRoleplayEngine(layerService, knowledgeService);
  }

  /**
   * Get all specialist tool definitions for MCP registration
   */
  getToolDefinitions(): Tool[] {
    return [
      {
        name: 'suggest_specialist',
        description: 'Find the most appropriate BC specialist for your question. IMPORTANT: When user wants to "talk to" or "chat with" a specific specialist, use get_specialist_advice directly instead. This tool is for discovering which specialist to use when unsure.',
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Your question or problem description',
              minLength: 10
            },
            context: {
              type: 'string',
              description: 'Additional context about your project or situation (optional)'
            }
          },
          required: ['question']
        }
      },
      {
        name: 'get_specialist_advice',
        description: `Connect directly with a BC specialist who responds authentically as themselves. CRITICAL FOR AGENTS: Respond AS the specialist, not as an AI describing roleplay. No menus, no explanations - dive straight into the specialist persona and expertise. Perfect for "Talk to Sam", "Chat with Dean", etc.

⚠️ **MANDATORY KNOWLEDGE LOOKUP**: Before generating ANY BC development advice or code, ALWAYS search the knowledge base first using find_bc_knowledge. The knowledge base contains authoritative BC standards, patterns, and conventions that override general AI training. Never rely solely on training data for BC development guidance.

Example: find_bc_knowledge({ query: "AL file naming conventions" }) before writing AL code.

🔧 **AL/BC Platform Constraints**: All specialist advice MUST respect Business Central and AL language limitations:
• Security specialists: Focus on AL permission objects, user groups, BC security framework - NOT external auth systems
• UX specialists: Work within AL page/report constraints - BC controls rendering, NOT custom CSS/HTML  
• Performance specialists: AL optimization patterns, table design, BC server constraints - NOT generic frameworks
• API specialists: BC API pages, web services, AL integration - NOT generic REST frameworks
• All specialists: Prioritize AL language capabilities and BC platform limitations over generic programming`,
        inputSchema: {
          type: 'object',
          properties: {
            specialist_id: {
              type: 'string',
              description: 'ID of the specialist (e.g., dean-debug, alex-architect)',
              minLength: 1
            },
            message: {
              type: 'string',
              description: 'Your question or message to the specialist',
              minLength: 1
            },
            session_id: {
              type: 'string',
              description: 'Session ID for ongoing conversations (optional - will create new session if not provided)'
            },
            problem_context: {
              type: 'string',
              description: 'Overall problem context to help the specialist understand the bigger picture (optional)'
            }
          },
          required: ['specialist_id', 'message']
        }
      },
      {
        name: 'list_specialists',
        description: 'Discover available BC specialists and their expertise areas. Useful for understanding the team capabilities.',
        inputSchema: {
          type: 'object',
          properties: {
            domain: {
              type: 'string',
              description: 'Filter by domain (e.g., performance, security, api-design) - optional'
            },
            expertise: {
              type: 'string',
              description: 'Filter by expertise area (e.g., caching, authentication) - optional'
            }
          },
          required: []
        }
      }
    ];
  }

  /**
   * Handle specialist tool calls
   */
  async handleToolCall(request: CallToolRequest): Promise<CallToolResult> {
    try {
      switch (request.params.name) {
        case 'suggest_specialist':
          return await this.handleSuggestSpecialist(request);
        case 'get_specialist_advice':
          return await this.handleGetSpecialistAdvice(request);
        case 'list_specialists':
          return await this.handleListSpecialists(request);
        default:
          return {
            content: [{ 
              type: 'text', 
              text: `Unknown specialist tool: ${request.params.name}` 
            }],
            isError: true
          };
      }
    } catch (error) {
      return {
        content: [{ 
          type: 'text', 
          text: `Error in ${request.params.name}: ${error instanceof Error ? error.message : 'Unknown error'}` 
        }],
        isError: true
      };
    }
  }

  /**
   * Find the best specialist for a question
   */
  private async handleSuggestSpecialist(request: CallToolRequest): Promise<CallToolResult> {
    const validated = SuggestSpecialistSchema.parse(request.params.arguments);
    
    // Create basic session context for suggestion
    const sessionContext = validated.context ? {
      problem: validated.context,
      solutions: [],
      recommendations: [],
      nextSteps: [],
      userPreferences: {}
    } : undefined;

    const suggestions = await this.roleplayEngine.suggestSpecialist(
      validated.question, 
      sessionContext
    );

    if (suggestions.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '🤔 No specialists found for this question. Try rephrasing or providing more context about your BC development challenge.'
        }]
      };
    }

    // Format suggestions with personality
    let response = `🎯 **Specialist Recommendations for your question:**\n\n`;
    
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const specialist = await this.layerService.getSpecialist(suggestion.specialist_id);
      
      if (specialist) {
        const confidence = Math.round(suggestion.confidence * 100);
        response += `**${i + 1}. ${specialist.title}** (${suggestion.specialist_id}) - ${confidence}% match\n`;
        response += `${specialist.persona.greeting}\n`;
        response += `💡 **Why ${specialist.title}:** ${suggestion.reasoning}\n`;
        response += `🔧 **Expertise:** ${specialist.expertise.primary.join(', ')}\n\n`;
      }
    }

    response += `💬 **Next step:** Use \`get_specialist_advice\` with your chosen specialist_id to start the conversation!`;

    return {
      content: [{ type: 'text', text: response }]
    };
  }

  /**
   * Get advice from a specialist with automatic session management
   */
  private async handleGetSpecialistAdvice(request: CallToolRequest): Promise<CallToolResult> {
    const validated = GetSpecialistAdviceSchema.parse(request.params.arguments);
    
    // Try exact ID match first
    let specialist = await this.layerService.getSpecialist(validated.specialist_id);
    
    // If not found, try fuzzy matching
    if (!specialist) {
      specialist = await this.findSpecialistByFuzzyName(validated.specialist_id);
    }
    
    if (!specialist) {
      return {
        content: [{
          type: 'text',
          text: `❌ Specialist '${validated.specialist_id}' not found. Tried exact ID match and fuzzy name matching. Use 'list_specialists' to see available experts.`
        }],
        isError: true
      };
    }

    // Handle session management
    let sessionId = validated.session_id;
    let session;

    if (sessionId) {
      // Get existing session with auto-recovery
      session = await this.sessionManager.getSession(sessionId);
      if (!session) {
        // Auto-recover: create new session instead of failing
        console.warn(`Session '${sessionId}' not found. Creating recovery session.`);
        session = await this.sessionManager.startSession(
          validated.specialist_id,
          'default-user',
          `Recovery session. Original session ${sessionId} was lost. Context: ${validated.problem_context || validated.message}`
        );
        sessionId = session.sessionId;
      }
    } else {
      // Create new session
      session = await this.sessionManager.startSession(
        validated.specialist_id,
        'default-user', // TODO: Get actual user ID from context
        validated.problem_context || validated.message
      );
      sessionId = session.sessionId;
    }

    // Determine if this is a new session or handoff requiring introduction
    const isNewSession = !validated.session_id || session.messages.length === 0;
    const isHandoff = validated.session_id && session.context.current_specialist !== validated.specialist_id;

    // Generate specialist response using conversation history
    const roleplayContext = {
      specialist,
      userMessage: validated.message,
      session: session.context,
      conversationHistory: session.messages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content,
        timestamp: m.timestamp
      })),
      requiresIntroduction: isNewSession || isHandoff
    };

    const response = await this.roleplayEngine.generateResponse(roleplayContext);

    // Add user and specialist messages to session
    await this.sessionManager.continueSession(sessionId, validated.message);
    
    // Update session with specialist response - we'll add this via continueSession flow
    const updatedSession = await this.sessionManager.getSession(sessionId);

    // Update context if provided
    if (response.context_updates && updatedSession) {
      await this.sessionManager.updateContext(sessionId, response.context_updates);
    }

    // Return agent roleplay instructions (NOT formatted user response)
    let agentInstructions = response.content;

    // NO knowledge context provided - specialist must search themselves

    // Add handoff guidance for the agent
    if (response.suggested_handoffs && response.suggested_handoffs.length > 0) {
      agentInstructions += `\n\nHANDOFF GUIDANCE:\n`;
      for (const handoff of response.suggested_handoffs) {
        const handoffSpecialist = await this.layerService.getSpecialist(handoff.specialist_id);
        if (handoffSpecialist) {
          agentInstructions += `- If user needs ${handoff.reason}, suggest consulting ${handoffSpecialist.title}\n`;
        }
      }
    }

    agentInstructions += `\n\nRemember: You ARE ${specialist.title}. Respond directly as this character, not as an AI assistant.`;

    // Add recommendations as agent guidance
    if (response.recommendations_added && response.recommendations_added.length > 0) {
      agentInstructions += `\n\nRECOMMENDATIONS TO INCLUDE:\n`;
      response.recommendations_added.forEach((rec, i) => {
        agentInstructions += `${i + 1}. ${rec}\n`;
      });
    }

    return {
      content: [{ type: 'text', text: agentInstructions }]
    };
  }

  /**
   * List available specialists with filtering
   */
  private async handleListSpecialists(request: CallToolRequest): Promise<CallToolResult> {
    const validated = ListSpecialistsSchema.parse(request.params.arguments || {});
    
    const specialists = await this.layerService.getAllSpecialists();
    
    // Apply filters
    let filteredSpecialists = specialists;
    
    if (validated.domain) {
      filteredSpecialists = specialists.filter(s => 
        s.domains.some(d => d.toLowerCase().includes(validated.domain!.toLowerCase()))
      );
    }
    
    if (validated.expertise) {
      filteredSpecialists = filteredSpecialists.filter(s =>
        [...s.expertise.primary, ...s.expertise.secondary].some(e =>
          e.toLowerCase().includes(validated.expertise!.toLowerCase())
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
    const specialistsByDomain = new Map<string, typeof filteredSpecialists>();
    
    filteredSpecialists.forEach(specialist => {
      specialist.domains.forEach(domain => {
        if (!specialistsByDomain.has(domain)) {
          specialistsByDomain.set(domain, []);
        }
        if (!specialistsByDomain.get(domain)!.includes(specialist)) {
          specialistsByDomain.get(domain)!.push(specialist);
        }
      });
    });

    let response = `👥 **BC Code Intelligence Specialists** ${validated.domain || validated.expertise ? '(filtered)' : ''}\n\n`;
    
    // Show specialists organized by domain
    for (const [domain, domainSpecialists] of specialistsByDomain.entries()) {
      response += `## 🏷️ ${domain.charAt(0).toUpperCase() + domain.slice(1)}\n\n`;
      
      for (const specialist of domainSpecialists) {
        response += `**${specialist.title}** (\`${specialist.specialist_id}\`)\n`;
        response += `💬 ${specialist.persona.greeting}\n`;
        response += `🎯 **Primary Expertise:** ${specialist.expertise.primary.join(', ')}\n`;
        if (specialist.expertise.secondary.length > 0) {
          response += `🔧 **Also helps with:** ${specialist.expertise.secondary.slice(0, 3).join(', ')}\n`;
        }
        response += `\n`;
      }
    }

    response += `\n💡 **Getting Started:**\n`;
    response += `• Use \`suggest_specialist\` with your question to get personalized recommendations\n`;
    response += `• Use \`get_specialist_advice\` with a specialist_id to start a conversation\n`;
    response += `• Sessions are automatically managed for multi-turn conversations`;

    return {
      content: [{ type: 'text', text: response }]
    };
  }

  /**
   * Find specialist by partial/fuzzy name matching
   * Handles cases like "Sam" -> "sam-coder", "Dean" -> "dean-debug", etc.
   */
  private async findSpecialistByFuzzyName(partialName: string): Promise<any> {
    const allSpecialists = await this.layerService.getAllSpecialists();
    const searchTerm = partialName.toLowerCase().trim();
    
    // First try exact specialist_id match (case insensitive)
    let match = allSpecialists.find(specialist => 
      specialist.specialist_id.toLowerCase() === searchTerm
    );
    
    if (match) return match;
    
    // Try partial match in specialist_id
    match = allSpecialists.find(specialist => 
      specialist.specialist_id.toLowerCase().includes(searchTerm)
    );
    
    if (match) return match;
    
    // Try matching first part of specialist_id (before the dash)
    match = allSpecialists.find(specialist => {
      const firstName = specialist.specialist_id.split('-')[0].toLowerCase();
      return firstName === searchTerm;
    });
    
    if (match) return match;
    
    // Try matching in title
    match = allSpecialists.find(specialist => 
      specialist.title?.toLowerCase().includes(searchTerm)
    );
    
    return match || null;
  }
}