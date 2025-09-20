/**
 * BC Code Intelligence MCP Client SDK
 * 
 * TypeScript/JavaScript SDK for connecting to BC Code Intelligence MCP servers
 * with full type safety, intelligent caching, and developer-friendly APIs.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { EventEmitter } from 'events';

export interface BCCodeIntelClientConfig {
  server_command: string;
  server_args?: string[];
  auto_reconnect?: boolean;
  request_timeout_ms?: number;
  cache_enabled?: boolean;
  cache_ttl_seconds?: number;
  debug_logging?: boolean;
}

export interface TopicSearchOptions {
  tags?: string[];
  domain?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  code_context?: string;
  bc_version?: string;
  limit?: number;
}

export interface SmartSearchOptions extends TopicSearchOptions {
  user_context?: {
    current_domain?: string;
    difficulty_preference?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    recent_topics?: string[];
    project_type?: 'new' | 'maintenance' | 'optimization' | 'migration';
  };
  include_layer_info?: boolean;
  layer_filter?: string[];
}

export interface BCCodeIntelTopic {
  id: string;
  title: string;
  domain: string;
  difficulty: string;
  tags: string[];
  prerequisites: string[];
  related_topics: string[];
  bc_versions: string;
  estimated_time?: string;
  content: string;
  word_count: number;
  last_modified: string;
  relevance_score?: number;
  samples?: {
    file_path: string;
    code: string;
  };
  // Layer-aware properties (if available)
  layer_info?: {
    source_layer: string;
    is_override: boolean;
    overridden_count: number;
  };
  relevance_reasons?: string[];
  recommendation_strength?: 'high' | 'medium' | 'low';
}

export interface CodeAnalysisOptions {
  code_snippet: string;
  analysis_type?: 'performance' | 'validation' | 'architecture' | 'general';
  suggest_topics?: boolean;
  bc_version?: string;
}

export interface SystemStatus {
  overall_health: 'healthy' | 'degraded' | 'unhealthy';
  configuration_loaded: boolean;
  layers_active: number;
  total_topics: number;
  cache_hit_rate: number;
  uptime_seconds: number;
}

export class BCCodeIntelClient extends EventEmitter {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private connected = false;
  private cache = new Map<string, { data: any; expires: number }>();
  private reconnectTimer?: NodeJS.Timeout;

  constructor(private readonly config: BCCodeIntelClientConfig) {
    super();

    this.client = new Client(
      { name: 'bc-code-intel-client', version: '1.0.0', capabilities: {} }
    );

    if (this.config.debug_logging) {
      console.log('🔌 BC Code Intelligence Client initialized with config:', this.config);
    }
  }

  /**
   * Connect to the BC Code Intelligence MCP server
   */
  async connect(): Promise<void> {
    try {
      if (this.connected) {
        console.warn('🔌 Already connected to BC Code Intelligence server');
        return;
      }

      this.transport = new StdioClientTransport({
        command: this.config.server_command,
        args: this.config.server_args || []
      });

      await this.client.connect(this.transport);
      this.connected = true;

      this.emit('connected');

      if (this.config.debug_logging) {
        console.log('✅ Connected to BC Code Intelligence MCP server');
      }

    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to connect to BC Code Intelligence server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Disconnect from the server
   */

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }

      this.connected = false;
      this.cache.clear();

      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }

      this.emit('disconnected');

      if (this.config.debug_logging) {
        console.log('🔌 Disconnected from BC Code Intelligence server');
      }

    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Search for BC knowledge topics
   */
  async searchTopics(query: string, options: TopicSearchOptions = {}): Promise<BCCodeIntelTopic[]> {
    const toolArgs = {
      tags: options.tags,
      domain: options.domain,
      difficulty: options.difficulty,
      code_context: query,
      bc_version: options.bc_version,
      limit: options.limit || 10
    };

    const result = await this.callTool('find_bc_topics', toolArgs);
    return JSON.parse(result.content[0].text).results;
  }

  /**
   * Advanced layered search with AI-powered recommendations
   */
  async smartSearch(query: string, options: SmartSearchOptions = {}): Promise<BCCodeIntelTopic[]> {
    const toolArgs = {
      query,
      layer_filter: options.layer_filter,
      include_layer_info: options.include_layer_info !== false,
      limit: options.limit || 10
    };

    const result = await this.callTool('search_layered_topics', toolArgs);
    const response = JSON.parse(result.content[0].text);
    return response.results;
  }

  /**
   * Get a specific topic by ID
   */
  async getTopic(topicId: string, includeSamples: boolean = true): Promise<BCCodeIntelTopic | null> {
    try {
      const result = await this.callTool('get_topic_content', {
        topic_id: topicId,
        include_samples: includeSamples
      });

      return JSON.parse(result.content[0].text);
    } catch (error) {
      if (this.config.debug_logging) {
        console.warn(`🔍 Topic not found: ${topicId}`);
      }
      return null;
    }
  }

  /**
   * Analyze AL code and get recommendations
   */
  async analyzeCode(options: CodeAnalysisOptions): Promise<any> {
    const result = await this.callTool('analyze_code_patterns', options);
    return JSON.parse(result.content[0].text);
  }

  /**
   * Get optimization workflow for a scenario
   */
  async getOptimizationWorkflow(scenario: string, constraints?: string[]): Promise<any> {
    const result = await this.callTool('get_optimization_workflow', {
      scenario,
      constraints: constraints || []
    });

    return JSON.parse(result.content[0].text);
  }

  /**
   * Get system status and health information
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const result = await this.callTool('get_configuration_status', {
      include_validation: true,
      include_performance: true
    });

    const response = JSON.parse(result.content[0].text);

    return {
      overall_health: response.validation?.is_valid ? 'healthy' : 'degraded',
      configuration_loaded: response.configuration_loaded,
      layers_active: response.layers_initialized,
      total_topics: response.layer_summary?.total_topics || 0,
      cache_hit_rate: response.performance?.hit_rate || 0,
      uptime_seconds: response.performance?.uptime_seconds || 0
    };
  }

  /**
   * Get layer information and statistics
   */
  async getLayerInfo(includeStatistics: boolean = true): Promise<any> {
    const result = await this.callTool('get_layer_info', {
      include_statistics: includeStatistics
    });

    return JSON.parse(result.content[0].text);
  }

  /**
   * Resolve topic across layers to see override information
   */
  async resolveTopicLayers(topicId: string): Promise<any> {
    const result = await this.callTool('resolve_topic_layers', {
      topic_id: topicId,
      show_overrides: true
    });

    return JSON.parse(result.content[0].text);
  }

  /**
   * Get comprehensive system analytics
   */
  async getSystemAnalytics(): Promise<any> {
    const result = await this.callTool('get_system_analytics', {
      include_topic_analytics: true,
      include_layer_performance: true,
      include_configuration_insights: true
    });

    return JSON.parse(result.content[0].text);
  }

  /**
   * Reload server configuration (useful for development)
   */
  async reloadConfiguration(force: boolean = false): Promise<any> {
    const result = await this.callTool('reload_configuration', {
      force,
      validate_only: false
    });

    return JSON.parse(result.content[0].text);
  }

  /**
   * Get available MCP tools from the server
   */
  async getAvailableTools(): Promise<any[]> {
    try {
      const response = await this.client.request(
        { method: 'tools/list', params: {} },
        CallToolRequestSchema
      );

      return (response as any).tools || [];
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Health check - verify connection and basic functionality
   */
  async healthCheck(): Promise<{ healthy: boolean; latency_ms: number; error?: string }> {
    const startTime = Date.now();

    try {
      await this.getSystemStatus();
      const latency = Date.now() - startTime;

      return { healthy: true, latency_ms: latency };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        healthy: false,
        latency_ms: latency,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Batch operations for efficiency
   */
  async batchGetTopics(topicIds: string[]): Promise<(BCCodeIntelTopic | null)[]> {
    const promises = topicIds.map(id => this.getTopic(id));
    return Promise.all(promises);
  }

  /**
   * Smart topic recommendations based on current context
   */
  async getRecommendations(currentTopic: string, maxRecommendations: number = 5): Promise<any[]> {
    // This would use AI-powered recommendations if available
    // For now, we'll simulate with related topics search
    const topic = await this.getTopic(currentTopic);
    if (!topic) return [];

    const relatedSearches = await Promise.all([
      this.searchTopics(`domain:${topic.domain}`, { limit: 3 }),
      this.searchTopics(`difficulty:${topic.difficulty}`, { limit: 3 })
    ]);

    const recommendations = [...relatedSearches[0], ...relatedSearches[1]]
      .filter(rec => rec.id !== currentTopic)
      .slice(0, maxRecommendations);

    return recommendations;
  }

  /**
   * Export client configuration (sanitized)
   */
  getClientConfig(): Omit<BCCodeIntelClientConfig, 'debug_logging'> {
    const { debug_logging, ...config } = this.config;
    return config;
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  // Private helper methods

  async callTool(toolName: string, args: any): Promise<any> {
    this.ensureConnected();

    // Check cache first
    if (this.config.cache_enabled) {
      const cacheKey = `${toolName}:${JSON.stringify(args)}`;
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() < cached.expires) {
        if (this.config.debug_logging) {
          console.log(`💾 Cache hit for ${toolName}`);
        }
        return cached.data;
      }
    }

    try {
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        },
        CallToolRequestSchema
      );

      // Cache the result
      if (this.config.cache_enabled) {
        const cacheKey = `${toolName}:${JSON.stringify(args)}`;
        const ttl = (this.config.cache_ttl_seconds || 300) * 1000;
        this.cache.set(cacheKey, {
          data: result,
          expires: Date.now() + ttl
        });
      }

      return result;

    } catch (error) {
      this.emit('error', error);

      // Auto-reconnect if enabled
      if (this.config.auto_reconnect && !this.reconnectTimer) {
        this.scheduleReconnect();
      }

      throw error;
    }
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Not connected to BC Code Intelligence server. Call connect() first.');
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.config.debug_logging) {
          console.log('🔄 Attempting to reconnect to BC Code Intelligence server...');
        }

        await this.disconnect();
        await this.connect();

        this.reconnectTimer = undefined;

        if (this.config.debug_logging) {
          console.log('✅ Reconnected to BC Code Intelligence server');
        }

      } catch (error) {
        if (this.config.debug_logging) {
          console.warn('❌ Reconnection failed:', error);
        }

        // Schedule another attempt
        this.reconnectTimer = undefined;
        this.scheduleReconnect();
      }
    }, 5000); // Retry after 5 seconds
  }
}

