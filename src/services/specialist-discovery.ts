/**
 * Specialist Discovery Service
 * 
 * Analyzes user queries and suggests relevant specialists based on keywords,
 * expertise domains, and conversation context.
 */

import { SpecialistDefinition } from './specialist-loader.js';
import { MultiContentLayerService } from './multi-content-layer-service.js';

export interface SpecialistSuggestion {
  specialist: SpecialistDefinition;
  confidence: number;
  reasons: string[];
  keywords_matched: string[];
  domain_match?: string;
}

export interface DiscoveryContext {
  query?: string;
  current_domain?: string;
  conversation_history?: string[];
  user_preferences?: {
    expertise_level?: 'beginner' | 'intermediate' | 'expert';
    communication_style?: 'detailed' | 'concise' | 'conversational';
  };
}

export class SpecialistDiscoveryService {
  private specialists: SpecialistDefinition[] = [];
  private keywordMappings: Map<string, Set<string>> = new Map();
  private initialized = false;

  constructor(private layerService: MultiContentLayerService) {}

  /**
   * Initialize the discovery service with specialist data
   */
  async initialize(): Promise<void> {
    this.specialists = await this.layerService.getAllSpecialists();
    this.buildKeywordMappings();
    this.initialized = true;
  }

  /**
   * Suggest specialists for a given query and context
   */
  async suggestSpecialists(
    context: DiscoveryContext,
    maxSuggestions: number = 3
  ): Promise<SpecialistSuggestion[]> {
    await this.ensureInitialized();

    if (!context.query) {
      return this.getDefaultSpecialists();
    }

    const suggestions: SpecialistSuggestion[] = [];

    for (const specialist of this.specialists) {
      const suggestion = this.analyzeSpecialistMatch(specialist, context);
      if (suggestion.confidence > 0.1) { // Minimum confidence threshold
        suggestions.push(suggestion);
      }
    }

    // Sort by confidence and return top suggestions
    return suggestions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
  }

  /**
   * Get the best single specialist suggestion
   */
  async getBestSpecialist(context: DiscoveryContext): Promise<SpecialistSuggestion | null> {
    const suggestions = await this.suggestSpecialists(context, 1);
    return suggestions.length > 0 ? suggestions[0] : null;
  }

  /**
   * Get specialists by domain
   */
  async getSpecialistsByDomain(domain: string): Promise<SpecialistDefinition[]> {
    await this.ensureInitialized();
    
    return this.specialists.filter(specialist => 
      specialist.expertise?.primary?.includes(domain) ||
      specialist.expertise?.secondary?.includes(domain) ||
      specialist.domains?.includes(domain)
    );
  }

  /**
   * Get all available specialists grouped by their primary domains
   */
  async getSpecialistsByCategory(): Promise<Record<string, SpecialistDefinition[]>> {
    await this.ensureInitialized();
    
    const categories: Record<string, SpecialistDefinition[]> = {};
    
    for (const specialist of this.specialists) {
      const primaryDomain = specialist.domains?.[0] || 'general';
      if (!categories[primaryDomain]) {
        categories[primaryDomain] = [];
      }
      categories[primaryDomain].push(specialist);
    }
    
    return categories;
  }

  /**
   * Analyze how well a specialist matches the given context
   */
  private analyzeSpecialistMatch(
    specialist: SpecialistDefinition,
    context: DiscoveryContext
  ): SpecialistSuggestion {
    let confidence = 0;
    const reasons: string[] = [];
    const keywords_matched: string[] = [];
    let domain_match: string | undefined;

    if (!context.query) {
      return {
        specialist,
        confidence: 0,
        reasons: [],
        keywords_matched: []
      };
    }

    const queryLower = context.query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);

    // Check keyword matches
    const specialistKeywords = this.keywordMappings.get(specialist.specialist_id) || new Set();
    
    for (const word of queryWords) {
      if (specialistKeywords.has(word)) {
        keywords_matched.push(word);
        confidence += 0.2;
      }
    }

    // Check domain expertise matches
    if (specialist.expertise?.primary) {
      for (const expertise of specialist.expertise.primary) {
        if (queryLower.includes(expertise.toLowerCase())) {
          confidence += 0.3;
          reasons.push(`Primary expertise in ${expertise}`);
          domain_match = expertise;
        }
      }
    }

    if (specialist.expertise?.secondary) {
      for (const expertise of specialist.expertise.secondary) {
        if (queryLower.includes(expertise.toLowerCase())) {
          confidence += 0.2;
          reasons.push(`Secondary expertise in ${expertise}`);
          domain_match = domain_match || expertise;
        }
      }
    }

    // Check domain matches
    if (specialist.domains) {
      for (const domain of specialist.domains) {
        if (queryLower.includes(domain.toLowerCase())) {
          confidence += 0.25;
          reasons.push(`Domain specialist for ${domain}`);
          domain_match = domain_match || domain;
        }
      }
    }

