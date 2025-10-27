/**
 * Enhanced Multi-Content Layer Service
 * 
 * Extends the existing layer system to support specialists alongside
 * atomic topics, enabling companies/teams/projects to have custom specialists
 * that override or supplement the base specialist personas.
 */

import { 
  MultiContentKnowledgeLayer, 
  EnhancedLayerLoadResult, 
  LayerContentType,
  SpecialistQueryContext,
  LayerSpecialistSuggestion,
  MultiLayerSpecialistResult,
  SpecialistResolutionStrategy
} from '../types/enhanced-layer-types.js';
import { AtomicTopic, TopicSearchParams, TopicSearchResult } from '../types/bc-knowledge.js';
import { SpecialistDefinition } from './specialist-loader.js';
import { LayerPriority } from '../types/layer-types.js';

export class MultiContentLayerService {
  private layers = new Map<string, MultiContentKnowledgeLayer>();
  private layerPriorities: string[] = []; // Ordered by priority (high to low)
  private contentCache = new Map<string, Map<string, any>>();
  private initialized = false;
  private availableMcps: string[] = []; // Track available MCP servers for conditional topics

  constructor(
    private readonly specialistResolutionStrategy: SpecialistResolutionStrategy = {
      conflict_resolution: 'override',
      inherit_collaborations: true,
      merge_expertise: false
    }
  ) {}

  /**
   * Set available MCP servers for conditional topic filtering
   */
  setAvailableMcps(mcps: string[]): void {
    this.availableMcps = mcps;
    this.clearCache(); // Clear cache when MCP availability changes
  }

  /**
   * Get currently available MCP servers
   */
  getAvailableMcps(): string[] {
    return [...this.availableMcps];
  }

  /**
   * Filter topic based on conditional_mcp frontmatter
   */
  private shouldIncludeTopic(topic: AtomicTopic): boolean {
    const fm = topic.frontmatter;
    
    // Positive conditional: include only if MCP present
    if (fm.conditional_mcp) {
      return this.availableMcps.includes(fm.conditional_mcp);
    }
    
    // Negative conditional: include only if MCP absent
    if (fm.conditional_mcp_missing) {
      return !this.availableMcps.includes(fm.conditional_mcp_missing);
    }
    
    // No conditional: always include
    return true;
  }

  /**
   * Add a layer to the service
   */
  addLayer(layer: MultiContentKnowledgeLayer): void {
    this.layers.set(layer.name, layer);
    this.updateLayerPriorities();
    this.clearCache();
  }

