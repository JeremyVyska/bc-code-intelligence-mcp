/**
 * Embedded Knowledge Layer
 *
 * Loads knowledge content from the embedded git submodule (embedded-knowledge/).
 * This is the base layer (Layer 0) that provides the core BC knowledge content.
 */

import { fileURLToPath } from 'url';
import { readFile, readdir, stat } from 'fs/promises';
import { join, basename, extname, dirname } from 'path';
import * as yaml from 'yaml';
import glob from 'fast-glob';

import { AtomicTopic, AtomicTopicFrontmatterSchema } from '../types/bc-knowledge.js';
import { LayerPriority, LayerLoadResult } from '../types/layer-types.js';
import { BaseKnowledgeLayer } from './base-layer.js';

export class EmbeddedKnowledgeLayer extends BaseKnowledgeLayer {
  constructor(
    private readonly embeddedPath: string = (() => {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      return join(__dirname, '../../embedded-knowledge');
    })()
  ) {
    super('embedded', LayerPriority.EMBEDDED, true);
  }

  /**
   * Initialize the embedded layer by loading topics and indexes from submodule
   */
  async initialize(): Promise<LayerLoadResult> {
    if (this.initialized) {
      return this.loadResult!;
    }

    const startTime = Date.now();

    try {
      console.error(`Initializing ${this.name} layer from ${this.embeddedPath}...`);

      // Load topics and indexes in parallel
      const [topicsLoaded, indexesLoaded] = await Promise.all([
        this.loadTopics(),
        this.loadIndexes()
      ]);

      const loadTimeMs = Date.now() - startTime;
      this.initialized = true;
      this.loadResult = this.createLoadResult(topicsLoaded, indexesLoaded, loadTimeMs);

      console.error(`✅ ${this.name} layer loaded: ${topicsLoaded} topics, ${indexesLoaded} indexes (${loadTimeMs}ms)`);
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
   * Load all atomic topics from embedded knowledge domains
   */
  protected async loadTopics(): Promise<number> {
    const domainsPath = join(this.embeddedPath, 'domains');

    // Use glob to find all markdown files in domains, excluding samples
    // Convert Windows paths to the format expected by fast-glob
    let pattern = join(domainsPath, '**', '*.md').replace(/\\/g, '/');

    // Convert /c/path to C:/path on Windows
    if (pattern.startsWith('/c/')) {
      pattern = 'C:' + pattern.substring(2);
    }

    console.error(`🔍 Using glob pattern: ${pattern}`);
    const topicFiles = await glob(pattern, {
      ignore: ['**/samples/**'] // Ignore sample files
    });

    console.error(`Found ${topicFiles.length} topic files in ${domainsPath}`);

    let loadedCount = 0;
    for (const filePath of topicFiles) {
      try {
        const topic = await this.loadAtomicTopic(filePath);
        if (topic && this.validateTopic(topic)) {
          this.topics.set(topic.id, topic);
          loadedCount++;
        } else {
          console.error(`Invalid topic structure in ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to load topic ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }

    return loadedCount;
  }

  /**
   * Load indexes from embedded knowledge
   */
  protected async loadIndexes(): Promise<number> {
    const indexesPath = join(this.embeddedPath, 'indexes');

    try {
      // Load tag indexes
      await this.loadTagIndexes(indexesPath);

      // Load other indexes
      await this.loadDomainCatalog(indexesPath);
      await this.loadTopicRelationships(indexesPath);
      await this.loadBCVersionMatrix(indexesPath);

      return this.indexes.size;
    } catch (error) {
      console.error(`Failed to load indexes from ${indexesPath}:`, error instanceof Error ? error.message : String(error));
      return 0;
    }
  }

  /**
   * Load a single atomic topic from a markdown file
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

    // Generate topic ID from file path
    const topicId = this.normalizeTopicId(filePath, this.embeddedPath);

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
      title: frontmatter.title || topicId.replace(/-/g, ' '), // Use frontmatter title or derive from ID
      filePath,
      frontmatter,
      content: markdownContent?.trim() || '',
      wordCount: markdownContent?.split(/\s+/).length || 0,
      lastModified: stats.mtime,
      samples: samples || undefined
    };
  }

  /**
   * Load tag indexes from JSON files
   */
  private async loadTagIndexes(indexesPath: string): Promise<void> {
    const tagsPath = join(indexesPath, 'tags');

    try {
      const tagFiles = await glob('*.json', { cwd: tagsPath });

      for (const tagFile of tagFiles) {
        const tagName = basename(tagFile, '.json');
        const filePath = join(tagsPath, tagFile);

        try {
          const content = await readFile(filePath, 'utf-8');
          const cleanContent = content.replace(/^\uFEFF/, ''); // Remove BOM
          const topics = JSON.parse(cleanContent) as string[];

          this.indexes.set(`tag:${tagName}`, {
            tag: tagName,
            topics,
            count: topics.length
          });
        } catch (error) {
          console.error(`Failed to load tag index ${tagFile}:`, error instanceof Error ? error.message : String(error));
        }
      }
    } catch (error) {
      // Tags directory might not exist, which is OK
      console.error(`No tags directory found at ${tagsPath}`);
    }
  }

  /**
   * Load domain catalog
   */
  private async loadDomainCatalog(indexesPath: string): Promise<void> {
    const catalogPath = join(indexesPath, 'domain-catalog.json');

    try {
      const content = await readFile(catalogPath, 'utf-8');
      const cleanContent = content.replace(/^\uFEFF/, '');
      const catalog = JSON.parse(cleanContent);
      this.indexes.set('domain-catalog', catalog);
    } catch (error) {
      console.error(`Failed to load domain catalog:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Load topic relationships
   */
  private async loadTopicRelationships(indexesPath: string): Promise<void> {
    const relationshipsPath = join(indexesPath, 'topic-relationships.json');

    try {
      const content = await readFile(relationshipsPath, 'utf-8');
      const cleanContent = content.replace(/^\uFEFF/, '');
      const relationships = JSON.parse(cleanContent);
      this.indexes.set('topic-relationships', relationships);
    } catch (error) {
      console.error(`Failed to load topic relationships:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Load BC version matrix
   */
  private async loadBCVersionMatrix(indexesPath: string): Promise<void> {
    const matrixPath = join(indexesPath, 'bc-version-matrix.json');

    try {
      const content = await readFile(matrixPath, 'utf-8');
      const cleanContent = content.replace(/^\uFEFF/, '');
      const matrix = JSON.parse(cleanContent);
      this.indexes.set('bc-version-matrix', matrix);
    } catch (error) {
      console.error(`Failed to load BC version matrix:`, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get an index by name
   */
  getIndex(indexName: string): any {
    return this.indexes.get(indexName);
  }

  /**
   * Get all available index names
   */
  getIndexNames(): string[] {
    return Array.from(this.indexes.keys());
  }
}