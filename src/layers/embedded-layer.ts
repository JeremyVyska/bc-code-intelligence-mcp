/**
 * Embedded Knowledge Layer
 *
 * Loads knowledge content from the embedded git submodule (embedded-knowledge/).
 * This is the base layer (Layer 0) that provides the core BC knowledge content.
 */

import { fileURLToPath } from 'url';
import { readFile, readdir, stat, access } from 'fs/promises';
import { join, basename, extname, dirname } from 'path';
import { existsSync } from 'fs';
import * as yaml from 'yaml';
import glob from 'fast-glob';

import { AtomicTopic, AtomicTopicFrontmatterSchema } from '../types/bc-knowledge.js';
import { LayerPriority, LayerLoadResult } from '../types/layer-types.js';
import { BaseKnowledgeLayer } from './base-layer.js';
import { SpecialistDefinition } from '../services/specialist-loader.js';
import { LayerContentType, EnhancedLayerLoadResult, MultiContentKnowledgeLayer } from '../types/enhanced-layer-types.js';

export class EmbeddedKnowledgeLayer extends BaseKnowledgeLayer {
  // Support for MultiContentKnowledgeLayer interface
  override readonly supported_content_types: LayerContentType[] = ['topics', 'specialists', 'workflows'];

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
    if (this.initialized && this.loadResult) {
      return this.loadResult;
    }

    const startTime = Date.now();

