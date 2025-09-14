/**
 * Claude Desktop Integration for BCKB MCP Server
 *
 * Provides enhanced integration with Claude Desktop including:
 * - Context-aware knowledge retrieval
 * - Smart conversation enhancement
 * - Automated code analysis suggestions
 * - Layered knowledge resolution
 */

import { BCKBClient, BCKBClientConfig, BCKBTopic } from '../../src/sdk/bckb-client.js';
import { EventEmitter } from 'events';

export interface ClaudeIntegrationConfig {
  server_path: string;
  server_args?: string[];
  debug_mode?: boolean;
  context_retention?: number;
  auto_suggestions?: boolean;
  layer_preference?: string[];
  max_context_topics?: number;
}

export interface ConversationContext {
  current_topic?: string;
  mentioned_domains?: string[];
  code_snippets?: string[];
  difficulty_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  project_context?: string;
  recent_searches?: string[];
}

export interface EnhancedResponse {
  original_response: string;
  knowledge_supplements: BCKBTopic[];
  suggested_actions: string[];
  related_resources: string[];
  confidence_score: number;
}

export class ClaudeIntegration extends EventEmitter {
  private client: BCKBClient;
  private conversationContext: ConversationContext = {};
  private knowledgeCache = new Map<string, BCKBTopic[]>();
  private analysisQueue: string[] = [];

  constructor(private readonly config: ClaudeIntegrationConfig) {
    super();

    const clientConfig: BCKBClientConfig = {
      server_command: config.server_path,
      server_args: config.server_args || ['dist/index.js'],
      auto_reconnect: true,
      request_timeout_ms: 15000,
      cache_enabled: true,
      cache_ttl_seconds: 900, // 15 minutes
      debug_logging: config.debug_mode || false
    };

    this.client = new BCKBClient(clientConfig);

    // Set up automatic connection monitoring
    this.setupConnectionHandling();
  }