  /**
   * Initialize all layers
   */
  async initialize(): Promise<Map<string, EnhancedLayerLoadResult>> {
    const results = new Map<string, EnhancedLayerLoadResult>();
    
    console.error('🚀 Initializing multi-content layer service...');
    
    for (const [name, layer] of this.layers) {
      try {
        console.error(`📋 Initializing layer: ${name}`);
        let result = await layer.initialize() as any;

        // Convert legacy LayerLoadResult to EnhancedLayerLoadResult if needed
        if (result && !result.content_counts && result.topicsLoaded !== undefined) {
          // This is a legacy LayerLoadResult, convert to enhanced format
          result = {
            success: result.success,
            layer_name: result.layerName,
            load_time_ms: result.loadTimeMs,
            content_counts: {
              topics: result.topicsLoaded || 0,
              specialists: 0, // Will be updated by layer-specific logic
              methodologies: result.indexesLoaded || 0
            },
            topics_loaded: result.topicsLoaded || 0,
            indexes_loaded: result.indexesLoaded || 0,
            error: result.success ? undefined : 'Layer load failed'
          };

          // For embedded layer, update specialist count from the layer itself
          if (layer.name === 'embedded' && 'specialists' in layer && layer.specialists instanceof Map) {
            result.content_counts.specialists = layer.specialists.size;
          }
        }

        results.set(name, result as EnhancedLayerLoadResult);
        
        if (result.success) {
          const contentCounts = result.content_counts || {};
          console.error(`✅ Layer ${name}: ${Object.entries(contentCounts)
            .map(([type, count]) => `${count} ${type}`)
            .join(', ')}`);
        } else {
          console.error(`❌ Layer ${name} failed: ${result.error}`);
        }
      } catch (error) {
        console.error(`❌ Layer ${name} initialization error:`, error);
        results.set(name, {
          success: false,
          layer_name: name,
          load_time_ms: 0,
          content_counts: { topics: 0, specialists: 0, methodologies: 0 },
          topics_loaded: 0,
          indexes_loaded: 0,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.initialized = true;
    console.error(`🎯 Multi-content layer service initialized with ${this.layers.size} layers`);
    
    return results;
  }

  /**
   * Get a specialist by ID with layer resolution
   */
  async getSpecialist(specialistId: string): Promise<SpecialistDefinition | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check cache first
    const cached = this.getCachedContent('specialists', specialistId);
    if (cached) {
      return cached as SpecialistDefinition;
    }

    // Search layers in priority order (highest priority first)
    for (const layerName of this.layerPriorities) {
      const layer = this.layers.get(layerName);
      if (!layer || !(layer.supported_content_types?.includes('specialists'))) {
        continue;
      }

      const specialist = await layer.getContent('specialists', specialistId);
      if (specialist) {
        this.setCachedContent('specialists', specialistId, specialist);
        return specialist;
      }
    }

    return null;
  }

  /**
   * Get all specialists across all layers with resolution
   */
  async getAllSpecialists(): Promise<SpecialistDefinition[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const specialistMap = new Map<string, SpecialistDefinition>();
    
    // Process layers in reverse priority order (lowest priority first)
    // so higher priority layers can override
    const reversePriorities = [...this.layerPriorities].reverse();
    
    for (const layerName of reversePriorities) {
      const layer = this.layers.get(layerName);
      if (!layer || !(layer.supported_content_types?.includes('specialists'))) {
        continue;
      }

      const layerSpecialistIds = layer.getContentIds('specialists');
      
      for (const specialistId of layerSpecialistIds) {
        const specialist = await layer.getContent('specialists', specialistId);
        if (specialist) {
          if (specialistMap.has(specialistId)) {
            // Apply resolution strategy
            const existing = specialistMap.get(specialistId)!;
            const resolved = this.resolveSpecialistConflict(existing, specialist, layerName);
            specialistMap.set(specialistId, resolved);
          } else {
            specialistMap.set(specialistId, specialist);
          }
        }
      }
    }

    return Array.from(specialistMap.values());
  }

  /**
   * Suggest specialists based on context across all layers
   */
  async suggestSpecialists(
    context: string,
    queryContext?: SpecialistQueryContext,
    limit: number = 5
  ): Promise<MultiLayerSpecialistResult> {
    const allSpecialists = await this.getAllSpecialists();
    const suggestions: LayerSpecialistSuggestion[] = [];

    for (const specialist of allSpecialists) {
      const score = this.calculateSpecialistScore(specialist, context, queryContext);
      
      if (score > 0) {
        const collaborationOptions = await this.getCollaborationOptions(specialist);
        
        suggestions.push({
          specialist,
          source_layer: this.findSpecialistSourceLayer(specialist.specialist_id),
          confidence_score: score,
          match_reasons: this.getMatchReasons(specialist, context, queryContext),
          collaboration_options: collaborationOptions
        });
      }
    }

    // Sort by confidence score
    suggestions.sort((a, b) => b.confidence_score - a.confidence_score);

    const primarySuggestions = suggestions.slice(0, limit);
    const alternativeSuggestions = suggestions.slice(limit, limit * 2);

    return {
      primary_suggestions: primarySuggestions,
      alternative_specialists: alternativeSuggestions,
      cross_layer_collaboration: await this.getCrossLayerCollaboration(primarySuggestions),
      resolution_strategy_used: this.specialistResolutionStrategy
    };
  }

  /**
   * Get specialists from a specific layer
   */
  async getSpecialistsByLayer(layerName: string): Promise<SpecialistDefinition[]> {
    const layer = this.layers.get(layerName);
    if (!layer || !layer.supported_content_types.includes('specialists')) {
      return [];
    }

    const specialistIds = layer.getContentIds('specialists');
    const specialists: SpecialistDefinition[] = [];

    for (const id of specialistIds) {
      const specialist = await layer.getContent('specialists', id);
      if (specialist) {
        specialists.push(specialist);
      }
    }

    return specialists;
  }

  /**
   * Get layer statistics including specialist counts
   */
  getLayerStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name, layer] of this.layers) {
      stats[name] = layer.getEnhancedStatistics();
    }

    return stats;
  }

