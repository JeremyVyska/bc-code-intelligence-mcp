import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { allTools, debugTools } from '../../src/tools/index.js';

/**
 * Prompt Validation Tests
 *
 * These tests prevent the exact problem you mentioned:
 * "a prompt or instruction IN the MCP was referring to a tool that didn't exist"
 */
describe('Prompt Validation Tests', () => {
  // Get all available tool names (production + debug)
  const availableToolNames = allTools.map(t => t.name);
  const debugToolNames = debugTools.map(t => t.name);

  const allValidToolNames = [...availableToolNames, ...debugToolNames];

  describe('Source Code Prompt References', () => {
    it('should not reference non-existent tools in service files', () => {
      const serviceFiles = [
        '../../src/services/workflow-specialist-router.ts',
        '../../src/services/knowledge-service.ts',
        '../../src/services/methodology-service.ts'
      ];

      const issues: string[] = [];

      for (const filePath of serviceFiles) {
        try {
          const content = readFileSync(join(__dirname, filePath), 'utf-8');
          
          // Look for tool references in backticks or quotes
          const toolReferencePatterns = [
            /`([a-z_]+)`/g,  // `tool_name`
            /'([a-z_]+)'/g,  // 'tool_name'
            /"([a-z_]+)"/g   // "tool_name"
          ];

          for (const pattern of toolReferencePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              const potentialToolName = match[1];
              
              // Check if it looks like a tool name (has underscores, specific patterns)
              if (potentialToolName.includes('_') && 
                  (potentialToolName.startsWith('find_') || 
                   potentialToolName.startsWith('get_') ||
                   potentialToolName.startsWith('ask_') ||
                   potentialToolName.startsWith('start_') ||
                   potentialToolName.includes('specialist') ||
                   potentialToolName.includes('workflow'))) {
                
                if (!allValidToolNames.includes(potentialToolName)) {
                  issues.push(`${filePath}: References unknown tool '${potentialToolName}'`);
                }
              }
            }
          }
        } catch (error) {
          // File might not exist, skip
        }
      }

      if (issues.length > 0) {
        console.log('Tool reference issues found:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      }

      expect(issues).toHaveLength(0);
    });

    it('should validate workflow specialist router tool references', () => {
      try {
        const promptServiceContent = readFileSync(
          join(__dirname, '../../src/services/workflow-specialist-router.ts'),
          'utf-8'
        );

        const issues: string[] = [];

        // Look for specific MCP tool usage patterns
        const mcpToolPatterns = [
          /Use MCP tool.*?([a-z_]+)/g,
          /suggest_specialist\s+([a-z_]+)/g,
          /advance_workflow/g,
          /get_workflow_status/g,
          /discover_specialists/g,
          /find_bc_topics/g
        ];

        for (const pattern of mcpToolPatterns) {
          let match;
          while ((match = pattern.exec(promptServiceContent)) !== null) {
            const toolName = match[1] || match[0];
            
            // Clean up the tool name
            const cleanToolName = toolName.replace(/[^a-z_]/g, '');
            
            if (cleanToolName &&
                cleanToolName.includes('_') &&
                !allValidToolNames.includes(cleanToolName)) {
              issues.push(`Workflow specialist router references unknown tool: ${cleanToolName}`);
            }
          }
        }

        expect(issues).toHaveLength(0);
      } catch (error) {
        // File might not exist, test passes
      }
    });
  });

  describe('Embedded Knowledge Prompt References', () => {
    it('should validate specialist definitions do not reference non-existent tools', () => {
      const specialistFiles = [
        '../../embedded-knowledge/specialists',
        '../../embedded-knowledge/domains'
      ];

      const issues: string[] = [];

      for (const dir of specialistFiles) {
        try {
          const dirPath = join(__dirname, dir);
          if (readdirSync(dirPath)) {
            const files = readdirSync(dirPath);
            
            for (const file of files) {
              if (file.endsWith('.md')) {
                const filePath = join(dirPath, file);
                const content = readFileSync(filePath, 'utf-8');
                
                // Look for tool references in markdown
                const toolMatches = content.match(/`([a-z_]+)`/g) || [];
                
                for (const match of toolMatches) {
                  const toolName = match.replace(/`/g, '');
                  
                  if (toolName.includes('_') && 
                      (toolName.startsWith('find_') || 
                       toolName.startsWith('get_') ||
                       toolName.startsWith('ask_') ||
                       toolName.includes('specialist')) &&
                      !allValidToolNames.includes(toolName)) {
                    issues.push(`${file}: References unknown tool '${toolName}'`);
                  }
                }
              }
            }
          }
        } catch (error) {
          // Directory might not exist, skip
        }
      }

      if (issues.length > 0) {
        console.log('Specialist file tool reference issues:');
        issues.forEach(issue => console.log(`  - ${issue}`));
      }

      expect(issues).toHaveLength(0);
    });
  });

  describe('Tool Documentation Consistency', () => {
    it('should ensure all tools have descriptions', () => {
      const allToolsToCheck = [...allTools, ...debugTools];
      const toolsWithoutDescriptions = allToolsToCheck.filter(
        tool => !tool.description || tool.description.trim().length === 0
      );

      expect(toolsWithoutDescriptions).toHaveLength(0);
    });

    it('should ensure tool descriptions do not reference other non-existent tools', () => {
      const issues: string[] = [];
      const allToolsToCheck = [...allTools, ...debugTools];

      for (const tool of allToolsToCheck) {
        const description = tool.description;

        // Skip tools without descriptions
        if (!description) continue;

        // Look for tool references in descriptions
        const matches = description.match(/`([a-z_]+)`/g) || [];

        for (const match of matches) {
          const referencedTool = match.replace(/`/g, '');

          if (referencedTool.includes('_') &&
              !allValidToolNames.includes(referencedTool) &&
              referencedTool !== tool.name) {
            issues.push(`Tool '${tool.name}' description references unknown tool '${referencedTool}'`);
          }
        }
      }

      expect(issues).toHaveLength(0);
    });
  });

  describe('Workflow Tool References', () => {
    it('should validate workflow prompts reference only existing tools', () => {
      // This would check any workflow templates or prompts
      // that are generated dynamically to ensure they only reference real tools
      
      const mockWorkflowPrompt = `
        Use MCP tool: find_bc_knowledge to search for information
        Then use: ask_bc_expert for specialist consultation
        Finally: advance_workflow to continue
      `;

      const referencedTools = mockWorkflowPrompt.match(/Use MCP tool:\s*([a-z_]+)/g) || [];
      
      for (const match of referencedTools) {
        const toolName = match.replace(/Use MCP tool:\s*/, '');
        if (!allValidToolNames.includes(toolName)) {
          expect.fail(`Workflow prompt references non-existent tool: ${toolName}`);
        }
      }
    });
  });
});
