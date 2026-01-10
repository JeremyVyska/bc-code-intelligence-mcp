/**
 * Handler for get_layer_diagnostics tool
 */
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MultiContentLayerService } from '../../../services/multi-content-layer-service.js';

export function createGetLayerDiagnosticsHandler(layerService: MultiContentLayerService) {
  return async function getLayerDiagnostics(args: any): Promise<CallToolResult> {
    const { layer_name, include_metrics = true } = args;

    const diagnostics = {
      timestamp: new Date().toISOString(),
      layers: [] as any[]
    };

    const stats = layerService.getStatistics();

    for (const layerStat of stats) {
      if (layer_name && layerStat.name !== layer_name) {
        continue;
      }

      const layerDiag = {
        name: layerStat.name,
        priority: layerStat.priority,
        enabled: layerStat.enabled,
        topic_count: layerStat.topicCount,
        index_count: layerStat.indexCount,
        load_status: layerStat.topicCount > 0 ? 'SUCCESS' : 'EMPTY_OR_FAILED'
      } as any;

      if (include_metrics) {
        layerDiag.metrics = {
          load_time_ms: layerStat.loadTimeMs || 0,
          memory_usage: layerStat.memoryUsage
        };
      }

      diagnostics.layers.push(layerDiag);
    }

    if (diagnostics.layers.length === 0 && layer_name) {
      return {
        content: [{
          type: 'text',
          text: `Layer '${layer_name}' not found. Available layers: ${stats.map(s => s.name).join(', ')}`
        }],
        isError: true
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(diagnostics, null, 2)
      }]
    };
  };
}
