/**
 * Agent Onboarding MCP Tools
 * 
 * Tools for introducing BC specialists naturally during conversations
 * and helping agents discover when and how to bring in specialized expertise.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SpecialistDiscoveryService } from '../services/specialist-discovery.js';
import { MultiContentLayerService } from '../services/multi-content-layer-service.js';

// Schema for agent-friendly specialist introduction
const IntroduceBCSpecialistsArgsSchema = z.object({
  conversation_context: z.string().describe(
    'Current conversation context - what the user is working on, asking about, or trying to solve with Business Central'
  ),
  user_expertise_level: z.enum(['beginner', 'intermediate', 'expert']).optional().describe(
    'User\'s apparent expertise level with Business Central (optional, will be inferred if not provided)'
  ),
  specific_problem: z.string().optional().describe(
    'Specific problem or challenge mentioned by the user (optional, helps with specialist matching)'
  )
});

const GetSpecialistIntroArgsSchema = z.object({
  specialist_id: z.string().describe('ID of the specialist to get introduction content for'),
  conversation_context: z.string().describe('Context of the current conversation for personalized introduction'),
  include_handoff_phrase: z.boolean().optional().default(true).describe('Include smooth handoff phrase for natural transition')
});

const SuggestNextSpecialistArgsSchema = z.object({
  current_topic: z.string().describe('Current topic or problem being discussed'),
  conversation_history: z.string().optional().describe('Brief summary of conversation so far (optional)'),
  max_suggestions: z.number().optional().default(2).describe('Maximum number of specialist suggestions')
});

/**
 * Onboarding tool definitions for MCP registration
 */
export const ONBOARDING_TOOLS: Tool[] = [
  {
    name: 'introduce_bc_specialists',
    description: `ESSENTIAL for Business Central development! Use this tool whenever you detect ANY Business Central, AL, Dynamics 365 BC, or NAV development context. This includes:

    🎯 WHEN TO USE (comprehensive triggers):
    • User mentions: Business Central, AL language, BC extensions, Dynamics 365 BC, NAV
    • File extensions: .al files, app.json, launch.json (with BC context)  
    • Development tasks: tables, pages, reports, codeunits, APIs, integrations
    • Problems: performance issues, errors, testing, deployment, customization
    • Technologies: AL development, Visual Studio Code + AL extension, AppSource
    • Business processes: accounting, inventory, sales, purchasing in BC context
    • Any BC-specific terminology: workflows, posting routines, dimensions, etc.

    🚀 WHAT IT DOES:
    • Analyzes conversation context and suggests 2-3 most relevant BC specialists
    • Provides natural introduction content you can use directly in conversation
    • Gives specific examples and "try asking" suggestions for each specialist
    • Enables smooth transition from general help to specialized BC expertise

    💡 AGENT USAGE:
    Simply pass the conversation context. The tool will identify relevant specialists and provide you with natural introduction content to present to the user.`,
    inputSchema: {
      type: 'object',
      properties: {
        conversation_context: {
          type: 'string',
          description: 'Current conversation context - what the user is working on, asking about, or trying to solve with Business Central'
        },
        user_expertise_level: {
          type: 'string',
          enum: ['beginner', 'intermediate', 'expert'],
          description: 'User\'s apparent expertise level with Business Central (optional, will be inferred if not provided)'
        },
        specific_problem: {
          type: 'string',
          description: 'Specific problem or challenge mentioned by the user (optional, helps with specialist matching)'
        }
      },
      required: ['conversation_context']
    }
  },
  {
    name: 'get_specialist_introduction',
    description: `Get ready-to-use introduction content for a specific BC specialist. Use when you want to introduce a particular specialist naturally in conversation or when transitioning from general help to specialized expertise.`,
    inputSchema: {
      type: 'object',
      properties: {
        specialist_id: {
          type: 'string',
          description: 'ID of the specialist to get introduction content for'
        },
        conversation_context: {
          type: 'string',
          description: 'Context of the current conversation for personalized introduction'
        },
        include_handoff_phrase: {
          type: 'boolean',
          description: 'Include smooth handoff phrase for natural transition',
          default: true
        }
      },
      required: ['specialist_id', 'conversation_context']
    }
  },
  {
    name: 'suggest_next_specialist',
    description: `Proactively suggest when to bring in a specialist during ongoing BC conversations. Use when the current conversation could benefit from specialized expertise or when transitioning between topics.`,
    inputSchema: {
      type: 'object',
      properties: {
        current_topic: {
          type: 'string',
          description: 'Current topic or problem being discussed'
        },
        conversation_history: {
          type: 'string',
          description: 'Brief summary of conversation so far (optional)'
        },
        max_suggestions: {
          type: 'number',
          description: 'Maximum number of specialist suggestions',
          default: 2
        }
      },
      required: ['current_topic']
    }
  }
];

