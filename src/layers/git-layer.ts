/**
 * Git Knowledge Layer - Load knowledge from Git repositories
 * Supports authentication, branch selection, and caching
 */

import { access, mkdir, stat, readdir, readFile } from 'fs/promises';
import { join, resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as yaml from 'yaml';

import { BaseKnowledgeLayer } from './base-layer.js';
import { AtomicTopic, AtomicTopicFrontmatterSchema } from '../types/bc-knowledge.js';
import {
  LayerLoadResult,
  ConfigGitLayerSource,
  AuthConfiguration,
  AuthType,
  ConfigLayerLoadResult
} from '../types/index.js';

export class GitKnowledgeLayer extends BaseKnowledgeLayer {
  private git: SimpleGit | null = null;
  private localPath: string;
  private lastUpdated?: Date;

  constructor(
    name: string,
    priority: number,
    private readonly gitConfig: ConfigGitLayerSource,
    private readonly auth?: AuthConfiguration,
    private readonly cacheDir: string = '.bckb-cache'
  ) {
    super(name, priority);

    // Generate local cache path based on URL
    const urlHash = this.generateUrlHash(gitConfig.url);
    this.localPath = join(process.cwd(), cacheDir, 'git-repos', urlHash);
  }

  async initialize(): Promise<LayerLoadResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      console.log(`🔄 Initializing Git layer: ${this.name} from ${this.gitConfig.url}`);

      // 1. Ensure local cache directory exists
      await this.ensureCacheDirectory();

      // 2. Set up Git with authentication
      await this.setupGitWithAuth();

      // 3. Clone or pull repository
      const repoUpdated = await this.ensureRepository();

      // 4. Checkout specified branch
      if (this.gitConfig.branch) {
        await this.checkoutBranch(this.gitConfig.branch);
      }

      // 5. Load knowledge from repository
      const knowledgePath = this.gitConfig.subpath
        ? join(this.localPath, this.gitConfig.subpath)
        : this.localPath;

      const loadResult = await this.loadFromDirectory(knowledgePath);

      if (repoUpdated) {
        this.lastUpdated = new Date();
        console.log(`✅ Git layer ${this.name} updated successfully`);
      } else {
        console.log(`📦 Git layer ${this.name} using cached version`);
      }

      return {
        layerName: this.name,
        topicsLoaded: this.topics.size,
        indexesLoaded: 0,
        loadTimeMs: Date.now() - startTime,
        success: true
      };

    } catch (error) {
      const errorMessage = `Failed to initialize Git layer: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);
      console.error(`❌ ${errorMessage}`);

      return {
        layerName: this.name,
        topicsLoaded: 0,
        indexesLoaded: 0,
        loadTimeMs: Date.now() - startTime,
        success: false,
        error: errorMessage
      };
    }
  }

  private async ensureCacheDirectory(): Promise<void> {
    const cacheParent = dirname(this.localPath);
    await mkdir(cacheParent, { recursive: true });
  }

  private async setupGitWithAuth(): Promise<void> {
    const gitOptions: Partial<SimpleGitOptions> = {
      baseDir: dirname(this.localPath),
      binary: 'git',
      maxConcurrentProcesses: 1,
      trimmed: true
    };

    this.git = simpleGit(gitOptions);

    // Configure authentication based on auth type
    if (this.auth) {
      await this.configureAuthentication();
    }
  }

  private async configureAuthentication(): Promise<void> {
    if (!this.auth || !this.git) return;

    switch (this.auth.type) {
      case AuthType.TOKEN:
        // For GitHub/GitLab token authentication
        const token = this.auth.token ||
          (this.auth.token_env_var ? process.env[this.auth.token_env_var] : undefined);

        if (token) {
          // Configure git to use token authentication
          await this.git.addConfig('credential.helper', 'store --file=.git-credentials');

          // For HTTPS URLs, we'll modify the URL to include credentials
          if (this.gitConfig.url.startsWith('https://')) {
            // This will be handled in clone/pull operations
            console.log('🔑 Configured token authentication');
          }
        } else {
          throw new Error('Token not found for git authentication');
        }
        break;

      case AuthType.SSH_KEY:
        // SSH key authentication - requires key to be in SSH agent
        if (this.auth.key_path) {
          // Set SSH command to use specific key
          process.env['GIT_SSH_COMMAND'] = `ssh -i ${this.auth.key_path} -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no`;
          console.log(`🔑 Configured SSH key authentication: ${this.auth.key_path}`);
        }
        break;

      case AuthType.BASIC:
        // Basic username/password authentication
        const username = this.auth.username;
        const password = this.auth.password ||
          (this.auth.password_env_var ? process.env[this.auth.password_env_var] : undefined);

        if (username && password) {
          console.log('🔑 Configured basic authentication');
          // This will be handled in the URL modification
        } else {
          throw new Error('Username/password not found for basic authentication');
        }
        break;

      default:
        console.warn(`⚠️  Unsupported authentication type: ${this.auth.type}`);
    }
  }

  private async ensureRepository(): Promise<boolean> {
    if (!this.git) throw new Error('Git not initialized');

    const repositoryExists = existsSync(join(this.localPath, '.git'));

    if (repositoryExists) {
      // Repository exists, pull latest changes
      console.log(`📥 Pulling latest changes for ${this.name}...`);
      await this.git.cwd(this.localPath);

      try {
        const pullResult = await this.git.pull('origin', this.gitConfig.branch || 'main');
        return pullResult.summary.changes > 0;
      } catch (error) {
        console.warn(`⚠️  Pull failed, using cached version: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    } else {
      // Repository doesn't exist, clone it
      console.log(`📦 Cloning repository ${this.gitConfig.url}...`);

      const cloneUrl = this.prepareUrlWithAuth(this.gitConfig.url);

      await this.git.clone(cloneUrl, this.localPath, [
        '--depth', '1', // Shallow clone for faster downloads
        '--single-branch',
        ...(this.gitConfig.branch ? ['--branch', this.gitConfig.branch] : [])
      ]);

      return true;
    }
  }

  private prepareUrlWithAuth(url: string): string {
    if (!this.auth) return url;

    // Only modify HTTPS URLs for token/basic auth
    if (!url.startsWith('https://')) return url;

    switch (this.auth.type) {
      case AuthType.TOKEN:
        const token = this.auth.token ||
          (this.auth.token_env_var ? process.env[this.auth.token_env_var] : undefined);
        if (token) {
          // For GitHub/GitLab: https://token@github.com/...
          return url.replace('https://', `https://${token}@`);
        }
        break;

      case AuthType.BASIC:
        const username = this.auth.username;
        const password = this.auth.password ||
          (this.auth.password_env_var ? process.env[this.auth.password_env_var] : undefined);
        if (username && password) {
          // https://username:password@gitlab.com/...
          return url.replace('https://', `https://${username}:${password}@`);
        }
        break;
    }

    return url;
  }

  private async checkoutBranch(branch: string): Promise<void> {
    if (!this.git) throw new Error('Git not initialized');

    console.log(`🔄 Checking out branch: ${branch}`);
    await this.git.cwd(this.localPath);

    try {
      // Try to checkout the branch
      await this.git.checkout(branch);
    } catch (error) {
      // If branch doesn't exist locally, try to checkout from remote
      try {
        await this.git.checkoutBranch(branch, `origin/${branch}`);
      } catch (remoteBranchError) {
        throw new Error(`Failed to checkout branch ${branch}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async loadFromDirectory(dirPath: string): Promise<void> {
    try {
      await access(dirPath);
      await this.loadTopicsFromDirectory(dirPath);
    } catch (error) {
      throw new Error(`Knowledge directory not found: ${dirPath}`);
    }
  }

  private async loadTopicsFromDirectory(dirPath: string): Promise<void> {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively load from subdirectories
        await this.loadTopicsFromDirectory(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Load markdown files as topics
        try {
          const content = await readFile(fullPath, 'utf-8');
          const relativePath = this.getRelativePath(fullPath);
          const topic = await this.loadAtomicTopic(fullPath, content, relativePath);

          if (topic && this.validateTopic(topic)) {
            this.topics.set(topic.id, topic);
          }
        } catch (error) {
          console.warn(`⚠️  Failed to load topic from ${fullPath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  private getRelativePath(absolutePath: string): string {
    const basePath = this.gitConfig.subpath
      ? join(this.localPath, this.gitConfig.subpath)
      : this.localPath;

    return absolutePath.replace(basePath + '/', '').replace(/\\/g, '/');
  }

  private async getCurrentCommitHash(): Promise<string | undefined> {
    if (!this.git) return undefined;

    try {
      await this.git.cwd(this.localPath);
      const log = await this.git.log(['--oneline', '-1']);
      return log.latest?.hash;
    } catch {
      return undefined;
    }
  }

  private async getRepositorySize(): Promise<number | undefined> {
    try {
      const stats = await stat(this.localPath);
      return stats.size;
    } catch {
      return undefined;
    }
  }

  private generateUrlHash(url: string): string {
    // Generate a simple hash for the URL to use as directory name
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  async refresh(): Promise<boolean> {
    console.log(`🔄 Refreshing Git layer: ${this.name}`);

    // Clear existing topics
    this.topics.clear();

    // Re-initialize
    const result = await this.initialize();
    return result.success;
  }

  // Implement required abstract methods from BaseKnowledgeLayer
  protected override async loadTopics(): Promise<number> {
    const knowledgePath = this.gitConfig.subpath
      ? join(this.localPath, this.gitConfig.subpath)
      : this.localPath;

    await this.loadFromDirectory(knowledgePath);
    return this.topics.size;
  }

  protected override async loadIndexes(): Promise<number> {
    // Git layers don't have separate indexes - everything is loaded as topics
    return 0;
  }

  /**
   * Load a single atomic topic from a markdown file
   */
  private async loadAtomicTopic(filePath: string, content: string, relativePath: string): Promise<AtomicTopic | null> {
    try {
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

      // Generate topic ID from relative path
      const topicId = this.normalizeTopicId(relativePath);

      return {
        id: topicId,
        filePath,
        frontmatter,
        content: markdownContent?.trim() || '',
        wordCount: markdownContent?.split(/\s+/).length || 0,
        lastModified: stats.mtime
      };

    } catch (error) {
      console.warn(`⚠️  Failed to parse topic from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Normalize topic ID from file path
   */
  protected override normalizeTopicId(filePath: string, basePath?: string): string {
    // For git layer, filePath is already relative
    return filePath
      .replace(/\.md$/, '')
      .replace(/\\/g, '/')
      .toLowerCase();
  }

  /**
   * Validate topic structure
   */
  protected override validateTopic(topic: AtomicTopic): boolean {
    return !!(topic.id && topic.frontmatter && topic.content);
  }

  getSourceInfo() {
    return {
      type: 'git' as const,
      url: this.gitConfig.url,
      branch: this.gitConfig.branch,
      subpath: this.gitConfig.subpath,
      localPath: this.localPath,
      lastUpdated: this.lastUpdated,
      hasAuth: !!this.auth
    };
  }
}