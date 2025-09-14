/**
 * GitHub Copilot Integration for BCKB Knowledge Base
 *
 * Provides contextual Business Central knowledge and recommendations
 * directly within GitHub Copilot Chat for enhanced AL development.
 */

import { BCKBClient, BCKBClientDefaults } from '../../src/sdk/bckb-client.js';

// GitHub Copilot Chat API types (simplified)
interface CopilotChatRequest {
  prompt: string;
  language?: string;
  context?: {
    selection?: string;
    activeFile?: {
      fileName: string;
      content: string;
    };
  };
}

interface CopilotChatResponse {
  content: string;
  suggestions?: Array<{
    title: string;
    description: string;
    code?: string;
  }>;
  references?: Array<{
    title: string;
    url: string;
    description: string;
  }>;
}

export class BCKBCopilotIntegration {
  private client: BCKBClient;
  private contextCache = new Map<string, any>();
  private lastAnalysis: any = null;

  constructor(serverPath?: string) {
    const config = BCKBClientDefaults.local(serverPath);
    config.cache_enabled = true;
    config.cache_ttl_seconds = 600; // 10 minutes
    config.debug_logging = false;

    this.client = new BCKBClient(config);
  }

  /**
   * Initialize connection to BCKB server
   */
  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      console.log('🤖 BCKB Copilot integration initialized');
    } catch (error) {
      console.error('❌ Failed to initialize BCKB Copilot integration:', error);
      throw error;
    }
  }

  /**
   * Main Copilot Chat handler for BCKB queries
   */
  async handleCopilotChat(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    try {
      const prompt = request.prompt.toLowerCase();

      // Route different types of requests
      if (prompt.includes('search') || prompt.includes('find')) {
        return await this.handleSearchRequest(request);
      } else if (prompt.includes('analyze') || prompt.includes('review')) {
        return await this.handleAnalysisRequest(request);
      } else if (prompt.includes('optimize') || prompt.includes('performance')) {
        return await this.handleOptimizationRequest(request);
      } else if (prompt.includes('recommend') || prompt.includes('suggest')) {
        return await this.handleRecommendationRequest(request);
      } else if (prompt.includes('explain') || prompt.includes('help')) {
        return await this.handleExplanationRequest(request);
      } else {
        return await this.handleGeneralRequest(request);
      }

    } catch (error) {
      return {
        content: `❌ Error processing BCKB request: ${error instanceof Error ? error.message : String(error)}. Please try again or check your BCKB server connection.`
      };
    }
  }

  /**
   * Handle search requests from Copilot
   */
  private async handleSearchRequest(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const searchQuery = this.extractSearchQuery(request.prompt);

    const searchOptions = {
      limit: 5,
      include_layer_info: true
    };

    // Add context if AL file is active
    if (request.context?.activeFile?.fileName.endsWith('.al')) {
      searchOptions['user_context'] = {
        current_domain: this.extractDomainFromCode(request.context.activeFile.content),
        project_type: 'maintenance'
      };
    }

    const results = await this.client.smartSearch(searchQuery, searchOptions);

    if (results.length === 0) {
      return {
        content: `🔍 No results found for "${searchQuery}". Try different keywords or broader terms.`
      };
    }

    const content = this.formatSearchResults(results);
    const suggestions = results.slice(0, 3).map(topic => ({
      title: topic.title,
      description: `${topic.domain} | ${topic.difficulty} | ${topic.tags.slice(0, 3).join(', ')}`,
      code: topic.samples?.code
    }));

    const references = results.map(topic => ({
      title: topic.title,
      url: `bckb://topic/${topic.id}`,
      description: topic.summary || topic.content.substring(0, 150) + '...'
    }));

    return { content, suggestions, references };
  }

  /**
   * Handle code analysis requests
   */
  private async handleAnalysisRequest(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const code = request.context?.selection || request.context?.activeFile?.content;

    if (!code) {
      return {
        content: '⚠️  Please select some AL code or have an AL file open for analysis.'
      };
    }

    const analysis = await this.client.analyzeCode({
      code_snippet: code,
      analysis_type: 'general',
      suggest_topics: true
    });

    this.lastAnalysis = analysis;

    const content = this.formatAnalysisResults(analysis);
    const suggestions = this.generateAnalysisSuggestions(analysis);
    const references = this.generateAnalysisReferences(analysis);

    return { content, suggestions, references };
  }

  /**
   * Handle optimization requests
   */
  private async handleOptimizationRequest(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const scenario = this.extractOptimizationScenario(request.prompt);
    const constraints = this.extractConstraints(request.prompt);

    const workflow = await this.client.getOptimizationWorkflow(scenario, constraints);

    const content = this.formatOptimizationWorkflow(workflow);
    const suggestions = workflow.workflow?.steps?.slice(0, 3).map((step: any) => ({
      title: step.title,
      description: step.description,
      code: step.example_code || undefined
    })) || [];

    const references = workflow.workflow?.learning_path?.map((topicId: string) => ({
      title: topicId,
      url: `bckb://topic/${topicId}`,
      description: `Learn more about ${topicId}`
    })) || [];

    return { content, suggestions, references };
  }

  /**
   * Handle recommendation requests
   */
  private async handleRecommendationRequest(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const context = this.buildUserContext(request);

    // Get current file context for recommendations
    const currentCode = request.context?.activeFile?.content || '';
    const domain = this.extractDomainFromCode(currentCode);

    const searchResults = await this.client.smartSearch(`domain:${domain}`, {
      limit: 5,
      user_context: context
    });

    const content = `🎯 **Recommendations for ${domain} development:**\n\n` +
      searchResults.map((topic, index) =>
        `${index + 1}. **${topic.title}** (${topic.difficulty})\n` +
        `   ${topic.summary}\n` +
        `   Relevance: ${(topic.relevance_score * 100).toFixed(0)}%\n`
      ).join('\n');

    const suggestions = searchResults.map(topic => ({
      title: topic.title,
      description: `${topic.domain} | ${topic.difficulty}`,
      code: topic.samples?.code
    }));

    return { content, suggestions };
  }

  /**
   * Handle explanation requests
   */
  private async handleExplanationRequest(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    const concept = this.extractConcept(request.prompt);

    const searchResults = await this.client.searchTopics(concept, {
      difficulty: 'beginner',
      limit: 3
    });

    if (searchResults.length === 0) {
      return {
        content: `❓ I couldn't find specific information about "${concept}" in the BCKB knowledge base. Try searching for related terms or check the available topics.`
      };
    }

    const bestMatch = searchResults[0];
    const content = `📚 **${bestMatch.title}**\n\n${bestMatch.content}\n\n` +
      `**Prerequisites:** ${bestMatch.prerequisites.join(', ') || 'None'}\n` +
      `**Estimated Time:** ${bestMatch.estimated_time || 'Variable'}\n` +
      `**Tags:** ${bestMatch.tags.join(', ')}`;

    const suggestions = searchResults.slice(1).map(topic => ({
      title: topic.title,
      description: topic.summary,
      code: topic.samples?.code
    }));

    return { content, suggestions };
  }

  /**
   * Handle general requests
   */
  private async handleGeneralRequest(request: CopilotChatRequest): Promise<CopilotChatResponse> {
    // Try to understand intent and provide relevant information
    const keywords = this.extractKeywords(request.prompt);
    const searchQuery = keywords.join(' ');

    const results = await this.client.smartSearch(searchQuery, { limit: 3 });

    if (results.length === 0) {
      return {
        content: `🤷‍♀️ I'm not sure how to help with that specific request. Try asking about:\n` +
          `• Searching for BC topics: "search for SIFT optimization"\n` +
          `• Code analysis: "analyze this AL code"\n` +
          `• Optimization: "optimize report performance"\n` +
          `• Recommendations: "recommend topics for data handling"\n` +
          `• Explanations: "explain flowfields"`
      };
    }

    const content = `🎯 Based on your query, here are relevant BC knowledge topics:\n\n` +
      results.map((topic, index) =>
        `${index + 1}. **${topic.title}**\n   ${topic.summary}\n`
      ).join('\n');

    return { content };
  }

  // Helper methods for formatting responses

  private formatSearchResults(results: any[]): string {
    return `🔍 **Found ${results.length} relevant topics:**\n\n` +
      results.map((topic, index) => {
        const layerInfo = topic.layer_info ? ` (from ${topic.layer_info.source_layer})` : '';
        const relevanceReasons = topic.relevance_reasons ?
          `\n   💡 ${topic.relevance_reasons.join(', ')}` : '';

        return `${index + 1}. **${topic.title}**${layerInfo}\n` +
               `   Domain: ${topic.domain} | Difficulty: ${topic.difficulty}\n` +
               `   Tags: ${topic.tags.slice(0, 4).join(', ')}\n` +
               `   ${topic.summary}${relevanceReasons}\n`;
      }).join('\n');
  }

  private formatAnalysisResults(analysis: any): string {
    let content = '🔍 **Code Analysis Results:**\n\n';

    if (analysis.issues && analysis.issues.length > 0) {
      content += `⚠️  **Issues Found (${analysis.issues.length}):**\n`;
      analysis.issues.slice(0, 5).forEach((issue: any, index: number) => {
        const severityEmoji = {
          'critical': '🚨',
          'high': '⚠️',
          'medium': '💡',
          'low': 'ℹ️'
        }[issue.severity] || '❓';

        content += `${index + 1}. ${severityEmoji} **${issue.type}** (${issue.severity})\n`;
        content += `   ${issue.description}\n`;
        content += `   💡 ${issue.suggestion}\n\n`;
      });
    }

    if (analysis.patterns_detected && analysis.patterns_detected.length > 0) {
      content += `🔎 **Patterns Detected:**\n`;
      analysis.patterns_detected.forEach((pattern: string) => {
        content += `• ${pattern}\n`;
      });
      content += '\n';
    }

    if (analysis.optimization_opportunities && analysis.optimization_opportunities.length > 0) {
      content += `⚡ **Optimization Opportunities:**\n`;
      analysis.optimization_opportunities.slice(0, 3).forEach((opp: any, index: number) => {
        content += `${index + 1}. ${opp.description}\n`;
        content += `   Impact: ${opp.impact} | Difficulty: ${opp.difficulty}\n\n`;
      });
    }

    return content;
  }

  private formatOptimizationWorkflow(workflow: any): string {
    if (!workflow.workflow) {
      return '❓ No specific optimization workflow found for this scenario.';
    }

    const w = workflow.workflow;
    let content = `🚀 **Optimization Workflow for: ${workflow.scenario}**\n\n`;

    if (w.steps && w.steps.length > 0) {
      content += '📋 **Steps:**\n';
      w.steps.forEach((step: any) => {
        content += `${step.step_number}. **${step.title}**\n`;
        content += `   ${step.description}\n`;
        content += `   ⏱️ Estimated time: ${step.estimated_time}\n`;
        if (step.related_topics && step.related_topics.length > 0) {
          content += `   📚 Related topics: ${step.related_topics.join(', ')}\n`;
        }
        content += '\n';
      });
    }

    if (w.success_metrics && w.success_metrics.length > 0) {
      content += '🎯 **Success Metrics:**\n';
      w.success_metrics.forEach((metric: string) => {
        content += `• ${metric}\n`;
      });
      content += '\n';
    }

    if (w.common_pitfalls && w.common_pitfalls.length > 0) {
      content += '⚠️  **Common Pitfalls to Avoid:**\n';
      w.common_pitfalls.forEach((pitfall: string) => {
        content += `• ${pitfall}\n`;
      });
    }

    return content;
  }

  private generateAnalysisSuggestions(analysis: any): Array<{title: string, description: string, code?: string}> {
    const suggestions = [];

    if (analysis.suggested_topics && analysis.suggested_topics.length > 0) {
      suggestions.push(...analysis.suggested_topics.slice(0, 3).map((topic: any) => ({
        title: `Learn: ${topic.title}`,
        description: `${topic.difficulty} level topic in ${topic.domain}`,
        code: topic.samples?.code
      })));
    }

    if (analysis.optimization_opportunities && analysis.optimization_opportunities.length > 0) {
      suggestions.push(...analysis.optimization_opportunities.slice(0, 2).map((opp: any) => ({
        title: `Optimize: ${opp.description}`,
        description: `${opp.impact} impact, ${opp.difficulty} difficulty`,
        code: opp.example_code
      })));
    }

    return suggestions;
  }

  private generateAnalysisReferences(analysis: any): Array<{title: string, url: string, description: string}> {
    const references = [];

    if (analysis.suggested_topics) {
      references.push(...analysis.suggested_topics.map((topic: any) => ({
        title: topic.title,
        url: `bckb://topic/${topic.id}`,
        description: topic.summary || `${topic.difficulty} level topic in ${topic.domain}`
      })));
    }

    return references;
  }

  // Utility methods for parsing requests

  private extractSearchQuery(prompt: string): string {
    // Simple extraction - could be enhanced with NLP
    const searchTerms = prompt
      .replace(/search|find|look for|show me/gi, '')
      .replace(/about|for|on/gi, '')
      .trim();

    return searchTerms || 'business central';
  }

  private extractOptimizationScenario(prompt: string): string {
    // Extract scenario from optimization request
    const scenarios = prompt
      .replace(/optimize|optimization|improve|performance/gi, '')
      .trim();

    return scenarios || 'general performance';
  }

  private extractConstraints(prompt: string): string[] {
    // Extract constraints from prompt
    const constraints = [];

    if (prompt.includes('memory')) constraints.push('memory limitations');
    if (prompt.includes('time')) constraints.push('time constraints');
    if (prompt.includes('legacy')) constraints.push('legacy system compatibility');

    return constraints;
  }

  private extractConcept(prompt: string): string {
    // Extract concept to explain
    return prompt
      .replace(/explain|what is|help me understand|tell me about/gi, '')
      .trim() || 'business central concepts';
  }

  private extractKeywords(prompt: string): string[] {
    // Simple keyword extraction
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'when', 'where', 'why'];

    return prompt
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !commonWords.includes(word))
      .slice(0, 5);
  }

  private extractDomainFromCode(code: string): string {
    const lowerCode = code.toLowerCase();

    if (lowerCode.includes('table') || lowerCode.includes('record')) return 'data';
    if (lowerCode.includes('page') || lowerCode.includes('card')) return 'ui';
    if (lowerCode.includes('codeunit')) return 'logic';
    if (lowerCode.includes('report')) return 'reporting';
    if (lowerCode.includes('xmlport')) return 'integration';
    if (lowerCode.includes('query')) return 'analytics';

    return 'general';
  }

  private buildUserContext(request: CopilotChatRequest): any {
    return {
      current_domain: request.context?.activeFile?.fileName ?
        this.extractDomainFromCode(request.context.activeFile.content) : 'general',
      project_type: 'maintenance', // Could be inferred from git history, etc.
      difficulty_preference: 'intermediate'
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    await this.client.disconnect();
    this.contextCache.clear();
  }
}

