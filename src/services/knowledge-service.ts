import { readFile, readdir, stat } from 'fs/promises';
import { join, basename, extname, relative } from 'path';
import glob from 'fast-glob';
import * as yaml from 'yaml';
import Fuse from 'fuse.js';
import {
  AtomicTopic,
  AtomicTopicFrontmatter,
  AtomicTopicFrontmatterSchema,
  TagIndex,
  DomainCatalog,
  TopicRelationships,
  BCVersionMatrix,
  TopicSearchParams,
  TopicSearchResult,
  BCKBConfig
} from '../types/bc-knowledge.js';

/**
 * Business Central Knowledge Service
 * 
 * Manages loading, caching, and searching of atomic BC knowledge topics.
 * Provides intelligent topic discovery and relationship traversal.
 */
export class KnowledgeService {
  private atomicTopics: Map<string, AtomicTopic> = new Map();
  private tagIndexes: Map<string, TagIndex> = new Map();
  private domainCatalog: DomainCatalog | null = null;
  private topicRelationships: TopicRelationships | null = null;
  private bcVersionMatrix: BCVersionMatrix | null = null;
  private searchIndex: Fuse<AtomicTopic> | null = null;
  private initialized = false;

  constructor(private config: BCKBConfig) {}

  /**
   * Initialize the knowledge service by loading all indexes and topics
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('Initializing BC Knowledge Service...');
    
    try {
      // Load all indexes first (fast)
      await this.loadTagIndexes();
      await this.loadDomainCatalog();
      await this.loadTopicRelationships();
      await this.loadBCVersionMatrix();
      
      // Load atomic topics (slower, but necessary for search)
      await this.loadAtomicTopics();
      
      // Initialize search index
      this.initializeSearchIndex();
      
      this.initialized = true;
      console.error(`Knowledge Service initialized with ${this.atomicTopics.size} topics`);
    } catch (error) {
      console.error('❌ Failed to initialize Knowledge Service:', error);
      throw error;
    }
  }

  /**
   * Load all tag-based indexes from JSON files
   */
  private async loadTagIndexes(): Promise<void> {
    const tagsPath = join(this.config.indexes_path, 'tags');
    const tagFiles = await glob('*.json', { cwd: tagsPath });
    
    for (const tagFile of tagFiles) {
      const tagName = basename(tagFile, '.json');
      const filePath = join(tagsPath, tagFile);
      
      try {
        const content = await readFile(filePath, 'utf-8');
        // Remove BOM if present
        const cleanContent = content.replace(/^\uFEFF/, '');
        const topics = JSON.parse(cleanContent) as string[];
        
        this.tagIndexes.set(tagName, {
          tag: tagName,
          topics,
          count: topics.length
        });
      } catch (error) {
        console.error(`Failed to load tag index ${tagFile}:`, error);
      }
    }
    
    console.error(`Loaded ${this.tagIndexes.size} tag indexes`);
  }

  /**
   * Load domain catalog from JSON
   */
  private async loadDomainCatalog(): Promise<void> {
    const catalogPath = join(this.config.indexes_path, 'domain-catalog.json');
    
    try {
      const content = await readFile(catalogPath, 'utf-8');
      // Remove BOM if present
      const cleanContent = content.replace(/^\uFEFF/, '');
      this.domainCatalog = JSON.parse(cleanContent) as DomainCatalog;
      console.error(`Loaded domain catalog with ${Object.keys(this.domainCatalog.domains).length} domains`);
    } catch (error) {
      console.error('Failed to load domain catalog:', error);
    }
  }

  /**
   * Load topic relationships from JSON
   */
  private async loadTopicRelationships(): Promise<void> {
    const relationshipsPath = join(this.config.indexes_path, 'topic-relationships.json');
    
    try {
      const content = await readFile(relationshipsPath, 'utf-8');
      // Remove BOM if present
      const cleanContent = content.replace(/^\uFEFF/, '');
      this.topicRelationships = JSON.parse(cleanContent) as TopicRelationships;
      console.error(`Loaded ${this.topicRelationships.metadata.total_mapped_topics} topic relationships`);
    } catch (error) {
      console.error('Failed to load topic relationships:', error);
    }
  }

