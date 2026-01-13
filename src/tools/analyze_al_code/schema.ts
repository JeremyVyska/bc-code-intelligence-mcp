/**
 * analyze_al_code Tool - Schema Definition
 *
 * AL code analysis and workspace inspection
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const analyzeAlCodeTool: Tool = {
  name: 'analyze_al_code',
  description: 'Analyze AL code files in a workspace or specific files. IMPORTANT: Use workspace_path or file_path parameters - the MCP reads files directly. Do NOT pass code content unless you have inline code that is not in a file.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_path: {
        type: 'string',
        description: 'PREFERRED: Absolute path to workspace root (e.g., "C:/Projects/MyApp"). The MCP scans for all .al files automatically.'
      },
      file_path: {
        type: 'string',
        description: 'Absolute path to a single .al file (e.g., "C:/Projects/MyApp/src/Codeunit.al"). The MCP reads the file directly.'
      },
      file_paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of absolute .al file paths to analyze.'
      },
      code: {
        type: 'string',
        description: 'DEPRECATED: Only use for inline code snippets not in files. Never pass "workspace" or file paths as code - use workspace_path or file_path instead.'
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
    required: []
  }
};
