/**
 * get_codelens_mappings Tool - Handler Implementation
 *
 * Returns merged CodeLens mappings from all active layers for the VSCode CodeLens provider.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as yaml from 'yaml';
import * as fs from 'fs';
import * as path from 'path';

interface CodeLensMapping {
  pattern: string;           // Regex pattern to match in AL code
  specialist: string;        // specialist_id to invoke
  label: string;             // Display label for CodeLens
  specialistEmoji?: string;  // Resolved from specialist definition
}

interface CodeLensMappingsFile {
  mappings: Array<{
    pattern: string;
    specialist: string;
    label: string;
  }>;
}

export function createGetCodelensMappingsHandler(services: any) {
  const { layerService } = services;

  return async (_args: any): Promise<CallToolResult> => {
    // Get all active layers in priority order (lowest to highest)
    const layers = layerService.getLayers();

    // Collect mappings from all layers
    const allMappings: Map<string, CodeLensMapping> = new Map();

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

      const mappingsPath = path.join(layerPath, 'codelens-mappings.yaml');

      if (fs.existsSync(mappingsPath)) {
        try {
          const content = fs.readFileSync(mappingsPath, 'utf-8');
          const parsed = yaml.parse(content) as CodeLensMappingsFile;

          if (parsed?.mappings) {
            for (const mapping of parsed.mappings) {
              // Higher priority layers override lower priority (same pattern)
              allMappings.set(mapping.pattern, {
                pattern: mapping.pattern,
                specialist: mapping.specialist,
                label: mapping.label,
                specialistEmoji: undefined  // Resolved below
              });
            }
          }
        } catch (error) {
          console.warn(`Failed to parse codelens-mappings.yaml in layer ${layer.name}:`, error);
        }
      }
    }

    // Resolve specialist emojis
    const mappingsArray = Array.from(allMappings.values());
    for (const mapping of mappingsArray) {
      try {
        const specialist = await layerService.getSpecialist(mapping.specialist);
        if (specialist) {
          mapping.specialistEmoji = specialist.emoji;
        }
      } catch (error) {
        // Specialist not found - emoji remains undefined
      }
    }

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          mappings: mappingsArray,
          layer_count: layers.filter((l: any) => l.enabled).length
        }, null, 2)
      }]
    };
  };
}
