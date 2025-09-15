/**
 * Intelligent Search Engine with AI-Powered Recommendations
 *
 * Advanced search capabilities including semantic search, context understanding,
 * intelligent topic recommendations, and learning from user patterns.
 */

import { AtomicTopic, TopicSearchParams, TopicSearchResult } from '../types/bc-knowledge.js';
import Fuse from 'fuse.js';

export interface SearchContext {
  user_code_context?: string;
  current_domain?: string;
  difficulty_preference?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  recent_topics?: string[];
  user_skill_level?: number; // 1-10 scale
  project_type?: 'new' | 'maintenance' | 'optimization' | 'migration';
}

export interface SmartSearchResult extends TopicSearchResult {
  relevance_reasons: string[];
  learning_path_position?: number;
  prerequisite_satisfaction_score?: number;
  difficulty_match_score?: number;
  context_relevance_score?: number;
  recommendation_strength?: 'high' | 'medium' | 'low';
}

export interface TopicRecommendation {
  topic_id: string;
  title: string;
  reason: string;
  confidence: number;
  type: 'prerequisite' | 'related' | 'next_step' | 'alternative' | 'deep_dive';
  estimated_value: number; // How valuable this recommendation is (1-10)
}

export interface LearningPath {
  path_id: string;
  name: string;
  description: string;
  topics: Array<{
    topic_id: string;
    position: number;
    is_required: boolean;
    estimated_time: string;
  }>;
  total_estimated_time: string;
  difficulty_progression: string[];
  success_criteria: string[];
}

export class IntelligentSearchEngine {
  private searchIndex: Fuse<AtomicTopic> | null = null;
  private topicRelationships = new Map<string, string[]>();
  private searchHistory: Array<{ query: string; results: string[]; timestamp: number }> = [];
  private userPreferences = new Map<string, number>(); // topic_id -> preference score

  constructor(
    private readonly enableSemanticSearch: boolean = true,
    private readonly enableLearningRecommendations: boolean = true,
    private readonly maxSearchHistory: number = 100
  ) {
    console.log('🧠 Intelligent search engine initialized');
  }

  /**
   * Build intelligent search index from topics
   */
  buildSearchIndex(topics: AtomicTopic[]): void {
    console.log(`🔍 Building intelligent search index with ${topics.length} topics...`);

    // Build enhanced Fuse.js index with semantic weighting
    this.searchIndex = new Fuse(topics, {
      keys: [
        { name: 'frontmatter.title', weight: 0.25 },
        { name: 'frontmatter.tags', weight: 0.2 },
        { name: 'frontmatter.domain', weight: 0.15 },
        { name: 'content', weight: 0.15 },
        { name: 'frontmatter.prerequisites', weight: 0.1 },
        { name: 'frontmatter.related_topics', weight: 0.1 },
        { name: 'samples.content', weight: 0.05 }
      ],
      threshold: 0.3, // More permissive for better semantic matching
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 2,
      ignoreLocation: true, // Better for semantic search
      useExtendedSearch: true
    });

    // Build topic relationship graph
    this.buildTopicRelationships(topics);

    console.log('✅ Intelligent search index built successfully');
  }

  /**
   * Perform intelligent search with context awareness
   */
  async intelligentSearch(
    query: string,
    context: SearchContext,
    limit: number = 10
  ): Promise<SmartSearchResult[]> {
    if (!this.searchIndex) {
      throw new Error('Search index not initialized');
    }

    const startTime = Date.now();

    // Enhanced query processing
    const processedQuery = this.processSearchQuery(query, context);

    // Perform base search
    const searchResults = this.searchIndex.search(processedQuery, { limit: limit * 2 });

    // Transform to smart results with AI-powered enhancements
    const smartResults: SmartSearchResult[] = [];

    for (const result of searchResults.slice(0, limit)) {
      const topic = result.item;
      const baseResult = this.topicToSearchResult(topic, result.score || 0);

      const smartResult: SmartSearchResult = {
        ...baseResult,
        relevance_reasons: this.calculateRelevanceReasons(topic, query, context, Array.from(result.matches || [])),
        learning_path_position: this.calculateLearningPathPosition(topic, context),
        prerequisite_satisfaction_score: this.calculatePrerequisiteSatisfaction(topic, context),
        difficulty_match_score: this.calculateDifficultyMatch(topic, context),
        context_relevance_score: this.calculateContextRelevance(topic, context),
        recommendation_strength: this.calculateRecommendationStrength(topic, context, result.score || 0)
      };

      smartResults.push(smartResult);
    }

    // Re-rank results based on AI scoring
    const rerankedResults = this.reRankResults(smartResults, context);

    // Track search for learning
    this.trackSearch(query, rerankedResults.map(r => r.id));

    const duration = Date.now() - startTime;
    console.log(`🔍 Intelligent search completed in ${duration}ms (${rerankedResults.length} results)`);

    return rerankedResults;
  }