    // Check "when to use" scenarios
    if (specialist.when_to_use) {
      for (const scenario of specialist.when_to_use) {
        if (queryLower.includes(scenario.toLowerCase())) {
          confidence += 0.3;
          reasons.push(`Ideal for ${scenario}`);
        }
      }
    }

    // Boost confidence for exact role matches
    if (specialist.role && queryLower.includes(specialist.role.toLowerCase())) {
      confidence += 0.4;
      reasons.push(`Role matches: ${specialist.role}`);
    }

    // Context domain bonus
    if (context.current_domain && specialist.domains?.includes(context.current_domain)) {
      confidence += 0.15;
      reasons.push(`Active in current domain: ${context.current_domain}`);
    }

    // Cap confidence at 1.0
    confidence = Math.min(confidence, 1.0);

    // Add generic reasons if confidence is reasonable but no specific reasons
    if (confidence > 0.3 && reasons.length === 0) {
      reasons.push('Good keyword and expertise match');
    }

    return {
      specialist,
      confidence,
      reasons,
      keywords_matched,
      domain_match
    };
  }

  /**
   * Build keyword mappings for efficient matching
   */
  private buildKeywordMappings(): void {
    for (const specialist of this.specialists) {
      const keywords = new Set<string>();

      // Add specialist ID keywords
      keywords.add(specialist.specialist_id);
      keywords.add(specialist.specialist_id.replace('-', ' '));

      // Add title keywords (this is the specialist's display name)
      if (specialist.title) {
        specialist.title.toLowerCase().split(/\s+/).forEach(word => keywords.add(word));
      }

      // Add role keywords
      if (specialist.role) {
        specialist.role.toLowerCase().split(/\s+/).forEach(word => keywords.add(word));
      }

      // Add expertise keywords
      if (specialist.expertise?.primary) {
        specialist.expertise.primary.forEach(exp => {
          exp.toLowerCase().split(/[-\s]+/).forEach(word => keywords.add(word));
        });
      }

      if (specialist.expertise?.secondary) {
        specialist.expertise.secondary.forEach(exp => {
          exp.toLowerCase().split(/[-\s]+/).forEach(word => keywords.add(word));
        });
      }

      // Add domain keywords
      if (specialist.domains) {
        specialist.domains.forEach(domain => {
          domain.toLowerCase().split(/[-\s]+/).forEach(word => keywords.add(word));
        });
      }

      // Add "when to use" keywords
      if (specialist.when_to_use) {
        specialist.when_to_use.forEach(scenario => {
          scenario.toLowerCase().split(/\s+/).forEach(word => keywords.add(word));
        });
      }

      // Add personality keywords if available
      if (specialist.persona?.personality) {
        specialist.persona.personality.forEach(trait => {
          trait.toLowerCase().split(/[-\s]+/).forEach(word => keywords.add(word));
        });
      }

      this.keywordMappings.set(specialist.specialist_id, keywords);
    }
  }

  /**
   * Get default specialists for when no query is provided
   */
  private getDefaultSpecialists(): SpecialistSuggestion[] {
    // Return most versatile specialists as defaults
    const defaultIds = ['casey-copilot', 'sam-coder', 'alex-architect'];
    
    return this.specialists
      .filter(s => defaultIds.includes(s.specialist_id))
      .map(specialist => ({
        specialist,
        confidence: 0.5,
        reasons: ['Popular general-purpose specialist'],
        keywords_matched: []
      }));
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Format specialist suggestions for display
   */
  formatSuggestions(suggestions: SpecialistSuggestion[]): string {
    if (suggestions.length === 0) {
      return "No specific specialist recommendations. Try asking Casey Copilot for general guidance!";
    }

    let result = "🎯 **Specialist Recommendations:**\n\n";
    
    for (const suggestion of suggestions) {
      const emoji = suggestion.specialist.emoji || '👤';
      const name = suggestion.specialist.title || suggestion.specialist.specialist_id;
      const confidence = Math.round(suggestion.confidence * 100);
      
      result += `${emoji} **${name}** (${confidence}% match)\n`;
      
      if (suggestion.reasons.length > 0) {
        result += `   • ${suggestion.reasons.join('\n   • ')}\n`;
      }
      
      if (suggestion.keywords_matched.length > 0) {
        result += `   • Keywords: ${suggestion.keywords_matched.join(', ')}\n`;
      }
      
      result += `   • Try: "${this.generateExampleQuery(suggestion.specialist)}"\n\n`;
    }

    return result;
  }

  /**
   * Generate an example query for a specialist
   */
  private generateExampleQuery(specialist: SpecialistDefinition): string {
    if (specialist.when_to_use && specialist.when_to_use.length > 0) {
      return `Help me with ${specialist.when_to_use[0].toLowerCase()}`;
    }
    
    if (specialist.expertise?.primary && specialist.expertise.primary.length > 0) {
      return `I need help with ${specialist.expertise.primary[0].toLowerCase()}`;
    }
    
    return `I need help with ${specialist.role?.toLowerCase() || 'development'}`;
  }
}