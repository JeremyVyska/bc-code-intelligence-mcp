/**
 * Handler for reload_layers tool
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MultiContentLayerService } from '../../../services/multi-content-layer-service.js';
import { ConfigurationLoader } from '../../../config/config-loader.js';

export function createReloadLayersHandler(
  layerService: MultiContentLayerService,
  configLoader?: ConfigurationLoader
) {
  return async function reloadLayers(args: any): Promise<CallToolResult> {
    const { layer_name, reload_config = true } = args;

    const results = {
      timestamp: new Date().toISOString(),
      config_reloaded: false,
      layers_reloaded: [] as any[],
      errors: [] as string[]
    };

    try {
      // Step 1: Reload configuration if requested
      if (reload_config && configLoader) {
        try {
          const configResult = await configLoader.loadConfiguration();
          results.config_reloaded = true;

          if (configResult.validation_errors.length > 0) {
            results.errors.push(`Configuration has ${configResult.validation_errors.length} validation errors`);
            for (const error of configResult.validation_errors) {
              results.errors.push(`  ${error.field}: ${error.message}`);
            }
          }
        } catch (error: any) {
          results.errors.push(`Failed to reload configuration: ${error.message}`);
          results.config_reloaded = false;
        }
      }

      // Step 2: Refresh layer cache
      try {
        await layerService.refreshCache();

        // Get updated layer statistics
        const stats = layerService.getStatistics();

        for (const stat of stats) {
          if (layer_name && stat.name !== layer_name) {
            continue;
          }

          results.layers_reloaded.push({
            name: stat.name,
            priority: stat.priority,
            topic_count: stat.topicCount,
            index_count: stat.indexCount,
            load_time_ms: stat.loadTimeMs || 0,
            status: stat.topicCount > 0 ? 'SUCCESS' : 'EMPTY_OR_FAILED'
          });
        }

        if (layer_name && results.layers_reloaded.length === 0) {
          results.errors.push(`Layer '${layer_name}' not found`);
        }

      } catch (error: any) {
        results.errors.push(`Failed to reload layers: ${error.message}`);
      }

      const success = results.errors.length === 0;
      const message = success
        ? `Successfully reloaded ${results.layers_reloaded.length} layer(s)`
        : `Reload completed with ${results.errors.length} error(s)`;

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...results,
            success,
            message
          }, null, 2)
        }],
        isError: !success
      };

    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Fatal error during reload: ${error.message}`,
            results
          }, null, 2)
        }],
        isError: true
      };
    }
  };
}
