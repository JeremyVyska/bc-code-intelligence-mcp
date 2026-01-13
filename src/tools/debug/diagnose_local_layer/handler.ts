/**
 * Handler for diagnose_local_layer tool
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { existsSync, accessSync, constants as fsConstants } from 'fs';
import { stat, readdir, readFile } from 'fs/promises';
import { join } from 'path';

export function createDiagnoseLocalLayerHandler() {
  return async function diagnoseLocalLayer(args: any): Promise<CallToolResult> {
    const { layer_path = './bc-code-intel-overrides' } = args;

    const diagnostics = {
      timestamp: new Date().toISOString(),
      layer_path,
      tests: [] as any[]
    };

    // Test 1: Path Existence
    const pathTest = {
      name: 'Path Existence Check',
      passed: false,
      details: {} as any
    };

    pathTest.details.absolute_path = join(process.cwd(), layer_path);
    pathTest.details.exists = existsSync(pathTest.details.absolute_path);

    if (pathTest.details.exists) {
      pathTest.passed = true;
      pathTest.details.message = 'Directory exists';
    } else {
      pathTest.details.message = 'Directory does not exist';
      pathTest.details.recommendation = `Create directory: mkdir ${layer_path}`;
    }

    diagnostics.tests.push(pathTest);

    // Test 2: Permissions Check
    if (pathTest.details.exists) {
      const permTest = {
        name: 'Path Permissions Check',
        passed: false,
        details: {} as any
      };

      try {
        accessSync(pathTest.details.absolute_path, fsConstants.R_OK);
        permTest.details.readable = true;
      } catch {
        permTest.details.readable = false;
      }

      try {
        accessSync(pathTest.details.absolute_path, fsConstants.W_OK);
        permTest.details.writable = true;
      } catch {
        permTest.details.writable = false;
      }

      if (permTest.details.readable) {
        permTest.passed = true;
        permTest.details.message = 'Directory is accessible';
      } else {
        permTest.details.message = 'Directory is not readable';
        permTest.details.recommendation = 'Check file permissions on the directory';
      }

      diagnostics.tests.push(permTest);
    }

    // Test 3: Content Discovery
    if (pathTest.details.exists) {
      const contentTest = {
        name: 'Content Discovery',
        passed: false,
        details: {} as any
      };

      try {
        const files = await readdir(pathTest.details.absolute_path);
        contentTest.details.total_files = files.length;

        // Check for markdown files
        const mdFiles = files.filter(f => f.endsWith('.md'));
        contentTest.details.markdown_files = mdFiles.length;

        // Check for expected directories
        const expectedDirs = ['domains', 'topics', 'overrides', 'specialists'];
        const foundDirs = files.filter(f => expectedDirs.includes(f));
        contentTest.details.expected_directories_found = foundDirs;

        // Recursively count markdown files
        let totalMdFiles = mdFiles.length;
        for (const item of files) {
          const itemPath = join(pathTest.details.absolute_path, item);
          try {
            const stats = await stat(itemPath);
            if (stats.isDirectory()) {
              const subFiles = await countMarkdownFiles(itemPath);
              totalMdFiles += subFiles;
            }
          } catch {
            // Skip inaccessible items
          }
        }

        contentTest.details.total_markdown_files = totalMdFiles;

        if (totalMdFiles > 0) {
          contentTest.passed = true;
          contentTest.details.message = `Found ${totalMdFiles} markdown file(s)`;
        } else {
          contentTest.details.message = 'No markdown files found';
          contentTest.details.recommendation = 'Add .md files to the directory or subdirectories (domains/, topics/, overrides/)';
          contentTest.details.example_structure = [
            `${layer_path}/domains/performance/my-optimization.md`,
            `${layer_path}/topics/company-specific-pattern.md`,
            `${layer_path}/overrides/existing-topic-override.md`
          ];
        }

      } catch (error: any) {
        contentTest.details.message = 'Failed to read directory contents';
        contentTest.details.error = error.message;
      }

      diagnostics.tests.push(contentTest);
    }

    // Test 4: Markdown File Validation (sample)
    if (pathTest.details.exists) {
      const validationTest = {
        name: 'Markdown File Validation',
        passed: false,
        details: {} as any
      };

      try {
        const sampleMdFiles = await findSampleMarkdownFiles(pathTest.details.absolute_path, 3);
        validationTest.details.files_checked = sampleMdFiles.length;

        if (sampleMdFiles.length > 0) {
          const validFiles = [];
          const invalidFiles = [];

          for (const file of sampleMdFiles) {
            const isValid = await validateMarkdownFile(file);
            if (isValid) {
              validFiles.push(file);
            } else {
              invalidFiles.push(file);
            }
          }

          validationTest.details.valid_files = validFiles.length;
          validationTest.details.invalid_files = invalidFiles.length;

          if (validFiles.length > 0) {
            validationTest.passed = true;
            validationTest.details.message = `${validFiles.length} of ${sampleMdFiles.length} files have valid frontmatter`;
          } else {
            validationTest.details.message = 'No valid markdown files with frontmatter found';
            validationTest.details.recommendation = 'Ensure markdown files have YAML frontmatter with title, domain, etc.';
          }

          if (invalidFiles.length > 0) {
            validationTest.details.invalid_file_examples = invalidFiles.slice(0, 2);
            validationTest.details.issue = 'Some files missing or have invalid YAML frontmatter';
          }
        }

      } catch (error: any) {
        validationTest.details.message = 'Failed to validate markdown files';
        validationTest.details.error = error.message;
      }

      diagnostics.tests.push(validationTest);
    }

    // Generate recommendations
    const recommendations = generateLocalLayerRecommendations(diagnostics.tests);

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

async function countMarkdownFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const files = await readdir(dir);
    for (const file of files) {
      const filePath = join(dir, file);
      try {
        const stats = await stat(filePath);
        if (stats.isDirectory()) {
          count += await countMarkdownFiles(filePath);
        } else if (file.endsWith('.md')) {
          count++;
        }
      } catch {
        // Skip inaccessible files
      }
    }
  } catch {
    // Skip inaccessible directories
  }
  return count;
}

async function findSampleMarkdownFiles(dir: string, limit: number): Promise<string[]> {
  const files: string[] = [];

  const findInDir = async (currentDir: string): Promise<void> => {
    if (files.length >= limit) return;

    try {
      const items = await readdir(currentDir);
      for (const item of items) {
        if (files.length >= limit) break;

        const itemPath = join(currentDir, item);
        try {
          const stats = await stat(itemPath);
          if (stats.isDirectory()) {
            await findInDir(itemPath);
          } else if (item.endsWith('.md')) {
            files.push(itemPath);
          }
        } catch {
          // Skip inaccessible items
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  };

  await findInDir(dir);
  return files;
}

async function validateMarkdownFile(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, 'utf-8');

    // Check for YAML frontmatter
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      return false;
    }

    // Basic validation - has some required fields
    const frontmatter = frontmatterMatch[1];
    return frontmatter.includes('title:') || frontmatter.includes('domain:');
  } catch {
    return false;
  }
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

function generateLocalLayerRecommendations(tests: any[]): string[] {
  const recommendations: string[] = [];

  const failedTests = tests.filter(t => !t.passed);

  if (failedTests.length === 0) {
    return ['All local layer checks passed! Layer should be loading correctly.'];
  }

  // Path doesn't exist
  if (failedTests.some(t => t.name === 'Path Existence Check')) {
    recommendations.push('Create the local layer directory before adding content');
    recommendations.push('Use: mkdir -p ./bc-code-intel-overrides/domains');
  }

  // Permission issues
  if (failedTests.some(t => t.name === 'Path Permissions Check')) {
    recommendations.push('Fix directory permissions to allow read access');
    recommendations.push('Check ownership and group permissions');
  }

  // No content
  if (failedTests.some(t => t.name === 'Content Discovery')) {
    recommendations.push('Add markdown files with BC knowledge to the directory');
    recommendations.push('Organize in subdirectories: domains/, topics/, or overrides/');
    recommendations.push('Each .md file should have YAML frontmatter with title, domain, tags, etc.');
  }

  // Invalid files
  if (failedTests.some(t => t.name === 'Markdown File Validation')) {
    recommendations.push('Ensure markdown files have proper YAML frontmatter (---...---)');
    recommendations.push('Required frontmatter fields: title, domain');
    recommendations.push('See embedded knowledge files for examples');
  }

  return recommendations;
}
