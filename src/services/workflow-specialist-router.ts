/**
 * Workflow Specialist Router
 *
 * Routes workflow requests to appropriate BC specialists based on context analysis.
 * Integrates specialist discovery with workflow prompts for better user experience.
 */

import { SpecialistDiscoveryService, DiscoveryContext } from './specialist-discovery.js';
import { SpecialistSessionManager } from './specialist-session-manager.js';
import { WorkflowService } from './workflow-service.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface EnhancedPromptOptions {
  includeSpecialistSuggestions?: boolean;
  maxSpecialistSuggestions?: number;
  includeWorkflowGuidance?: boolean;
  includeExamples?: boolean;
}

export interface EnhancedPromptResult {
  originalContent: string;
  specialistSuggestions?: SpecialistSuggestion[];
  enhancedContent: string;
  routingOptions: string[];
}

interface SpecialistSuggestion {
  specialist_id: string;
  title: string;
  confidence: number;
  reason: string;
  example_query: string;
}

interface WorkflowMetadata {
  name: string;
  domains?: string[];
  category?: string;
  difficulty?: string;
  tags?: string[];
}

export class WorkflowSpecialistRouter {
  private workflowMetadataCache: Map<string, WorkflowMetadata> = new Map();
  private workflowsPath: string;

  constructor(
    private discoveryService: SpecialistDiscoveryService,
    private sessionManager: SpecialistSessionManager,
    private workflowService: WorkflowService
  ) {
    // Initialize path to workflows with backward compatibility
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Prefer workflows/, fall back to methodologies/ for backward compatibility
    const preferredPath = join(__dirname, '../../embedded-knowledge', 'workflows');
    const legacyPath = join(__dirname, '../../embedded-knowledge', 'methodologies');

    if (existsSync(preferredPath)) {
      this.workflowsPath = preferredPath;
    } else if (existsSync(legacyPath)) {
      this.workflowsPath = legacyPath;
    } else {
      this.workflowsPath = preferredPath; // Default, may not exist
    }
  }

  /**
   * Enhance a workflow prompt with specialist routing
   */
  async enhanceWorkflowPrompt(
    workflowType: string,
    userContext: string,
    originalGuidance: string,
    options: EnhancedPromptOptions = {}
  ): Promise<EnhancedPromptResult> {
    const opts = {
      includeSpecialistSuggestions: true,
      maxSpecialistSuggestions: 2,
      includeWorkflowGuidance: true,
      includeExamples: true,
      ...options
    };

    let enhancedContent = originalGuidance;
    const routingOptions: string[] = [];
    let specialistSuggestions: SpecialistSuggestion[] = [];

    // Get specialist suggestions based on workflow context
    if (opts.includeSpecialistSuggestions) {
      const discoveryContext: DiscoveryContext = {
        query: `${workflowType} ${userContext}`,
        current_domain: this.extractDomainFromWorkflow(workflowType)
      };

      const suggestions = await this.discoveryService.suggestSpecialists(
        discoveryContext,
        opts.maxSpecialistSuggestions
      );

      if (suggestions.length > 0) {
        specialistSuggestions = suggestions.map(s => ({
          specialist_id: s.specialist.specialist_id,
          title: s.specialist.title,
          confidence: Math.round(s.confidence * 100),
          reason: s.reasons.join(', ') || 'Good match for this workflow',
          example_query: this.generateExampleQuery(s.specialist, workflowType)
        }));

        // Add specialist routing section to prompt
        enhancedContent += this.buildSpecialistRoutingSection(specialistSuggestions, suggestions, workflowType);
        
        // Add routing options
        specialistSuggestions.forEach(suggestion => {
          routingOptions.push(`**Use MCP tool:** suggest_specialist ${suggestion.specialist_id} (${suggestion.title})`);
        });
      }
    }

    // Add workflow coordination options
    routingOptions.push(`**Use MCP tool:** workflow_next (Get the next workflow action)`);
    routingOptions.push(`**Use MCP tool:** workflow_status (Check workflow progress)`);
    routingOptions.push(`**Use MCP tool:** ask_bc_expert (Get expert advice for specific questions)`);
    routingOptions.push(`**Use MCP tool:** find_bc_knowledge (Search BC knowledge topics)`);

    return {
      originalContent: originalGuidance,
      specialistSuggestions,
      enhancedContent,
      routingOptions
    };
  }

