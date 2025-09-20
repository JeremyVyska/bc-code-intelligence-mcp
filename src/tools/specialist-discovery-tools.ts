/**
 * MCP Tools for Specialist Discovery and Management
 * 
 * Provides tools for discovering specialists, getting recommendations,
 * and managing specialist interactions.
 */

import { CallToolRequest, CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { SpecialistDiscoveryService } from '../services/specialist-discovery.js';
import { SpecialistSessionManager } from '../services/specialist-session-manager.js';
import { MultiContentLayerService } from '../services/multi-content-layer-service.js';

// Tool argument schemas
const DiscoverSpecialistsArgsSchema = z.object({
  query: z.string().describe('Query or problem description to find relevant specialists'),
  max_suggestions: z.number().optional().default(3).describe('Maximum number of specialist suggestions to return'),
  include_examples: z.boolean().optional().default(true).describe('Include example queries for each specialist')
});

const BrowseSpecialistsArgsSchema = z.object({
  category: z.string().optional().describe('Filter by domain/category (e.g., "performance", "api-design")'),
  include_details: z.boolean().optional().default(false).describe('Include detailed specialist information')
});

const GetSpecialistArgsSchema = z.object({
  specialist_id: z.string().describe('ID of the specialist to get information about'),
  include_examples: z.boolean().optional().default(true).describe('Include example scenarios and usage')
});

export const SPECIALIST_DISCOVERY_TOOLS: Tool[] = [
  {
    name: 'discover_specialists',
    description: 'Find specialists who can help with your specific query or problem',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Query or problem description to find relevant specialists'
        },
        max_suggestions: {
          type: 'number',
          description: 'Maximum number of specialist suggestions to return',
          default: 3
        },
        include_examples: {
          type: 'boolean',
          description: 'Include example queries for each specialist',
          default: true
        }
      },
      required: ['query']
    }
  },
  {
    name: 'browse_specialists',
    description: 'Browse all available specialists, optionally filtered by category/domain',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Filter by domain/category (e.g., "performance", "api-design")'
        },
        include_details: {
          type: 'boolean',
          description: 'Include detailed specialist information',
          default: false
        }
      },
      required: []
    }
  },
  {
    name: 'get_specialist_info',
    description: 'Get detailed information about a specific specialist',
    inputSchema: {
      type: 'object',
      properties: {
        specialist_id: {
          type: 'string',
          description: 'ID of the specialist to get information about'
        },
        include_examples: {
          type: 'boolean',
          description: 'Include example scenarios and usage',
          default: true
        }
      },
      required: ['specialist_id']
    }
  }
];

export class SpecialistDiscoveryTools {
  constructor(
    private discoveryService: SpecialistDiscoveryService,
    private sessionManager: SpecialistSessionManager,
    private layerService: MultiContentLayerService
  ) {}

  /**
   * Get tool definitions for MCP registration
   */
  getToolDefinitions(): Tool[] {
    return SPECIALIST_DISCOVERY_TOOLS;
  }

