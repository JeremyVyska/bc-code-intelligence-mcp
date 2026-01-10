/**
 * analyze_al_code Tool - Schema Definition
 *
 * AL code analysis and workspace inspection
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const analyzeAlCodeTool: Tool = {
  name: 'analyze_al_code',
  description: 'Analyze AL code for issues, patterns, and improvements. Supports performance, quality, security, and comprehensive analysis types. Use operation=validate for compliance checks or operation=suggest_fixes for code transformations. Includes workspace analysis and workflow recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'AL code to analyze (or "workspace" to analyze current workspace)'
      },
      analysis_type: {
        type: 'string',
        enum: ['performance', 'quality', 'security', 'patterns', 'comprehensive'],
        description: 'Type of analysis to perform',
        default: 'comprehensive'
      },
      operation: {
        type: 'string',
        enum: ['analyze', 'validate', 'suggest_fixes'],
        description: 'Analysis operation mode: "analyze" (conversational), "validate" (compliance check + auto-fixes), "suggest_fixes" (code transformations)',
        default: 'analyze'
      },
      bc_version: {
        type: 'string',
        description: 'Business Central version for version-specific analysis'
      },
      suggest_workflows: {
        type: 'boolean',
        description: 'Include workflow recommendations based on analysis',
        default: true
      }
    },
    required: ['code']
  }
};