  /**
   * Resolve specialist conflicts between layers
   */
  private resolveSpecialistConflict(
    existing: SpecialistDefinition,
    incoming: SpecialistDefinition,
    incomingLayerName: string
  ): SpecialistDefinition {
    switch (this.specialistResolutionStrategy.conflict_resolution) {
      case 'override':
        return incoming; // Higher priority layer wins
        
      case 'merge':
        return this.mergeSpecialists(existing, incoming);
        
      case 'extend':
        return this.extendSpecialist(existing, incoming);
        
      default:
        return incoming;
    }
  }

  /**
   * Merge two specialist definitions
   */
  private mergeSpecialists(
    base: SpecialistDefinition,
    override: SpecialistDefinition
  ): SpecialistDefinition {
    return {
      ...base,
      ...override,
      persona: {
        ...base.persona,
        ...override.persona,
        personality: [
          ...new Set([...base.persona.personality, ...override.persona.personality])
        ]
      },
      expertise: {
        primary: [...new Set([...base.expertise.primary, ...override.expertise.primary])],
        secondary: [...new Set([...base.expertise.secondary, ...override.expertise.secondary])]
      },
      domains: [...new Set([...base.domains, ...override.domains])],
      when_to_use: [...new Set([...base.when_to_use, ...override.when_to_use])],
      collaboration: {
        natural_handoffs: this.specialistResolutionStrategy.inherit_collaborations
          ? [...new Set([...base.collaboration.natural_handoffs, ...override.collaboration.natural_handoffs])]
          : override.collaboration.natural_handoffs,
        team_consultations: this.specialistResolutionStrategy.inherit_collaborations
          ? [...new Set([...base.collaboration.team_consultations, ...override.collaboration.team_consultations])]
          : override.collaboration.team_consultations
      },
      related_specialists: [...new Set([...base.related_specialists, ...override.related_specialists])]
    };
  }

  /**
   * Extend specialist with additional capabilities
   */
  private extendSpecialist(
    base: SpecialistDefinition,
    extension: SpecialistDefinition
  ): SpecialistDefinition {
    // Similar to merge but preserves base identity more strongly
    return {
      ...base,
      // Only extend non-identity fields
      expertise: {
        primary: base.expertise.primary, // Keep base primary expertise
        secondary: [...new Set([...base.expertise.secondary, ...extension.expertise.secondary])]
      },
      domains: [...new Set([...base.domains, ...extension.domains])],
      when_to_use: [...new Set([...base.when_to_use, ...extension.when_to_use])],
      collaboration: {
        natural_handoffs: [...new Set([...base.collaboration.natural_handoffs, ...extension.collaboration.natural_handoffs])],
        team_consultations: [...new Set([...base.collaboration.team_consultations, ...extension.collaboration.team_consultations])]
      },
      related_specialists: [...new Set([...base.related_specialists, ...extension.related_specialists])],
      content: `${base.content}\n\n## Extended Capabilities\n${extension.content}`
    };
  }

  /**
   * Calculate specialist relevance score
   */
  private calculateSpecialistScore(
    specialist: SpecialistDefinition,
    context: string,
    queryContext?: SpecialistQueryContext
  ): number {
    let score = 0;
    const contextLower = context.toLowerCase();

    // Check when_to_use scenarios
    for (const scenario of specialist.when_to_use) {
      if (contextLower.includes(scenario.toLowerCase()) ||
          scenario.toLowerCase().includes(contextLower)) {
        score += 10;
      }
    }

    // Check expertise areas
    for (const expertise of specialist.expertise.primary) {
      if (contextLower.includes(expertise.toLowerCase())) {
        score += 8;
      }
    }
    
    for (const expertise of specialist.expertise.secondary) {
      if (contextLower.includes(expertise.toLowerCase())) {
        score += 5;
      }
    }

    // Check domains
    for (const domain of specialist.domains) {
      if (contextLower.includes(domain.toLowerCase())) {
        score += 6;
      }
    }

    // Apply query context modifiers
    if (queryContext) {
      if (queryContext.domain && specialist.domains.includes(queryContext.domain)) {
        score += 15;
      }
      
      if (queryContext.urgency === 'high') {
        // Prefer specialists with quick response traits
        if (specialist.persona.personality.some(p => 
          p.toLowerCase().includes('quick') || 
          p.toLowerCase().includes('direct') ||
          p.toLowerCase().includes('efficient'))) {
          score += 5;
        }
      }
    }

    return score;
  }

