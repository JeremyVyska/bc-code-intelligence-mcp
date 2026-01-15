/**
 * extract_bc_snapshot Tool - Handler Implementation
 *
 * Extract BC snapshot files for debugging analysis
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { SnapshotService } from '../../services/snapshot-service.js';

export function createExtractBcSnapshotHandler(services: any) {
  const snapshotService = new SnapshotService();

  return async (args: any): Promise<CallToolResult> => {
    try {
      const { snapshot_path } = args;

      if (!snapshot_path) {
        return {
          content: [{
            type: 'text',
            text: '❌ Error: snapshot_path is required'
          }],
          isError: true
        };
      }

      // Extract the snapshot
      const result = await snapshotService.extractSnapshot(snapshot_path);

      // Format response
      let response = `✅ **BC Snapshot Extracted Successfully**\n\n`;
      
      response += `📁 **Temporary Directory:** \`${result.temp_directory}\`\n\n`;
      
      response += `## 📊 Snapshot Summary\n\n`;
      response += `- **Debug Trace Files:** ${result.metadata.total_mdc_files} .mdc files\n`;
      response += `- **AL Source Files:** ${result.metadata.total_al_files} .al files\n`;
      
      if (result.metadata.bc_version) {
        response += `- **BC Version:** ${result.metadata.bc_version}\n`;
      }

      if (result.metadata.app_info.length > 0) {
        response += `\n### 📦 Application Info\n\n`;
        result.metadata.app_info.forEach(app => {
          response += `- **${app.name}** (${app.publisher})\n`;
          response += `  - Version: ${app.version}\n`;
          response += `  - App ID: ${app.appId}\n`;
        });
      }

      response += `\n## 📂 File Structure\n\n\`\`\`\n${result.file_tree}\n\`\`\`\n\n`;

      if (result.notable_files.largest_mdc) {
        response += `## 🔍 Key Files\n\n`;
        response += `- **Largest Debug Trace:** \`${result.notable_files.largest_mdc}\` (often contains the most interesting debugging data)\n\n`;
      }

      if (result.notable_files.al_files.length > 0) {
        response += `### AL Source Files Available\n\n`;
        const displayFiles = result.notable_files.al_files.slice(0, 10);
        displayFiles.forEach(file => {
          if (file.object_type && file.object_id) {
            response += `- \`${file.encoded_name}\` → ${file.object_type} ${file.object_id}\n`;
          } else {
            response += `- \`${file.encoded_name}\`\n`;
          }
        });
        if (result.notable_files.al_files.length > 10) {
          response += `- ... and ${result.notable_files.al_files.length - 10} more files\n`;
        }
      }

      response += `\n## 💡 Next Steps\n\n`;
      response += `1. **Read debug traces:** Use file reading tools on .mdc files in \`${result.temp_directory}\`\n`;
      response += `2. **Examine AL source:** Check the .al files to see code that was executing\n`;
      response += `3. **Start with largest .mdc:** \`${result.notable_files.largest_mdc || '0.mdc'}\` typically has key execution data\n`;
      response += `4. **Look for patterns:** Search for call stacks, variable values, and execution flow\n\n`;
      
      response += `⚠️ **Security Note:** Snapshot files contain production data. Extracted files are automatically cleaned up when the MCP server exits.\n`;

      return {
        content: [{ type: 'text', text: response }]
      };

    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: `❌ **Error extracting snapshot:** ${error.message}\n\nPlease ensure the snapshot file exists and is a valid .snap file.`
        }],
        isError: true
      };
    }
  };
}
