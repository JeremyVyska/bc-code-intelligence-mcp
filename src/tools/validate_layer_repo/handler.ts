/**
 * validate_layer_repo Tool - Handler Implementation
 *
 * Validates if a directory has valid layer structure for the VSCode extension setup wizard.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  valid: boolean;
  missing: string[];
  present: string[];
  suggestions: string[];
  warnings: string[];
}

const REQUIRED_STRUCTURE = [
  'specialists/',
  'domains/',
  'prompts/'
];

const OPTIONAL_STRUCTURE = [
  'indexes/',
  'codelens-mappings.yaml',
  'layer-config.yaml',
  'README.md'
];

export function createValidateLayerRepoHandler() {
  return async (args: { path: string }): Promise<CallToolResult> => {
    const { path: layerPath } = args;

    if (!layerPath) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            valid: false,
            error: 'path parameter is required',
            missing: REQUIRED_STRUCTURE,
            present: [],
            suggestions: ['Provide an absolute path to the directory to validate']
          }, null, 2)
        }]
      };
    }

    const result: ValidationResult = {
      valid: true,
      missing: [],
      present: [],
      suggestions: [],
      warnings: []
    };

    // Check if path exists
    if (!fs.existsSync(layerPath)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            valid: false,
            error: `Path does not exist: ${layerPath}`,
            missing: REQUIRED_STRUCTURE,
            present: [],
            suggestions: ['Create the directory first, then run scaffold_layer_repo']
          }, null, 2)
        }]
      };
    }

    // Check if path is a directory
    const stats = fs.statSync(layerPath);
    if (!stats.isDirectory()) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            valid: false,
            error: `Path is not a directory: ${layerPath}`,
            missing: REQUIRED_STRUCTURE,
            present: [],
            suggestions: ['Provide a path to a directory, not a file']
          }, null, 2)
        }]
      };
    }

    // Check required structure
    for (const item of REQUIRED_STRUCTURE) {
      const itemPath = path.join(layerPath, item);
      if (fs.existsSync(itemPath)) {
        result.present.push(item);
      } else {
        result.missing.push(item);
        result.valid = false;
      }
    }

    // Check optional structure
    for (const item of OPTIONAL_STRUCTURE) {
      const itemPath = path.join(layerPath, item);
      if (fs.existsSync(itemPath)) {
        result.present.push(item);
      }
    }

    // Generate suggestions
    if (!result.valid) {
      result.suggestions.push('Use scaffold_layer_repo to create missing folders with templates');
    }

    if (!result.present.includes('layer-config.yaml')) {
      result.suggestions.push('Consider adding layer-config.yaml to define layer metadata');
    }

    if (!result.present.includes('README.md')) {
      result.suggestions.push('Consider adding README.md with contributor guidelines');
    }

    // Check for content
    const specialistsDir = path.join(layerPath, 'specialists');
    if (fs.existsSync(specialistsDir)) {
      try {
        const files = fs.readdirSync(specialistsDir).filter(f => f.endsWith('.md'));
        if (files.length === 0) {
          result.warnings.push('specialists/ folder exists but contains no .md files');
        }
      } catch (error) {
        result.warnings.push('Could not read specialists/ folder');
      }
    }

    const domainsDir = path.join(layerPath, 'domains');
    if (fs.existsSync(domainsDir)) {
      try {
        const subdirs = fs.readdirSync(domainsDir, { withFileTypes: true })
          .filter(d => d.isDirectory());
        if (subdirs.length === 0) {
          result.warnings.push('domains/ folder exists but contains no domain subfolders');
        }
      } catch (error) {
        result.warnings.push('Could not read domains/ folder');
      }
    }

    const promptsDir = path.join(layerPath, 'prompts');
    if (fs.existsSync(promptsDir)) {
      try {
        const files = fs.readdirSync(promptsDir).filter(f => f.endsWith('.md'));
        if (files.length === 0) {
          result.warnings.push('prompts/ folder exists but contains no .md files');
        }
      } catch (error) {
        result.warnings.push('Could not read prompts/ folder');
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2)
      }]
    };
  };
}