  /**
   * Build specialist routing section for prompts
   */
  private buildSpecialistRoutingSection(
    suggestions: SpecialistSuggestion[],
    fullSuggestions: any[], // The original suggestions with specialist objects
    workflowType: string
  ): string {
    let section = '\n\n## 🎯 START HERE: Use MCP Tools for Specialist Consultation\n\n';
    section += '**IMPORTANT:** You have access to BC Code Intelligence MCP tools. Use them now for expert guidance:\n\n';

    suggestions.forEach((suggestion, index) => {
      // Get emoji from the specialist object in fullSuggestions
      const fullSuggestion = fullSuggestions[index];
      const emoji = fullSuggestion?.specialist?.emoji || '👤';
      section += `### ${emoji} ${suggestion.title} (${suggestion.confidence}% match)\n`;
      section += `**Why this specialist:** ${suggestion.reason}\n\n`;
      section += `**🚀 USE THIS MCP TOOL NOW:**\n`;
      section += `\`\`\`\nsuggest_specialist ${suggestion.specialist_id}\n\`\`\`\n\n`;
      section += `**Example question to ask:** "${suggestion.example_query}"\n\n`;
      section += `---\n\n`;
    });

    section += '## �️ Available MCP Tools for This Workflow\n\n';
    section += '**Specialist Tools (use these for expert consultation):**\n';
    section += '- `ask_bc_expert` - Consult a BC specialist for direct expert guidance\n';
    section += '- `list_specialists` - See all available specialists\n\n';

    section += '**Knowledge Tools (use these for topic research):**\n';
    section += '- `find_bc_knowledge` - Search for BC knowledge topics\n';
    section += '- `get_bc_topic` - Get detailed content for specific topics\n\n';
    
    section += '**Workflow Tools (use these for systematic approach):**\n';
    section += '- `workflow_next` - Get the next action in the workflow\n';
    section += '- `workflow_status` - Check workflow progress\n';
    section += '- `workflow_progress` - Report action completion\n\n';

    section += '### � External MCP Tool Discovery\n\n';
    section += '**IMPORTANT:** Before proceeding with BC operations, check if there are relevant MCP tools from other servers available:\n\n';
    section += '- **Object creation/ID assignment** → Look for `al-objid-mcp-server` (Object ID Ninja)\n';
    section += '- **Dependency analysis** → Look for `AL-Dependency-MCP-Server` \n';
    section += '- **Code generation, debugging, testing** → Check for any specialized AL/BC MCP servers\n\n';
    section += 'Use these external tools when available rather than manual approaches for better accuracy and automation.\n\n';

    section += '### �💡 How to Proceed Effectively\n\n';
    section += '1. **Start with specialists:** Use `ask_bc_expert` for one of the recommended specialists above\n';
    section += '2. **Get specific knowledge:** Use `find_bc_knowledge` to research specific BC topics\n';
    section += '3. **Follow systematic approach:** Use `workflow_next` for step-by-step guidance\n';
    section += '4. **Ask targeted questions:** Be specific about your BC development challenges\n\n';

    return section;
  }

  /**
   * Generate example query for specialist in workflow context
   */
  private generateExampleQuery(specialist: any, workflowType: string): string {
    const workflowContext = this.getWorkflowContext(workflowType);
    const examples = {
      'dean-debug': `Help me analyze ${workflowContext} performance bottlenecks`,
      'eva-errors': `Review ${workflowContext} error handling patterns`,
      'alex-architect': `Design architecture for ${workflowContext}`,
      'sam-coder': `Implement best practices for ${workflowContext}`,
      'quinn-tester': `Create testing strategy for ${workflowContext}`,
      'seth-security': `Secure ${workflowContext} implementation`,
      'uma-ux': `Improve user experience in ${workflowContext}`,
      'jordan-bridge': `Design integrations for ${workflowContext}`,
      'logan-legacy': `Modernize legacy code in ${workflowContext}`,
      'roger-reviewer': `Review code quality in ${workflowContext}`,
      'maya-mentor': `Learn best practices for ${workflowContext}`,
      'taylor-docs': `Document ${workflowContext} solution`,
      'lena-pipe': `Get CI/CD pipeline guidance for ${workflowContext}`,
      'victor-versioning': `Get version upgrade guidance for ${workflowContext}`,
      'morgan-market': `Prepare ${workflowContext} for AppSource`
    };

    return examples[specialist.specialist_id] || `Help me with ${workflowContext}`;
  }

