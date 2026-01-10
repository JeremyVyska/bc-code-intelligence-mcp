/**
 * Schema for validate_layer_config tool
 */
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const validateLayerConfigTool: Tool = {
  name: 'validate_layer_config',
  description: 'Validate layer configuration before attempting to load. Checks paths, permissions, and configuration syntax.',
  inputSchema: {
    type: 'object',
    properties: {
      config_path: {
        type: 'string',
        description: 'Path to configuration file to validate'
      },
      check_type: {
        type: 'string',
        enum: ['syntax', 'paths', 'permissions', 'full'],
        description: 'Type of validation to perform',
        default: 'full'
      }
    },
    required: ['config_path']
  }
};