/**
 * Register BCKB integration with GitHub Copilot
 * This would be called by the Copilot extension framework
 */
export function registerBCKBIntegration(): BCKBCopilotIntegration {
  const integration = new BCKBCopilotIntegration();

  // Initialize in background
  integration.initialize().catch(error => {
    console.error('Failed to initialize BCKB Copilot integration:', error);
  });

  return integration;
}

/**
 * Copilot Chat participant configuration
 */
export const BCKBCopilotParticipant = {
  name: 'bckb',
  description: 'Business Central Knowledge Base assistant for AL development',

  // Available slash commands
  slashCommands: [
    {
      name: 'search',
      description: 'Search BCKB knowledge base',
      usage: '/bckb search <query>'
    },
    {
      name: 'analyze',
      description: 'Analyze AL code for issues and recommendations',
      usage: '/bckb analyze'
    },
    {
      name: 'optimize',
      description: 'Get optimization recommendations',
      usage: '/bckb optimize <scenario>'
    },
    {
      name: 'explain',
      description: 'Explain BC concepts and features',
      usage: '/bckb explain <concept>'
    },
    {
      name: 'status',
      description: 'Check BCKB server status',
      usage: '/bckb status'
    }
  ],

  // Context variables that can be referenced
  variables: [
    {
      name: 'currentFile',
      description: 'Currently active AL file'
    },
    {
      name: 'selection',
      description: 'Currently selected code'
    },
    {
      name: 'lastAnalysis',
      description: 'Results from last code analysis'
    }
  ]
};