/**
 * Agent Onboarding Tools Class
 * Handles onboarding-related tool calls
 */
export class AgentOnboardingTools {
  constructor(
    private discoveryService: SpecialistDiscoveryService,
    private layerService: MultiContentLayerService
  ) {}

  /**
   * Get tool definitions for MCP registration
   */
  getToolDefinitions(): Tool[] {
    return ONBOARDING_TOOLS;
  }

  /**
   * Handle tool calls
   */
  async handleToolCall(request: CallToolRequest): Promise<CallToolResult> {
    try {
      switch (request.params.name) {
        case 'introduce_bc_specialists':
          return await this.introduceBCSpecialists(request);
        case 'get_specialist_introduction':
          return await this.getSpecialistIntroduction(request);
        case 'suggest_next_specialist':
          return await this.suggestNextSpecialist(request);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  private async introduceBCSpecialists(request: CallToolRequest): Promise<CallToolResult> {
    const validated = IntroduceBCSpecialistsArgsSchema.parse(request.params.arguments);
    
    // First, check if a specific specialist is mentioned by name
    const allSpecialists = await this.layerService.getAllSpecialists();
    const mentionedSpecialist = this.findMentionedSpecialist(validated.conversation_context, allSpecialists);
    
    if (mentionedSpecialist) {
      // Direct specialist request - return just that specialist
      return this.formatSingleSpecialistIntroduction(mentionedSpecialist);
    }
    
    // Fall back to content-based suggestions
    const suggestions = await this.discoveryService.suggestSpecialists({
      query: validated.conversation_context,
      user_preferences: validated.user_expertise_level ? {
        expertise_level: validated.user_expertise_level
      } : undefined
    }, 3);

    let response = `# 🎯 BC Specialists Available for Your Challenge\n\n`;
    response += `Based on your context, here are the specialists who can help:\n\n`;

    for (const suggestion of suggestions.slice(0, 3)) {
      const specialist = suggestion.specialist;
      if (specialist) {
        response += `## ${specialist.emoji} ${specialist.title}\n`;
        response += `${specialist.persona.greeting}\n\n`;
        response += `**Role:** ${specialist.role}\n\n`;
        
        if (suggestion.reasons && suggestion.reasons.length > 0) {
          response += `**Why this specialist:** ${suggestion.reasons.join(', ')}\n\n`;
        }
        
        if (specialist.when_to_use && specialist.when_to_use.length > 0) {
          response += `**When to use:**\n`;
          specialist.when_to_use.slice(0, 2).forEach(scenario => {
            response += `- ${scenario}\n`;
          });
          response += `\n`;
        }
      }
    }

    return {
      content: [{ type: 'text', text: response }]
    };
  }

  /**
   * Find if a specific specialist is mentioned by name in the conversation context
   */
  private findMentionedSpecialist(context: string, specialists: any[]): any | null {
    const contextLower = context.toLowerCase();
    
    // Look for direct request patterns first (e.g., "get Morgan online", "talk to Sam", "connect with Dean")
    const directRequestPatterns = [
      /\b(?:get|bring|connect|talk to|chat with|need|want|ask)\s+(\w+)\s*(?:online|here|to help|about|for)/i,
      /\b(\w+)\s+(?:online|here|to help)\b/i,
      /\b(?:I need|need to|want to)\s+(\w+)/i
    ];

    for (const pattern of directRequestPatterns) {
      const match = context.match(pattern);
      if (match) {
        const mentionedName = match[1].toLowerCase();
        const specialist = specialists.find(s => 
          s.specialist_id.split('-')[0].toLowerCase() === mentionedName
        );
        if (specialist) {
          return specialist;
        }
      }
    }

    // Look for specialist names in context with priority scoring
    const candidates: Array<{ specialist: any; score: number; reasons: string[] }> = [];
    
    for (const specialist of specialists) {
      const firstName = specialist.specialist_id.split('-')[0].toLowerCase();
      const fullId = specialist.specialist_id.toLowerCase();
      let score = 0;
      const reasons: string[] = [];
      
      // Check for first name match
      const firstNameRegex = new RegExp(`\\b${firstName}\\b`, 'i');
      if (firstNameRegex.test(context)) {
        score += 1;
        reasons.push('name mentioned');
        
        // Boost score if mentioned with action words
        if (/\b(?:get|bring|connect|talk to|chat with|need|want|ask)\s+\w*${firstName}/i.test(context)) {
          score += 3;
          reasons.push('direct request');
        }
      }
      
      // Check for full specialist ID match
      const fullIdRegex = new RegExp(`\\b${fullId.replace('-', '[\\s-]')}\\b`, 'i');
      if (fullIdRegex.test(context)) {
        score += 4;
        reasons.push('full ID mentioned');
      }
      
      // Check for domain-specific keywords that align with specialist expertise
      if (specialist.expertise?.primary) {
        for (const expertise of specialist.expertise.primary) {
          const expertiseKeywords = expertise.toLowerCase().split(/\s+/);
          if (expertiseKeywords.some(keyword => keyword.length > 4 && contextLower.includes(keyword))) {
            score += 0.5;
            reasons.push(`${expertise} expertise match`);
          }
        }
      }
      
      // Check when_to_use scenarios
      if (specialist.when_to_use) {
        for (const scenario of specialist.when_to_use) {
          const scenarioKeywords = scenario.toLowerCase().split(/\s+/);
          if (scenarioKeywords.some(keyword => keyword.length > 4 && contextLower.includes(keyword))) {
            score += 0.5;
            reasons.push(`${scenario} scenario match`);
          }
        }
      }
      
      if (score > 0) {
        candidates.push({ specialist, score, reasons });
      }
    }
    
    // Sort by score and return the highest scoring candidate if it has a clear name mention
    candidates.sort((a, b) => b.score - a.score);
    
    // Only return a specialist if they have a clear name mention (score >= 1)
    if (candidates.length > 0 && candidates[0].score >= 1) {
      return candidates[0].specialist;
    }
    
    return null;
  }

  /**
   * Format introduction for a single specifically requested specialist
   */
  private formatSingleSpecialistIntroduction(specialist: any): CallToolResult {
    let response = `# ${specialist.emoji} ${specialist.title}\n\n`;
    response += `${specialist.persona?.greeting || 'Hello!'}\n\n`;
    response += `**Role:** ${specialist.role}\n\n`;
    
    if (specialist.expertise?.primary && specialist.expertise.primary.length > 0) {
      response += `**Primary Expertise:**\n`;
      specialist.expertise.primary.forEach((exp: string) => {
        response += `- ${exp}\n`;
      });
      response += `\n`;
    }
    
    if (specialist.when_to_use && specialist.when_to_use.length > 0) {
      response += `**When to use ${specialist.specialist_id.split('-')[0]}:**\n`;
      specialist.when_to_use.slice(0, 3).forEach((scenario: string) => {
        response += `- ${scenario}\n`;
      });
      response += `\n`;
    }
    
    response += `Ready to help! What would you like to work on?`;

    return {
      content: [{ type: 'text', text: response }]
    };
  }

  private async getSpecialistIntroduction(request: CallToolRequest): Promise<CallToolResult> {
    const validated = GetSpecialistIntroArgsSchema.parse(request.params.arguments);
    
    const specialist = await this.layerService.getSpecialist(validated.specialist_id);
    if (!specialist) {
      return {
        content: [{ type: 'text', text: `Specialist not found: ${validated.specialist_id}` }],
        isError: true
      };
    }

    let intro = '';
    if (validated.include_handoff_phrase) {
      intro += `Let me connect you with ${specialist.title}...\n\n`;
    }
    
    intro += `## ${specialist.emoji} ${specialist.title}\n`;
    intro += `${specialist.persona.greeting}\n\n`;
    intro += `**Role:** ${specialist.role}\n\n`;

    return {
      content: [{ type: 'text', text: intro }]
    };
  }

  private async suggestNextSpecialist(request: CallToolRequest): Promise<CallToolResult> {
    const validated = SuggestNextSpecialistArgsSchema.parse(request.params.arguments);
    
    const query = validated.conversation_history 
      ? `${validated.current_topic}\n\nContext: ${validated.conversation_history}`
      : validated.current_topic;

    const suggestions = await this.discoveryService.suggestSpecialists({
      query,
      conversation_history: validated.conversation_history ? [validated.conversation_history] : undefined
    }, validated.max_suggestions || 2);

    if (suggestions.length === 0) {
      return {
        content: [{ type: 'text', text: 'No specialist suggestions available for the current topic.' }]
      };
    }

    let response = `# 💡 Specialist Suggestions\n\n`;
    for (const suggestion of suggestions) {
      const specialist = suggestion.specialist;
      if (specialist) {
        const reasonText = suggestion.reasons.length > 0 
          ? suggestion.reasons.join(', ') 
          : 'their expertise in this area';
        response += `**${specialist.emoji} ${specialist.title}** could help with ${reasonText}\n\n`;
      }
    }

    return {
      content: [{ type: 'text', text: response }]
    };
  }
}
