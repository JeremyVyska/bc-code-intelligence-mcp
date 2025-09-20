/**
 * Specialist Handoff Service
 * 
 * Enables seamless transitions between specialists while preserving context,
 * conversation history, and ensuring natural collaboration flow.
 */

import { CallToolRequest, CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SpecialistSessionManager } from './specialist-session-manager.js';
import { SessionContext, SpecialistSession } from '../types/session-types.js';
import { SpecialistDiscoveryService } from './specialist-discovery.js';
import { MultiContentLayerService } from './multi-content-layer-service.js';

// Handoff types
export type HandoffType = 'transfer' | 'consultation' | 'collaboration' | 'escalation';

// Handoff context interface
export interface HandoffContext {
  session_id: string;
  from_specialist: string;
  to_specialist: string;
  handoff_type: HandoffType;
  problem_summary: string;
  work_completed: string[];
  recommendations_made: string[];
  current_challenges: string[];
  user_context: {
    expertise_level?: 'beginner' | 'intermediate' | 'expert';
    bc_version?: string;
    project_type?: string;
    preferences?: string[];
  };
  conversation_summary: string;
  handoff_reason: string;
  continuation_points: string[];
}

// Tool argument schemas
const HandoffToSpecialistArgsSchema = z.object({
  target_specialist_id: z.string().describe('ID of the specialist to hand off to'),
  handoff_type: z.enum(['transfer', 'consultation', 'collaboration', 'escalation']).describe('Type of handoff - transfer (complete), consultation (temporary), collaboration (joint), escalation (senior expert)'),
  handoff_reason: z.string().describe('Clear reason why this handoff is needed'),
  problem_summary: z.string().describe('Current problem/challenge being worked on'),
  work_completed: z.array(z.string()).describe('List of work completed so far'),
  current_challenges: z.array(z.string()).optional().default([]).describe('Current challenges or blockers'),
  continuation_points: z.array(z.string()).optional().default([]).describe('Specific points for the next specialist to focus on'),
  preserve_session: z.boolean().optional().default(true).describe('Whether to preserve current session context')
});

const BringInSpecialistArgsSchema = z.object({
  specialist_id: z.string().describe('ID of the specialist to bring in for consultation'),
  consultation_reason: z.string().describe('Why this specialist\'s expertise is needed'),
  specific_question: z.string().describe('Specific question or challenge for the specialist'),
  current_context: z.string().describe('Brief context of current work and situation'),
  collaboration_type: z.enum(['advice', 'review', 'joint-work']).optional().default('advice').describe('Type of collaboration needed')
});

const GetHandoffSummaryArgsSchema = z.object({
  session_id: z.string().optional().describe('Session ID to get handoff summary for (current session if omitted)'),
  include_recommendations: z.boolean().optional().default(true).describe('Include previous recommendations in summary')
});

