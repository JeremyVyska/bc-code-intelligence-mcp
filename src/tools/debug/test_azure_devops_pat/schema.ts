/**
 * Schema for test_azure_devops_pat tool
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const testAzureDevOpsPATTool: Tool = {
  name: 'test_azure_devops_pat',
  description: 'Test Azure DevOps Personal Access Token (PAT) validity and permissions. Helps diagnose PAT-related authentication failures.',
  inputSchema: {
    type: 'object',
    properties: {
      organization: {
        type: 'string',
        description: 'Azure DevOps organization name'
      },
      project: {
        type: 'string',
        description: 'Azure DevOps project name'
      },
      repository: {
        type: 'string',
        description: 'Repository name'
      },
      pat_env_var: {
        type: 'string',
        description: 'Environment variable containing the PAT'
      }
    },
    required: ['organization', 'project', 'repository', 'pat_env_var']
  }
};