  async handleToolCall(request: CallToolRequest): Promise<CallToolResult> {
    try {
      switch (request.params.name) {
        case 'discover_specialists':
          return await this.discoverSpecialists(request);
        case 'browse_specialists':
          return await this.browseSpecialists(request);
        case 'get_specialist_info':
          return await this.getSpecialistInfo(request);
        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async discoverSpecialists(request: CallToolRequest): Promise<CallToolResult> {
    const args = DiscoverSpecialistsArgsSchema.parse(request.params.arguments);
    
    const suggestions = await this.discoveryService.suggestSpecialists({
      query: args.query
    }, args.max_suggestions);

    if (suggestions.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No specific specialists found for "${args.query}". Try asking Casey Copilot for general guidance!`
          }
        ]
      };
    }

    let result = `🎯 **Specialist Recommendations for:** "${args.query}"\n\n`;
    
    for (let i = 0; i < suggestions.length; i++) {
      const suggestion = suggestions[i];
      const emoji = suggestion.specialist.emoji || '👤';
      const title = suggestion.specialist.title;
      const confidence = Math.round(suggestion.confidence * 100);
      
      result += `**${i + 1}. ${emoji} ${title}** (${confidence}% match)\n`;
      result += `   📋 **Role:** ${suggestion.specialist.role}\n`;
      
      if (suggestion.reasons.length > 0) {
        result += `   ✅ **Why:** ${suggestion.reasons.join(', ')}\n`;
      }
      
      if (suggestion.keywords_matched.length > 0) {
        result += `   🔍 **Keywords:** ${suggestion.keywords_matched.join(', ')}\n`;
      }

      if (args.include_examples) {
        const example = this.generateExampleQuery(suggestion.specialist);
        result += `   💬 **Try asking:** "${example}"\n`;
      }
      
      result += '\n';
    }

    result += '💡 **Next Steps:**\n';
    result += '1. Use `suggest_specialist` tool to start a session with your chosen specialist\n';
    result += '2. Or ask: "Start a session with [specialist-id]"\n';

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async browseSpecialists(request: CallToolRequest): Promise<CallToolResult> {
    const args = BrowseSpecialistsArgsSchema.parse(request.params.arguments);
    
    let specialists;
    if (args.category) {
      specialists = await this.discoveryService.getSpecialistsByDomain(args.category);
    } else {
      specialists = await this.layerService.getAllSpecialists();
    }

    if (specialists.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: args.category 
              ? `No specialists found for category "${args.category}"`
              : 'No specialists available'
          }
        ]
      };
    }

    let result = args.category 
      ? `🏷️ **Specialists in "${args.category}" category:**\n\n`
      : '👥 **Available BC Code Intelligence Specialists:**\n\n';

    for (const specialist of specialists) {
      const emoji = specialist.emoji || '👤';
      result += `${emoji} **${specialist.title}** (\`${specialist.specialist_id}\`)\n`;
      result += `   📋 ${specialist.role}\n`;
      
      if (args.include_details) {
        if (specialist.expertise?.primary) {
          result += `   🎯 **Primary:** ${specialist.expertise.primary.join(', ')}\n`;
        }
        if (specialist.when_to_use) {
          result += `   💡 **Use for:** ${specialist.when_to_use.slice(0, 2).join(', ')}\n`;
        }
      }
      
      result += '\n';
    }

    result += '💬 **To interact:** Use `discover_specialists` with your specific question or `get_specialist_info` for details.\n';

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private async getSpecialistInfo(request: CallToolRequest): Promise<CallToolResult> {
    const args = GetSpecialistArgsSchema.parse(request.params.arguments);
    
    const specialist = await this.layerService.getSpecialist(args.specialist_id);
    
    if (!specialist) {
      return {
        content: [
          {
            type: 'text',
            text: `Specialist "${args.specialist_id}" not found. Use \`list_specialists\` to see available specialists.`
          }
        ],
        isError: true
      };
    }

    const emoji = specialist.emoji || '👤';
    let result = `${emoji} **${specialist.title}**\n\n`;
    
    result += `**Specialist ID:** \`${specialist.specialist_id}\`\n`;
    result += `**Role:** ${specialist.role}\n`;
    result += `**Team:** ${specialist.team}\n\n`;

    if (specialist.persona?.communication_style) {
      result += `**Communication Style:** ${specialist.persona.communication_style}\n\n`;
    }

    if (specialist.expertise?.primary) {
      result += `**Primary Expertise:**\n`;
      specialist.expertise.primary.forEach(exp => result += `• ${exp}\n`);
      result += '\n';
    }

    if (specialist.expertise?.secondary) {
      result += `**Secondary Expertise:**\n`;
      specialist.expertise.secondary.forEach(exp => result += `• ${exp}\n`);
      result += '\n';
    }

    if (specialist.when_to_use) {
      result += `**When to Use:**\n`;
      specialist.when_to_use.forEach(use => result += `• ${use}\n`);
      result += '\n';
    }

    if (specialist.collaboration?.natural_handoffs) {
      result += `**Natural Handoffs:**\n`;
      specialist.collaboration.natural_handoffs.forEach(handoff => result += `• ${handoff}\n`);
      result += '\n';
    }

    if (args.include_examples) {
      const example = this.generateExampleQuery(specialist);
      result += `**Example Query:** "${example}"\n\n`;
    }

    result += `**💬 Start a session:** Use \`suggest_specialist\` with specialist_id: \`${specialist.specialist_id}\`\n`;

    return {
      content: [
        {
          type: 'text',
          text: result
        }
      ]
    };
  }

  private generateExampleQuery(specialist: any): string {
    if (specialist.when_to_use && specialist.when_to_use.length > 0) {
      return `Help me with ${specialist.when_to_use[0].toLowerCase()}`;
    }
    
    if (specialist.expertise?.primary && specialist.expertise.primary.length > 0) {
      return `I need guidance on ${specialist.expertise.primary[0].toLowerCase()}`;
    }
    
    return `I need help with ${specialist.role?.toLowerCase() || 'development'}`;
  }
}