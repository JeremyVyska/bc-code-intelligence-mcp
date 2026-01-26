import { z } from "zod";

/**
 * Business Central Knowledge Base Types
 *
 * These types define the structure of our atomic BC knowledge topics,
 * indexes, and relationships for intelligent AI consumption.
 */

// Relevance signals schema for knowledge-driven detection
export const RelevanceSignalsSchema = z
  .object({
    // AL language constructs that indicate this topic may be relevant
    constructs: z
      .array(z.string())
      .optional()
      .describe(
        "AL constructs that trigger this topic (e.g., 'FindSet', 'CalcFields')",
      ),
    // General keywords to match against code or context
    keywords: z
      .array(z.string())
      .optional()
      .describe("Keywords for text matching"),
    // Phrases indicating an anti-pattern is present
    anti_pattern_indicators: z
      .array(z.string())
      .optional()
      .describe("Phrases indicating bad patterns"),
    // Phrases indicating a good pattern is present
    positive_pattern_indicators: z
      .array(z.string())
      .optional()
      .describe("Phrases indicating good patterns"),
  })
  .describe(
    "Relevance detection signals - how to identify when this knowledge applies",
  );

export type RelevanceSignals = z.infer<typeof RelevanceSignalsSchema>;

// YAML Frontmatter Schema - Extended for structured knowledge types
export const AtomicTopicFrontmatterSchema = z
  .object({
    title: z.string().optional().describe("Human-readable topic title"),
    domain: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .describe(
        "Knowledge domain(s) - single domain or array for shared topics",
      ),
    difficulty: z
      .enum(["beginner", "intermediate", "advanced", "expert"])
      .optional()
      .describe("Complexity level"),
    bc_versions: z
      .string()
      .optional()
      .describe(
        "BC version compatibility. Syntax: 'x..' (min), 'x..y' or 'x-y' (range), '..y' (max), 'x->y' (migration), 'x,y,z' (discrete), 'x+' (legacy min)",
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe("Searchable tags for topic discovery"),
    prerequisites: z
      .array(z.string())
      .optional()
      .describe("Required prerequisite topics"),
    related_topics: z
      .array(z.string())
      .optional()
      .describe("Related and complementary topics"),
    samples: z.string().optional().describe("Path to companion sample file"),
    estimated_time: z
      .string()
      .optional()
      .describe("Time to read/implement (e.g., '15 minutes')"),

    // Extended properties for structured knowledge types
    type: z
      .string()
      .optional()
      .describe("Knowledge type (code-pattern, workflow, etc.)"),
    name: z.string().optional().describe("Unique name for structured types"),
    pattern_type: z
      .enum(["good", "bad", "unknown"])
      .optional()
      .describe("Pattern classification"),
    regex_patterns: z
      .array(z.string())
      .optional()
      .describe("Regex patterns for code detection"),
    description: z
      .string()
      .optional()
      .describe("Brief description for structured types"),
    category: z.string().optional().describe("Category classification"),
    severity: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .describe("Severity level"),
    impact_level: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe("Impact level"),
    detection_confidence: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe("Detection confidence"),

    // Workflow-specific properties
    workflow_type: z
      .string()
      .optional()
      .describe("Type of workflow (checklist, procedure, etc.)"),
    phases: z.array(z.any()).optional().describe("Workflow phases"),

    // Conditional MCP integration
    conditional_mcp: z
      .string()
      .optional()
      .describe(
        "MCP server ID required for this topic (show only if MCP present)",
      ),
    conditional_mcp_missing: z
      .string()
      .optional()
      .describe(
        "MCP server ID that excludes this topic (show only if MCP absent)",
      ),

    // V2: Relevance-based detection fields
    relevance_signals: RelevanceSignalsSchema.optional().describe(
      "Signals for knowledge-driven detection",
    ),
    applicable_object_types: z
      .array(z.string())
      .optional()
      .describe(
        "AL object types this knowledge applies to (e.g., 'codeunit', 'page')",
      ),
    relevance_threshold: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Minimum relevance score (0.0-1.0) to surface this topic"),
  })
  .passthrough();

export type AtomicTopicFrontmatter = z.infer<
  typeof AtomicTopicFrontmatterSchema
>;

// Complete Atomic Topic Structure
export interface AtomicTopic {
  id: string; // Unique topic identifier
  title: string; // Human-readable title (derived from frontmatter or filename)
  filePath: string; // File system path
  frontmatter: AtomicTopicFrontmatter;
  content: string; // Markdown content without frontmatter
  wordCount: number; // Content length
  lastModified: Date; // File modification date
  samples?: {
    filePath: string;
    content: string;
  };
}

// Tag Index Entry
export interface TagIndex {
  tag: string;
  topics: string[]; // Array of topic file paths
  count: number;
}

// Domain Catalog Structure
export const DomainInfoSchema = z.object({
  title: z.string(),
  description: z.string(),
  topic_count: z.number(),
  subdirectories: z.array(z.string()),
  key_topics: z.array(z.string()),
  difficulty_levels: z.record(z.number()),
  tags: z.array(z.string()),
  sample_files: z.number().optional(),
});

export type DomainInfo = z.infer<typeof DomainInfoSchema>;

export interface DomainCatalog {
  domains: Record<string, DomainInfo>;
  global_statistics: {
    total_atomic_topics: number;
    total_domains: number;
    total_sample_files: number;
    average_topics_per_domain: number;
    most_common_tags: Array<{ tag: string; count: number }>;
    difficulty_distribution: Record<string, number>;
    bc_version_support: Record<string, number>;
  };
  generation_metadata: {
    generated_at: string;
    pipeline_version: string;
    atomic_topics_validated: boolean;
    tag_indexes_generated: number;
    quality_score: number;
  };
}

// Topic Relationships Structure
export interface TopicRelationship {
  prerequisites: string[];
  related_topics: string[];
  enables: string[];
  difficulty_progression: string;
  domain: string;
}

export interface TopicRelationships {
  topic_relationships: Record<string, TopicRelationship>;
  relationship_types: Record<string, string>;
  learning_pathways: Record<string, string[]>;
  cross_domain_connections: Record<string, Record<string, string[]>>;
  metadata: {
    generated_at: string;
    total_mapped_topics: number;
    relationship_count: number;
    learning_pathways: number;
    cross_domain_connections: number;
  };
}

// BC Version Compatibility Matrix
export interface BCVersionInfo {
  description: string;
  supported_topics: number;
  percentage: number;
  key_features: string[];
}

export interface BCVersionMatrix {
  bc_version_compatibility: {
    version_ranges: Record<string, BCVersionInfo>;
    feature_evolution: Record<string, Record<string, string>>;
    backward_compatibility: {
      breaking_changes: Array<{
        version: string;
        impact: string;
        affected_topics: string[];
        migration_path: string;
      }>;
      deprecated_features: Array<{
        version: string;
        feature: string;
        replacement: string;
        sunset_version: string;
      }>;
    };
    version_specific_topics: Record<string, string[]>;
  };
  compatibility_testing: {
    test_matrix: Record<
      string,
      {
        tested_versions: string[];
        success_rate: number;
        known_issues: number;
        last_tested: string;
      }
    >;
    testing_methodology: {
      compilation_test: string;
      functionality_test: string;
      performance_validation: string;
    };
  };
  metadata: {
    generated_at: string;
    total_topics_analyzed: number;
    versions_covered: number;
    compatibility_score: number;
    next_review_date: string;
  };
}

// MCP Tool Input/Output Types
export interface TopicSearchParams {
  tags?: string[];
  domain?: string; // Can be specialist ID (e.g., "dean-debug") or legacy domain
  specialist?: string; // Direct specialist ID for persona-based search
  difficulty?: "beginner" | "intermediate" | "advanced" | "expert";
  code_context?: string;
  bc_version?: string | undefined;
  limit?: number;
}

export interface TopicSearchResult {
  id: string;
  title: string;
  domain: string; // Primary domain (first if multiple) - Will be specialist ID in persona-based system
  domains?: string[]; // All domains for multi-domain topics
  specialist?: string; // Explicit specialist reference
  difficulty: string;
  relevance_score: number;
  summary: string;
  tags: string[];
  prerequisites: string[];
  estimated_time?: string | undefined;
}

export interface CodeAnalysisParams {
  code_snippet: string;
  analysis_type?:
    | "performance"
    | "quality"
    | "security"
    | "patterns"
    | "comprehensive";
  suggest_topics?: boolean;
  bc_version?: string | undefined;
}

export interface CodeAnalysisResult {
  issues: Array<{
    type: "anti-pattern" | "optimization" | "best-practice" | "warning";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    line_number?: number;
    suggestion: string;
    related_topics: string[];
  }>;
  patterns_detected: string[];
  optimization_opportunities: Array<{
    description: string;
    impact: "low" | "medium" | "high";
    difficulty: "easy" | "moderate" | "complex";
    related_topics: string[];
  }>;
  suggested_topics: TopicSearchResult[];
}

export interface OptimizationWorkflowParams {
  scenario: string;
  current_approach?: string;
  target_performance?: string;
  constraints?: string[];
}

export interface OptimizationWorkflow {
  steps: Array<{
    step_number: number;
    title: string;
    description: string;
    related_topics: string[];
    validation_criteria: string[];
    estimated_time: string;
  }>;
  learning_path: string[];
  success_metrics: string[];
  common_pitfalls: string[];
}

// AL Code Pattern Detection Types
export interface ALCodePattern {
  name: string;
  pattern_type: "good" | "bad" | "unknown";
  regex_patterns: RegExp[];
  description: string;
  related_topics: string[];
  severity?: "low" | "medium" | "high" | "critical";
  category?: string;
  impact_level?: "low" | "medium" | "high";
  detection_confidence?: "low" | "medium" | "high";
}

// MCP Server Configuration
export interface BCKBConfig {
  knowledge_base_path: string;
  indexes_path: string;
  workflows_path?: string;
  cache_size: number;
  max_search_results: number;
  default_bc_version: string;
  enable_fuzzy_search: boolean;
  search_threshold: number;
}

// Utility functions for domain handling
export function isDomainMatch(
  topicDomain: string | string[] | undefined,
  targetDomain: string,
): boolean {
  if (!topicDomain) return false;

  if (typeof topicDomain === "string") {
    return topicDomain === targetDomain;
  }

  if (Array.isArray(topicDomain)) {
    return topicDomain.includes(targetDomain);
  }

  return false;
}

export function getDomainList(domain: string | string[] | undefined): string[] {
  if (!domain) return [];
  if (typeof domain === "string") return [domain];
  return domain;
}
