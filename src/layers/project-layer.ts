/**
 * Project Knowledge Layer
 *
 * Loads project-specific knowledge overrides from ./bckb-overrides/ directory.
 * This is the highest priority layer that can override any embedded knowledge.
 */

import { readFile, readdir, stat, access } from 'fs/promises';
import { join, basename } from 'path';
import * as yaml from 'yaml';
import glob from 'fast-glob';

import { AtomicTopic, AtomicTopicFrontmatterSchema } from '../types/bc-knowledge.js';
import { LayerPriority, LayerLoadResult } from '../types/layer-types.js';
import { BaseKnowledgeLayer } from './base-layer.js';

export class ProjectKnowledgeLayer extends BaseKnowledgeLayer {
  constructor(
    private readonly projectPath: string = './bckb-overrides'
  ) {
    super('project', LayerPriority.PROJECT, true);
  }

  /**
   * Initialize the project layer by checking for and loading overrides
   */
  async initialize(): Promise<LayerLoadResult> {
    if (this.initialized) {
      return this.loadResult!;
    }

    const startTime = Date.now();

    try {
      // Check if the project overrides directory exists
      const exists = await this.checkProjectDirectoryExists();
      if (!exists) {
        console.error(`No project overrides found at ${this.projectPath} - skipping project layer`);

        const loadTimeMs = Date.now() - startTime;
        this.initialized = true;
        this.loadResult = this.createLoadResult(0, 0, loadTimeMs);
        return this.loadResult;
      }

      console.error(`Initializing ${this.name} layer from ${this.projectPath}...`);

      // Load all content types in parallel
      const [topicsLoaded, specialistsLoaded, methodologiesLoaded, indexesLoaded] = await Promise.all([
        this.loadTopics(),
        this.loadSpecialists(),
        this.loadMethodologies(),
        this.loadIndexes()
      ]);

      const loadTimeMs = Date.now() - startTime;
      this.initialized = true;
      this.loadResult = this.createLoadResult(topicsLoaded, indexesLoaded, loadTimeMs);

      console.error(`✅ ${this.name} layer loaded: ${topicsLoaded} topics, ${specialistsLoaded} specialists, ${methodologiesLoaded} methodologies, ${indexesLoaded} indexes (${loadTimeMs}ms)`);
      return this.loadResult;

    } catch (error) {
      const loadTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.loadResult = this.createErrorResult(errorMessage, loadTimeMs);

      console.error(`❌ Failed to initialize ${this.name} layer: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Check if the project overrides directory exists
   */
  private async checkProjectDirectoryExists(): Promise<boolean> {
    try {
      await access(this.projectPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Load override topics from project directory
   */
  protected async loadTopics(): Promise<number> {
    // Look for markdown files in various potential structures
    const patterns = [
      join(this.projectPath, '**', '*.md'),
      join(this.projectPath, 'domains', '**', '*.md'),
      join(this.projectPath, 'topics', '**', '*.md'),
      join(this.projectPath, 'overrides', '**', '*.md')
    ];

    let allTopicFiles: string[] = [];

    for (const pattern of patterns) {
      try {
        const files = await glob(pattern.replace(/\\/g, '/'), {
          ignore: ['**/samples/**', '**/node_modules/**', '**/.git/**']
        });
        allTopicFiles.push(...files);
      } catch (error) {
        // Pattern might not match anything, which is OK
      }
    }

    // Remove duplicates
    const uniqueTopicFiles = [...new Set(allTopicFiles)];

    console.error(`Found ${uniqueTopicFiles.length} override topic files in ${this.projectPath}`);

    let loadedCount = 0;
    for (const filePath of uniqueTopicFiles) {
      try {
        const topic = await this.loadAtomicTopic(filePath);
        if (topic && this.validateTopic(topic)) {
          this.topics.set(topic.id, topic);
          loadedCount++;
          console.error(`📝 Override loaded: ${topic.id}`);
        } else {
          console.error(`Invalid override topic structure in ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to load override topic ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }

    return loadedCount;
  }

  /**
   * Load project-specific indexes (if any)
   */
  protected async loadIndexes(): Promise<number> {
    const indexPaths = [
      join(this.projectPath, 'indexes'),
      join(this.projectPath, 'config')
    ];

    let loadedIndexes = 0;

    for (const indexesPath of indexPaths) {
      try {
        await access(indexesPath);

        // Load any JSON files as indexes
        const jsonFiles = await glob('*.json', { cwd: indexesPath });

        for (const jsonFile of jsonFiles) {
          try {
            const filePath = join(indexesPath, jsonFile);
            const content = await readFile(filePath, 'utf-8');
            const cleanContent = content.replace(/^\uFEFF/, ''); // Remove BOM
            const indexData = JSON.parse(cleanContent);

            const indexName = `project:${basename(jsonFile, '.json')}`;
            this.indexes.set(indexName, indexData);
            loadedIndexes++;

            console.error(`📋 Project index loaded: ${indexName}`);
          } catch (error) {
            console.error(`Failed to load project index ${jsonFile}:`, error instanceof Error ? error.message : String(error));
          }
        }
      } catch {
        // Index directory doesn't exist, which is OK
      }
    }

    return loadedIndexes;
  }

  /**
   * Load project-specific specialists
   */
  protected async loadSpecialists(): Promise<number> {
    const specialistsPath = join(this.projectPath, 'specialists');
    
    try {
      await access(specialistsPath);
      // TODO: Implement specialist loading when needed
    } catch (error) {
      // specialists/ directory doesn't exist - that's okay
    }
    
    return this.specialists.size;
  }

  /**
   * Load project-specific methodologies
   */
  protected async loadMethodologies(): Promise<number> {
    const methodologiesPath = join(this.projectPath, 'methodologies');
    
    try {
      await access(methodologiesPath);
      // TODO: Implement methodology loading when needed
    } catch (error) {
      // methodologies/ directory doesn't exist - that's okay
    }
    
    return this.methodologies.size;
  }

  /**
   * Load a single override topic from a markdown file
   */
  private async loadAtomicTopic(filePath: string): Promise<AtomicTopic | null> {
    const content = await readFile(filePath, 'utf-8');
    const stats = await stat(filePath);

    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Extract YAML frontmatter
    const frontmatterMatch = normalizedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!frontmatterMatch) {
      return null;
    }

    const [, frontmatterContent, markdownContent] = frontmatterMatch;

    // Parse and validate frontmatter
    const frontmatterData = yaml.parse(frontmatterContent || '');
    const frontmatter = AtomicTopicFrontmatterSchema.parse(frontmatterData);

    // Generate topic ID from file path relative to project root
    const topicId = this.normalizeTopicId(filePath, this.projectPath);

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
      title: frontmatter.title || topicId.replace(/-/g, ' '),
      filePath,
      frontmatter: {
        ...frontmatter,
        // Mark as override for identification
        tags: [...(frontmatter.tags || []), 'project-override']
      },
      content: markdownContent?.trim() || '',
      wordCount: markdownContent?.split(/\s+/).length || 0,
      lastModified: stats.mtime,
      samples: samples || undefined
    };
  }

  /**
   * Check if this layer can provide overrides for a specific topic
   */
  canOverride(topicId: string): boolean {
    return this.hasTopic(topicId);
  }

  /**
   * Get the override configuration for this layer
   */
  getOverrideConfig(): { [topicId: string]: { strategy: string; source: string } } {
    const config: { [topicId: string]: { strategy: string; source: string } } = {};

    for (const topicId of this.getTopicIds()) {
      config[topicId] = {
        strategy: 'replace',
        source: this.name
      };
    }

    return config;
  }

  /**
   * Create a sample project override structure
   */
  static generateSampleStructure(): string {
    return `
bckb-overrides/
├── domains/
│   ├── performance/
│   │   └── al-performance-optimization.md    # Override embedded topic
│   └── custom-domain/
│       └── company-specific-pattern.md       # New company-specific topic
├── indexes/
│   └── company-standards.json                # Company-specific standards
└── README.md                                 # Documentation for overrides

Example override topic (bckb-overrides/domains/performance/al-performance-optimization.md):
---
title: "AL Performance Optimization - Company Standards"
domain: "performance"
difficulty: "intermediate"
bc_versions: "14+"
tags: ["performance", "sift", "company-standard"]
related_topics: ["database-optimization", "query-patterns"]
---

# AL Performance Optimization - Company Standards

This topic overrides the standard performance optimization guidance with
company-specific requirements and standards.

## Company Requirements

- All queries must use SetLoadFields
- SIFT optimization is mandatory for all reporting
- Performance testing required for all table operations

[Company-specific content here...]
`.trim();
  }
}