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
      // Layer service should already be initialized by server before creating services
      // Verify by checking if topics are available
      const allTopicIds = this.layerService.getAllTopicIds();
      if (allTopicIds.length === 0) {
        throw new Error('LayerService has no topics - must be initialized first');
      }

      this.initialized = true;
      console.error(`✅ Knowledge Service initialized with ${allTopicIds.length} total topics`);

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
  async getTopic(topicId: string, includeSamples = false, contextDomain?: string): Promise<AtomicTopic | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Resolve topic through layer system
    const resolution = await this.layerService.resolveTopic(topicId);
    if (!resolution) {
      // If exact match fails, suggest similar topics
      const suggestions = await this.layerService.findPartialTopicMatches(topicId);
      if (suggestions.length > 0) {
        const error = {
          error: 'Topic not found',
          message: `Topic ID '${topicId}' not found. Did you mean one of these?`,
          suggestions: suggestions.map(s => ({
            topic_id: s.id,
            title: s.title,
            domain: s.domain
          }))
        };
        // Return error object disguised as a topic for better UX
        return error as any;
      }
      
      // No partial matches found - try to extract domain from topic_id and show domain topics
      const domainMatch = topicId.match(/^([^/]+)\//);
      if (domainMatch) {
        const domain = domainMatch[1];
        const domainTopics = await this.layerService.getTopicsByDomain(domain);
        if (domainTopics.length > 0) {
          return {
            error: 'Topic not found',
            message: `Topic ID '${topicId}' not found in domain '${domain}'. Available topics in this domain:`,
            available_topics: domainTopics.map(t => ({
              topic_id: t.id,
              title: t.title
            }))
          } as any;
        }
      }
      
      // If we have context domain (from active specialist), show topics from that domain
      if (contextDomain) {
        const domainTopics = await this.layerService.getTopicsByDomain(contextDomain);
        if (domainTopics.length > 0) {
          return {
            error: 'Topic not found',
            message: `Topic ID '${topicId}' not found. Available topics in '${contextDomain}' domain:`,
            available_topics: domainTopics.map(t => ({
              topic_id: t.id,
              title: t.title
            })),
            hint: `You are currently working with the '${contextDomain}' specialist. Use full topic IDs like '${contextDomain}/topic-name'`
          } as any;
        }
      }
      
      // Last resort: show topics grouped by domain for easy navigation
      const allTopicIds = this.layerService.getAllTopicIds();
      const topicsByDomain: Record<string, string[]> = {};
      
      for (const id of allTopicIds) {
        const domain = id.split('/')[0];
        if (!topicsByDomain[domain]) topicsByDomain[domain] = [];
        topicsByDomain[domain].push(id);
      }
      
      // Show max 3 topics per domain, max 10 domains
      const domainSample: Record<string, string[]> = {};
      const domains = Object.keys(topicsByDomain).slice(0, 10);
      for (const domain of domains) {
        domainSample[domain] = topicsByDomain[domain].slice(0, 3);
      }
      
      return {
        error: 'Topic not found',
        message: `Topic ID '${topicId}' not found. Available topics by domain (showing ${domains.length} domains):`,
        topics_by_domain: domainSample,
        total_topics: allTopicIds.length,
        hint: 'Topic IDs follow the format: domain/topic-name. Use the domain that matches your current specialist.'
      } as any;
    }

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