    try {
      console.error(`Initializing ${this.name} layer from ${this.embeddedPath}...`);

      // Early validation: Check if embedded knowledge directory exists and has content
      if (!existsSync(this.embeddedPath)) {
        throw new Error(`
🚨 BC Code Intelligence MCP Server Setup Issue

PROBLEM: Embedded knowledge directory not found
PATH: ${this.embeddedPath}

LIKELY CAUSE: The git submodule 'embedded-knowledge' was not initialized when this package was built/installed.

SOLUTIONS:
📦 For NPM users: Update to the latest version with: npm update bc-code-intelligence-mcp
🔧 For developers: Run: git submodule init && git submodule update  
🏢 For package maintainers: Ensure submodules are initialized before npm publish

The embedded-knowledge directory should contain BC expertise (domains/ or topics/, specialists/, workflows/) required for the MCP server to function.
        `.trim());
      }

      // Check if directory has the expected structure (domains/ or topics/ are both valid)
      const hasDomains = existsSync(join(this.embeddedPath, 'domains'));
      const hasTopics = existsSync(join(this.embeddedPath, 'topics'));
      const hasSpecialists = existsSync(join(this.embeddedPath, 'specialists'));
      // Support both 'workflows/' (new) and 'methodologies/' (legacy) directory names
      const hasWorkflows = existsSync(join(this.embeddedPath, 'workflows')) ||
                           existsSync(join(this.embeddedPath, 'methodologies'));

      const missingDirs: string[] = [];
      if (!hasDomains && !hasTopics) missingDirs.push('domains/ or topics/');
      if (!hasSpecialists) missingDirs.push('specialists');
      // Workflows are optional - don't fail initialization if missing
      // if (!hasWorkflows) missingDirs.push('workflows');

      if (missingDirs.length > 0) {
        throw new Error(`
🚨 BC Code Intelligence MCP Server Setup Issue

PROBLEM: Incomplete embedded knowledge structure
PATH: ${this.embeddedPath}
MISSING: ${missingDirs.join(', ')}

LIKELY CAUSE: The embedded-knowledge submodule is present but incomplete or corrupted.

SOLUTIONS:
📦 For NPM users: Update to the latest version with: npm update bc-code-intelligence-mcp
🔧 For developers: Run: git submodule update --remote --force
🏢 For package maintainers: Verify submodule content before npm publish

Expected structure: (domains/ or topics/), specialists/, workflows/ directories with BC expertise content.
        `.trim());
      }

      // Load topics, specialists, and indexes in parallel
      const [topicsLoaded, specialistsLoaded, indexesLoaded] = await Promise.all([
        this.loadTopics(),
        this.loadSpecialists(),
        this.loadIndexes()
      ]);

      const loadTimeMs = Date.now() - startTime;
      this.initialized = true;
      this.loadResult = this.createLoadResult(topicsLoaded, indexesLoaded, loadTimeMs);

      console.error(`✅ ${this.name} layer loaded: ${topicsLoaded} topics, ${specialistsLoaded} specialists, ${indexesLoaded} indexes (${loadTimeMs}ms)`);

      return this.loadResult;

    } catch (error) {
      const loadTimeMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.loadResult = this.createErrorResult(errorMessage, loadTimeMs);

      console.error(`❌ Failed to initialize ${this.name} layer: ${errorMessage}`);
      return this.loadResult;
    }
  }

  /**
   * Load all atomic topics from embedded knowledge (supports both domains/ and topics/)
   */
  protected async loadTopics(): Promise<number> {
    // Support both domains/ and topics/ directory structures
    const domainsPath = join(this.embeddedPath, 'domains');
    const topicsPath = join(this.embeddedPath, 'topics');

    // Determine which directory exists
    const useDomainsPath = existsSync(domainsPath);
    const useTopicsPath = existsSync(topicsPath);
    const basePath = useDomainsPath ? domainsPath : (useTopicsPath ? topicsPath : domainsPath);
    const dirType = useDomainsPath ? 'domains' : (useTopicsPath ? 'topics' : 'domains (not found)');

    // Diagnostic logging for path resolution across platforms
    console.error(`📂 Loading topics from: ${basePath}`);
    console.error(`   Platform: ${process.platform}`);
    console.error(`   Directory exists: ${existsSync(basePath)} (using ${dirType})`);

    // Use glob to find all markdown files, excluding samples
    // Normalize path separators for cross-platform compatibility
    let pattern = join(basePath, '**', '*.md');

    // fast-glob expects forward slashes on all platforms
    pattern = pattern.replace(/\\/g, '/');

    // Handle Windows drive letter normalization (e.g., /c/ to C:/)
    if (process.platform === 'win32' && pattern.startsWith('/c/')) {
      pattern = 'C:' + pattern.substring(2);
    }

    console.error(`🔍 Using glob pattern: ${pattern}`);

    try {
      const topicFiles = await glob(pattern, {
        ignore: ['**/samples/**'], // Ignore sample files
        absolute: true, // Return absolute paths
        onlyFiles: true // Only return files, not directories
      });

      console.error(`   Found ${topicFiles.length} topic files`);

      if (topicFiles.length === 0) {
        console.error(`⚠️  Warning: No topic files found. Check if embedded-knowledge is properly populated.`);
      }

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
    } catch (error) {
      console.error(`❌ Fatal error loading topics from ${domainsPath}:`, error);
      console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
      console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`   Stack trace: ${error.stack}`);
      }
      throw error; // Re-throw to be caught by initialize()
    }
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

  /**
   * Load all specialists from embedded knowledge specialists folder
   */
  protected async loadSpecialists(): Promise<number> {
    const specialistsPath = join(this.embeddedPath, 'specialists');

    try {
      // Check if specialists directory exists
      const specialistsStats = await stat(specialistsPath);
      if (!specialistsStats.isDirectory()) {
        console.error(`⚠️ Specialists path is not a directory: ${specialistsPath}`);
        return 0;
      }
    } catch (error) {
      console.error(`⚠️ Specialists directory not found: ${specialistsPath}`);
      return 0;
    }

    // Use glob to find all markdown files in specialists
    let pattern = join(specialistsPath, '*.md').replace(/\\/g, '/');

    // Convert /c/path to C:/path on Windows
    if (pattern.startsWith('/c/')) {
      pattern = 'C:' + pattern.substring(2);
    }

    console.error(`🎭 Using specialists glob pattern: ${pattern}`);
    const specialistFiles = await glob(pattern);

    console.error(`Found ${specialistFiles.length} specialist files in ${specialistsPath}`);

    let loadedCount = 0;
    for (const filePath of specialistFiles) {
      try {
        const specialist = await this.loadSpecialist(filePath);
        if (specialist && this.validateSpecialist(specialist)) {
          this.specialists.set(specialist.specialist_id, specialist);
          loadedCount++;
        } else {
          console.error(`Invalid specialist structure in ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to load specialist ${filePath}:`, error instanceof Error ? error.message : String(error));
      }
    }

    console.error(`🎭 Loaded ${loadedCount} specialists from embedded layer`);
    return loadedCount;
  }

  /**
   * Load a single specialist from a markdown file
   */
  private async loadSpecialist(filePath: string): Promise<SpecialistDefinition | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const normalizedContent = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

      // Extract YAML frontmatter
      const frontmatterMatch = normalizedContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
      if (!frontmatterMatch) {
        console.error(`⚠️ No frontmatter found in ${filePath}`);
        return null;
      }

      const [, frontmatterContent, markdownContent] = frontmatterMatch;

      // Parse and validate frontmatter
      const frontmatterData = yaml.parse(frontmatterContent || '');

      // Validate required fields
      if (!frontmatterData.specialist_id || !frontmatterData.title) {
        console.error(`⚠️ Missing required fields in ${filePath}`);
        return null;
      }

      // Create specialist definition
      const specialist: SpecialistDefinition = {
        title: frontmatterData.title,
        specialist_id: frontmatterData.specialist_id,
        emoji: frontmatterData.emoji || '🤖',
        role: frontmatterData.role || 'Specialist',
        team: frontmatterData.team || 'General',
        persona: {
          personality: frontmatterData.persona?.personality || [],
          communication_style: frontmatterData.persona?.communication_style || '',
          greeting: frontmatterData.persona?.greeting || `${frontmatterData.emoji || '🤖'} Hello!`
        },
        expertise: {
          primary: frontmatterData.expertise?.primary || [],
          secondary: frontmatterData.expertise?.secondary || []
        },
        domains: frontmatterData.domains || [],
        when_to_use: frontmatterData.when_to_use || [],
        collaboration: {
          natural_handoffs: frontmatterData.collaboration?.natural_handoffs || [],
          team_consultations: frontmatterData.collaboration?.team_consultations || []
        },
        related_specialists: frontmatterData.related_specialists || [],
        content: markdownContent.trim()
      };

      return specialist;

    } catch (error) {
      console.error(`❌ Failed to parse specialist file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Validate specialist definition
   */
  private validateSpecialist(specialist: SpecialistDefinition): boolean {
    return !!(
      specialist.specialist_id &&
      specialist.title &&
      specialist.persona &&
      specialist.expertise
    );
  }

  /**
   * Load workflows from workflows/ directory (or methodologies/ for backward compatibility)
   */
  protected async loadWorkflows(): Promise<number> {
    // Prefer workflows/, fall back to methodologies/ for backward compatibility
    const workflowsPath = join(this.embeddedPath, 'workflows');
    const legacyPath = join(this.embeddedPath, 'methodologies');

    let activePath: string | null = null;

    try {
      await access(workflowsPath);
      activePath = workflowsPath;
    } catch {
      // workflows/ doesn't exist, try legacy methodologies/
      try {
        await access(legacyPath);
        activePath = legacyPath;
        console.error(`⚠️  Using deprecated 'methodologies/' directory. Please rename to 'workflows/'`);
      } catch {
        // Neither directory exists - that's okay
      }
    }

    if (activePath) {
      // TODO: Implement workflow loading when structure is defined
    }

    return this.workflows.size;
  }

  /**
   * Check if the layer has a specific specialist
   */
  hasSpecialist(specialistId: string): boolean {
    return this.specialists.has(specialistId);
  }

  /**
   * Get a specialist from this layer
   */
  getSpecialist(specialistId: string): SpecialistDefinition | null {
    return this.specialists.get(specialistId) || null;
  }

  /**
   * Get all specialist IDs available in this layer
   */
  getSpecialistIds(): string[] {
    return Array.from(this.specialists.keys());
  }

  /**
   * Get all specialists from this layer
   */
  getAllSpecialists(): SpecialistDefinition[] {
    return Array.from(this.specialists.values());
  }

  /**
   * Search for specialists within this layer
   */
  protected override searchSpecialists(query: string, limit?: number): SpecialistDefinition[] {
    const queryLower = query.toLowerCase();
    const matches: { specialist: SpecialistDefinition; score: number }[] = [];

    for (const specialist of this.specialists.values()) {
      let score = 0;

      // Check title
      if (specialist.title.toLowerCase().includes(queryLower)) {
        score += 10;
      }

      // Check expertise
      for (const expertise of [...specialist.expertise.primary, ...specialist.expertise.secondary]) {
        if (expertise.toLowerCase().includes(queryLower)) {
          score += specialist.expertise.primary.includes(expertise) ? 8 : 5;
        }
      }

      // Check domains
      for (const domain of specialist.domains) {
        if (domain.toLowerCase().includes(queryLower)) {
          score += 6;
        }
      }

      // Check when_to_use scenarios
      for (const scenario of specialist.when_to_use) {
        if (scenario.toLowerCase().includes(queryLower)) {
          score += 7;
        }
      }

      if (score > 0) {
        matches.push({ specialist, score });
      }
    }

    // Sort by score and apply limit
    const sortedMatches = matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit || matches.length);

    return sortedMatches.map(m => m.specialist);
  }

  /**
   * Get specialist statistics for this layer
   */
  getSpecialistStatistics(): {
    total_specialists: number;
    teams: Record<string, number>;
    domains: Record<string, number>;
  } {
    const specialists = Array.from(this.specialists.values());
    const teams: Record<string, number> = {};
    const domains: Record<string, number> = {};

    for (const specialist of specialists) {
      // Count teams
      teams[specialist.team] = (teams[specialist.team] || 0) + 1;

      // Count domains
      for (const domain of specialist.domains) {
        domains[domain] = (domains[domain] || 0) + 1;
      }
    }

    return {
      total_specialists: specialists.length,
      teams,
      domains
    };
  }

  // MultiContentKnowledgeLayer interface implementation

  /**
   * Check if content exists by type and ID
   */
  override hasContent<T extends LayerContentType>(type: T, id: string): boolean {
    switch (type) {
      case 'topics':
        return this.topics.has(id);
      case 'specialists':
        return this.specialists.has(id);
      default:
        return false;
    }
  }

  /**
   * Get content by type and ID
   */
  override async getContent<T extends LayerContentType>(
    type: T,
    id: string
  ): Promise<any> {
    switch (type) {
      case 'topics':
        return this.topics.get(id) || null;
      case 'specialists':
        return this.specialists.get(id) || null;
      default:
        return null;
    }
  }

  /**
   * Get all content IDs for a specific type
   */
  override getContentIds<T extends LayerContentType>(type: T): string[] {
    switch (type) {
      case 'topics':
        return Array.from(this.topics.keys());
      case 'specialists':
        return Array.from(this.specialists.keys());
      default:
        return [];
    }
  }

  /**
   * Search content within this layer by type
   */
  override searchContent<T extends LayerContentType>(
    type: T,
    query: string,
    limit: number = 10
  ): any[] {
    switch (type) {
      case 'topics':
        return this.searchTopics(query, limit);
      case 'specialists':
        return this.searchSpecialists(query, limit);
      default:
        return [];
    }
  }

  /**
   * Get enhanced statistics with content type breakdown
   */
  override getEnhancedStatistics(): {
    name: string;
    priority: number;
    content_counts: Record<LayerContentType, number>;
    load_time_ms?: number;
    initialized: boolean;
  } {
    return {
      name: this.name,
      priority: this.priority,
      content_counts: {
        topics: this.topics.size,
        specialists: this.specialists.size,
        workflows: 0 // Not supported yet
      },
      load_time_ms: this.loadResult?.loadTimeMs,
      initialized: this.initialized
    };
  }

  /**
   * Convert LayerLoadResult to EnhancedLayerLoadResult
   */
  private convertToEnhancedResult(result: LayerLoadResult): EnhancedLayerLoadResult {
    return {
      success: result.success,
      layer_name: result.layerName,
      load_time_ms: result.loadTimeMs,
      content_counts: {
        topics: this.topics.size,
        specialists: this.specialists.size,
        workflows: 0
      },
      topics_loaded: this.topics.size, // Use actual Map size for consistency
      indexes_loaded: result.indexesLoaded || 0,
      error: result.success ? undefined : 'Layer load failed'
    };
  }
}