  /**
   * Extract domain from workflow type
   *
   * Dynamically queries workflow metadata from methodology files instead of using hardcoded maps.
   * This allows domain mappings to be maintained in workflow frontmatter where they belong.
   *
   * @param workflowType - The workflow type to extract domain for
   * @returns Primary domain for the workflow, or 'general' if not found
   */
  private extractDomainFromWorkflow(workflowType: string): string {
    try {
      const metadata = this.getWorkflowMetadata(workflowType);

      // Return first domain from metadata if available
      if (metadata?.domains && metadata.domains.length > 0) {
        return metadata.domains[0];
      }

      // Fallback: try to derive from category
      if (metadata?.category) {
        return metadata.category;
      }
    } catch (error) {
      // If metadata loading fails, fall through to fallback
      console.error(`Failed to load workflow metadata for ${workflowType}:`, error);
    }

    // Fallback to general if no metadata found
    // This ensures the service continues to work even if workflow files are missing
    return 'general';
  }

  /**
   * Get workflow metadata by querying methodology files
   *
   * Loads and parses workflow markdown files to extract frontmatter metadata.
   * Results are cached for performance.
   *
   * @param workflowType - The workflow type identifier
   * @returns Workflow metadata or null if not found
   */
  private getWorkflowMetadata(workflowType: string): WorkflowMetadata | null {
    // Check cache first
    if (this.workflowMetadataCache.has(workflowType)) {
      return this.workflowMetadataCache.get(workflowType) || null;
    }

    // Try to load from workflow file
    const metadata = this.loadWorkflowMetadataFromFile(workflowType);

    if (metadata) {
      this.workflowMetadataCache.set(workflowType, metadata);
    }

    return metadata;
  }

  /**
   * Load workflow metadata from markdown file frontmatter
   *
   * Parses the YAML frontmatter from workflow markdown files to extract metadata.
   *
   * @param workflowType - The workflow type identifier
   * @returns Parsed workflow metadata or null if file not found
   */
  private loadWorkflowMetadataFromFile(workflowType: string): WorkflowMetadata | null {
    try {
      // Convert workflow type to filename (e.g., 'review-bc-code' -> 'bc-code-review-workflow.md')
      // Try multiple potential filename patterns
      const potentialFilenames = [
        `${workflowType}-workflow.md`,
        `bc-${workflowType}-workflow.md`,
        `${workflowType.replace('bc-', '')}-workflow.md`
      ];

      for (const filename of potentialFilenames) {
        const filePath = join(this.workflowsPath, filename);

        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          return this.parseFrontmatter(content);
        }
      }

      return null;
    } catch (error) {
      console.error(`Error loading workflow metadata for ${workflowType}:`, error);
      return null;
    }
  }

  /**
   * Parse YAML frontmatter from markdown content
   *
   * Extracts and parses the YAML frontmatter block from markdown files.
   * Simple parser that handles basic YAML arrays and key-value pairs.
   *
   * @param content - The markdown file content
   * @returns Parsed metadata object
   */
  private parseFrontmatter(content: string): WorkflowMetadata | null {
    // Match YAML frontmatter between --- markers
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) {
      return null;
    }

    const frontmatterText = frontmatterMatch[1];
    const metadata: WorkflowMetadata = { name: '' };

    // Simple YAML parser for our needs
    const lines = frontmatterText.split('\n');

    for (const line of lines) {
      // Handle array values like: domains: [quality-assurance, performance, security]
      const arrayMatch = line.match(/^(\w+):\s*\[(.*?)\]/);
      if (arrayMatch) {
        const key = arrayMatch[1];
        const values = arrayMatch[2].split(',').map(v => v.trim());

        if (key === 'domains' || key === 'tags') {
          (metadata as any)[key] = values;
        }
        continue;
      }

      // Handle simple key-value pairs like: category: quality-assurance
      const kvMatch = line.match(/^(\w+):\s*(.+?)$/);
      if (kvMatch) {
        const key = kvMatch[1];
        const value = kvMatch[2].trim().replace(/['"]/g, '');

        if (key === 'name' || key === 'category' || key === 'difficulty') {
          (metadata as any)[key] = value;
        }
      }
    }

    return metadata;
  }

  /**
   * Get workflow context description
   */
  private getWorkflowContext(workflowType: string): string {
    const contextMap: Record<string, string> = {
      'new-bc-app': 'new BC app development',
      'enhance-bc-app': 'BC app enhancement', 
      'upgrade-bc-version': 'BC version upgrade',
      'add-ecosystem-features': 'ecosystem integration',
      'debug-bc-issues': 'BC debugging',
      'document-bc-solution': 'solution documentation',
      'modernize-bc-code': 'code modernization',
      'onboard-developer': 'developer onboarding',
      'review-bc-code': 'code review'
    };

    return contextMap[workflowType] || 'this workflow';
  }
}