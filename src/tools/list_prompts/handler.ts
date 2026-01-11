/**
 * list_prompts Tool - Handler Implementation
 *
 * Lists all prompts from all layers with metadata for the tree view and Quick Pick.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface PromptInfo {
  prompt_id: string;
  title: string;
  type: string;
  phases?: number;
  specialists: string[];
  description: string;
  layer: string;        // Which layer it comes from
  layer_priority: number;
  content?: string;     // Full content if requested
}

export function createListPromptsHandler(services: any) {
  const { layerService } = services;

  return async (args: { type?: string; include_content?: boolean }): Promise<CallToolResult> => {
    const { type = 'all', include_content = false } = args;

    const layers = layerService.getLayers();
    const promptsMap = new Map<string, PromptInfo>();  // Keyed by prompt_id

    for (const layer of layers) {
      if (!layer.enabled) continue;

      // Determine the layer path - handle different layer types
      let layerPath: string | null = null;

      if ('path' in layer && layer.path) {
        layerPath = layer.path;
      } else if ('basePath' in layer && layer.basePath) {
        layerPath = layer.basePath;
      } else if (layer.name === 'embedded') {
        // For embedded layer, use the embedded-knowledge directory
        layerPath = path.join(process.cwd(), 'embedded-knowledge');
      }

      if (!layerPath) continue;

      const promptsDir = path.join(layerPath, 'prompts');

      if (!fs.existsSync(promptsDir)) continue;

      let files: string[];
      try {
        files = fs.readdirSync(promptsDir)
          .filter(f => f.endsWith('.md') && !f.startsWith('_'));
      } catch (error) {
        console.warn(`Could not read prompts directory in layer ${layer.name}:`, error);
        continue;
      }

      for (const file of files) {
        const filePath = path.join(promptsDir, file);
        let content: string;

        try {
          content = fs.readFileSync(filePath, 'utf-8');
        } catch (error) {
          console.warn(`Could not read prompt file ${file}:`, error);
          continue;
        }

        // Parse frontmatter
        const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if (!match) continue;

        try {
          const frontmatter = yaml.parse(match[1]);

          // Filter by type if specified
          if (type !== 'all' && frontmatter.type !== type) continue;

          const promptInfo: PromptInfo = {
            prompt_id: frontmatter.prompt_id || file.replace('.md', ''),
            title: frontmatter.title || file.replace('.md', ''),
            type: frontmatter.type || 'workflow',
            phases: frontmatter.phases,
            specialists: frontmatter.specialists || [],
            description: frontmatter.description || '',
            layer: layer.name,
            layer_priority: layer.priority
          };

          if (include_content) {
            promptInfo.content = content;
          }

          // Higher priority layer overrides
          const existing = promptsMap.get(promptInfo.prompt_id);
          if (!existing || layer.priority > existing.layer_priority) {
            promptsMap.set(promptInfo.prompt_id, promptInfo);
          }

        } catch (error) {
          console.warn(`Failed to parse prompt ${file}:`, error);
        }
      }
    }

    const prompts = Array.from(promptsMap.values());

    // Sort by title for consistent ordering
    prompts.sort((a, b) => a.title.localeCompare(b.title));

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          prompts,
          count: prompts.length,
          layers_searched: layers.filter((l: any) => l.enabled).length
        }, null, 2)
      }]
    };
  };
}
