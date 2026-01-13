/**
 * RelevanceIndexService
 *
 * Indexes all knowledge topics at startup using BM25 for fast relevance matching.
 * Replaces regex-based pattern detection with knowledge-driven discovery.
 *
 * ## Design Principles
 *
 * 1. **Knowledge-First**: Detection signals come from knowledge files, not hardcoded patterns
 * 2. **Fast First-Pass**: BM25 provides sub-millisecond relevance scoring
 * 3. **Backward Compatible**: Topics without relevance_signals are indexed by title/tags/content
 * 4. **Layer-Aware**: Respects layer priority (project > team > company > embedded)
 */

import BM25 from 'wink-bm25-text-search';
import winkNLP from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import { MultiContentLayerService } from './multi-content-layer-service.js';
import { RelevanceSignals } from '../types/bc-knowledge.js';

export interface CodeCharacteristics {
  /** Detected AL constructs (FindSet, repeat, CalcFields, etc.) */
  constructs: string[];

  /** AL object type if detectable (codeunit, page, table, etc.) */
  objectType: string | null;

  /** Semantic flags for quick filtering */
  hasLoops: boolean;
  hasFieldAccess: boolean;
  hasRecordOperations: boolean;
  hasValidation: boolean;
  hasErrorHandling: boolean;
  hasSecurityCalls: boolean;

  /** Raw tokens for BM25 matching */
  tokens: string[];
}

export interface RelevanceMatch {
  topicId: string;
  title: string;
  relevanceScore: number;        // 0.0 - 1.0 normalized
  matchedSignals: string[];      // Which constructs/keywords matched
  domain: string;
  category?: string;
  severity?: string;
  patternType?: 'good' | 'bad' | 'unknown';
  applicableObjectTypes?: string[];
}

export interface FindRelevantTopicsOptions {
  /** Maximum topics to return (default: 10) */
  limit?: number;

  /** Minimum relevance score threshold (default: 0.3) */
  minScore?: number;

  /** Filter by AL object type */
  objectType?: string;

  /** Filter by category (performance, security, etc.) */
  category?: string;

  /** Include topics without relevance_signals (legacy mode) */
  includeLegacyTopics?: boolean;
}

interface TopicMetadata {
  title: string;
  domain: string;
  category?: string;
  severity?: string;
  patternType?: 'good' | 'bad' | 'unknown';
  applicableObjectTypes?: string[];
  relevanceThreshold?: number;
  hasRelevanceSignals: boolean;
  relevanceSignals?: RelevanceSignals;
}

export class RelevanceIndexService {
  private engine: BM25 | null = null;
  private nlp: ReturnType<typeof winkNLP>;
  private initialized: boolean = false;
  private topicMetadata: Map<string, TopicMetadata> = new Map();

