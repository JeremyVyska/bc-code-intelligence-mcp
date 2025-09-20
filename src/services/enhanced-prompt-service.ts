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
        enhancedContent += this.buildSpecialistRoutingSection(specialistSuggestions, workflowType);
        
        // Add routing options
        specialistSuggestions.forEach(suggestion => {
          routingOptions.push(`🎯 Start session with ${suggestion.title}: suggest_specialist ${suggestion.specialist_id}`);
        });
      }
    }

    // Add workflow coordination options
    routingOptions.push(`🔄 Continue with systematic workflow: advance_workflow`);
    routingOptions.push(`📋 Get current workflow status: get_workflow_status`);

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
    workflowType: string
  ): string {
    let section = '\n\n## 🎯 Recommended Specialists\n\n';
    section += 'Based on your workflow, these specialists can provide targeted expertise:\n\n';

    suggestions.forEach((suggestion, index) => {
      const emoji = this.getSpecialistEmoji(suggestion.specialist_id);
      section += `**${index + 1}. ${emoji} ${suggestion.title}** (${suggestion.confidence}% match)\n`;
      section += `   💡 **Why:** ${suggestion.reason}\n`;
      section += `   💬 **Try asking:** "${suggestion.example_query}"\n`;
      section += `   🎯 **Start session:** \`suggest_specialist ${suggestion.specialist_id}\`\n\n`;
    });

    section += '### 🚀 How to Proceed\n\n';
    section += '1. **For targeted expertise:** Use `suggest_specialist [specialist-id]` to start a focused session\n';
    section += '2. **For systematic approach:** Continue with the workflow using `advance_workflow`\n';
    section += '3. **For exploration:** Ask "discover specialists for [your specific question]"\n\n';

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
      'workflow_code_optimization': 'performance',
      'workflow_architecture_review': 'architecture', 
      'workflow_security_audit': 'security',
      'workflow_performance_analysis': 'performance',
      'workflow_integration_design': 'api-design',
      'workflow_upgrade_planning': 'architecture',
      'workflow_testing_strategy': 'testing',
      'workflow_new_developer_onboarding': 'best-practices',
      'workflow_pure_review': 'code-quality'
    };

    return domainMap[workflowType] || 'general';
  }

  /**
   * Get workflow context description
   */
  private getWorkflowContext(workflowType: string): string {
    const contextMap: Record<string, string> = {
      'workflow_code_optimization': 'code optimization',
      'workflow_architecture_review': 'architecture review', 
      'workflow_security_audit': 'security audit',
      'workflow_performance_analysis': 'performance analysis',
      'workflow_integration_design': 'integration design',
      'workflow_upgrade_planning': 'upgrade planning',
      'workflow_testing_strategy': 'testing strategy',
      'workflow_new_developer_onboarding': 'developer onboarding',
      'workflow_pure_review': 'code review'
    };

    return contextMap[workflowType] || 'this workflow';
  }

  /**
   * Get emoji for specialist
   */
  private getSpecialistEmoji(specialistId: string): string {
    const emojiMap: Record<string, string> = {
      'dean-debug': '🔍',
      'eva-errors': '⚠️',
      'alex-architect': '🏗️',
      'sam-coder': '💻',
      'quinn-tester': '🧪',
      'seth-security': '🔒',
      'uma-ux': '🎨',
      'jordan-bridge': '🌉',
      'logan-legacy': '🏛️',
      'roger-reviewer': '📝',
      'maya-mentor': '👩‍🏫',
      'taylor-docs': '📚',
      'casey-copilot': '🤖',
      'morgan-market': '🏪'
    };

    return emojiMap[specialistId] || '👤';
  }
}