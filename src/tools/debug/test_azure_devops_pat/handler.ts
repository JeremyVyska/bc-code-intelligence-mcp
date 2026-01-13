/**
 * Handler for test_azure_devops_pat tool
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { createDiagnoseGitLayerHandler } from '../diagnose_git_layer/handler.js';

export function createTestAzureDevOpsPATHandler() {
  const diagnoseGitLayer = createDiagnoseGitLayerHandler();

  return async function testAzureDevOpsPAT(args: any): Promise<CallToolResult> {
    const { organization, project, repository, pat_env_var } = args;

    const url = `https://dev.azure.com/${organization}/${project}/_git/${repository}`;

    // Reuse git layer diagnostics
    return diagnoseGitLayer({
      git_url: url,
      auth_type: 'token',
      token_env_var: pat_env_var,
      test_type: 'full'
    });
  };
}
