#!/usr/bin/env tsx

/**
 * Embedded Knowledge Validation Script
 * 
 * Validates that the embedded-knowledge submodule is properly initialized
 * and contains the required BC knowledge content before building/packaging.
 * 
 * This prevents publishing empty packages due to missing submodule initialization.
 */

import { existsSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const embeddedKnowledgePath = join(projectRoot, 'embedded-knowledge');

interface ValidationResult {
  success: boolean;
  message: string;
  details?: string[];
}

/**
 * Validate that embedded-knowledge directory exists and has content
 */
function validateEmbeddedKnowledgeExists(): ValidationResult {
  if (!existsSync(embeddedKnowledgePath)) {
    return {
      success: false,
      message: 'Embedded knowledge directory not found',
      details: [
        `Expected path: ${embeddedKnowledgePath}`,
        'Run: git submodule init && git submodule update',
        'This is required to include BC knowledge content in the package'
      ]
    };
  }

  // Check if directory is empty (common sign of uninitialized submodule)
  try {
    const stat = statSync(embeddedKnowledgePath);
    if (!stat.isDirectory()) {
      return {
        success: false,
        message: 'Embedded knowledge path exists but is not a directory',
        details: [`Path: ${embeddedKnowledgePath}`]
      };
    }
  } catch (error) {
    return {
      success: false,
      message: 'Cannot access embedded knowledge directory',
      details: [`Path: ${embeddedKnowledgePath}`, `Error: ${error}`]
    };
  }

  return { success: true, message: 'Embedded knowledge directory found' };
}

/**
 * Validate required directory structure
 */
function validateDirectoryStructure(): ValidationResult {
  const requiredDirs = [
    'domains',
    'specialists', 
    'methodologies',
    'indexes'
  ];

  const missingDirs: string[] = [];
  const details: string[] = [];

  for (const dir of requiredDirs) {
    const dirPath = join(embeddedKnowledgePath, dir);
    if (!existsSync(dirPath)) {
      missingDirs.push(dir);
    } else {
      // Count files in directory for validation
      try {
        const stat = statSync(dirPath);
        if (stat.isDirectory()) {
          details.push(`✅ ${dir}/ directory found`);
        }
      } catch (error) {
        details.push(`❌ ${dir}/ directory access error: ${error}`);
      }
    }
  }

  if (missingDirs.length > 0) {
    return {
      success: false,
      message: 'Missing required embedded knowledge directories',
      details: [
        `Missing: ${missingDirs.join(', ')}`,
        'This suggests an incomplete submodule initialization',
        'Run: git submodule update --remote --force',
        ...details
      ]
    };
  }

  return {
    success: true,
    message: 'All required directories found',
    details
  };
}

/**
 * Validate critical files exist
 */
function validateCriticalFiles(): ValidationResult {
  const criticalFiles = [
    'methodologies/index.json',
    'indexes/domain-catalog.json',
    'specialists/alex-architect.md',
    'domains/alex-architect/facade-pattern-al-implementation.md'
  ];

  const missingFiles: string[] = [];
  const details: string[] = [];

  for (const file of criticalFiles) {
    const filePath = join(embeddedKnowledgePath, file);
    if (!existsSync(filePath)) {
      missingFiles.push(file);
    } else {
      try {
        const stat = statSync(filePath);
        if (stat.size > 0) {
          details.push(`✅ ${file} (${stat.size} bytes)`);
        } else {
          details.push(`❌ ${file} (empty file)`);
          missingFiles.push(file);
        }
      } catch (error) {
        details.push(`❌ ${file} (access error: ${error})`);
        missingFiles.push(file);
      }
    }
  }

  if (missingFiles.length > 0) {
    return {
      success: false,
      message: 'Missing critical embedded knowledge files',
      details: [
        `Missing/empty files: ${missingFiles.join(', ')}`,
        'This indicates corrupted or incomplete embedded knowledge',
        'Run: git submodule update --remote --force',
        ...details
      ]
    };
  }

  return {
    success: true,
    message: 'All critical files validated',
    details
  };
}

/**
 * Count content to ensure meaningful amount of knowledge
 */
function validateContentCount(): ValidationResult {
  const details: string[] = [];
  let totalFiles = 0;

  const contentDirs = ['domains', 'specialists'];
  
  for (const dir of contentDirs) {
    const dirPath = join(embeddedKnowledgePath, dir);
    if (existsSync(dirPath)) {
      try {
        // Count .md files recursively
        const files = readdirSync(dirPath, { recursive: true }) as string[];
        const mdFiles = files.filter((f: string) => f.endsWith('.md'));
        totalFiles += mdFiles.length;
        details.push(`📚 ${dir}/: ${mdFiles.length} content files`);
      } catch (error) {
        details.push(`❌ Error counting files in ${dir}/: ${error}`);
      }
    }
  }

  // We expect at least 50+ content files for a meaningful BC knowledge base
  const minExpectedFiles = 50;
  
  if (totalFiles < minExpectedFiles) {
    return {
      success: false,
      message: `Insufficient embedded knowledge content (${totalFiles} files, expected ${minExpectedFiles}+)`,
      details: [
        'This suggests incomplete submodule content',
        'Run: git submodule update --remote --force',
        ...details
      ]
    };
  }

  return {
    success: true,
    message: `Sufficient content validated (${totalFiles} files)`,
    details
  };
}

/**
 * Run all validation checks
 */
function runValidation(): boolean {
  console.log('🔍 Validating embedded knowledge for build/package...\n');

  const validations = [
    { name: 'Directory Existence', fn: validateEmbeddedKnowledgeExists },
    { name: 'Directory Structure', fn: validateDirectoryStructure },
    { name: 'Critical Files', fn: validateCriticalFiles },
    { name: 'Content Count', fn: validateContentCount }
  ];

  let allValid = true;

  for (const { name, fn } of validations) {
    const result = fn();
    
    if (result.success) {
      console.log(`✅ ${name}: ${result.message}`);
      if (result.details) {
        result.details.forEach(detail => console.log(`   ${detail}`));
      }
    } else {
      console.log(`❌ ${name}: ${result.message}`);
      if (result.details) {
        result.details.forEach(detail => console.log(`   ${detail}`));
      }
      allValid = false;
    }
    console.log('');
  }

  if (allValid) {
    console.log('🎉 All embedded knowledge validations passed!');
    console.log('✅ Safe to build and package bc-code-intelligence-mcp\n');
  } else {
    console.log('🚨 Embedded knowledge validation FAILED!');
    console.log('❌ DO NOT build or package - embedded knowledge is incomplete');
    console.log('\n📋 Quick fix commands:');
    console.log('   git submodule init');
    console.log('   git submodule update --remote');
    console.log('   npm run validate:embedded-knowledge  # re-run this check\n');
  }

  return allValid;
}

// Run validation and exit with appropriate code
const isValid = runValidation();
process.exit(isValid ? 0 : 1);
