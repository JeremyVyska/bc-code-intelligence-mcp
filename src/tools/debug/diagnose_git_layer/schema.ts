/**
 * Schema for diagnose_git_layer tool
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const diagnoseGitLayerTool: Tool = {
  name: 'diagnose_git_layer',
  description: 'Diagnose git layer authentication and connectivity issues. Use this when git layers fail to load or Azure DevOps PAT authentication is not working.',
  inputSchema: {
    type: 'object',
    properties: {
      git_url: {
        type: 'string',
        description: 'Git repository URL to test (e.g., https://dev.azure.com/org/project/_git/repo)'
      },
      auth_type: {
        type: 'string',
        enum: ['token', 'basic', 'ssh'],
        description: 'Authentication type being used'
      },
      token_env_var: {
        type: 'string',
        description: 'Environment variable name containing the PAT/token (if using token auth)'
      },
      branch: {
        type: 'string',
        description: 'Branch to test (defaults to main)',
        default: 'main'
      },
      test_type: {
        type: 'string',
        enum: ['connectivity', 'authentication', 'clone', 'full'],
        description: 'Type of diagnostic test to run',
        default: 'full'
      }
    },
    required: ['git_url', 'auth_type']
  }
};