  /**
   * Generate intelligent topic recommendations based on context
   */
  async getTopicRecommendations(
    currentTopic: string,
    context: SearchContext,
    maxRecommendations: number = 5
  ): Promise<TopicRecommendation[]> {
    const recommendations: TopicRecommendation[] = [];

    // Get related topics from relationship graph
    const relatedTopics = this.topicRelationships.get(currentTopic) || [];

    // Generate different types of recommendations
    const prerequisiteRecs = this.generatePrerequisiteRecommendations(currentTopic, context);
    const nextStepRecs = this.generateNextStepRecommendations(currentTopic, context);
    const alternativeRecs = this.generateAlternativeRecommendations(currentTopic, context);
    const deepDiveRecs = this.generateDeepDiveRecommendations(currentTopic, context);

    recommendations.push(...prerequisiteRecs, ...nextStepRecs, ...alternativeRecs, ...deepDiveRecs);

    // Score and sort recommendations
    const scoredRecommendations = recommendations
      .map(rec => ({
        ...rec,
        final_score: this.calculateRecommendationScore(rec, context)
      }))
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, maxRecommendations);

    return scoredRecommendations.map(({ final_score, ...rec }) => rec);
  }

  /**
   * Generate personalized learning path
   */
  async generateLearningPath(
    goal: string,
    context: SearchContext
  ): Promise<LearningPath> {
    // This is a simplified implementation - in practice would use ML models
    const pathTopics = await this.findPathTopics(goal, context);

    const learningPath: LearningPath = {
      path_id: `path_${Date.now()}`,
      name: `Learning Path: ${goal}`,
      description: `Personalized learning path to master ${goal} based on your experience level and context`,
      topics: pathTopics.map((topic, index) => ({
        topic_id: topic.id,
        position: index + 1,
        is_required: index < pathTopics.length * 0.7, // First 70% are required
        estimated_time: topic.estimated_time || '15-30 minutes'
      })),
      total_estimated_time: this.calculateTotalTime(pathTopics),
      difficulty_progression: this.calculateDifficultyProgression(pathTopics),
      success_criteria: this.generateSuccessCriteria(goal, pathTopics)
    };

    return learningPath;
  }

  /**
   * Update user preferences based on interaction patterns
   */
  updateUserPreferences(
    viewedTopics: string[],
    positiveInteractions: string[],
    negativeInteractions: string[] = []
  ): void {
    if (!this.enableLearningRecommendations) return;

    // Increase preference for positively interacted topics
    for (const topicId of positiveInteractions) {
      const current = this.userPreferences.get(topicId) || 0;
      this.userPreferences.set(topicId, Math.min(10, current + 1));
    }

    // Decrease preference for negatively interacted topics
    for (const topicId of negativeInteractions) {
      const current = this.userPreferences.get(topicId) || 0;
      this.userPreferences.set(topicId, Math.max(0, current - 1));
    }

    // Small positive signal for viewed topics
    for (const topicId of viewedTopics) {
      if (!positiveInteractions.includes(topicId)) {
        const current = this.userPreferences.get(topicId) || 0;
        this.userPreferences.set(topicId, Math.min(10, current + 0.1));
      }
    }

    console.log(`🎯 Updated user preferences for ${viewedTopics.length} topics`);
  }

  // Private helper methods

  private processSearchQuery(query: string, context: SearchContext): string {
    let processedQuery = query.trim();

    // Add context-aware query expansion
    if (context.current_domain) {
      processedQuery += ` domain:${context.current_domain}`;
    }

    if (context.user_code_context) {
      // Extract relevant keywords from code context
      const codeKeywords = this.extractCodeKeywords(context.user_code_context);
      processedQuery += ` ${codeKeywords.join(' ')}`;
    }

    return processedQuery;
  }

  private calculateRelevanceReasons(
    topic: AtomicTopic,
    query: string,
    context: SearchContext,
    matches: any[]
  ): string[] {
    const reasons: string[] = [];

    // Analyze matches to provide explanations
    for (const match of matches) {
      if (match.key === 'frontmatter.title') {
        reasons.push('Title matches your search query');
      } else if (match.key === 'frontmatter.tags') {
        reasons.push('Tags are highly relevant to your query');
      } else if (match.key === 'content') {
        reasons.push('Content contains relevant information');
      } else if (match.key === 'frontmatter.domain' && context.current_domain) {
        reasons.push('In your current working domain');
      }
    }

    // Context-based reasons
    if (topic.frontmatter.difficulty === context.difficulty_preference) {
      reasons.push('Matches your preferred difficulty level');
    }

    if (context.recent_topics?.includes(topic.id)) {
      reasons.push('Recently viewed topic');
    }

    // User preference reasons
    const userPreference = this.userPreferences.get(topic.id) || 0;
    if (userPreference > 7) {
      reasons.push('Highly rated based on your history');
    }

    return reasons.length > 0 ? reasons : ['Content relevance match'];
  }

  private calculateLearningPathPosition(topic: AtomicTopic, context: SearchContext): number | undefined {
    // Simplified calculation - would be more sophisticated in practice
    const difficultyOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
    return difficultyOrder.indexOf(topic.frontmatter.difficulty) + 1;
  }

  private calculatePrerequisiteSatisfaction(topic: AtomicTopic, context: SearchContext): number {
    const prerequisites = topic.frontmatter.prerequisites || [];
    if (prerequisites.length === 0) return 100;

    const recentTopics = context.recent_topics || [];
    const satisfiedPrereqs = prerequisites.filter(prereq =>
      recentTopics.some(recent => recent.includes(prereq))
    );

    return (satisfiedPrereqs.length / prerequisites.length) * 100;
  }

  private calculateDifficultyMatch(topic: AtomicTopic, context: SearchContext): number {
    if (!context.difficulty_preference) return 50;

    const difficultyOrder = ['beginner', 'intermediate', 'advanced', 'expert'];
    const topicLevel = difficultyOrder.indexOf(topic.frontmatter.difficulty);
    const userLevel = difficultyOrder.indexOf(context.difficulty_preference);

    // Perfect match = 100, adjacent levels = 70, further = lower
    const distance = Math.abs(topicLevel - userLevel);
    return Math.max(0, 100 - (distance * 30));
  }

  private calculateContextRelevance(topic: AtomicTopic, context: SearchContext): number {
    let score = 0;

    // Domain match
    if (context.current_domain && topic.frontmatter.domain === context.current_domain) {
      score += 40;
    }

    // Code context relevance
    if (context.user_code_context) {
      const codeKeywords = this.extractCodeKeywords(context.user_code_context);
      const topicContent = topic.content.toLowerCase();
      const matchingKeywords = codeKeywords.filter(keyword =>
        topicContent.includes(keyword.toLowerCase())
      );
      score += (matchingKeywords.length / codeKeywords.length) * 30;
    }

    // Project type relevance
    if (context.project_type) {
      const projectKeywords = {
        'new': ['setup', 'getting started', 'fundamentals', 'basics'],
        'maintenance': ['debugging', 'troubleshooting', 'best practices'],
        'optimization': ['performance', 'optimization', 'efficiency'],
        'migration': ['migration', 'upgrade', 'transition']
      };

      const relevantKeywords = projectKeywords[context.project_type] || [];
      const topicContent = topic.content.toLowerCase();
      const matches = relevantKeywords.filter(keyword =>
        topicContent.includes(keyword)
      );
      score += (matches.length > 0) ? 30 : 0;
    }

    return Math.min(100, score);
  }

  private calculateRecommendationStrength(
    topic: AtomicTopic,
    context: SearchContext,
    searchScore: number
  ): 'high' | 'medium' | 'low' {
    const contextScore = this.calculateContextRelevance(topic, context);
    const difficultyScore = this.calculateDifficultyMatch(topic, context);
    const prerequisiteScore = this.calculatePrerequisiteSatisfaction(topic, context);

    const combinedScore = (contextScore + difficultyScore + prerequisiteScore + (100 - searchScore * 100)) / 4;

    if (combinedScore > 75) return 'high';
    if (combinedScore > 50) return 'medium';
    return 'low';
  }

  private reRankResults(results: SmartSearchResult[], context: SearchContext): SmartSearchResult[] {
    return results.sort((a, b) => {
      // Weight different factors
      const scoreA = (a.context_relevance_score || 0) * 0.3 +
                    (a.difficulty_match_score || 0) * 0.25 +
                    (a.prerequisite_satisfaction_score || 0) * 0.2 +
                    a.relevance_score * 0.25;

      const scoreB = (b.context_relevance_score || 0) * 0.3 +
                    (b.difficulty_match_score || 0) * 0.25 +
                    (b.prerequisite_satisfaction_score || 0) * 0.2 +
                    b.relevance_score * 0.25;

      return scoreB - scoreA;
    });
  }

  private buildTopicRelationships(topics: AtomicTopic[]): void {
    for (const topic of topics) {
      const relationships = [
        ...(topic.frontmatter.prerequisites || []),
        ...(topic.frontmatter.related_topics || [])
      ];

      this.topicRelationships.set(topic.id, relationships);
    }
  }

  private extractCodeKeywords(codeContext: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const keywords = codeContext
      .toLowerCase()
      .match(/\b(procedure|function|table|field|record|page|report|codeunit|query|flowfield|sift|calcsum|setrange|findset)\w*\b/g) || [];

    return [...new Set(keywords)]; // Remove duplicates
  }

  private topicToSearchResult(topic: AtomicTopic, relevanceScore: number): TopicSearchResult {
    const firstParagraph = topic.content.split('\n\n')[0]?.replace(/[#*`]/g, '').trim() || '';
    const summary = firstParagraph.length > 200
      ? firstParagraph.substring(0, 200) + '...'
      : firstParagraph;

    return {
      id: topic.id,
      title: topic.frontmatter.title,
      domain: topic.frontmatter.domain,
      difficulty: topic.frontmatter.difficulty,
      relevance_score: 1 - relevanceScore,
      summary,
      tags: topic.frontmatter.tags,
      prerequisites: topic.frontmatter.prerequisites || [],
      estimated_time: topic.frontmatter.estimated_time
    };
  }

  private trackSearch(query: string, resultTopicIds: string[]): void {
    this.searchHistory.push({
      query,
      results: resultTopicIds,
      timestamp: Date.now()
    });

    // Keep only recent history
    if (this.searchHistory.length > this.maxSearchHistory) {
      this.searchHistory.shift();
    }
  }

  // Placeholder methods for recommendation generation (would be more sophisticated in practice)
  private generatePrerequisiteRecommendations(topicId: string, context: SearchContext): TopicRecommendation[] {
    return []; // Implementation would analyze prerequisites and user knowledge
  }

  private generateNextStepRecommendations(topicId: string, context: SearchContext): TopicRecommendation[] {
    return []; // Implementation would suggest logical next topics
  }

  private generateAlternativeRecommendations(topicId: string, context: SearchContext): TopicRecommendation[] {
    return []; // Implementation would find alternative approaches
  }

  private generateDeepDiveRecommendations(topicId: string, context: SearchContext): TopicRecommendation[] {
    return []; // Implementation would suggest advanced/related topics
  }

  private calculateRecommendationScore(rec: TopicRecommendation, context: SearchContext): number {
    return rec.confidence * rec.estimated_value; // Simple scoring
  }

  private async findPathTopics(goal: string, context: SearchContext): Promise<TopicSearchResult[]> {
    // Simplified implementation - would use more sophisticated path finding
    return [];
  }

  private calculateTotalTime(topics: TopicSearchResult[]): string {
    // Simple time calculation
    return topics.length > 0 ? `${topics.length * 20} minutes` : '0 minutes';
  }

  private calculateDifficultyProgression(topics: TopicSearchResult[]): string[] {
    return topics.map(t => t.difficulty);
  }

  private generateSuccessCriteria(goal: string, topics: TopicSearchResult[]): string[] {
    return [
      `Understand core concepts of ${goal}`,
      `Apply knowledge in practical scenarios`,
      `Complete all required topics with comprehension`
    ];
  }
}