export const HANDOFF_TOOLS: Tool[] = [
  {
    name: 'handoff_to_specialist',
    description: `Transfer or collaborate with another BC specialist while preserving full context. Use when:
    • Current problem requires different expertise domain
    • User asks for specific specialist or different perspective  
    • Problem complexity requires architectural, security, testing, or other specialized input
    • You've completed your analysis and next steps need different skills
    
    Creates seamless transition with full context transfer so user doesn't repeat information.`,
    inputSchema: {
      type: 'object',
      properties: {
        target_specialist_id: {
          type: 'string',
          description: 'ID of the specialist to hand off to'
        },
        handoff_type: {
          type: 'string',
          enum: ['transfer', 'consultation', 'collaboration', 'escalation'],
          description: 'Type of handoff - transfer (complete), consultation (temporary), collaboration (joint), escalation (senior expert)'
        },
        handoff_reason: {
          type: 'string',
          description: 'Clear reason why this handoff is needed'
        },
        problem_summary: {
          type: 'string',
          description: 'Current problem/challenge being worked on'
        },
        work_completed: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of work completed so far'
        },
        current_challenges: {
          type: 'array',
          items: { type: 'string' },
          description: 'Current challenges or blockers'
        },
        continuation_points: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific points for the next specialist to focus on'
        },
        preserve_session: {
          type: 'boolean',
          description: 'Whether to preserve current session context',
          default: true
        }
      },
      required: ['target_specialist_id', 'handoff_type', 'handoff_reason', 'problem_summary', 'work_completed']
    }
  },
  {
    name: 'bring_in_specialist',
    description: `Bring in another specialist for consultation or collaboration while maintaining current session. Use for quick expert input, code reviews, or joint problem-solving without full handoff.`,
    inputSchema: {
      type: 'object',
      properties: {
        specialist_id: {
          type: 'string',
          description: 'ID of the specialist to bring in for consultation'
        },
        consultation_reason: {
          type: 'string',
          description: 'Why this specialist\'s expertise is needed'
        },
        specific_question: {
          type: 'string',
          description: 'Specific question or challenge for the specialist'
        },
        current_context: {
          type: 'string',
          description: 'Brief context of current work and situation'
        },
        collaboration_type: {
          type: 'string',
          enum: ['advice', 'review', 'joint-work'],
          description: 'Type of collaboration needed'
        }
      },
      required: ['specialist_id', 'consultation_reason', 'specific_question', 'current_context']
    }
  },
  {
    name: 'get_handoff_summary',
    description: `Get summary of previous specialist handoffs and context for current session. Useful when you need to understand what other specialists have already worked on.`,
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Session ID to get handoff summary for (current session if omitted)'
        },
        include_recommendations: {
          type: 'boolean',
          description: 'Include previous recommendations in summary',
          default: true
        }
      },
      required: []
    }
  }
];

export class SpecialistHandoffService {
  private handoffHistory: Map<string, HandoffContext[]> = new Map();
  private currentSessionId?: string; // Track current session

  constructor(
    private sessionManager: SpecialistSessionManager,
    private discoveryService: SpecialistDiscoveryService,
    private layerService: MultiContentLayerService
  ) {}

