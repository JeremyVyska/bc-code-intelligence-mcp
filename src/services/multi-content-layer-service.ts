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
import { AtomicTopic } from '../types/bc-knowledge.js';
import { SpecialistDefinition } from './specialist-loader.js';
import { LayerPriority } from '../types/layer-types.js';

export class MultiContentLayerService {
  private layers = new Map<string, MultiContentKnowledgeLayer>();
  private layerPriorities: string[] = []; // Ordered by priority (high to low)
  private contentCache = new Map<string, Map<string, any>>();
  private initialized = false;

  constructor(
    private readonly specialistResolutionStrategy: SpecialistResolutionStrategy = {
      conflict_resolution: 'override',
      inherit_collaborations: true,
      merge_expertise: false
    }
  ) {}

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
        const result = await layer.initialize();
        results.set(name, result);
        
        if (result.success) {
          console.error(`✅ Layer ${name}: ${Object.entries(result.content_counts)
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
      if (!layer || !layer.supported_content_types.includes('specialists')) {
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
      if (!layer || !layer.supported_content_types.includes('specialists')) {
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