  /**
   * Get match reasons for a specialist suggestion
   */
  private getMatchReasons(
    specialist: SpecialistDefinition,
    context: string,
    queryContext?: SpecialistQueryContext
  ): string[] {
    const reasons: string[] = [];
    const contextLower = context.toLowerCase();

    // Check expertise matches
    const primaryMatches = specialist.expertise.primary.filter(e => 
      contextLower.includes(e.toLowerCase()));
    if (primaryMatches.length > 0) {
      reasons.push(`Primary expertise: ${primaryMatches.join(', ')}`);
    }

    // Check scenario matches
    const scenarioMatches = specialist.when_to_use.filter(s => 
      contextLower.includes(s.toLowerCase()) || s.toLowerCase().includes(contextLower));
    if (scenarioMatches.length > 0) {
      reasons.push(`Relevant scenarios: ${scenarioMatches.join(', ')}`);
    }

    // Check domain matches
    const domainMatches = specialist.domains.filter(d => 
      contextLower.includes(d.toLowerCase()));
    if (domainMatches.length > 0) {
      reasons.push(`Domain expertise: ${domainMatches.join(', ')}`);
    }

    return reasons;
  }

  /**
   * Get collaboration options for a specialist
   */
  private async getCollaborationOptions(specialist: SpecialistDefinition): Promise<{
    available_handoffs: SpecialistDefinition[];
    recommended_consultations: SpecialistDefinition[];
  }> {
    const handoffs: SpecialistDefinition[] = [];
    const consultations: SpecialistDefinition[] = [];

    // Get handoff specialists
    for (const handoffId of specialist.collaboration.natural_handoffs) {
      const handoffSpecialist = await this.getSpecialist(handoffId);
      if (handoffSpecialist) {
        handoffs.push(handoffSpecialist);
      }
    }

    // Get consultation specialists
    for (const consultationId of specialist.collaboration.team_consultations) {
      const consultationSpecialist = await this.getSpecialist(consultationId);
      if (consultationSpecialist) {
        consultations.push(consultationSpecialist);
      }
    }

    return { available_handoffs: handoffs, recommended_consultations: consultations };
  }

  /**
   * Get cross-layer collaboration opportunities
   */
  private async getCrossLayerCollaboration(
    suggestions: LayerSpecialistSuggestion[]
  ): Promise<Array<{ layer_name: string; specialists: SpecialistDefinition[] }>> {
    const crossLayerCollab: Array<{ layer_name: string; specialists: SpecialistDefinition[] }> = [];

    for (const [layerName] of this.layers) {
      const layerSpecialists = await this.getSpecialistsByLayer(layerName);
      if (layerSpecialists.length > 0) {
        crossLayerCollab.push({
          layer_name: layerName,
          specialists: layerSpecialists
        });
      }
    }

    return crossLayerCollab;
  }

  /**
   * Find which layer a specialist comes from
   */
  private findSpecialistSourceLayer(specialistId: string): string {
    for (const layerName of this.layerPriorities) {
      const layer = this.layers.get(layerName);
      if (layer?.hasContent('specialists', specialistId)) {
        return layerName;
      }
    }
    return 'unknown';
  }

  /**
   * Update layer priority ordering
   */
  private updateLayerPriorities(): void {
    this.layerPriorities = Array.from(this.layers.values())
      .sort((a, b) => a.priority - b.priority) // Lower number = higher priority
      .map(layer => layer.name);
  }

  /**
   * Cache management
   */
  private getCachedContent(type: LayerContentType, id: string): any {
    return this.contentCache.get(type)?.get(id);
  }

  private setCachedContent(type: LayerContentType, id: string, content: any): void {
    if (!this.contentCache.has(type)) {
      this.contentCache.set(type, new Map());
    }
    this.contentCache.get(type)!.set(id, content);
  }

  private clearCache(): void {
    this.contentCache.clear();
  }

  /**
   * Search topics across all layers
   */
  async searchTopics(params: TopicSearchParams): Promise<TopicSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: TopicSearchResult[] = [];
    const limit = params.limit || 50;
    