  // AL construct detection patterns (simple, fast regex)
  private readonly constructPatterns: Array<{ name: string; pattern: RegExp }> = [
    { name: 'FindSet', pattern: /\.FindSet\s*\(/gi },
    { name: 'FindFirst', pattern: /\.FindFirst\s*\(/gi },
    { name: 'FindLast', pattern: /\.FindLast\s*\(/gi },
    { name: 'Next', pattern: /\.Next\s*\(/gi },
    { name: 'repeat', pattern: /\brepeat\b/gi },
    { name: 'until', pattern: /\buntil\b/gi },
    { name: 'SetLoadFields', pattern: /\.SetLoadFields\s*\(/gi },
    { name: 'SetRange', pattern: /\.SetRange\s*\(/gi },
    { name: 'SetFilter', pattern: /\.SetFilter\s*\(/gi },
    { name: 'CalcFields', pattern: /\.CalcFields\s*\(/gi },
    { name: 'CalcSums', pattern: /\.CalcSums\s*\(/gi },
    { name: 'Insert', pattern: /\.Insert\s*\(/gi },
    { name: 'Modify', pattern: /\.Modify\s*\(/gi },
    { name: 'Delete', pattern: /\.Delete\s*\(/gi },
    { name: 'DeleteAll', pattern: /\.DeleteAll\s*\(/gi },
    { name: 'ModifyAll', pattern: /\.ModifyAll\s*\(/gi },
    { name: 'TestField', pattern: /\.TestField\s*\(/gi },
    { name: 'FieldError', pattern: /\.FieldError\s*\(/gi },
    { name: 'Validate', pattern: /\.Validate\s*\(/gi },
    { name: 'Error', pattern: /\bError\s*\(/gi },
    { name: 'Confirm', pattern: /\bConfirm\s*\(/gi },
    { name: 'Message', pattern: /\bMessage\s*\(/gi },
    { name: 'Dialog', pattern: /\bDialog\./gi },
    { name: 'HttpClient', pattern: /\bHttpClient\b/gi },
    { name: 'JsonToken', pattern: /\bJsonToken\b/gi },
    { name: 'EventSubscriber', pattern: /\[EventSubscriber\b/gi },
    { name: 'IntegrationEvent', pattern: /\[IntegrationEvent\b/gi },
    { name: 'Codeunit.Run', pattern: /Codeunit\.Run\s*\(/gi },
  ];

  // Object type detection
  private readonly objectTypePattern = /^\s*(codeunit|page|table|report|query|xmlport|enum|interface|permissionset|profile)\s+\d+/im;

  constructor(private layerService: MultiContentLayerService) {
    this.nlp = winkNLP(model);
  }

  /**
   * Initialize the relevance index by loading all knowledge topics
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.error('🔍 RelevanceIndexService: Building knowledge index...');
    const startTime = Date.now();

    // Initialize BM25 engine
    this.engine = new BM25();

    // Configure BM25 with field weights
    this.engine.defineConfig({
      fldWeights: {
        title: 2,
        constructs: 3,      // High weight for construct matches
        keywords: 2,
        tags: 1.5,
        content: 1
      },
      bm25Params: { k1: 1.2, b: 0.75 }
    });

    // Define text preparation pipeline
    this.engine.definePrepTasks([
      this.nlp.readDoc.bind(this.nlp),
      (doc: any) => doc.tokens().out(),
    ]);

    // Load all topics from all layers
    const allTopicIds = this.layerService.getAllTopicIds();
    let indexedCount = 0;
    let legacyCount = 0;

    for (const topicId of allTopicIds) {
      const resolution = await this.layerService.resolveTopic(topicId);
      if (!resolution?.topic) continue;

      const topic = resolution.topic;
      const fm = topic.frontmatter;

      // Build document for indexing - ALL fields must be present for BM25
      const doc: Record<string, string> = {
        title: topic.title || '',
        tags: (fm.tags || []).join(' '),
        content: this.extractContentSummary(topic.content, 500),
        constructs: '',  // Default empty
        keywords: '',    // Default empty - BM25 requires all configured fields
      };

      // Add relevance signals if present (v2 topics)
      if (fm.relevance_signals) {
        doc.constructs = (fm.relevance_signals.constructs || []).join(' ');
        doc.keywords = (fm.relevance_signals.keywords || []).join(' ');
        // Also add indicators to keywords for broader matching
        const indicators = [
          ...(fm.relevance_signals.anti_pattern_indicators || []),
          ...(fm.relevance_signals.positive_pattern_indicators || []),
        ].join(' ');
        if (indicators) {
          doc.keywords = doc.keywords ? `${doc.keywords} ${indicators}` : indicators;
        }
      } else {
        legacyCount++;
      }

      // Add to BM25 index
      this.engine.addDoc(doc, topicId);

      // Store metadata for result enrichment
      this.topicMetadata.set(topicId, {
        title: topic.title,
        domain: this.getPrimaryDomain(fm.domain),
        category: fm.category,
        severity: fm.severity,
        patternType: fm.pattern_type,
        applicableObjectTypes: fm.applicable_object_types,
        relevanceThreshold: fm.relevance_threshold,
        hasRelevanceSignals: !!fm.relevance_signals,
        relevanceSignals: fm.relevance_signals,
      });

      indexedCount++;
    }

    // Consolidate the index for searching
    this.engine.consolidate();

    this.initialized = true;
    console.error(`🔍 RelevanceIndexService: Indexed ${indexedCount} topics (${legacyCount} legacy) in ${Date.now() - startTime}ms`);
  }

  /**
   * Extract code characteristics for relevance matching
   */
  extractCodeCharacteristics(code: string): CodeCharacteristics {
    const constructs: string[] = [];

    // Detect AL constructs
    for (const { name, pattern } of this.constructPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(code)) {
        constructs.push(name);
      }
    }

    // Detect object type
    const objectTypeMatch = code.match(this.objectTypePattern);
    const objectType = objectTypeMatch ? objectTypeMatch[1].toLowerCase() : null;

    // Semantic flags
    const hasLoops = /\brepeat\b[\s\S]*?\buntil\b/i.test(code) ||
                     /\bwhile\b[\s\S]*?\bdo\b/i.test(code) ||
                     /\bfor\b[\s\S]*?\bto\b/i.test(code);

    const hasFieldAccess = /\.\s*"[^"]+"/g.test(code);
    const hasRecordOperations = constructs.some(c =>
      ['FindSet', 'FindFirst', 'FindLast', 'Insert', 'Modify', 'Delete'].includes(c)
    );
    const hasValidation = constructs.some(c =>
      ['TestField', 'FieldError', 'Validate'].includes(c)
    );
    const hasErrorHandling = constructs.some(c =>
      ['Error', 'Codeunit.Run'].includes(c)
    ) || /\bif\s+not\b/i.test(code);
    const hasSecurityCalls = /User\.|Permission|Security/i.test(code);

    // Tokenize for BM25
    const tokens = this.nlp.readDoc(code).tokens().out() as string[];

    return {
      constructs,
      objectType,
      hasLoops,
      hasFieldAccess,
      hasRecordOperations,
      hasValidation,
      hasErrorHandling,
      hasSecurityCalls,
      tokens,
    };
  }

  /**
   * Find relevant knowledge topics for the given code
   */
  async findRelevantTopics(
    code: string,
    options: FindRelevantTopicsOptions = {}
  ): Promise<RelevanceMatch[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.engine) {
      console.error('🔍 RelevanceIndexService: Engine not initialized');
      return [];
    }

    const {
      limit = 10,
      minScore = 0.3,
      objectType,
      category,
      includeLegacyTopics = true,
    } = options;

    // Extract characteristics from code
    const characteristics = this.extractCodeCharacteristics(code);

    // Build search query from characteristics
    const queryParts = [
      ...characteristics.constructs,
      characteristics.objectType || '',
    ].filter(Boolean);

    if (queryParts.length === 0) {
      // No detectable constructs - use content-based search
      queryParts.push(...characteristics.tokens.slice(0, 50));
    }

    const query = queryParts.join(' ');

    // Search BM25 index
    const searchResults = this.engine.search(query, limit * 2); // Get extra for filtering

    // Process and filter results
    const matches: RelevanceMatch[] = [];

    for (const result of searchResults) {
      const topicId = result[0] as string;
      const rawScore = result[1] as number;
      const metadata = this.topicMetadata.get(topicId);

      if (!metadata) continue;

      // Skip legacy topics if not included
      if (!includeLegacyTopics && !metadata.hasRelevanceSignals) continue;

      // Filter by object type if specified
      if (objectType && metadata.applicableObjectTypes) {
        if (!metadata.applicableObjectTypes.includes(objectType)) continue;
      }

      // Filter by category if specified
      if (category && metadata.category !== category) continue;

      // Normalize score to 0-1 range
      const normalizedScore = this.normalizeScore(rawScore, searchResults);

      // Apply topic-specific threshold
      const threshold = metadata.relevanceThreshold ?? minScore;
      if (normalizedScore < threshold) continue;

      // Determine which signals matched
      const matchedSignals = this.identifyMatchedSignals(
        characteristics,
        metadata.relevanceSignals
      );

      matches.push({
        topicId,
        title: metadata.title,
        relevanceScore: normalizedScore,
        matchedSignals,
        domain: metadata.domain,
        category: metadata.category,
        severity: metadata.severity,
        patternType: metadata.patternType,
        applicableObjectTypes: metadata.applicableObjectTypes,
      });
    }

    // Sort by relevance and limit
    return matches
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Rebuild the index (call when layers are reloaded)
   */
  async rebuildIndex(): Promise<void> {
    this.initialized = false;
    this.topicMetadata.clear();
    this.engine = null;
    await this.initialize();
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get statistics about the index
   */
  getStatistics(): { totalTopics: number; legacyTopics: number; v2Topics: number } {
    let legacyCount = 0;
    let v2Count = 0;

    for (const metadata of this.topicMetadata.values()) {
      if (metadata.hasRelevanceSignals) {
        v2Count++;
      } else {
        legacyCount++;
      }
    }

    return {
      totalTopics: this.topicMetadata.size,
      legacyTopics: legacyCount,
      v2Topics: v2Count,
    };
  }

  // --- Private Helpers ---

  private extractContentSummary(content: string, maxLength: number): string {
    // Remove markdown formatting, get first N chars
    return content
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .substring(0, maxLength);
  }

  private getPrimaryDomain(domain: string | string[] | undefined): string {
    if (!domain) return 'unknown';
    return Array.isArray(domain) ? domain[0] : domain;
  }

  private normalizeScore(score: number, allResults: any[]): number {
    if (allResults.length === 0) return 0;
    const maxScore = allResults[0][1] as number;
    if (maxScore === 0) return 0;
    return Math.min(1, score / maxScore);
  }

  private identifyMatchedSignals(
    characteristics: CodeCharacteristics,
    signals?: RelevanceSignals
  ): string[] {
    if (!signals) return characteristics.constructs.slice(0, 5);

    const matched: string[] = [];

    // Check construct matches
    if (signals.constructs) {
      for (const construct of signals.constructs) {
        if (characteristics.constructs.some(c =>
          c.toLowerCase() === construct.toLowerCase()
        )) {
          matched.push(construct);
        }
      }
    }

    return matched;
  }
}
