/**
 * Handler for diagnose_git_layer tool
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import simpleGit from 'simple-git';
import { join } from 'path';

export function createDiagnoseGitLayerHandler() {
  return async function diagnoseGitLayer(args: any): Promise<CallToolResult> {
    const { git_url, auth_type, token_env_var, branch = 'main', test_type = 'full' } = args;

    const diagnostics = {
      timestamp: new Date().toISOString(),
      url: git_url,
      auth_type,
      tests: [] as any[]
    };

    // Test 1: URL Format Validation
    if (test_type === 'connectivity' || test_type === 'full') {
      const urlTest = validateGitUrl(git_url);
      diagnostics.tests.push(urlTest);
    }

    // Test 2: Authentication Configuration
    if (test_type === 'authentication' || test_type === 'full') {
      const authTest = await testAuthConfiguration(git_url, auth_type, token_env_var);
      diagnostics.tests.push(authTest);
    }

    // Test 3: Network Connectivity (if full test)
    if (test_type === 'connectivity' || test_type === 'full') {
      const connectivityTest = await testGitConnectivity(git_url, auth_type, token_env_var);
      diagnostics.tests.push(connectivityTest);
    }

    // Test 4: Clone Test (if full or clone test)
    if (test_type === 'clone' || test_type === 'full') {
      const cloneTest = await testGitClone(git_url, auth_type, token_env_var, branch);
      diagnostics.tests.push(cloneTest);
    }

    // Generate recommendations based on failures
    const recommendations = generateRecommendations(diagnostics.tests, auth_type);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...diagnostics,
          summary: generateDiagnosticSummary(diagnostics.tests),
          recommendations
        }, null, 2)
      }]
    };
  };
}

function validateGitUrl(url: string): any {
  const test = {
    name: 'URL Format Validation',
    passed: false,
    details: {} as any
  };

  // Check URL format
  try {
    const urlObj = new URL(url);
    test.details.protocol = urlObj.protocol;
    test.details.hostname = urlObj.hostname;
    test.details.pathname = urlObj.pathname;

    // Azure DevOps specific validation
    if (url.includes('dev.azure.com') || url.includes('visualstudio.com')) {
      test.details.provider = 'Azure DevOps';

      // Parse Azure DevOps URL components
      const azureMatch = url.match(/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/(.+?)(?:\.git)?$/);
      if (azureMatch) {
        test.details.organization = azureMatch[1];
        test.details.project = azureMatch[2];
        test.details.repository = azureMatch[3];
        test.passed = true;
        test.details.message = 'Valid Azure DevOps URL format';
      } else {
        test.details.message = 'Invalid Azure DevOps URL format. Expected: https://dev.azure.com/{org}/{project}/_git/{repo}';
        test.details.recommendation = 'Verify your Azure DevOps repository URL format';
      }
    } else if (url.includes('github.com')) {
      test.details.provider = 'GitHub';
      test.passed = true;
    } else if (url.includes('gitlab.com')) {
      test.details.provider = 'GitLab';
      test.passed = true;
    } else {
      test.details.provider = 'Unknown';
      test.passed = true; // Generic git URL
    }

  } catch (error) {
    test.details.message = `Invalid URL: ${error instanceof Error ? error.message : String(error)}`;
    test.details.recommendation = 'Provide a valid HTTP(S) or SSH URL';
  }

  return test;
}

async function testAuthConfiguration(url: string, authType: string, tokenEnvVar?: string): Promise<any> {
  const test = {
    name: 'Authentication Configuration',
    passed: false,
    details: {} as any
  };

  test.details.auth_type = authType;

  if (authType === 'token') {
    if (!tokenEnvVar) {
      test.details.message = 'Token environment variable not specified';
      test.details.recommendation = 'Specify token_env_var parameter';
      return test;
    }

    test.details.token_env_var = tokenEnvVar;
    const tokenValue = process.env[tokenEnvVar];

    if (!tokenValue) {
      test.details.message = `Environment variable ${tokenEnvVar} not set or empty`;
      test.details.recommendation = `Set ${tokenEnvVar} environment variable with your PAT`;
      test.details.check_instructions = [
        `Run: echo $env:${tokenEnvVar} (PowerShell) or echo $${tokenEnvVar} (Bash)`,
        'Verify the PAT is not expired',
        'Ensure the PAT has "Code (Read)" permission for Azure DevOps'
      ];
      return test;
    }

    test.details.token_length = tokenValue.length;
    test.details.token_prefix = tokenValue.substring(0, 4) + '...';

    // Azure DevOps PAT validation
    if (url.includes('dev.azure.com')) {
      // Azure DevOps PATs are typically 52 characters
      if (tokenValue.length === 52) {
        test.passed = true;
        test.details.message = 'PAT format appears valid for Azure DevOps';
      } else {
        test.details.message = `PAT length (${tokenValue.length}) unusual for Azure DevOps (expected 52 characters)`;
        test.details.recommendation = 'Verify this is a valid Azure DevOps Personal Access Token';
      }
    } else {
      test.passed = true;
      test.details.message = 'Token configuration present';
    }

  } else if (authType === 'ssh') {
    test.details.message = 'SSH authentication configured';
    test.passed = true;
  } else {
    test.details.message = `Unsupported auth type: ${authType}`;
    test.details.recommendation = 'Use "token", "basic", or "ssh" for auth_type';
  }

  return test;
}

async function testGitConnectivity(url: string, authType: string, tokenEnvVar?: string): Promise<any> {
  const test = {
    name: 'Git Connectivity Test',
    passed: false,
    details: {} as any
  };

  try {
    const git = simpleGit();

    // Prepare URL with auth for ls-remote test
    let testUrl = url;
    if (authType === 'token' && tokenEnvVar) {
      const token = process.env[tokenEnvVar];
      if (token && testUrl.startsWith('https://')) {
        // For Azure DevOps, use empty username with PAT
        testUrl = testUrl.replace('https://', `https://:${token}@`);
      }
    }

    // Try ls-remote to test connectivity without cloning
    const result = await git.listRemote(['--heads', testUrl]);

    test.passed = true;
    test.details.message = 'Successfully connected to repository';
    test.details.branches_found = result.split('\n').filter(Boolean).length;

  } catch (error: any) {
    test.details.message = 'Failed to connect to repository';
    test.details.error = error.message;

    // Parse common error scenarios
    if (error.message.includes('Authentication failed') || error.message.includes('403')) {
      test.details.issue = 'Authentication failure';
      test.details.recommendation = 'Verify PAT is valid and has Code (Read) permission';
    } else if (error.message.includes('Could not resolve host')) {
      test.details.issue = 'Network/DNS issue';
      test.details.recommendation = 'Check network connection and URL hostname';
    } else if (error.message.includes('Repository not found') || error.message.includes('404')) {
      test.details.issue = 'Repository not found';
      test.details.recommendation = 'Verify repository URL and access permissions';
    } else {
      test.details.issue = 'Unknown error';
      test.details.recommendation = 'Check error message for details';
    }
  }

  return test;
}

async function testGitClone(url: string, authType: string, tokenEnvVar: string | undefined, branch: string): Promise<any> {
  const test = {
    name: 'Git Clone Test',
    passed: false,
    details: {} as any
  };

  const tempDir = join(process.cwd(), '.bckb-diagnostic-temp', Date.now().toString());

  try {
    const git = simpleGit();

    // Prepare URL with auth
    let cloneUrl = url;
    if (authType === 'token' && tokenEnvVar) {
      const token = process.env[tokenEnvVar];
      if (token && cloneUrl.startsWith('https://')) {
        // For Azure DevOps, use empty username with PAT as password
        cloneUrl = cloneUrl.replace('https://', `https://:${token}@`);
      }
    }

    test.details.clone_url_format = cloneUrl.replace(/:([^@]+)@/, ':***@'); // Mask token in output

    await git.clone(cloneUrl, tempDir, [
      '--depth', '1',
      '--single-branch',
      '--branch', branch
    ]);

    test.passed = true;
    test.details.message = `Successfully cloned repository (branch: ${branch})`;
    test.details.temp_location = tempDir;

  } catch (error: any) {
    test.details.message = 'Clone failed';
    test.details.error = error.message;

    // Detailed error analysis
    if (error.message.includes('authentication failed') || error.message.includes('invalid credentials')) {
      test.details.issue = 'Authentication failed during clone';
      test.details.recommendation = [
        'Verify PAT is valid and not expired',
        'Ensure PAT has "Code (Read)" scope in Azure DevOps',
        'Check that the PAT belongs to a user with repository access',
        'Try regenerating the PAT in Azure DevOps'
      ];
    } else if (error.message.includes(`Couldn't find remote ref ${branch}`)) {
      test.details.issue = `Branch '${branch}' not found`;
      test.details.recommendation = `Verify branch name - try 'main' or 'master'`;
    } else {
      test.details.issue = 'Clone operation failed';
      test.details.recommendation = 'Review error message for specific cause';
    }
  }

  return test;
}

function generateDiagnosticSummary(tests: any[]): any {
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;

  return {
    total_tests: tests.length,
    passed,
    failed,
    overall_status: failed === 0 ? 'PASS' : 'FAIL',
    failed_tests: tests.filter(t => !t.passed).map(t => t.name)
  };
}

function generateRecommendations(tests: any[], authType: string): string[] {
  const recommendations: string[] = [];

  const failedTests = tests.filter(t => !t.passed);

  if (failedTests.length === 0) {
    return ['All tests passed! Git layer should work with this configuration.'];
  }

  // URL format issues
  if (failedTests.some(t => t.name === 'URL Format Validation')) {
    recommendations.push('Fix the repository URL format before proceeding');
  }

  // Auth configuration issues
  if (failedTests.some(t => t.name === 'Authentication Configuration')) {
    recommendations.push('Configure authentication properly (set environment variable with valid PAT)');

    if (authType === 'token') {
      recommendations.push('For Azure DevOps: Create a PAT with "Code (Read)" scope at https://dev.azure.com/{org}/_usersSettings/tokens');
    }
  }

  // Connectivity issues
  if (failedTests.some(t => t.name === 'Git Connectivity Test')) {
    recommendations.push('Test network connectivity and verify repository URL');
    recommendations.push('Ensure firewall/proxy allows git protocol access');
  }

  // Clone issues
  if (failedTests.some(t => t.name === 'Git Clone Test')) {
    recommendations.push('Review clone test error details for specific issue');
    recommendations.push('Verify PAT permissions include repository access');
  }

  return recommendations;
}