    // Search across all layers in priority order
    for (const layerName of this.layerPriorities) {
      const layer = this.layers.get(layerName);
      if (!layer) continue;

      try {
        // Get all topic IDs from this layer
        const topicIds = layer.getContentIds('topics');
        
        // Load each topic and filter
        for (const topicId of topicIds) {
          const topic = await layer.getContent('topics', topicId);
          if (topic && this.shouldIncludeTopic(topic) && this.matchesSearchCriteria(topic, params)) {
            try {
              const score = this.calculateRelevanceScore(topic, params);

              const searchResult = this.topicToSearchResult(topic, score);
              results.push(searchResult);

              // Note: Don't break early here - let all matching topics be scored
              // The final limit will be applied after sorting by relevance
            } catch (scoreError) {
              console.error(`Error scoring topic ${topic.title}:`, scoreError);
              // Skip this topic if scoring fails
            }
          }
        }
      } catch (error) {
        console.error(`Error searching topics in layer ${layerName}:`, error);
        // Continue with other layers
      }
    }

    // Sort by relevance score and apply limit
    return results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, limit);
  }

  /**
   * Find specialists by query across all layers
   */
  async findSpecialistsByQuery(query: string): Promise<SpecialistDefinition[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: SpecialistDefinition[] = [];
    const queryLower = query.toLowerCase();
    
    // Search across all layers in priority order
    for (const layerName of this.layerPriorities) {
      const layer = this.layers.get(layerName);
      if (!layer || !layer.supported_content_types || !layer.supported_content_types.includes('specialists')) {
        continue;
      }

      try {
        // Get all specialist IDs from this layer
        const specialistIds = layer.getContentIds('specialists');
        
        // Load each specialist and check for matches
        for (const specialistId of specialistIds) {
          const specialist = await layer.getContent('specialists', specialistId);
          if (specialist && this.matchesSpecialistQuery(specialist, queryLower)) {
            results.push(specialist);
          }
        }
      } catch (error) {
        console.error(`Error searching specialists in layer ${layerName}:`, error);
        // Continue with other layers
      }
    }

    return results;
  }

  /**
   * Check if specialist matches query using token-based matching
   * 
   * Fixes Issue #17: Complex compound questions now tokenized for matching.
   * Instead of requiring full query as substring, matches any individual token.
   */
  private matchesSpecialistQuery(specialist: SpecialistDefinition, queryLower: string): boolean {
    const searchableFields = [
      specialist.title,
      specialist.role,
      specialist.specialist_id,
      ...(specialist.expertise?.primary || []),
      ...(specialist.expertise?.secondary || []),
      ...(specialist.domains || []),
      ...(specialist.when_to_use || [])
    ].filter(Boolean).map(field => field.toLowerCase());

    // Tokenize query into individual keywords (filter out short words)
    const queryTokens = queryLower
      .split(/[\s,]+/)
      .filter(token => token.length > 3)
      .map(token => token.replace(/[^a-z0-9]/g, ''));
    
    // Match if ANY query token matches ANY searchable field (bidirectional partial matching)
    return queryTokens.some(token => 
      searchableFields.some(field => 
        field.includes(token) || token.includes(field)
      )
    );
  }

  /**
   * Ask a specialist a question (simulated consultation)
   */
  async askSpecialist(question: string, preferredSpecialist?: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    let specialist: SpecialistDefinition | null = null;

    // Try to find the preferred specialist first
    if (preferredSpecialist) {
      specialist = await this.findSpecialistById(preferredSpecialist);
    }

    // If no preferred specialist or not found, find best match
    if (!specialist) {
      const specialists = await this.findSpecialistsByQuery(question);
      specialist = specialists[0] || null;
    }

    if (!specialist) {
      throw new Error('No suitable specialist found for this question');
    }

    // Return a consultation response
    return {
      specialist: {
        id: specialist.specialist_id,
        name: specialist.title,
        role: specialist.role
      },
      response: `${specialist.title} would approach this question: "${question}" using their expertise in ${specialist.expertise?.primary?.join(', ') || 'general BC development'}.`,
      consultation_guidance: specialist.content.substring(0, 200) + '...' || 'General BC development guidance',
      follow_up_suggestions: specialist.related_specialists || []
    };
  }

  /**
   * Find specialist by ID across all layers
   */
  private async findSpecialistById(specialistId: string): Promise<SpecialistDefinition | null> {
    for (const layerName of this.layerPriorities) {
      const layer = this.layers.get(layerName);
      if (!layer || !layer.supported_content_types.includes('specialists')) {
        continue;
      }

      try {
        if (layer.hasContent('specialists', specialistId)) {
          return await layer.getContent('specialists', specialistId);
        }
      } catch (error) {
        console.error(`Error finding specialist ${specialistId} in layer ${layerName}:`, error);
        // Continue with other layers
      }
    }

    return null;
  }

  /**
   * Check if topic matches search criteria
   */
  private matchesSearchCriteria(topic: AtomicTopic, params: TopicSearchParams): boolean {
    // Text matching using code_context parameter
    if (params.code_context) {
      const searchTerm = params.code_context.toLowerCase();
      const title = topic.title.toLowerCase();
      const content = topic.content.toLowerCase();
      const tags = (topic.frontmatter.tags || []).map(tag => tag.toLowerCase());

      // Prioritize individual word matching over full phrase matching
      const searchWords = searchTerm.split(' ').filter(word => word.length > 2);

      // Check individual words first (more flexible)
      const wordMatches = searchWords.some(word =>
        title.includes(word) || content.includes(word) || tags.some(tag => tag.includes(word))
      );

      // Also check exact phrase match (bonus case)
      const exactPhraseMatch = title.includes(searchTerm) ||
                              content.includes(searchTerm) ||
                              tags.some(tag => tag.includes(searchTerm));

      const matches = wordMatches || exactPhraseMatch;

      if (!matches) {
        return false;
      }
    }

    // Domain filtering
    if (params.domain) {
      const topicDomains = Array.isArray(topic.frontmatter.domain) 
        ? topic.frontmatter.domain 
        : topic.frontmatter.domain ? [topic.frontmatter.domain] : [];
      
      if (!topicDomains.includes(params.domain)) {
        return false;
      }
    }

    // BC version filtering
    if (params.bc_version && topic.frontmatter.bc_versions) {
      // Simple version check - could be enhanced
      if (!topic.frontmatter.bc_versions.includes(params.bc_version)) {
        return false;
      }
    }

    // Difficulty filtering
    if (params.difficulty && topic.frontmatter.difficulty !== params.difficulty) {
      return false;
    }

    // Tag filtering
    if (params.tags && params.tags.length > 0) {
      const topicTags = topic.frontmatter.tags || [];
      if (!params.tags.some(tag => topicTags.includes(tag))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate relevance score for topic
   */
  private calculateRelevanceScore(topic: AtomicTopic, params: TopicSearchParams): number {
    let score = 0; // Start with 0, add points for relevance

    // Text relevance scoring - the most important factor
    if (params.code_context) {
      const searchTerm = params.code_context.toLowerCase();
      const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 2);

      const title = topic.title.toLowerCase();
      const content = topic.content.toLowerCase();
      const tags = (topic.frontmatter.tags || []).map(tag => tag.toLowerCase());

      // **MAJOR FIX**: Prioritize exact phrase matches and semantic clusters

      // 1. Exact phrase match in title (highest priority)
      if (title.includes(searchTerm)) {
        score += 100; // Massive bonus for exact phrase in title
      }

      // 2. High-value word combinations in title
      let titleWordMatches = 0;
      for (const word of searchWords) {
        if (title.includes(word)) {
          titleWordMatches++;
          score += 15; // Higher than before for title matches
        }
      }

      // 3. Title clustering bonus - reward multiple words in title
      if (titleWordMatches > 1) {
        score += titleWordMatches * titleWordMatches * 10; // Exponential bonus for clustering
      }

      // 4. Semantic tag matches (better than content)
      let tagMatches = 0;
      for (const word of searchWords) {
        for (const tag of tags) {
          if (tag.includes(word)) {
            tagMatches++;
            score += 12; // Increased from 8
          }
        }
      }

      // 5. Tag clustering bonus
      if (tagMatches > 1) {
        score += tagMatches * 8;
      }

      // 6. Content matches (lower priority than before)
      for (const word of searchWords) {
        const matches = (content.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
        score += Math.min(matches * 1.5, 4); // Reduced from 2 and 6
      }

      // 7. **NEW**: Exact phrase in content
      if (content.includes(searchTerm)) {
        score += 20;
      }

      // 8. **NEW**: Multi-word phrase detection in title (highest semantic value)
      if (searchWords.length > 1) {
        // Check for consecutive word sequences in title
        for (let i = 0; i < searchWords.length - 1; i++) {
          const phrase = searchWords.slice(i, i + 2).join(' ');
          if (title.includes(phrase)) {
            score += 50; // Massive bonus for 2-word phrases in title
          }
        }

        // Check for 3+ word phrases
        for (let i = 0; i < searchWords.length - 2; i++) {
          const phrase = searchWords.slice(i, i + 3).join(' ');
          if (title.includes(phrase)) {
            score += 100; // Even bigger bonus for longer phrases
          }
        }
      }

      // 9. **NEW**: Semantic relevance bonus for technical terms
      const technicalTerms = ['al', 'naming', 'convention', 'field', 'table', 'extension'];
      const queryTechTerms = searchWords.filter(word => technicalTerms.includes(word));
      const topicTechTerms = [...title.split(/\s+/), ...tags.join(' ').split(/\s+/)]
        .filter(word => technicalTerms.includes(word.toLowerCase()));

      const techTermOverlap = queryTechTerms.filter(term =>
        topicTechTerms.some(topicTerm => topicTerm.toLowerCase().includes(term))
      ).length;

      if (techTermOverlap > 0) {
        score += techTermOverlap * 25; // High bonus for technical term matches
      }

      // 10. Penalty for very long content (prefer focused topics)
      if (topic.content.length > 5000) {
        score *= 0.8; // Increased penalty
      }
    }

    // Domain exact match bonus (secondary factor)
    if (params.domain) {
      const topicDomains = Array.isArray(topic.frontmatter.domain)
        ? topic.frontmatter.domain
        : topic.frontmatter.domain ? [topic.frontmatter.domain] : [];

      if (topicDomains.includes(params.domain)) {
        score += 5;
      }
    }

    // BC version exact match bonus
    if (params.bc_version && topic.frontmatter.bc_versions?.includes(params.bc_version)) {
      score += 3;
    }

    // Difficulty match bonus
    if (params.difficulty && topic.frontmatter.difficulty === params.difficulty) {
      score += 2;
    }

    // Tag match bonus (from explicit tag parameters)
    if (params.tags && params.tags.length > 0) {
      const topicTags = topic.frontmatter.tags || [];
      const matchingTags = params.tags.filter(tag => topicTags.includes(tag));
      score += matchingTags.length * 2;
    }

    return Math.max(score, 0.1); // Ensure minimum score > 0
  }

  /**
   * Convert topic to search result
   */
  private topicToSearchResult(topic: AtomicTopic, relevanceScore: number): TopicSearchResult {
    const primaryDomain = Array.isArray(topic.frontmatter.domain) 
      ? topic.frontmatter.domain[0] 
      : topic.frontmatter.domain || '';
    
    const allDomains = Array.isArray(topic.frontmatter.domain) 
      ? topic.frontmatter.domain 
      : topic.frontmatter.domain ? [topic.frontmatter.domain] : [];

    return {
      id: topic.id,
      title: topic.title,
      summary: topic.content.substring(0, 200) + '...', // First 200 chars as summary
      domain: primaryDomain,
      domains: allDomains,
      difficulty: topic.frontmatter.difficulty || 'beginner',
      relevance_score: relevanceScore,
      tags: topic.frontmatter.tags || [],
      prerequisites: topic.frontmatter.prerequisites || [],
      estimated_time: topic.frontmatter.estimated_time
    };
  }

  /**
   * Get a specific layer by name (adapted from LayerService)
   */
  getLayer(layerName: string): MultiContentKnowledgeLayer | null {
    return this.layers.get(layerName) || null;
  }

  /**
   * Get all layers (adapted from LayerService)
   */
  getLayers(): MultiContentKnowledgeLayer[] {
    return Array.from(this.layers.values());
  }

  /**
   * Get all available topic IDs from all layers (adapted from LayerService)
   */
  getAllTopicIds(): string[] {
    const topicIds = new Set<string>();

    for (const layer of this.layers.values()) {
      if ('getTopicIds' in layer) {
        for (const topicId of layer.getTopicIds()) {
          topicIds.add(topicId);
        }
      }
    }

    return Array.from(topicIds);
  }

  /**
   * Resolve a topic with layer override logic (adapted from LayerService)
   */
  async resolveTopic(topicId: string): Promise<any | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Find the highest priority layer that has this topic
    let resolvedTopic: AtomicTopic | null = null;
    let sourceLayer: string = '';

    // Go through layers in priority order (highest first)
    for (const layerName of this.layerPriorities) {
      const layer = this.layers.get(layerName);
      if (layer && 'getTopic' in layer) {
        try {
          const topic = await (layer as any).getTopic(topicId);
          if (topic) {
            resolvedTopic = topic;
            sourceLayer = layerName;
            break; // Highest priority wins
          }
        } catch (error) {
          // Continue to next layer
        }
      }
    }

    if (resolvedTopic) {
      return {
        topic: resolvedTopic,
        sourceLayer,
        isOverride: false,
        overriddenLayers: []
      };
    }

    return null;
  }

  /**
   * Get all resolved topics (adapted from LayerService)
   */
  async getAllResolvedTopics(): Promise<AtomicTopic[]> {
    const allTopics: AtomicTopic[] = [];
    const topicIds = this.getAllTopicIds();

    for (const topicId of topicIds) {
      const resolution = await this.resolveTopic(topicId);
      if (resolution && resolution.topic) {
        allTopics.push(resolution.topic);
      }
    }

    return allTopics;
  }

  /**
   * Get overridden topics statistics (adapted from LayerService)
   */
  getOverriddenTopics(): any {
    // For now, return empty stats - can be enhanced later
    return {
      totalOverrides: 0,
      overridesByLayer: {},
      conflictResolutions: []
    };
  }

  /**
   * Get layer statistics - adapts new enhanced statistics to old LayerStatistics format
   */
  getStatistics(): Array<{
    name: string;
    priority: number;
    enabled: boolean;
    topicCount: number;
    indexCount: number;
    lastLoaded?: Date;
    loadTimeMs?: number;
    memoryUsage?: {
      topics: number;
      indexes: number;
      total: number;
    };
  }> {
    return Array.from(this.layers.values()).map(layer => {
      // Try to use getEnhancedStatistics if available, otherwise fall back to basic stats
      if ('getEnhancedStatistics' in layer && typeof (layer as any).getEnhancedStatistics === 'function') {
        const enhanced = (layer as any).getEnhancedStatistics();
        return {
          name: enhanced.name,
          priority: enhanced.priority,
          enabled: layer.enabled,
          topicCount: enhanced.content_counts.topics || 0,
          indexCount: enhanced.content_counts.methodologies || 0,
          lastLoaded: enhanced.initialized ? new Date() : undefined,
          loadTimeMs: enhanced.load_time_ms,
          memoryUsage: {
            topics: 0,
            indexes: 0,
            total: 0
          }
        };
      } else {
        // Fallback to standard layer properties
        const layerAsAny = layer as any;
        return {
          name: layer.name,
          priority: layer.priority,
          enabled: layer.enabled,
          topicCount: layerAsAny.topics?.size || 0,
          indexCount: layerAsAny.indexes?.size || 0,
          lastLoaded: undefined,
          loadTimeMs: undefined,
          memoryUsage: {
            topics: 0,
            indexes: 0,
            total: 0
          }
        };
      }
    });
  }

  /**
   * Initialize from configuration (adapted from LayerService)
   */
  async initializeFromConfiguration(config: any): Promise<Map<string, EnhancedLayerLoadResult>> {
    // For now, just call regular initialize
    // This can be enhanced to handle configuration-based layer loading
    return await this.initialize();
  }

  /**
   * Get session storage configuration (adapted from LayerService)
   */
  getSessionStorageConfig(): any {
    return {
      enabled: false,
      type: 'memory',
      options: {}
    };
  }

  /**
   * Refresh cache (adapted from LayerService)
   */
  async refreshCache(): Promise<void> {
    this.clearCache();
    // Force re-initialization if needed
    if (this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Get cache statistics (adapted from LayerService)
   */
  getCacheStats(): any {
    return {
      topicCacheSize: this.contentCache.size,
      layerCount: this.layers.size,
      totalMemoryUsage: 0 // Could be calculated if needed
    };
  }

  /**
   * Dispose of all layers
   */
  async dispose(): Promise<void> {
    for (const layer of this.layers.values()) {
      await layer.dispose();
    }
    this.layers.clear();
    this.clearCache();
    this.initialized = false;
  }
}