/**
 * extract_bc_snapshot Tool - Schema Definition
 *
 * Extract BC snapshot files for debugging analysis
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const extractBcSnapshotTool: Tool = {
  name: 'extract_bc_snapshot',
  description: 'Extract a Business Central snapshot (.snap) file to analyze debug traces, AL source code, and execution flow. Snapshots are ZIP archives containing .mdc debug trace files and .al source files. Returns temp directory path where files can be read using standard file tools.',
  inputSchema: {
    type: 'object',
    properties: {
      snapshot_path: {
        type: 'string',
        description: 'Absolute path to the .snap file to extract'
      }
    },
    required: ['snapshot_path']
  }
};