/**
 * Convenience factory function for creating BC Code Intelligence clients
 */
export function createBCCodeIntelClient(config: BCCodeIntelClientConfig): BCCodeIntelClient {
  return new BCCodeIntelClient(config);
}

/**
 * Default configuration for common scenarios
 */
export const BCCodeIntelClientDefaults = {
  local: (serverPath?: string): BCCodeIntelClientConfig => ({
    server_command: serverPath || 'node',
    server_args: ['dist/index.js'],
    auto_reconnect: true,
    request_timeout_ms: 10000,
    cache_enabled: true,
    cache_ttl_seconds: 300,
    debug_logging: false
  }),

  development: (serverPath?: string): BCCodeIntelClientConfig => ({
    server_command: serverPath || 'npm',
    server_args: ['run', 'dev'],
    auto_reconnect: true,
    request_timeout_ms: 30000,
    cache_enabled: false, // Disable cache for development
    cache_ttl_seconds: 60,
    debug_logging: true
  }),

  production: (serverPath: string): BCCodeIntelClientConfig => ({
    server_command: serverPath,
    server_args: [],
    auto_reconnect: true,
    request_timeout_ms: 5000,
    cache_enabled: true,
    cache_ttl_seconds: 600, // 10 minutes
    debug_logging: false
  })
};
