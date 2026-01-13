/**
 * ask_bc_expert Tool - Schema Definition
 *
 * Direct specialist consultation for BC development assistance
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const askBcExpertTool: Tool = {
  name: 'ask_bc_expert',
  description: 'Consult a BC specialist for direct expert guidance. Returns specialist instructions and relevant BC knowledge. Auto-selects best specialist or use preferred_specialist parameter. Set autonomous_mode=true for structured action plans instead of conversational responses.',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Your specific question or challenge about BC development'
      },
      context: {
        type: 'string',
        description: 'Optional context about your situation, code, or project'
      },
      preferred_specialist: {
        type: 'string',
        description: 'Optional: specific specialist to consult (will auto-detect if not provided)'
      },
      autonomous_mode: {
        type: 'boolean',
        description: 'Enable autonomous agent mode: returns structured action plan instead of conversational response. For GitHub Coding Agents and automated workflows.',
        default: false
      }
    },
    required: ['question']
  }
};
