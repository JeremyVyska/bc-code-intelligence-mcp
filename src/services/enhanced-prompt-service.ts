/**
 * Enhanced Prompt Service
 * 
 * Enhances MCP prompts with specialist routing and intelligent guidance.
 * Integrates specialist discovery with workflow prompts for better user experience.
 */

import { SpecialistDiscoveryService, DiscoveryContext } from './specialist-discovery.js';
import { SpecialistSessionManager } from './specialist-session-manager.js';
import { WorkflowService } from './workflow-service.js';

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

export class EnhancedPromptService {
  constructor(
    private discoveryService: SpecialistDiscoveryService,
    private sessionManager: SpecialistSessionManager,
    private workflowService: WorkflowService
  ) {}

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
    routingOptions.push(`**Use MCP tool:** advance_workflow (Continue systematic workflow)`);
    routingOptions.push(`**Use MCP tool:** get_workflow_help (Get workflow help)`);
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
    section += '- `suggest_specialist [specialist-id]` - Get advice from a specific specialist\n';
    section += '- `discover_specialists` - Find specialists for your specific question\n';
    section += '- `browse_specialists` - See all available specialists by domain\n\n';
    
    section += '**Knowledge Tools (use these for topic research):**\n';
    section += '- `find_bc_knowledge` - Search for BC knowledge topics\n';
    section += '- `get_bc_topic` - Get detailed content for specific topics\n\n';
    
    section += '**Workflow Tools (use these for systematic approach):**\n';
    section += '- `advance_workflow` - Continue with systematic workflow steps\n';
    section += '- `get_workflow_help` - Get help with workflow steps\n\n';

    section += '### � External MCP Tool Discovery\n\n';
    section += '**IMPORTANT:** Before proceeding with BC operations, check if there are relevant MCP tools from other servers available:\n\n';
    section += '- **Object creation/ID assignment** → Look for `al-objid-mcp-server` (Object ID Ninja)\n';
    section += '- **Dependency analysis** → Look for `AL-Dependency-MCP-Server` \n';
    section += '- **Code generation, debugging, testing** → Check for any specialized AL/BC MCP servers\n\n';
    section += 'Use these external tools when available rather than manual approaches for better accuracy and automation.\n\n';

    section += '### �💡 How to Proceed Effectively\n\n';
    section += '1. **Start with specialists:** Use `ask_bc_expert` for one of the recommended specialists above\n';
    section += '2. **Get specific knowledge:** Use `find_bc_knowledge` to research specific BC topics\n';
    section += '3. **Follow systematic approach:** Use `advance_workflow` for step-by-step guidance\n';
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
      'casey-copilot': `Get AI assistance with ${workflowContext}`,
      'morgan-market': `Prepare ${workflowContext} for AppSource`
    };

    return examples[specialist.specialist_id] || `Help me with ${workflowContext}`;
  }

  /**
   * Extract domain from workflow type
   */
  private extractDomainFromWorkflow(workflowType: string): string {
    const domainMap: Record<string, string> = {
      'new-bc-app': 'architecture',
      'enhance-bc-app': 'implementation', 
      'upgrade-bc-version': 'architecture',
      'add-ecosystem-features': 'api-design',
      'debug-bc-issues': 'debugging',
      'document-bc-solution': 'documentation',
      'modernize-bc-code': 'performance',
      'onboard-developer': 'best-practices',
      'review-bc-code': 'code-quality'
    };

    return domainMap[workflowType] || 'general';
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