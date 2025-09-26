import {
  AtomicTopic,
  TopicSearchParams,
  TopicSearchResult,
  BCKBConfig,
  isDomainMatch,
  getDomainList
} from '../types/bc-knowledge.js';
import { MultiContentLayerService } from '../services/multi-content-layer-service.js';
import { LayerResolutionResult } from '../types/layer-types.js';
import { SpecialistDefinition } from './specialist-loader.js';
import { SpecialistDiscoveryService } from './specialist-discovery.js';
import { SpecialistResponse } from '../types/roleplay-types.js';

/**
 * Business Central Knowledge Service
 *
 * Manages loading, caching, and searching of atomic BC knowledge topics
 * using the layered architecture system. Provides intelligent topic discovery
 * and relationship traversal with support for project overrides.
 */
export class KnowledgeService {
  private layerService: MultiContentLayerService;
  private initialized = false;

  constructor(private config: BCKBConfig, layerService?: MultiContentLayerService) {
    if (layerService) {
      // Use provided layer service (preferred - avoids duplicate initialization)
      this.layerService = layerService;
    } else {
      // Fallback: create own layer service (for backward compatibility)
      console.error(`⚠️  KnowledgeService creating own layer service - consider passing initialized layerService`);
      const embeddedPath = config.knowledge_base_path.includes('embedded-knowledge')
        ? config.knowledge_base_path
        : config.knowledge_base_path.replace(/\/knowledge-base$/, '/embedded-knowledge');

      console.error(`🔧 Using embedded path: ${embeddedPath}`);
      this.layerService = new MultiContentLayerService();
    }
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

      // Log initialization results - handle Map instead of array
      const layerResultsArray = Array.from(layerResults.entries());
      const successfulLayers = layerResultsArray.filter(([_, r]) => r.success);
      const totalTopics = successfulLayers.reduce((sum, [_, r]) => sum + (r.topics_loaded || 0), 0);

      console.error(`✅ Knowledge Service initialized with ${successfulLayers.length}/${layerResultsArray.length} layers and ${totalTopics} total topics`);

      // Log layer details
      for (const [layerName, result] of layerResultsArray) {
        if (result.success) {
          const specialistCount = result.content_counts?.specialists || 0;
          console.error(`  📚 ${layerName}: ${result.topics_loaded || 0} topics, ${specialistCount} specialists (${result.load_time_ms || 0}ms)`);
        } else {
          console.error(`  ❌ ${layerName}: Failed - ${result.error || 'Unknown error'}`);
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

    const targetDomains = getDomainList(resolution.topic.frontmatter.domain);
    const allTopicIds = this.layerService.getAllTopicIds();
    const relatedTopics: string[] = [];

    // Check first 50 topics to avoid performance issues
    for (const otherTopicId of allTopicIds.slice(0, 50)) {
      if (otherTopicId !== topicId) {
        const otherResolution = await this.layerService.resolveTopic(otherTopicId);
        if (otherResolution) {
          const otherDomains = getDomainList(otherResolution.topic.frontmatter.domain);
          // Check if there's any domain overlap
          const hasOverlap = targetDomains.some(targetDomain =>
            otherDomains.includes(targetDomain)
          );
          if (hasOverlap) {
            relatedTopics.push(otherTopicId);
            if (relatedTopics.length >= 10) break; // Limit to 10
          }
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
   * TODO: Refactor to use SpecialistDefinition
   */
  /*
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
  */

  /**
   * Get all available specialists
   */
  /**
   * Get all available specialists (delegates to MultiContentLayerService)
   */
  async getAllSpecialists(): Promise<SpecialistDefinition[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Delegate to the MultiContentLayerService which has specialist capabilities
    return await this.layerService.getAllSpecialists();
  }

  /**
   * Ask a specialist a question (delegates to MultiContentLayerService)
   */
  async askSpecialist(question: string, preferredSpecialist?: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Delegate to the MultiContentLayerService which has specialist capabilities
    return await this.layerService.askSpecialist(question, preferredSpecialist);
  }

  /**
   * Find specialists by query (delegates to MultiContentLayerService)
   */
  async findSpecialistsByQuery(query: string): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Delegate to the MultiContentLayerService which has specialist capabilities
    return await this.layerService.findSpecialistsByQuery(query);
  }



  /**
   * Get specialists by expertise area
   * TODO: Refactor to use SpecialistDefinition
   */
  /*
  getSpecialistsByExpertise(expertiseArea: string): BCSpecialist[] {
    return this.personaRegistry.getSpecialistsByExpertise(expertiseArea);
  }
  */

  /**
   * Generate consultation content from specialist
   */
  private generateConsultationContent(
    specialist: SpecialistDefinition, 
    question: string, 
    relevantTopics: TopicSearchResult[]
  ): string {
    let content = `${specialist.persona.greeting}\n\n`;
    
    content += `As ${specialist.title}, I can help you with this question about "${question}".\n\n`;
    
    if (relevantTopics.length > 0) {
      content += `Based on my expertise in ${specialist.expertise.primary.join(', ')}, here are some relevant insights:\n\n`;
      
      for (const topicResult of relevantTopics.slice(0, 3)) {
        content += `**${topicResult.title}**\n`;
        content += `${topicResult.summary || 'No description available'}\n\n`;
      }
      
      content += `These topics should provide a good starting point for your ${question}.\n\n`;
    } else {
      content += `While I don't have specific knowledge articles directly matching your question, `;
      content += `my expertise in ${specialist.expertise.primary.join(', ')} means I can help guide you `;
      content += `through ${specialist.domains.join(', ')} related challenges.\n\n`;
    }
    
    // Add specialist's characteristic approach
    if (specialist.when_to_use.length > 0) {
      content += `I'm particularly helpful when you need to:\n`;
      for (const useCase of specialist.when_to_use.slice(0, 3)) {
        content += `• ${useCase}\n`;
      }
      content += `\n`;
    }
    
    content += `Feel free to ask me more specific questions about your BC development challenge!`;
    
    return content;
  }
}