  /**
   * Initialize the Claude Desktop integration
   */
  async initialize(): Promise<void> {
    try {
      await this.client.connect();

      // Verify server health
      const health = await this.client.healthCheck();
      if (!health.healthy) {
        throw new Error(`BCKB server unhealthy: ${health.error}`);
      }

      this.emit('initialized', { healthy: health.healthy, latency: health.latency_ms });

      if (this.config.debug_mode) {
        console.log('🚀 Claude Desktop BCKB integration initialized successfully');
      }

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize Claude integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enhance Claude's response with relevant BC knowledge
   */
  async enhanceConversation(
    userMessage: string,
    claudeResponse: string,
    context?: Partial<ConversationContext>
  ): Promise<EnhancedResponse> {

    // Update conversation context
    this.updateContext(userMessage, context);

    try {
      // Extract BC-related content from the conversation
      const bcContent = this.extractBusinessCentralContent(userMessage + ' ' + claudeResponse);

      if (bcContent.length === 0) {
        return {
          original_response: claudeResponse,
          knowledge_supplements: [],
          suggested_actions: [],
          related_resources: [],
          confidence_score: 0
        };
      }

      // Search for relevant knowledge
      const knowledge = await this.findRelevantKnowledge(bcContent);

      // Generate suggestions based on context
      const suggestions = await this.generateSuggestions(knowledge, bcContent);

      // Calculate confidence score
      const confidence = this.calculateConfidence(knowledge, bcContent);

      return {
        original_response: claudeResponse,
        knowledge_supplements: knowledge.slice(0, this.config.max_context_topics || 5),
        suggested_actions: suggestions,
        related_resources: this.extractRelatedResources(knowledge),
        confidence_score: confidence
      };

    } catch (error) {
      this.emit('error', error);

      // Return graceful fallback
      return {
        original_response: claudeResponse,
        knowledge_supplements: [],
        suggested_actions: ['Check BCKB server connection'],
        related_resources: [],
        confidence_score: 0
      };
    }
  }

  /**
   * Analyze code snippets mentioned in conversation
   */
  async analyzeCodeInContext(codeSnippet: string): Promise<any> {
    try {
      // Add to analysis queue for batch processing
      this.analysisQueue.push(codeSnippet);

      const analysis = await this.client.analyzeCode({
        code_snippet: codeSnippet,
        analysis_type: 'general',
        suggest_topics: true,
        bc_version: this.inferBCVersion()
      });

      // Update context based on analysis
      this.updateContextFromAnalysis(analysis);

      return {
        ...analysis,
        contextual_suggestions: await this.getContextualSuggestions(analysis.suggested_topics)
      };

    } catch (error) {
      this.emit('error', error);
      return { error: 'Code analysis failed', details: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get proactive suggestions based on conversation flow
   */
  async getProactiveSuggestions(): Promise<string[]> {
    if (!this.config.auto_suggestions) return [];

    try {
      const suggestions: string[] = [];

      // Domain-based suggestions
      if (this.conversationContext.mentioned_domains) {
        for (const domain of this.conversationContext.mentioned_domains.slice(0, 2)) {
          const topics = await this.client.searchTopics(`domain:${domain}`, { limit: 3 });
          if (topics.length > 0) {
            suggestions.push(`Explore ${domain} fundamentals: ${topics[0].title}`);
          }
        }
      }

      // Code-based suggestions
      if (this.conversationContext.code_snippets && this.conversationContext.code_snippets.length > 0) {
        suggestions.push('Run code analysis for optimization opportunities');
        suggestions.push('Check related AL patterns and best practices');
      }

      // Learning progression suggestions
      if (this.conversationContext.difficulty_level && this.conversationContext.current_topic) {
        const nextLevel = this.getNextDifficultyLevel(this.conversationContext.difficulty_level);
        if (nextLevel) {
          suggestions.push(`Ready for ${nextLevel} topics on ${this.conversationContext.current_topic}`);
        }
      }

      return suggestions.slice(0, 3); // Limit to 3 suggestions

    } catch (error) {
      this.emit('error', error);
      return [];
    }
  }

  /**
   * Search knowledge with conversation context
   */
  async contextualSearch(query: string): Promise<BCKBTopic[]> {
    try {
      const searchOptions = {
        limit: 10,
        domain: this.conversationContext.mentioned_domains?.[0],
        difficulty: this.conversationContext.difficulty_level,
        bc_version: this.inferBCVersion()
      };

      // Use smart search if available
      const results = await this.client.smartSearch(query, {
        ...searchOptions,
        user_context: {
          current_domain: this.conversationContext.mentioned_domains?.[0],
          difficulty_preference: this.conversationContext.difficulty_level,
          recent_topics: this.conversationContext.recent_searches,
          project_type: this.inferProjectType()
        },
        layer_filter: this.config.layer_preference,
        include_layer_info: true
      });

      // Cache results for quick follow-up
      this.knowledgeCache.set(query, results);

      return results;

    } catch (error) {
      // Fallback to regular search
      return this.client.searchTopics(query, { limit: 10 });
    }
  }

  /**
   * Get integration status and health
   */
  async getIntegrationStatus(): Promise<any> {
    try {
      const [health, status] = await Promise.all([
        this.client.healthCheck(),
        this.client.getSystemStatus()
      ]);

      return {
        integration_health: health.healthy ? 'connected' : 'disconnected',
        server_status: status,
        context_state: {
          active_domains: this.conversationContext.mentioned_domains?.length || 0,
          code_snippets_analyzed: this.analysisQueue.length,
          cached_searches: this.knowledgeCache.size,
          current_difficulty: this.conversationContext.difficulty_level
        },
        performance: {
          response_time_ms: health.latency_ms,
          cache_hit_rate: status.cache_hit_rate
        }
      };

    } catch (error) {
      return {
        integration_health: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    try {
      await this.client.disconnect();
      this.knowledgeCache.clear();
      this.analysisQueue.length = 0;
      this.conversationContext = {};

      this.emit('shutdown');

    } catch (error) {
      this.emit('error', error);
    }
  }

  // Private helper methods

  private setupConnectionHandling(): void {
    this.client.on('connected', () => {
      this.emit('connected');
    });

    this.client.on('disconnected', () => {
      this.emit('disconnected');
    });

    this.client.on('error', (error) => {
      this.emit('error', error);
    });
  }

  private updateContext(userMessage: string, context?: Partial<ConversationContext>): void {
    // Extract domains mentioned
    const domains = this.extractDomains(userMessage);
    if (domains.length > 0) {
      this.conversationContext.mentioned_domains = [
        ...(this.conversationContext.mentioned_domains || []),
        ...domains
      ].slice(-5); // Keep last 5 domains
    }

    // Extract code snippets
    const codeSnippets = this.extractCodeSnippets(userMessage);
    if (codeSnippets.length > 0) {
      this.conversationContext.code_snippets = [
        ...(this.conversationContext.code_snippets || []),
        ...codeSnippets
      ].slice(-3); // Keep last 3 snippets
    }

    // Apply provided context
    if (context) {
      Object.assign(this.conversationContext, context);
    }
  }

  private extractBusinessCentralContent(text: string): string[] {
    const bcKeywords = [
      'Business Central', 'AL', 'Dynamics 365', 'NAV', 'ERP',
      'codeunit', 'table', 'page', 'report', 'xmlport', 'query',
      'extension', 'AppSource', 'PTE', 'per-tenant'
    ];

    const content: string[] = [];
    const lowercaseText = text.toLowerCase();

    bcKeywords.forEach(keyword => {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        // Extract sentence containing the keyword
        const sentences = text.split(/[.!?]+/);
        const relevantSentences = sentences.filter(sentence =>
          sentence.toLowerCase().includes(keyword.toLowerCase())
        );
        content.push(...relevantSentences.map(s => s.trim()).filter(s => s.length > 10));
      }
    });

    return [...new Set(content)]; // Remove duplicates
  }

  private extractDomains(text: string): string[] {
    const domainPatterns = [
      /\b(sales|purchase|inventory|finance|manufacturing|service|warehouse)\b/gi,
      /\b(posting|dimension|vat|tax|currency|bank|ledger)\b/gi,
      /\b(integration|api|web service|odata|powerbi)\b/gi
    ];

    const domains: string[] = [];
    domainPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        domains.push(...matches.map(m => m.toLowerCase()));
      }
    });

    return [...new Set(domains)];
  }

  private extractCodeSnippets(text: string): string[] {
    const codePatterns = [
      /```[\s\S]*?```/g,
      /`[^`\n]+`/g,
      /\b(procedure|trigger|var|begin|end|if|then|else)\b/gi
    ];

    const snippets: string[] = [];
    codePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        snippets.push(...matches.filter(match => match.length > 5));
      }
    });

    return snippets;
  }

  private async findRelevantKnowledge(bcContent: string[]): Promise<BCKBTopic[]> {
    const allTopics: BCKBTopic[] = [];

    for (const content of bcContent.slice(0, 3)) { // Limit to 3 content pieces
      try {
        const topics = await this.contextualSearch(content);
        allTopics.push(...topics.slice(0, 2)); // Max 2 topics per content
      } catch (error) {
        // Continue with other content if one search fails
      }
    }

    // Remove duplicates and sort by relevance
    const uniqueTopics = allTopics.filter((topic, index, array) =>
      array.findIndex(t => t.id === topic.id) === index
    );

    return uniqueTopics.slice(0, this.config.max_context_topics || 5);
  }

  private async generateSuggestions(knowledge: BCKBTopic[], bcContent: string[]): Promise<string[]> {
    const suggestions: string[] = [];

    // Knowledge-based suggestions
    knowledge.forEach(topic => {
      if (topic.samples) {
        suggestions.push(`Review code samples for ${topic.title}`);
      }
      if (topic.prerequisites.length > 0) {
        suggestions.push(`Check prerequisites: ${topic.prerequisites.join(', ')}`);
      }
    });

    // Content-based suggestions
    if (bcContent.some(content => /\b(error|issue|problem)\b/i.test(content))) {
      suggestions.push('Run diagnostic analysis on related AL code');
    }

    if (bcContent.some(content => /\b(performance|slow|optimize)\b/i.test(content))) {
      suggestions.push('Get optimization workflow recommendations');
    }

    return suggestions.slice(0, 5);
  }

  private calculateConfidence(knowledge: BCKBTopic[], bcContent: string[]): number {
    if (knowledge.length === 0) return 0;

    let confidence = 0;

    // Base confidence from knowledge matches
    confidence += Math.min(knowledge.length * 20, 60);

    // Boost for high relevance scores
    const avgRelevance = knowledge.reduce((sum, topic) =>
      sum + (topic.relevance_score || 0), 0) / knowledge.length;
    confidence += avgRelevance * 30;

    // Boost for code context
    if (bcContent.some(content => /```|procedure|trigger|codeunit/i.test(content))) {
      confidence += 10;
    }

    return Math.min(Math.round(confidence), 100);
  }

  private extractRelatedResources(knowledge: BCKBTopic[]): string[] {
    const resources: string[] = [];

    knowledge.forEach(topic => {
      topic.related_topics.forEach(related => {
        resources.push(`Related: ${related}`);
      });
    });

    return [...new Set(resources)].slice(0, 5);
  }

  private updateContextFromAnalysis(analysis: any): void {
    if (analysis.patterns_detected) {
      const domains = this.extractDomains(analysis.patterns_detected.join(' '));
      if (domains.length > 0) {
        this.conversationContext.mentioned_domains = [
          ...(this.conversationContext.mentioned_domains || []),
          ...domains
        ].slice(-5);
      }
    }
  }

  private async getContextualSuggestions(suggestedTopics: any[]): Promise<string[]> {
    return suggestedTopics.slice(0, 3).map(topic =>
      `Learn more: ${topic.title} (${topic.difficulty})`
    );
  }

  private getNextDifficultyLevel(current: string): string | null {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(current);
    return currentIndex < levels.length - 1 ? levels[currentIndex + 1] : null;
  }

  private inferBCVersion(): string {
    // Try to infer BC version from conversation context
    const context = JSON.stringify(this.conversationContext);
    if (context.includes('365') || context.includes('cloud')) return 'BC365';
    if (context.includes('2024')) return 'BC24';
    if (context.includes('2023')) return 'BC23';
    return 'BC365'; // Default to latest
  }

  private inferProjectType(): 'new' | 'maintenance' | 'optimization' | 'migration' {
    const context = JSON.stringify(this.conversationContext).toLowerCase();
    if (context.includes('new') || context.includes('create') || context.includes('start')) return 'new';
    if (context.includes('fix') || context.includes('bug') || context.includes('maintain')) return 'maintenance';
    if (context.includes('optimize') || context.includes('performance') || context.includes('improve')) return 'optimization';
    if (context.includes('migrate') || context.includes('upgrade') || context.includes('convert')) return 'migration';
    return 'new'; // Default
  }
}

/**
 * Factory function for creating Claude Desktop integration
 */
export function createClaudeIntegration(config: ClaudeIntegrationConfig): ClaudeIntegration {
  return new ClaudeIntegration(config);
}

/**
 * Default configuration for Claude Desktop integration
 */
export const ClaudeIntegrationDefaults = {
  local: (): ClaudeIntegrationConfig => ({
    server_path: 'node',
    server_args: ['dist/index.js'],
    debug_mode: false,
    context_retention: 10,
    auto_suggestions: true,
    max_context_topics: 5
  }),

  development: (): ClaudeIntegrationConfig => ({
    server_path: 'npm',
    server_args: ['run', 'dev'],
    debug_mode: true,
    context_retention: 20,
    auto_suggestions: true,
    max_context_topics: 8
  })
};