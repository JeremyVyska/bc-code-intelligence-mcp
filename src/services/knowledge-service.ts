import {
  AtomicTopic,
  TopicSearchParams,
  TopicSearchResult,
  BCKBConfig
} from '../types/bc-knowledge.js';
import { LayerService } from '../layers/layer-service.js';
import { LayerResolutionResult } from '../types/layer-types.js';
import { 
  BCSpecialist, 
  SpecialistConsultation, 
  SpecialistResponse, 
  PersonaRegistry 
} from '../types/persona-types.js';

/**
 * Business Central Knowledge Service
 *
 * Manages loading, caching, and searching of atomic BC knowledge topics
 * using the layered architecture system. Provides intelligent topic discovery
 * and relationship traversal with support for project overrides.
 */
export class KnowledgeService {
  private layerService: LayerService;
  private initialized = false;
  private personaRegistry: PersonaRegistry;

  constructor(private config: BCKBConfig) {
    // Initialize layer service with embedded knowledge from submodule
    // For testing, use the knowledge_base_path directly if it doesn't contain embedded-knowledge
    const embeddedPath = config.knowledge_base_path.includes('embedded-knowledge')
      ? config.knowledge_base_path
      : config.knowledge_base_path.replace(/\/knowledge-base$/, '/embedded-knowledge');

    console.error(`🔧 Using embedded path: ${embeddedPath}`);
    this.layerService = new LayerService(embeddedPath, './bckb-overrides');
    this.personaRegistry = PersonaRegistry.getInstance();
  }

