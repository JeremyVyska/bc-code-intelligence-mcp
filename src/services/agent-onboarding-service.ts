/**
 * Agent-Friendly Onboarding Service
 * 
 * Designed to make ANY coding agent naturally recognize when to introduce
 * BC specialists during Business Central development conversations.
 */

import { CallToolRequest, CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
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

export const BC_ONBOARDING_TOOLS: Tool[] = [
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

export class AgentOnboardingService {
  constructor(
    private discoveryService: SpecialistDiscoveryService,
    private layerService: MultiContentLayerService
  ) {}

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
            text: `Error in onboarding service: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Main tool: Introduce BC specialists based on conversation context
   */
  private async introduceBCSpecialists(request: CallToolRequest): Promise<CallToolResult> {
    const args = IntroduceBCSpecialistsArgsSchema.parse(request.params.arguments);
    
    // Get specialist suggestions based on context
    const suggestions = await this.discoveryService.suggestSpecialists({
      query: args.conversation_context + (args.specific_problem ? ` ${args.specific_problem}` : ''),
      user_preferences: args.user_expertise_level ? { expertise_level: args.user_expertise_level } : undefined
    }, 3);

    if (suggestions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `I can connect you with our Business Central specialists! Let me introduce Casey Copilot 🤖 - our AI-enhanced development coach who can help with general BC development guidance.`
          }
        ]
      };
    }

    // Build agent-friendly introduction content
    let response = `🎯 **BC Specialist Team Available!**\n\n`;
    response += `Based on "${args.conversation_context}", I can introduce you to specialized Business Central experts:\n\n`;

    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const emoji = this.getSpecialistEmoji(suggestion.specialist.specialist_id);
      const confidence = Math.round(suggestion.confidence * 100);
      
      response += `**${emoji} ${suggestion.specialist.title}** (${confidence}% match)\n`;
      response += `${suggestion.specialist.role} who specializes in ${suggestion.specialist.domains?.join(', ') || 'BC development'}\n\n`;
      
      if (suggestion.reasons.length > 0) {
        response += `*Why this specialist: ${suggestion.reasons.join(', ')}*\n\n`;
      }

      // Add conversation starters
      response += `💬 **Natural conversation starters:**\n`;
      response += `• "Let me connect you with ${suggestion.specialist.title.split(' - ')[0]}..."\n`;
      response += `• "${suggestion.specialist.title.split(' - ')[0]} specializes in exactly this type of challenge"\n`;
      response += `• "I think ${suggestion.specialist.title.split(' - ')[0]} can provide the specific BC expertise you need"\n\n`;

      // Add example questions
      const example = this.generateContextualExample(suggestion.specialist, args.conversation_context);
      response += `💡 **User can try asking:** "${example}"\n\n`;
      
      response += `🎯 **To connect:** Use \`suggest_specialist ${suggestion.specialist.specialist_id}\`\n\n`;
      response += `---\n\n`;
    }

    response += `### 🚀 How to Proceed as Agent:\n`;
    response += `1. **Choose** the most relevant specialist based on user's needs\n`;
    response += `2. **Introduce** them naturally: "Let me connect you with [specialist name]..."\n`;
    response += `3. **Transition** using: \`suggest_specialist [specialist-id]\`\n`;
    response += `4. **Follow up** by letting the specialist take the lead on BC-specific guidance\n`;

    return {
      content: [
        {
          type: 'text',
          text: response
        }
      ]
    };
  }

  /**
   * Get introduction content for specific specialist
   */
  private async getSpecialistIntroduction(request: CallToolRequest): Promise<CallToolResult> {
    const args = GetSpecialistIntroArgsSchema.parse(request.params.arguments);
    
    const specialists = await this.layerService.getAllSpecialists();
    const specialist = specialists.find(s => s.specialist_id === args.specialist_id);
    
    if (!specialist) {
      return {
        content: [
          {
            type: 'text',
            text: `Specialist ${args.specialist_id} not found. Use 'browse_specialists' to see available specialists.`
          }
        ],
        isError: true
      };
    }

    const emoji = this.getSpecialistEmoji(specialist.specialist_id);
    let response = '';

    if (args.include_handoff_phrase) {
      response += `Perfect! Let me connect you with ${specialist.title.split(' - ')[0]}...\n\n`;
    }

    response += `${emoji} **${specialist.title}**\n`;
    response += `${specialist.role}\n\n`;
    
    if (specialist.domains && specialist.domains.length > 0) {
      response += `**Specializes in:** ${specialist.domains.join(', ')}\n`;
    }

    if (specialist.when_to_use && specialist.when_to_use.length > 0) {
      response += `**Perfect for:** ${specialist.when_to_use.slice(0, 2).join(', ')}\n`;
    }

    response += `\n**Example question for your context:**\n`;
    response += `"${this.generateContextualExample(specialist, args.conversation_context)}"\n\n`;

    response += `🎯 **Ready to start:** Use \`suggest_specialist ${specialist.specialist_id}\``;

    return {
      content: [
        {
          type: 'text',
          text: response
        }
      ]
    };
  }

  /**
   * Suggest when to bring in specialists during conversation
   */
  private async suggestNextSpecialist(request: CallToolRequest): Promise<CallToolResult> {
    const args = SuggestNextSpecialistArgsSchema.parse(request.params.arguments);
    
    const suggestions = await this.discoveryService.suggestSpecialists({
      query: args.current_topic,
      conversation_history: args.conversation_history ? [args.conversation_history] : undefined
    }, args.max_suggestions);

    if (suggestions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `Continue with general BC guidance or use 'introduce_bc_specialists' to see the full team.`
          }
        ]
      };
    }

    let response = `🤔 **Consider bringing in a specialist:**\n\n`;
    
    suggestions.forEach((suggestion, index) => {
      const emoji = this.getSpecialistEmoji(suggestion.specialist.specialist_id);
      response += `${index + 1}. **${emoji} ${suggestion.specialist.title.split(' - ')[0]}** - ${suggestion.reasons.join(', ') || 'Good match for current topic'}\n`;
    });

    response += `\n💡 **Agent tip:** When conversation gets into BC-specific details, specialist handoff often provides better value than general assistance.`;

    return {
      content: [
        {
          type: 'text',
          text: response
        }
      ]
    };
  }

  /**
   * Generate contextual example question
   */
  private generateContextualExample(specialist: any, context: string): string {
    const contextLower = context.toLowerCase();
    const specialistId = specialist.specialist_id;
    
    // Context-specific examples
    if (contextLower.includes('performance') || contextLower.includes('slow')) {
      if (specialistId === 'dean-debug') return `Help me identify why ${this.extractSubject(context)} is performing slowly`;
    }
    
    if (contextLower.includes('security') || contextLower.includes('permission')) {
      if (specialistId === 'seth-security') return `Review the security approach for ${this.extractSubject(context)}`;
    }
    
    if (contextLower.includes('test') || contextLower.includes('quality')) {
      if (specialistId === 'quinn-tester') return `Design a testing strategy for ${this.extractSubject(context)}`;
    }

    if (contextLower.includes('architecture') || contextLower.includes('design')) {
      if (specialistId === 'alex-architect') return `Review the architecture of ${this.extractSubject(context)}`;
    }

    // Fallback examples
    const fallbacks: Record<string, string> = {
      'dean-debug': `Help me troubleshoot performance issues in my BC solution`,
      'seth-security': `Review security best practices for my BC implementation`,
      'quinn-tester': `Create a comprehensive testing strategy for my BC extensions`,
      'alex-architect': `Design a scalable architecture for my BC solution`,
      'sam-coder': `Show me efficient coding patterns for this BC scenario`,
      'eva-errors': `Help me implement robust error handling`,
      'uma-ux': `Improve the user experience of my BC pages`,
      'jordan-bridge': `Design integrations for my BC solution`,
      'logan-legacy': `Help me modernize this legacy BC code`,
      'roger-reviewer': `Review the code quality of my BC implementation`,
      'maya-mentor': `Teach me the best practices for this BC scenario`,
      'taylor-docs': `Help me document this BC solution properly`,
      'casey-copilot': `Guide me through this BC development challenge`,
      'morgan-market': `Prepare my BC solution for AppSource`
    };

    return fallbacks[specialistId] || `Help me with my Business Central challenge`;
  }

  /**
   * Extract main subject from context for personalized examples
   */
  private extractSubject(context: string): string {
    const contextLower = context.toLowerCase();
    
    // Extract BC-specific subjects
    if (contextLower.includes('report')) return 'my BC reports';
    if (contextLower.includes('page')) return 'my BC pages';
    if (contextLower.includes('table')) return 'my BC tables';
    if (contextLower.includes('extension')) return 'my BC extension';
    if (contextLower.includes('integration')) return 'my BC integration';
    if (contextLower.includes('api')) return 'my BC API';
    if (contextLower.includes('workflow')) return 'my BC workflow';
    
    return 'my BC solution';
  }

  /**
   * Get emoji for specialist
   */
  private getSpecialistEmoji(specialistId: string): string {
    const emojiMap: Record<string, string> = {
      'dean-debug': '🔍',
      'eva-errors': '⚠️',
      'alex-architect': '🏗️',
      'sam-coder': '💻',
      'quinn-tester': '🧪',
      'seth-security': '🔒',
      'uma-ux': '🎨',
      'jordan-bridge': '🌉',
      'logan-legacy': '🏛️',
      'roger-reviewer': '📝',
      'maya-mentor': '👩‍🏫',
      'taylor-docs': '📚',
      'casey-copilot': '🤖',
      'morgan-market': '🏪'
    };

    return emojiMap[specialistId] || '👤';
  }

  /**
   * Get tool definitions for MCP registration
   */
  getToolDefinitions(): Tool[] {
    return BC_ONBOARDING_TOOLS;
  }
}