  /**
   * Set current session ID for handoff operations
   */
  setCurrentSession(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  /**
   * Get current session
   */
  private async getCurrentSession(): Promise<SpecialistSession | null> {
    if (!this.currentSessionId) {
      return null;
    }
    return await this.sessionManager.getSession(this.currentSessionId);
  }

  async handleToolCall(request: CallToolRequest): Promise<CallToolResult> {
    try {
      switch (request.params.name) {
        case 'handoff_to_specialist':
          return await this.handoffToSpecialist(request);
        case 'bring_in_specialist':
          return await this.bringInSpecialist(request);
        case 'get_handoff_summary':
          return await this.getHandoffSummary(request);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error in handoff service: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Execute handoff to another specialist with full context transfer
   */
  private async handoffToSpecialist(request: CallToolRequest): Promise<CallToolResult> {
    const args = HandoffToSpecialistArgsSchema.parse(request.params.arguments);
    
    // Get current session context
    const currentSession = await this.getCurrentSession();
    if (!currentSession) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active session found. Start a session first with suggest_specialist.'
          }
        ],
        isError: true
      };
    }

    // Get target specialist info
    const specialists = await this.layerService.getAllSpecialists();
    const targetSpecialist = specialists.find(s => s.specialist_id === args.target_specialist_id);
    
    if (!targetSpecialist) {
      return {
        content: [
          {
            type: 'text',
            text: `Specialist ${args.target_specialist_id} not found. Use 'browse_specialists' to see available specialists.`
          }
        ],
        isError: true
      };
    }

    // Create handoff context
    const handoffContext: HandoffContext = {
      session_id: currentSession.sessionId,
      from_specialist: currentSession.specialistId,
      to_specialist: args.target_specialist_id,
      handoff_type: args.handoff_type,
      problem_summary: args.problem_summary,
      work_completed: args.work_completed,
      recommendations_made: currentSession.context.recommendations || [],
      current_challenges: args.current_challenges,
      user_context: {
        expertise_level: currentSession.context.userPreferences?.expertiseLevel,
        bc_version: undefined, // Not available in current session structure
        project_type: currentSession.context.codebaseContext?.project,
        preferences: currentSession.context.userPreferences?.preferredTopics
      },
      conversation_summary: this.summarizeConversation(currentSession),
      handoff_reason: args.handoff_reason,
      continuation_points: args.continuation_points
    };

    // Store handoff history
    const sessionHandoffs = this.handoffHistory.get(currentSession.sessionId) || [];
    sessionHandoffs.push(handoffContext);
    this.handoffHistory.set(currentSession.sessionId, sessionHandoffs);

    // Create handoff message
    let response = this.createHandoffMessage(handoffContext, targetSpecialist);

    // Handle session transition based on handoff type
    if (args.handoff_type === 'transfer' && args.preserve_session) {
      // Transfer session to new specialist
      await this.sessionManager.transferSession(currentSession.sessionId, args.target_specialist_id);
      response += `\n\n🔄 **Session transferred to ${targetSpecialist.title}**\n`;
      response += `Use \`suggest_specialist ${args.target_specialist_id}\` to continue with full context.`;
    } else if (args.handoff_type === 'collaboration') {
      response += `\n\n🤝 **Collaboration Mode**\n`;
      response += `Both specialists are now available for this session. Use \`suggest_specialist ${args.target_specialist_id}\` to engage.`;
    }

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
   * Bring in specialist for consultation without full handoff
   */
  private async bringInSpecialist(request: CallToolRequest): Promise<CallToolResult> {
    const args = BringInSpecialistArgsSchema.parse(request.params.arguments);
    
    const specialists = await this.layerService.getAllSpecialists();
    const specialist = specialists.find(s => s.specialist_id === args.specialist_id);
    
    if (!specialist) {
      return {
        content: [
          {
            type: 'text',
            text: `Specialist ${args.specialist_id} not found.`
          }
        ],
        isError: true
      };
    }

    const emoji = this.getSpecialistEmoji(args.specialist_id);
    let response = `🤝 **Bringing in ${emoji} ${specialist.title}**\n\n`;
    
    response += `**Consultation Reason:** ${args.consultation_reason}\n\n`;
    response += `**Current Context:** ${args.current_context}\n\n`;
    response += `**Specific Question:** "${args.specific_question}"\n\n`;
    
    if (args.collaboration_type === 'advice') {
      response += `💡 **Quick Expert Input Needed**\n`;
      response += `${specialist.title.split(' - ')[0]} can provide immediate guidance on this specific question.`;
    } else if (args.collaboration_type === 'review') {
      response += `🔍 **Expert Review Requested**\n`;
      response += `${specialist.title.split(' - ')[0]} will review the current approach and provide feedback.`;
    } else if (args.collaboration_type === 'joint-work') {
      response += `🤝 **Joint Problem-Solving**\n`;
      response += `${specialist.title.split(' - ')[0]} will work alongside on this challenge.`;
    }

    response += `\n\n🎯 **To engage:** Use \`suggest_specialist ${args.specialist_id}\` with this context.`;

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
   * Get handoff summary for current session
   */
  private async getHandoffSummary(request: CallToolRequest): Promise<CallToolResult> {
    const args = GetHandoffSummaryArgsSchema.parse(request.params.arguments);
    
    const currentSession = await this.getCurrentSession();
    const sessionId = args.session_id || currentSession?.sessionId;
    
    if (!sessionId) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active session found.'
          }
        ],
        isError: true
      };
    }

    const handoffs = this.handoffHistory.get(sessionId) || [];
    
    if (handoffs.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No handoffs have occurred in this session.'
          }
        ]
      };
    }

    let response = `📋 **Session Handoff Summary**\n\n`;
    
    handoffs.forEach((handoff, index) => {
      const fromEmoji = this.getSpecialistEmoji(handoff.from_specialist);
      const toEmoji = this.getSpecialistEmoji(handoff.to_specialist);
      
      response += `**${index + 1}. ${fromEmoji} → ${toEmoji} (${handoff.handoff_type})**\n`;
      response += `   Reason: ${handoff.handoff_reason}\n`;
      response += `   Problem: ${handoff.problem_summary}\n`;
      
      if (handoff.work_completed.length > 0) {
        response += `   Completed: ${handoff.work_completed.slice(0, 2).join(', ')}${handoff.work_completed.length > 2 ? '...' : ''}\n`;
      }
      
      if (handoff.continuation_points.length > 0) {
        response += `   Focus: ${handoff.continuation_points.slice(0, 2).join(', ')}\n`;
      }
      
      response += '\n';
    });

    if (args.include_recommendations && currentSession?.context.recommendations) {
      response += `\n💡 **Current Recommendations:**\n`;
      currentSession.context.recommendations.slice(0, 3).forEach((rec, index) => {
        response += `${index + 1}. ${rec}\n`;
      });
    }

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
   * Create handoff message with full context
   */
  private createHandoffMessage(context: HandoffContext, targetSpecialist: any): string {
    const fromEmoji = this.getSpecialistEmoji(context.from_specialist);
    const toEmoji = this.getSpecialistEmoji(context.to_specialist);
    
    let message = `🔄 **Specialist ${context.handoff_type === 'transfer' ? 'Handoff' : 'Collaboration'}**\n\n`;
    message += `${fromEmoji} **From:** ${this.getSpecialistName(context.from_specialist)}\n`;
    message += `${toEmoji} **To:** ${targetSpecialist.title}\n`;
    message += `🎯 **Type:** ${context.handoff_type}\n\n`;
    
    message += `**Handoff Reason:** ${context.handoff_reason}\n\n`;
    
    message += `📋 **Context Summary:**\n`;
    message += `• **Problem:** ${context.problem_summary}\n`;
    
    if (context.work_completed.length > 0) {
      message += `• **Work Completed:**\n`;
      context.work_completed.forEach((work, index) => {
        message += `  ${index + 1}. ${work}\n`;
      });
    }
    
    if (context.current_challenges.length > 0) {
      message += `• **Current Challenges:**\n`;
      context.current_challenges.forEach((challenge, index) => {
        message += `  ${index + 1}. ${challenge}\n`;
      });
    }
    
    if (context.continuation_points.length > 0) {
      message += `• **Focus Areas for ${targetSpecialist.title.split(' - ')[0]}:**\n`;
      context.continuation_points.forEach((point, index) => {
        message += `  ${index + 1}. ${point}\n`;
      });
    }
    
    if (context.recommendations_made.length > 0) {
      message += `• **Previous Recommendations:**\n`;
      context.recommendations_made.slice(0, 3).forEach((rec, index) => {
        message += `  ${index + 1}. ${rec}\n`;
      });
    }

    message += `\n💬 **Ready for ${targetSpecialist.title.split(' - ')[0]}:** All context has been preserved for seamless continuation.`;

    return message;
  }

  /**
   * Summarize conversation for handoff context
   */
  private summarizeConversation(session: SpecialistSession): string {
    // Simple conversation summary - could be enhanced with more sophisticated analysis
    const messages = session.messages || [];
    if (messages.length === 0) return 'No conversation history';
    
    const recentMessages = messages.slice(-5); // Last 5 messages
    return `Recent discussion: ${recentMessages.map(m => m.content).join(' | ')}`;
  }

  /**
   * Get specialist name by ID
   */
  private getSpecialistName(specialistId: string): string {
    const nameMap: Record<string, string> = {
      'dean-debug': 'Dean Debug',
      'eva-errors': 'Eva Errors',
      'alex-architect': 'Alex Architect',
      'sam-coder': 'Sam Coder',
      'quinn-tester': 'Quinn Tester',
      'seth-security': 'Seth Security',
      'uma-ux': 'Uma UX',
      'jordan-bridge': 'Jordan Bridge',
      'logan-legacy': 'Logan Legacy',
      'roger-reviewer': 'Roger Reviewer',
      'maya-mentor': 'Maya Mentor',
      'taylor-docs': 'Taylor Docs',
      'casey-copilot': 'Casey Copilot',
      'morgan-market': 'Morgan Market'
    };

    return nameMap[specialistId] || specialistId;
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
    return HANDOFF_TOOLS;
  }
}