  /**
   * Initialize the knowledge service by loading all layers
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('🔄 Initializing BC Knowledge Service with Layer System...');

    try {
      // Initialize the layer service (loads embedded + project layers)
      const layerResults = await this.layerService.initialize();

      this.initialized = true;

      // Log initialization results
      const successfulLayers = layerResults.filter(r => r.success);
      const totalTopics = successfulLayers.reduce((sum, r) => sum + r.topicsLoaded, 0);

      console.error(`✅ Knowledge Service initialized with ${successfulLayers.length}/${layerResults.length} layers and ${totalTopics} total topics`);

      // Log layer details
      for (const result of layerResults) {
        if (result.success) {
          console.error(`  📚 ${result.layerName}: ${result.topicsLoaded} topics, ${result.indexesLoaded} indexes (${result.loadTimeMs}ms)`);
        } else {
          console.error(`  ❌ ${result.layerName}: Failed - ${result.error}`);
        }
      }

    } catch (error) {
      console.error('❌ Failed to initialize Knowledge Service:', error);
      throw error;
    }
  }

  // Tag indexes are now handled by individual layers
  // This method is kept for backward compatibility but delegates to layers
  private getTagIndexes(): Map<string, any> {
    const tagIndexes = new Map<string, any>();

    // Get tag indexes from embedded layer
    const embeddedLayer = this.layerService.getLayer('embedded');
    if (embeddedLayer && 'getIndex' in embeddedLayer) {
      // Access embedded layer indexes if available
      const indexNames = (embeddedLayer as any).getIndexNames?.() || [];
      for (const indexName of indexNames) {
        if (indexName.startsWith('tag:')) {
          const tagName = indexName.replace('tag:', '');
          const tagIndex = (embeddedLayer as any).getIndex?.(indexName);
          if (tagIndex) {
            tagIndexes.set(tagName, tagIndex);
          }
        }
      }
    }

    return tagIndexes;
  }

  /**
   * Search for topics based on various criteria using the layer system
   */
  async searchTopics(params: TopicSearchParams): Promise<TopicSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Delegate to layer service for unified search across all layers
    return await this.layerService.searchTopics(params);
  }


  /**
   * Get a specific topic by ID with layer resolution
   */
  async getTopic(topicId: string, includeSamples = false): Promise<AtomicTopic | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Resolve topic through layer system
    const resolution = await this.layerService.resolveTopic(topicId);
    if (!resolution) return null;

    // Return copy to prevent mutation
    const result = { ...resolution.topic };
    if (!includeSamples) {
      delete result.samples;
    }

    return result;
  }

  /**
   * Get topic relationships and learning paths from layers
   */
  async getTopicRelationships(topicId: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get relationships from embedded layer
    const embeddedLayer = this.layerService.getLayer('embedded');
    if (!embeddedLayer || !('getIndex' in embeddedLayer)) return null;

    const topicRelationships = (embeddedLayer as any).getIndex?.('topic-relationships');
    if (!topicRelationships) return null;

    const relationships = topicRelationships.topic_relationships?.[topicId];
    if (!relationships) return null;

    return {
      ...relationships,
      learning_pathways: this.findLearningPathways(topicId, topicRelationships),
      related_by_domain: await this.findRelatedByDomain(topicId)
    };
  }

  /**
   * Find learning pathways that include this topic
   */
  private findLearningPathways(topicId: string, topicRelationships: any): string[] {
    if (!topicRelationships?.learning_pathways) return [];

    const pathways: string[] = [];
    for (const [pathwayName, topics] of Object.entries(topicRelationships.learning_pathways)) {
      if (Array.isArray(topics) && topics.includes(topicId)) {
        pathways.push(pathwayName);
      }
    }

    return pathways;
  }

  /**
   * Find topics related by domain using layer system
   */
  private async findRelatedByDomain(topicId: string): Promise<string[]> {
    const resolution = await this.layerService.resolveTopic(topicId);
    if (!resolution) return [];

    const targetDomain = resolution.topic.frontmatter.domain;
    const allTopicIds = this.layerService.getAllTopicIds();
    const relatedTopics: string[] = [];

    // Check first 50 topics to avoid performance issues
    for (const otherTopicId of allTopicIds.slice(0, 50)) {
      if (otherTopicId !== topicId) {
        const otherResolution = await this.layerService.resolveTopic(otherTopicId);
        if (otherResolution?.topic.frontmatter.domain === targetDomain) {
          relatedTopics.push(otherTopicId);
          if (relatedTopics.length >= 10) break; // Limit to 10
        }
      }
    }

    return relatedTopics;
  }

  /**
   * Find topics by type from frontmatter (e.g., 'code-pattern', 'workflow')
   */
  async findTopicsByType(type: string): Promise<AtomicTopic[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const allTopics = await this.layerService.getAllResolvedTopics();

      return allTopics.filter(topic => {
        const frontmatter = topic.frontmatter;
        return frontmatter && frontmatter.type === type;
      });
    } catch (error) {
      console.error(`Error finding topics by type '${type}':`, error);
      return [];
    }
  }

  /**
   * Get knowledge base statistics from layer system
   */
  getStatistics() {
    const layerStats = this.layerService.getLayerStatistics();

    // Get domain catalog from embedded layer
    const embeddedLayer = this.layerService.getLayer('embedded');
    const domainCatalog = embeddedLayer && 'getIndex' in embeddedLayer
      ? (embeddedLayer as any).getIndex?.('domain-catalog')
      : null;

    return {
      total_topics: layerStats.total.totalTopics,
      total_layers: layerStats.total.layers,
      layer_details: layerStats.layers,
      domains: domainCatalog?.domains || {},
      most_common_tags: domainCatalog?.global_statistics?.most_common_tags || [],
      initialized: this.initialized,
      last_loaded: new Date().toISOString(),
      memory_usage: layerStats.total.memoryUsage
    };
  }

  // ============================================================================
  // PERSONA-BASED METHODS
  // ============================================================================

  /**
   * Search topics by specialist persona
   */
  async searchTopicsBySpecialist(specialistId: string, query?: string, limit = 10): Promise<TopicSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.error(`🔍 Searching topics for specialist: ${specialistId}, query: "${query}"`);

    // Direct search within specialist's domain folder
    const searchResults = await this.layerService.searchTopics({
      domain: specialistId, // Persona ID as domain
      code_context: query,
      limit
    });

    console.error(`📊 Found ${searchResults.length} results for specialist ${specialistId}`);
    
    return searchResults;
  }

  /**
   * Get specialist consultation for a specific topic
   */
  async getSpecialistConsultation(topicId: string, question?: string): Promise<SpecialistConsultation> {
    if (!this.initialized) {
      await this.initialize();
    }

    const topic = await this.getTopic(topicId);
    if (!topic) {
      throw new Error(`Topic not found: ${topicId}`);
    }

    // Get specialist from topic's domain (should be persona ID)
    const specialist = this.personaRegistry.getSpecialist(topic.frontmatter.domain || '');
    if (!specialist) {
      throw new Error(`No specialist found for domain: ${topic.frontmatter.domain}`);
    }

    // Find related topics in same specialist area
    const relatedTopics = await this.searchTopicsBySpecialist(specialist.id, question, 5);

    return {
      topic,
      specialist,
      consultation_approach: this.generateConsultationApproach(specialist, topic, question),
      related_topics: relatedTopics,
      expertise_context: this.generateExpertiseContext(specialist, topic)
    };
  }

  /**
   * Natural language specialist consultation
   */
  async askSpecialist(question: string, specialistId?: string): Promise<SpecialistResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    let specialist: BCSpecialist;

    if (specialistId) {
      // Use specified specialist
      const requestedSpecialist = this.personaRegistry.getSpecialist(specialistId);
      if (!requestedSpecialist) {
        throw new Error(`Unknown specialist: ${specialistId}`);
      }
      specialist = requestedSpecialist;
    } else {
      // Infer specialist from question
      const inferredSpecialist = this.personaRegistry.inferSpecialistFromQuestion(question);
      if (!inferredSpecialist) {
        throw new Error('Could not determine appropriate specialist for question. Please specify a specialist ID.');
      }
      specialist = inferredSpecialist;
    }

    // Find relevant knowledge in specialist's domain
    const relevantTopics = await this.searchTopicsBySpecialist(specialist.id, question, 8);

    return {
      specialist,
      question,
      relevant_knowledge: relevantTopics,
      consultation_guidance: this.generateConsultationGuidance(specialist, question, relevantTopics),
      follow_up_suggestions: this.generateFollowUpSuggestions(specialist, question, relevantTopics),
      confidence_level: relevantTopics.length > 0 ? 'high' : 'medium'
    };
  }

  /**
   * Get all available specialists
   */
  getAllSpecialists(): BCSpecialist[] {
    return this.personaRegistry.getAllSpecialists();
  }

  /**
   * Get specialists by expertise area
   */
  getSpecialistsByExpertise(expertiseArea: string): BCSpecialist[] {
    return this.personaRegistry.getSpecialistsByExpertise(expertiseArea);
  }

  /**
   * Get specialist collaboration recommendations
   */
  getCollaboratingSpecialists(primarySpecialistId: string, question: string): BCSpecialist[] {
    const primarySpecialist = this.personaRegistry.getSpecialist(primarySpecialistId);
    if (!primarySpecialist) {
      return [];
    }
    return this.personaRegistry.getCollaboratingSpecialists(primarySpecialist, question);
  }

  /**
   * Find specialists by search query
   */
  findSpecialistsByQuery(query: string): BCSpecialist[] {
    const allSpecialists = this.personaRegistry.getAllSpecialists();
    const queryLower = query.toLowerCase();
    
    return allSpecialists.filter(specialist => {
      // Search in name, role, or any expertise area
      return specialist.name.toLowerCase().includes(queryLower) ||
             specialist.role.toLowerCase().includes(queryLower) ||
             specialist.expertise_areas.some(area => area.toLowerCase().includes(queryLower)) ||
             specialist.consultation_style.toLowerCase().includes(queryLower);
    });
  }

  // ============================================================================
  // PRIVATE HELPER METHODS FOR PERSONA CONSULTATION
  // ============================================================================

  private generateConsultationApproach(specialist: BCSpecialist, topic: AtomicTopic, question?: string): string {
    const baseApproach = `${specialist.name} approaches this topic with ${specialist.consultation_style.toLowerCase()}.`;
    
    if (question) {
      return `${baseApproach} For your specific question about "${question}", ${specialist.name} would focus on ${specialist.expertise_areas.slice(0, 3).join(', ')} aspects, providing ${specialist.communication_tone} guidance.`;
    }
    
    return `${baseApproach} This topic (${topic.frontmatter.title}) aligns with ${specialist.name}'s expertise in ${specialist.expertise_areas.slice(0, 3).join(', ')}.`;
  }

  private generateExpertiseContext(specialist: BCSpecialist, topic: AtomicTopic): string {
    return `${specialist.name} is particularly qualified to discuss "${topic.frontmatter.title}" because of their expertise in: ${specialist.expertise_areas.join(', ')}. Their ${specialist.communication_tone} approach focuses on ${specialist.consultation_style.toLowerCase()}.`;
  }

  private generateConsultationGuidance(specialist: BCSpecialist, question: string, relevantTopics: TopicSearchResult[]): string {
    let guidance = `${specialist.name} says: "${specialist.consultation_style}"\n\n`;
    
    if (relevantTopics.length > 0) {
      guidance += `Based on my expertise in ${specialist.expertise_areas.slice(0, 3).join(', ')}, here's what I recommend:\n\n`;
      guidance += `Key knowledge areas to explore:\n`;
      relevantTopics.slice(0, 3).forEach((topic, index) => {
        guidance += `${index + 1}. ${topic.title} - ${topic.summary}\n`;
      });
    } else {
      guidance += `While I don't have specific knowledge topics for this exact question, as ${specialist.role}, I'd approach this by focusing on ${specialist.expertise_areas.slice(0, 2).join(' and ')}.`;
    }
    
    return guidance;
  }

  private generateFollowUpSuggestions(specialist: BCSpecialist, question: string, relevantTopics: TopicSearchResult[]): string[] {
    const suggestions: string[] = [];
    
    // Add specialist-specific follow-ups
    if (specialist.typical_questions.length > 0) {
      suggestions.push(`Ask ${specialist.name}: "${specialist.typical_questions[0]}"`);
    }
    
    // Add topic-based suggestions
    if (relevantTopics.length > 0) {
      suggestions.push(`Explore the "${relevantTopics[0].title}" topic in detail`);
    }
    
    // Add expertise area suggestions
    const primaryExpertise = specialist.expertise_areas[0];
    suggestions.push(`Learn more about ${primaryExpertise} fundamentals`);
    
    // Add collaboration suggestions
    const collaborators = this.getCollaboratingSpecialists(specialist.id, question);
    if (collaborators.length > 0) {
      suggestions.push(`Consider also consulting ${collaborators[0].name} for ${collaborators[0].expertise_areas[0]} perspective`);
    }
    
    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }
}