  /**
   * Load BC version compatibility matrix
   */
  private async loadBCVersionMatrix(): Promise<void> {
    const matrixPath = join(this.config.indexes_path, 'bc-version-matrix.json');
    
    try {
      const content = await readFile(matrixPath, 'utf-8');
      // Remove BOM if present
      const cleanContent = content.replace(/^\uFEFF/, '');
      this.bcVersionMatrix = JSON.parse(cleanContent) as BCVersionMatrix;
      console.error(`Loaded BC version matrix for ${this.bcVersionMatrix.metadata.versions_covered} versions`);
    } catch (error) {
      console.error('Failed to load BC version matrix:', error);
    }
  }

  /**
   * Load all atomic topics from markdown files
   */
  private async loadAtomicTopics(): Promise<void> {
    const topicsPattern = join(this.config.knowledge_base_path, 'domains', '**', '*.md').replace(/\\/g, '/');
    console.error(`Debug: Looking for topics with pattern: ${topicsPattern}`);
    const topicFiles = await glob(topicsPattern, { 
      ignore: ['**/samples/**'] // Ignore sample files
    });
    
    console.error(`Loading ${topicFiles.length} atomic topics...`);
    if (topicFiles.length === 0) {
      console.error(`Debug: No files found. Knowledge base path: ${this.config.knowledge_base_path}`);
    }
    
    for (const filePath of topicFiles) {
      try {
        const topic = await this.loadAtomicTopic(filePath);
        if (topic) {
          this.atomicTopics.set(topic.id, topic);
        } else {
          console.error(`Debug: Topic returned null for ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to load topic ${filePath}:`, error);
      }
    }
  }

  /**
   * Load a single atomic topic from a markdown file
   */
  private async loadAtomicTopic(filePath: string): Promise<AtomicTopic | null> {
    const content = await readFile(filePath, 'utf-8');
    const stats = await stat(filePath);
    
    // Normalize line endings to Unix format
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Extract YAML frontmatter
    const frontmatterMatch = normalizedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      console.error(`No frontmatter found in ${filePath}`);
      return null;
    }
    
    const [, frontmatterContent, markdownContent] = frontmatterMatch;
    
    // Parse and validate frontmatter
    const frontmatterData = yaml.parse(frontmatterContent || '');
    const frontmatter = AtomicTopicFrontmatterSchema.parse(frontmatterData);
    
    // Generate topic ID from file path
    const relativePath = relative(this.config.knowledge_base_path, filePath || '');
    const topicId = relativePath.replace(/\.md$/, '').replace(/[/\\]/g, '/');
    
    // Load companion sample file if exists
    let samples: { filePath: string; content: string } | undefined;
    if (frontmatter.samples) {
      const samplesPath = join(filePath, '..', frontmatter.samples);
      try {
        const sampleContent = await readFile(samplesPath, 'utf-8');
        samples = { filePath: samplesPath, content: sampleContent };
      } catch {
        // Sample file doesn't exist, which is OK
      }
    }
    
    return {
      id: topicId,
      filePath,
      frontmatter,
      content: markdownContent?.trim() || '',
      wordCount: markdownContent?.split(/\s+/).length || 0,
      lastModified: stats.mtime,
      samples: samples || undefined
    };
  }

  /**
   * Initialize fuzzy search index for intelligent topic discovery
   */
  private initializeSearchIndex(): void {
    const topics = Array.from(this.atomicTopics.values());
    
    this.searchIndex = new Fuse(topics, {
      keys: [
        { name: 'frontmatter.title', weight: 0.3 },
        { name: 'frontmatter.tags', weight: 0.25 },
        { name: 'frontmatter.domain', weight: 0.2 },
        { name: 'content', weight: 0.15 },
        { name: 'frontmatter.prerequisites', weight: 0.05 },
        { name: 'frontmatter.related_topics', weight: 0.05 }
      ],
      threshold: this.config.search_threshold,
      includeScore: true,
      includeMatches: true
    });
    
    console.error('Search index initialized');
  }

