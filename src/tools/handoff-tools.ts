/**
 * Specialist Handoff MCP Tools
 * 
 * Tools for seamless transitions between specialists while preserving context,
 * conversation history, and ensuring natural collaboration flow.
 */

import { Tool, CallToolRequest, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SpecialistSessionManager } from '../services/specialist-session-manager.js';
import { SpecialistDiscoveryService } from '../services/specialist-discovery.js';
import { MultiContentLayerService } from '../services/multi-content-layer-service.js';

// Handoff types
export type HandoffType = 'transfer' | 'consultation' | 'collaboration' | 'escalation';

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

/**
 * Handoff tool definitions for MCP registration
 */
export const HANDOFF_TOOLS: Tool[] = [
  {
    name: 'handoff_to_specialist',
    description: `Transfer or collaborate with another BC specialist while preserving full context. Use when:
    • Current problem requires different expertise domain
    • User asks for specific specialist or different perspective  
    • Problem complexity requires architectural, security, testing, or other specialized input
    • You've completed your analysis and next steps need different skills
    
    Creates seamless transition with full context transfer so user doesn't repeat information.
    
🔧 **AL/BC Platform Constraints**: Specialists follow Business Central and AL Language limitations:
• Security: AL permissions, BC security framework only
• UX: AL page/report constraints, not custom rendering
• Performance: AL optimization patterns, BC server constraints
• API: BC web services, AL integration patterns only`,
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
    description: `Bring in another specialist for consultation or collaboration while maintaining current session. Use for quick expert input, code reviews, or joint problem-solving without full handoff.

🔧 **AL/BC Platform Constraints**: Specialists follow Business Central limitations:
• Security: AL permissions, BC security framework only
• UX: AL page/report constraints, not custom rendering  
• Performance: AL optimization patterns, BC server constraints
• API: BC web services, AL integration patterns only`,
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
          description: 'Type of collaboration needed',
          default: 'advice'
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

/**
 * Specialist Handoff Tools Class
 * Handles handoff-related tool calls and maintains handoff context
 */
export class SpecialistHandoffTools {
  constructor(
    private sessionManager: SpecialistSessionManager,
    private discoveryService: SpecialistDiscoveryService,
    private layerService: MultiContentLayerService
  ) {}

  /**
   * Get tool definitions for MCP registration
   */
  getToolDefinitions(): Tool[] {
    return HANDOFF_TOOLS;
  }

  /**
   * Handle tool calls
   */
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
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  private async handoffToSpecialist(request: CallToolRequest): Promise<CallToolResult> {
    const validated = HandoffToSpecialistArgsSchema.parse(request.params.arguments);
    
    const specialist = await this.layerService.getSpecialist(validated.target_specialist_id);
    if (!specialist) {
      return {
        content: [{ type: 'text', text: `Specialist not found: ${validated.target_specialist_id}` }],
        isError: true
      };
    }

    // Build handoff message
    let response = `# 🔄 Specialist Handoff\n\n`;
    response += `Transitioning to **${specialist.title}**\n\n`;
    response += `## Handoff Summary\n`;
    response += `**Type:** ${validated.handoff_type}\n`;
    response += `**Reason:** ${validated.handoff_reason}\n\n`;
    response += `**Problem:** ${validated.problem_summary}\n\n`;
    
    if (validated.work_completed.length > 0) {
      response += `**Work Completed:**\n`;
      validated.work_completed.forEach(item => response += `- ${item}\n`);
      response += `\n`;
    }
    
    if (validated.current_challenges && validated.current_challenges.length > 0) {
      response += `**Current Challenges:**\n`;
      validated.current_challenges.forEach(item => response += `- ${item}\n`);
      response += `\n`;
    }
    
    if (validated.continuation_points && validated.continuation_points.length > 0) {
      response += `**Continuation Points:**\n`;
      validated.continuation_points.forEach(item => response += `- ${item}\n`);
      response += `\n`;
    }
    
    response += `---\n\n`;
    response += `${specialist.persona.greeting}\n\n`;
    response += `I've reviewed the handoff context. Let me pick up from where we are...\n`;

    return {
      content: [{ type: 'text', text: response }]
    };
  }

  private async bringInSpecialist(request: CallToolRequest): Promise<CallToolResult> {
    const validated = BringInSpecialistArgsSchema.parse(request.params.arguments);
    
    const specialist = await this.layerService.getSpecialist(validated.specialist_id);
    if (!specialist) {
      return {
        content: [{ type: 'text', text: `Specialist not found: ${validated.specialist_id}` }],
        isError: true
      };
    }

    let response = `# 👋 Bringing in ${specialist.title}\n\n`;
    response += `**Consultation Reason:** ${validated.consultation_reason}\n`;
    response += `**Question:** ${validated.specific_question}\n`;
    response += `**Context:** ${validated.current_context}\n\n`;
    response += `---\n\n`;
    response += `${specialist.persona.greeting}\n\n`;
    response += `I'm here to help with this ${validated.collaboration_type}. Let me address your question...\n`;

    return {
      content: [{ type: 'text', text: response }]
    };
  }

  private async getHandoffSummary(request: CallToolRequest): Promise<CallToolResult> {
    const validated = GetHandoffSummaryArgsSchema.parse(request.params.arguments);
    
    // For now, return a placeholder - full implementation would query session history
    const response = `# 📋 Handoff Summary\n\nNo previous handoffs found for this session.\n`;

    return {
      content: [{ type: 'text', text: response }]
    };
  }
}