  /**
   * Search for topics based on various criteria
   */
  async searchTopics(params: TopicSearchParams): Promise<TopicSearchResult[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: TopicSearchResult[] = [];
    const limit = params.limit || this.config.max_search_results;

    // Tag-based search (fastest)
    if (params.tags && params.tags.length > 0) {
      const tagResults = this.searchByTags(params.tags, limit);
      results.push(...tagResults);
    }

    // Domain-based search
    if (params.domain) {
      const domainResults = this.searchByDomain(params.domain, limit);
      results.push(...domainResults);
    }

    // Code context search (most intelligent)
    if (params.code_context && this.searchIndex) {
      const contextResults = this.searchByCodeContext(params.code_context, limit);
      results.push(...contextResults);
    }

    // Fuzzy text search fallback
    if (results.length === 0 && this.searchIndex) {
      const query = [
        params.domain,
        ...(params.tags || []),
        params.code_context
      ].filter(Boolean).join(' ');
      
      if (query) {
        const fuzzyResults = this.searchIndex.search(query, { limit });
        results.push(...fuzzyResults.map(result => this.topicToSearchResult(result.item, result.score || 0)));
      }
    }

    // Filter by difficulty and BC version
    let filteredResults = results;
    if (params.difficulty) {
      filteredResults = filteredResults.filter(r => r.difficulty === params.difficulty);
    }
    if (params.bc_version) {
      filteredResults = this.filterByBCVersion(filteredResults, params.bc_version);
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = this.deduplicateResults(filteredResults);
    return uniqueResults.slice(0, limit);
  }

  /**
   * Search topics by tags using tag indexes
   */
  private searchByTags(tags: string[], limit: number): TopicSearchResult[] {
    const results: TopicSearchResult[] = [];
    const seenTopics = new Set<string>();

    for (const tag of tags) {
      const tagIndex = this.tagIndexes.get(tag.toLowerCase());
      if (!tagIndex) continue;

      for (const topicPath of tagIndex.topics) {
        if (seenTopics.has(topicPath)) continue;
        seenTopics.add(topicPath);

        // Convert path to topic ID and look up topic
        const topicId = topicPath.replace(/\.md$/, '').replace(/[/\\]/g, '/');
        const topic = this.atomicTopics.get(topicId);
        if (topic) {
          results.push(this.topicToSearchResult(topic, 0.9)); // High relevance for tag matches
        }

        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Search topics by domain
   */
  private searchByDomain(domain: string, limit: number): TopicSearchResult[] {
    const results: TopicSearchResult[] = [];
    
    for (const topic of this.atomicTopics.values()) {
      if (topic.frontmatter.domain.toLowerCase() === domain.toLowerCase()) {
        results.push(this.topicToSearchResult(topic, 0.8)); // High relevance for domain matches
      }
      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Intelligent search based on code context
   */
  private searchByCodeContext(codeContext: string, limit: number): TopicSearchResult[] {
    if (!this.searchIndex) return [];

    // Extract AL patterns from code context
    const alPatterns = this.extractALPatterns(codeContext);
    
    // Search using extracted patterns
    const searchQuery = alPatterns.join(' ');
    const results = this.searchIndex.search(searchQuery, { limit });
    
    return results.map(result => this.topicToSearchResult(result.item, result.score || 0));
  }

  /**
   * Extract AL language patterns from code context
   */
  private extractALPatterns(code: string): string[] {
    const patterns: string[] = [];
    
    // Common AL patterns to search for
    const alPatterns = [
      /CalcFields\s*\(/gi,
      /SetLoadFields\s*\(/gi,
      /FindSet\s*\(/gi,
      /CalcSums\s*\(/gi,
      /SumIndexFields/gi,
      /MaintainSIFTIndex/gi,
      /FlowField/gi,
      /SetRange\s*\(/gi,
      /TestField\s*\(/gi,
      /FieldError\s*\(/gi,
      /DeleteAll\s*\(/gi,
      /table\s+\d+/gi,
      /codeunit\s+\d+/gi,
      /page\s+\d+/gi
    ];

    for (const pattern of alPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        patterns.push(...matches.map(m => m.toLowerCase().replace(/[^a-z]/g, '')));
      }
    }

    return patterns;
  }

  /**
   * Convert AtomicTopic to TopicSearchResult
   */
  private topicToSearchResult(topic: AtomicTopic, relevanceScore: number): TopicSearchResult {
    // Generate summary from first paragraph of content
    const firstParagraph = topic.content.split('\n\n')[0]?.replace(/[#*`]/g, '').trim() || '';
    const summary = firstParagraph.length > 200 
      ? firstParagraph.substring(0, 200) + '...' 
      : firstParagraph;

    return {
      id: topic.id,
      title: topic.frontmatter.title,
      domain: topic.frontmatter.domain,
      difficulty: topic.frontmatter.difficulty,
      relevance_score: 1 - relevanceScore, // Fuse.js uses lower scores for better matches
      summary,
      tags: topic.frontmatter.tags,
      prerequisites: topic.frontmatter.prerequisites || [],
      estimated_time: topic.frontmatter.estimated_time || undefined
    };
  }

  /**
   * Filter results by BC version compatibility
   */
  private filterByBCVersion(results: TopicSearchResult[], bcVersion: string): TopicSearchResult[] {
    if (!this.bcVersionMatrix) return results;

    return results.filter(result => {
      const topic = this.atomicTopics.get(result.id);
      if (!topic) return false;

      // Simple version compatibility check (can be enhanced)
      const topicVersion = topic.frontmatter.bc_versions;
      const requestedVersion = parseInt(bcVersion.replace(/\D/g, ''));
      const topicMinVersion = parseInt(topicVersion.replace(/\D/g, ''));

      return requestedVersion >= topicMinVersion;
    });
  }

  /**
   * Remove duplicate results and sort by relevance
   */
  private deduplicateResults(results: TopicSearchResult[]): TopicSearchResult[] {
    const seen = new Set<string>();
    const unique: TopicSearchResult[] = [];

    // Sort by relevance score (higher is better)
    const sorted = results.sort((a, b) => b.relevance_score - a.relevance_score);

    for (const result of sorted) {
      if (!seen.has(result.id)) {
        seen.add(result.id);
        unique.push(result);
      }
    }

    return unique;
  }

  /**
   * Get a specific topic by ID with all details
   */
  async getTopic(topicId: string, includeSamples = false): Promise<AtomicTopic | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const topic = this.atomicTopics.get(topicId);
    if (!topic) return null;

    // Return copy to prevent mutation
    const result = { ...topic };
    if (!includeSamples) {
      delete result.samples;
    }

    return result;
  }

  /**
   * Get topic relationships and learning paths
   */
  getTopicRelationships(topicId: string) {
    if (!this.topicRelationships) return null;

    const relationships = this.topicRelationships.topic_relationships[topicId];
    if (!relationships) return null;

    return {
      ...relationships,
      learning_pathways: this.findLearningPathways(topicId),
      related_by_domain: this.findRelatedByDomain(topicId)
    };
  }

  /**
   * Find learning pathways that include this topic
   */
  private findLearningPathways(topicId: string): string[] {
    if (!this.topicRelationships) return [];

    const pathways: string[] = [];
    for (const [pathwayName, topics] of Object.entries(this.topicRelationships.learning_pathways)) {
      if (topics.includes(topicId)) {
        pathways.push(pathwayName);
      }
    }

    return pathways;
  }

  /**
   * Find topics related by domain
   */
  private findRelatedByDomain(topicId: string): string[] {
    const topic = this.atomicTopics.get(topicId);
    if (!topic) return [];

    const relatedTopics: string[] = [];
    for (const [id, otherTopic] of this.atomicTopics) {
      if (id !== topicId && otherTopic.frontmatter.domain === topic.frontmatter.domain) {
        relatedTopics.push(id);
      }
    }

    return relatedTopics.slice(0, 10); // Limit to 10 related topics
  }

  /**
   * Get knowledge base statistics
   */
  getStatistics() {
    return {
      total_topics: this.atomicTopics.size,
      total_tags: this.tagIndexes.size,
      domains: this.domainCatalog?.domains || {},
      most_common_tags: this.domainCatalog?.global_statistics.most_common_tags || [],
      initialized: this.initialized,
      last_loaded: new Date().toISOString()
    };
  }
}