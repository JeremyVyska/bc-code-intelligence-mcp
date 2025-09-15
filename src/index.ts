#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { KnowledgeService } from './services/knowledge-service.js';
import { CodeAnalysisService } from './services/code-analysis-service.js';
import { MethodologyService } from './services/methodology-service.js';
import { LayerService } from './layers/layer-service.js';
import { ConfigurationLoader } from './config/config-loader.js';
import { ConfigurationValidator } from './config/config-validator.js';
import { domainWorkflows } from './workflows/domain-workflows.js';
import {
  TopicSearchParams,
  CodeAnalysisParams,
  OptimizationWorkflowParams,
  BCKBConfig
} from './types/bc-knowledge.js';
import {
  BCKBConfiguration,
  ConfigurationLoadResult
} from './types/index.js';

/**
 * BCKB MCP Server
 * 
 * Business Central Knowledge Base Model Context Protocol Server
 * Surfaces atomic BC knowledge topics for intelligent AI consumption
 * via GitHub Copilot, Claude, and other LLM tools.
 */
class BCKBServer {
  private server: Server;
  private knowledgeService!: KnowledgeService;
  private codeAnalysisService!: CodeAnalysisService;
  private methodologyService!: MethodologyService;
  private layerService!: LayerService;
  private configuration!: BCKBConfiguration;
  private configLoader: ConfigurationLoader;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'bckb-server',
        version: '2.0.0', // Updated for Phase 2B
      }
    );

    // Initialize configuration loader
    this.configLoader = new ConfigurationLoader();

    // Services will be initialized asynchronously in run()
    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'find_bc_topics',
            description: 'Search BC atomic knowledge topics by tags, domain, difficulty, or code context',
            inputSchema: {
              type: 'object',
              properties: {
                tags: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Topic tags to search for (e.g., ["sift", "performance"])'
                },
                domain: {
                  type: 'string',
                  description: 'Knowledge domain (performance, validation, architecture, etc.)'
                },
                difficulty: {
                  type: 'string',
                  enum: ['beginner', 'intermediate', 'advanced', 'expert'],
                  description: 'Complexity level filter'
                },
                code_context: {
                  type: 'string',
                  description: 'Code context for semantic search (e.g., "flowfield calculations")'
                },
                bc_version: {
                  type: 'string',
                  description: 'Business Central version (e.g., "BC22", "BC20")'
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results (default: 10)',
                  default: 10
                }
              }
            }
          },
          {
            name: 'get_topic_content',
            description: 'Retrieve complete content of a specific BC knowledge topic',
            inputSchema: {
              type: 'object',
              properties: {
                topic_id: {
                  type: 'string',
                  description: 'Unique topic identifier (e.g., "sift-technology-fundamentals")'
                },
                include_samples: {
                  type: 'boolean',
                  description: 'Include companion AL code samples if available',
                  default: true
                }
              },
              required: ['topic_id']
            }
          },
          {
            name: 'analyze_code_patterns',
            description: 'Analyze AL code for performance issues, anti-patterns, and suggest related topics',
            inputSchema: {
              type: 'object',
              properties: {
                code_snippet: {
                  type: 'string',
                  description: 'AL code to analyze for patterns and issues'
                },
                analysis_type: {
                  type: 'string',
                  enum: ['performance', 'validation', 'architecture', 'general'],
                  description: 'Type of analysis to perform',
                  default: 'general'
                },
                suggest_topics: {
                  type: 'boolean',
                  description: 'Whether to suggest relevant learning topics',
                  default: true
                },
                bc_version: {
                  type: 'string',
                  description: 'Business Central version for version-specific analysis'
                }
              },
              required: ['code_snippet']
            }
          },
          {
            name: 'get_optimization_workflow',
            description: 'Generate step-by-step optimization workflow for BC scenarios',
            inputSchema: {
              type: 'object',
              properties: {
                scenario: {
                  type: 'string',
                  description: 'Performance scenario to optimize (e.g., "slow report with large dataset")'
                },
                current_approach: {
                  type: 'string',
                  description: 'Current implementation approach if known'
                },
                target_performance: {
                  type: 'string',
                  description: 'Performance target or constraint (e.g., "sub-5 second response")'
                },
                constraints: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Technical constraints or limitations'
                }
              },
              required: ['scenario']
            }
          },
          {
            name: 'load_methodology',
            description: 'Load systematic methodology phases based on user intent for AI-guided optimization',
            inputSchema: {
              type: 'object',
              properties: {
                user_request: {
                  type: 'string',
                  description: 'Natural language description of user\'s optimization goal'
                },
                domain: {
                  type: 'string',
                  description: 'Technology domain (business-central, azure, dotnet, etc.)',
                  default: 'business-central'
                }
              },
              required: ['user_request']
            }
          },
          {
            name: 'get_phase_guidance',
            description: 'Retrieve specific methodology instructions and checklists for a given phase',
            inputSchema: {
              type: 'object',
              properties: {
                phase_name: {
                  type: 'string',
                  description: 'Name of methodology phase (analysis, performance, architecture, etc.)'
                },
                step: {
                  type: 'string',
                  description: 'Optional specific step within the phase'
                }
              },
              required: ['phase_name']
            }
          },
          {
            name: 'validate_completeness',
            description: 'Check methodology completion against systematic framework and get next actions',
            inputSchema: {
              type: 'object',
              properties: {
                phase: {
                  type: 'string',
                  description: 'Current methodology phase to validate'
                },
                completed_items: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'List of completed analysis/optimization items'
                }
              },
              required: ['phase', 'completed_items']
            }
          },
          {
            name: 'get_layer_info',
            description: 'Get information about configured knowledge layers and their priorities',
            inputSchema: {
              type: 'object',
              properties: {
                include_statistics: {
                  type: 'boolean',
                  description: 'Include layer statistics and performance metrics',
                  default: true
                }
              }
            }
          },
          {
            name: 'resolve_topic_layers',
            description: 'Show how a topic is resolved across different layers (embedded, git, local overrides)',
            inputSchema: {
              type: 'object',
              properties: {
                topic_id: {
                  type: 'string',
                  description: 'Topic identifier to trace through layer resolution'
                },
                show_overrides: {
                  type: 'boolean',
                  description: 'Show which layers are overridden',
                  default: true
                }
              },
              required: ['topic_id']
            }
          },
          {
            name: 'search_layered_topics',
            description: 'Search topics across all configured layers with layer-aware results',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Search query for topics'
                },
                layer_filter: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional filter to specific layers'
                },
                include_layer_info: {
                  type: 'boolean',
                  description: 'Include source layer information in results',
                  default: true
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results',
                  default: 10
                }
              },
              required: ['query']
            }
          },
          {
            name: 'get_configuration_status',
            description: 'Get current configuration status, validation results, and system health',
            inputSchema: {
              type: 'object',
              properties: {
                include_validation: {
                  type: 'boolean',
                  description: 'Include configuration validation results',
                  default: true
                },
                include_performance: {
                  type: 'boolean',
                  description: 'Include performance metrics',
                  default: false
                }
              }
            }
          },
          {
            name: 'reload_configuration',
            description: 'Reload configuration and reinitialize layers (useful during development)',
            inputSchema: {
              type: 'object',
              properties: {
                force: {
                  type: 'boolean',
                  description: 'Force reload even if configuration appears unchanged',
                  default: false
                },
                validate_only: {
                  type: 'boolean',
                  description: 'Only validate configuration without reloading',
                  default: false
                }
              }
            }
          },
          {
            name: 'get_system_analytics',
            description: 'Get comprehensive system analytics including layer performance, topic distribution, and usage insights',
            inputSchema: {
              type: 'object',
              properties: {
                include_topic_analytics: {
                  type: 'boolean',
                  description: 'Include topic distribution and coverage analytics',
                  default: true
                },
                include_layer_performance: {
                  type: 'boolean',
                  description: 'Include layer load times and performance metrics',
                  default: true
                },
                include_configuration_insights: {
                  type: 'boolean',
                  description: 'Include configuration optimization recommendations',
                  default: true
                }
              }
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'find_bc_topics': {
            const searchParams = args as TopicSearchParams;
            const results = await this.knowledgeService.searchTopics(searchParams);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    results,
                    total_found: results.length,
                    search_params: searchParams
                  }, null, 2)
                }
              ]
            };
          }

          case 'get_topic_content': {
            const { topic_id, include_samples = true } = args as { topic_id: string; include_samples?: boolean };
            const topic = await this.knowledgeService.getTopic(topic_id);
            
            if (!topic) {
              throw new McpError(ErrorCode.InvalidRequest, `Topic not found: ${topic_id}`);
            }

            const response: any = {
              id: topic.id,
              title: topic.frontmatter.title,
              domain: topic.frontmatter.domain,
              difficulty: topic.frontmatter.difficulty,
              tags: topic.frontmatter.tags,
              prerequisites: topic.frontmatter.prerequisites || [],
              related_topics: topic.frontmatter.related_topics || [],
              bc_versions: topic.frontmatter.bc_versions,
              estimated_time: topic.frontmatter.estimated_time,
              content: topic.content,
              word_count: topic.wordCount,
              last_modified: topic.lastModified
            };

            if (include_samples && topic.samples) {
              response.samples = {
                file_path: topic.samples.filePath,
                code: topic.samples.content
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(response, null, 2)
                }
              ]
            };
          }

          case 'analyze_code_patterns': {
            const analysisParams = args as unknown as CodeAnalysisParams;
            const result = await this.codeAnalysisService.analyzeCode(analysisParams);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'get_optimization_workflow': {
            const workflowParams = args as unknown as OptimizationWorkflowParams;
            const workflow = await this.generateOptimizationWorkflow(workflowParams);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(workflow, null, 2)
                }
              ]
            };
          }

          case 'load_methodology': {
            const { user_request, domain = 'business-central' } = args as { user_request: string; domain?: string };
            const result = await this.methodologyService.loadMethodology({ user_request, domain });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    methodology: result,
                    message: `Loaded methodology for: ${result.intent_detected}`,
                    guidance: `Follow the ${result.execution_order.length} phases in order: ${result.execution_order.join(' → ')}`
                  }, null, 2)
                }
              ]
            };
          }

          case 'get_phase_guidance': {
            const { phase_name, step } = args as { phase_name: string; step?: string };
            const result = await this.methodologyService.getPhaseGuidance({ phase_name, step });

            if ('error' in result) {
              throw new McpError(ErrorCode.InvalidRequest, result.error as string);
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    phase: result,
                    guidance: `Phase: ${result.phase_name}`,
                    checklist_items: result.checklists.length,
                    content_size: result.methodology_content.length
                  }, null, 2)
                }
              ]
            };
          }

          case 'validate_completeness': {
            const { phase, completed_items } = args as { phase: string; completed_items: string[] };
            const result = await this.methodologyService.validateCompleteness({ phase, completed_items });

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    validation: result,
                    summary: `${result.completion_percentage.toFixed(1)}% complete (${result.completed_items_count}/${result.total_requirements})`,
                    quality: `Quality Score: ${result.quality_score.toFixed(1)}/100`,
                    can_proceed: result.can_proceed_to_next_phase ? 'Ready for next phase' : 'Continue current phase'
                  }, null, 2)
                }
              ]
            };
          }

          case 'get_layer_info': {
            const { include_statistics = true } = args as { include_statistics?: boolean };

            const layerInfo = {
              layers: this.layerService.getLayers().map(layer => ({
                name: layer.name,
                priority: layer.priority,
                enabled: layer.enabled,
                type: layer.constructor.name,
                statistics: include_statistics ? layer.getStatistics() : undefined
              })),
              configuration: {
                total_layers: this.configuration.layers.length,
                enabled_layers: this.configuration.layers.filter(l => l.enabled).length,
                layer_types: [...new Set(this.configuration.layers.map(l => l.source.type))]
              }
            };

            if (include_statistics) {
              (layerInfo as any).system_statistics = this.layerService.getLayerStatistics();
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(layerInfo, null, 2)
                }
              ]
            };
          }

          case 'resolve_topic_layers': {
            const { topic_id, show_overrides = true } = args as { topic_id: string; show_overrides?: boolean };

            const resolution = await this.layerService.resolveTopic(topic_id);

            if (!resolution) {
              throw new McpError(ErrorCode.InvalidRequest, `Topic not found in any layer: ${topic_id}`);
            }

            const result = {
              topic_id,
              resolved_from: resolution.sourceLayer,
              is_override: resolution.isOverride,
              overridden_layers: show_overrides ? resolution.overriddenLayers : [],
              topic_metadata: {
                title: resolution.topic.frontmatter.title,
                domain: resolution.topic.frontmatter.domain,
                difficulty: resolution.topic.frontmatter.difficulty,
                last_modified: resolution.topic.lastModified
              },
              layer_resolution_path: this.layerService.getLayers()
                .filter(layer => layer.hasTopic(topic_id))
                .map(layer => ({
                  layer_name: layer.name,
                  priority: layer.priority,
                  is_source: layer.name === resolution.sourceLayer
                }))
                .sort((a, b) => b.priority - a.priority)
            };

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'search_layered_topics': {
            const { query, layer_filter, include_layer_info = true, limit = 10 } = args as {
              query: string;
              layer_filter?: string[];
              include_layer_info?: boolean;
              limit?: number;
            };

            const searchParams: TopicSearchParams = {
              code_context: query,
              limit
            };

            const results = await this.layerService.searchTopics(searchParams);

            const enhancedResults = await Promise.all(results.map(async (result) => {
              const enhanced = { ...result } as any;

              if (include_layer_info) {
                const resolution = await this.layerService.resolveTopic(result.id);
                if (resolution) {
                  enhanced.layer_info = {
                    source_layer: resolution.sourceLayer,
                    is_override: resolution.isOverride,
                    overridden_count: resolution.overriddenLayers.length
                  };
                }
              }

              return enhanced;
            }));

            // Apply layer filter if specified
            const filteredResults = layer_filter
              ? enhancedResults.filter((r: any) =>
                  r.layer_info && layer_filter.includes(r.layer_info.source_layer))
              : enhancedResults;

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    query,
                    total_results: filteredResults.length,
                    layer_filter: layer_filter || 'none',
                    results: filteredResults
                  }, null, 2)
                }
              ]
            };
          }

          case 'get_configuration_status': {
            const { include_validation = true, include_performance = false } = args as {
              include_validation?: boolean;
              include_performance?: boolean;
            };

            const status = {
              configuration_loaded: !!this.configuration,
              layers_initialized: this.layerService ? this.layerService.getLayers().length : 0,
              layer_summary: this.configuration ? {
                total_layers: this.configuration.layers.length,
                enabled_layers: this.configuration.layers.filter(l => l.enabled).length,
                layer_types: this.configuration.layers.reduce((acc, layer) => {
                  acc[layer.source.type] = (acc[layer.source.type] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              } : null
            };

            if (include_validation && this.configuration) {
              const validator = new ConfigurationValidator();
              const validation = await validator.validate(this.configuration);
              (status as any).validation = {
                is_valid: validation.valid,
                quality_score: validation.score,
                error_count: validation.errors.length,
                warning_count: validation.warnings.length,
                errors: validation.errors.map(e => ({ field: e.field, message: e.message })),
                warnings: validation.warnings.map(w => ({ type: w.type, message: w.message }))
              };
            }

            if (include_performance && this.layerService) {
              (status as any).performance = this.layerService.getLayerStatistics();
            }

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(status, null, 2)
                }
              ]
            };
          }

          case 'reload_configuration': {
            const { force = false, validate_only = false } = args as { force?: boolean; validate_only?: boolean };

            try {
              // Load fresh configuration
              const configResult = await this.configLoader.loadConfiguration();

              if (validate_only) {
                const validator = new ConfigurationValidator();
                const validation = await validator.validate(configResult.config);

                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        validation_only: true,
                        is_valid: validation.valid,
                        quality_score: validation.score,
                        errors: validation.errors,
                        warnings: validation.warnings
                      }, null, 2)
                    }
                  ]
                };
              }

              // Reinitialize services if configuration changed or forced
              if (force || JSON.stringify(configResult.config) !== JSON.stringify(this.configuration)) {
                await this.initializeServices(configResult);

                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        reloaded: true,
                        layers_reinitialized: this.layerService.getLayers().length,
                        configuration_sources: configResult.sources,
                        warnings: configResult.warnings
                      }, null, 2)
                    }
                  ]
                };
              } else {
                return {
                  content: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        reloaded: false,
                        message: 'Configuration unchanged, no reload needed',
                        current_layers: this.layerService.getLayers().length
                      }, null, 2)
                    }
                  ]
                };
              }
            } catch (error) {
              throw new McpError(ErrorCode.InternalError,
                `Configuration reload failed: ${error instanceof Error ? error.message : String(error)}`);
            }
          }

          case 'get_system_analytics': {
            const {
              include_topic_analytics = true,
              include_layer_performance = true,
              include_configuration_insights = true
            } = args as {
              include_topic_analytics?: boolean;
              include_layer_performance?: boolean;
              include_configuration_insights?: boolean;
            };

            const analytics = await this.generateSystemAnalytics(
              include_topic_analytics,
              include_layer_performance,
              include_configuration_insights
            );

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(analytics, null, 2)
                }
              ]
            };
          }

          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  /**
   * Initialize all services with configuration
   */
  private async initializeServices(configResult: ConfigurationLoadResult): Promise<void> {
    console.error('🔧 Initializing BCKB services with layered configuration...');

    // Store configuration
    this.configuration = configResult.config;

    // Initialize layer service with configuration
    this.layerService = new LayerService();
    await this.layerService.initializeFromConfiguration(this.configuration);

    // Initialize legacy knowledge service for backward compatibility
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const legacyConfig: BCKBConfig = {
      knowledge_base_path: process.env['BCKB_KB_PATH'] || join(__dirname, '../embedded-knowledge'),
      indexes_path: process.env['BCKB_INDEXES_PATH'] || join(__dirname, '../embedded-knowledge/indexes'),
      methodologies_path: process.env['BCKB_METHODOLOGIES_PATH'] || join(__dirname, '../embedded-knowledge/methodologies'),
      cache_size: this.configuration.cache.max_size_mb * 1024, // Convert MB to entries approximation
      max_search_results: 20,
      default_bc_version: 'BC22',
      enable_fuzzy_search: true,
      search_threshold: 0.6
    };

    this.knowledgeService = new KnowledgeService(legacyConfig);
    await this.knowledgeService.initialize();

    this.codeAnalysisService = new CodeAnalysisService(this.knowledgeService);
    this.methodologyService = new MethodologyService(this.knowledgeService, legacyConfig.methodologies_path);

    console.error('✅ All services initialized successfully');
  }

  /**
   * Generate comprehensive system analytics
   */
  private async generateSystemAnalytics(
    includeTopicAnalytics: boolean,
    includeLayerPerformance: boolean,
    includeConfigurationInsights: boolean
  ): Promise<any> {
    const analytics = {
      timestamp: new Date().toISOString(),
      system_overview: {
        server_version: '2.0.0',
        layers_active: this.layerService?.getLayers().length || 0,
        configuration_loaded: !!this.configuration,
        total_topics: this.layerService?.getAllTopicIds().length || 0
      }
    } as any;

    if (includeTopicAnalytics && this.layerService) {
      analytics.topic_analytics = await this.generateTopicAnalytics();
    }

    if (includeLayerPerformance && this.layerService) {
      analytics.layer_performance = this.generateLayerPerformanceAnalytics();
    }

    if (includeConfigurationInsights && this.configuration) {
      analytics.configuration_insights = await this.generateConfigurationInsights();
    }

    return analytics;
  }

  /**
   * Generate topic distribution and coverage analytics
   */
  private async generateTopicAnalytics(): Promise<any> {
    const allTopicIds = this.layerService.getAllTopicIds();
    const domainDistribution: Record<string, number> = {};
    const difficultyDistribution: Record<string, number> = {};
    const overrideStats = this.layerService.getOverriddenTopics();

    // Analyze a sample of topics for domain/difficulty distribution
    const sampleSize = Math.min(50, allTopicIds.length);
    const sampleTopics = allTopicIds.slice(0, sampleSize);

    for (const topicId of sampleTopics) {
      const resolution = await this.layerService.resolveTopic(topicId);
      if (resolution) {
        const domain = resolution.topic.frontmatter.domain;
        const difficulty = resolution.topic.frontmatter.difficulty;

        domainDistribution[domain] = (domainDistribution[domain] || 0) + 1;
        difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
      }
    }

    return {
      total_topics: allTopicIds.length,
      analyzed_sample: sampleSize,
      domain_distribution: domainDistribution,
      difficulty_distribution: difficultyDistribution,
      override_statistics: {
        total_overrides: Object.keys(overrideStats).length,
        override_percentage: allTopicIds.length > 0
          ? ((Object.keys(overrideStats).length / allTopicIds.length) * 100).toFixed(1) + '%'
          : '0%'
      },
      coverage_insights: {
        domains_covered: Object.keys(domainDistribution).length,
        difficulty_levels: Object.keys(difficultyDistribution).length,
        most_common_domain: Object.entries(domainDistribution).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A',
        most_common_difficulty: Object.entries(difficultyDistribution).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'
      }
    };
  }

  /**
   * Generate layer performance analytics
   */
  private generateLayerPerformanceAnalytics(): any {
    const layerStats = this.layerService.getLayerStatistics();
    const layers = this.layerService.getLayers();

    const layerMetrics = layers.map(layer => {
      const stats = layer.getStatistics();
      return {
        name: layer.name,
        priority: layer.priority,
        enabled: layer.enabled,
        topic_count: stats.topicCount,
        index_count: stats.indexCount,
        memory_usage_mb: stats.memoryUsage?.total ? (stats.memoryUsage.total / (1024 * 1024)).toFixed(2) : 'N/A',
        load_time_ms: stats.loadTimeMs,
        type: layer.constructor.name
      };
    });

    return {
      system_totals: {
        total_layers: layerStats.total.layers,
        total_topics: layerStats.total.totalTopics,
        total_indexes: layerStats.total.totalIndexes,
        total_memory_mb: layerStats.total.memoryUsage ? (layerStats.total.memoryUsage / (1024 * 1024)).toFixed(2) : 'N/A'
      },
      layer_metrics: layerMetrics,
      performance_insights: {
        fastest_layer: layerMetrics.sort((a, b) => (a.load_time_ms || 0) - (b.load_time_ms || 0))[0]?.name || 'N/A',
        most_topics: layerMetrics.sort((a, b) => b.topic_count - a.topic_count)[0]?.name || 'N/A',
        layer_efficiency: layerMetrics.length > 0
          ? (layerStats.total.totalTopics / layerMetrics.length).toFixed(1) + ' topics/layer avg'
          : 'N/A'
      }
    };
  }

  /**
   * Generate configuration optimization insights
   */
  private async generateConfigurationInsights(): Promise<any> {
    const validator = new ConfigurationValidator();
    const validation = await validator.validate(this.configuration);

    const insights = {
      configuration_quality: {
        overall_score: validation.score,
        is_valid: validation.valid,
        error_count: validation.errors.length,
        warning_count: validation.warnings.length
      },
      layer_configuration: {
        total_layers: this.configuration.layers.length,
        enabled_layers: this.configuration.layers.filter(l => l.enabled).length,
        layer_types: this.configuration.layers.reduce((acc, layer) => {
          acc[layer.source.type] = (acc[layer.source.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        priority_distribution: this.configuration.layers.map(l => l.priority).sort((a, b) => a - b)
      },
      optimization_recommendations: []
    } as any;

    // Generate optimization recommendations
    if (this.configuration.layers.filter(l => l.enabled).length < 2) {
      insights.optimization_recommendations.push({
        type: 'layer_diversity',
        message: 'Consider adding more layer types (git, local overrides) for better customization',
        impact: 'medium'
      });
    }

    if (this.configuration.performance.max_concurrent_loads < 3) {
      insights.optimization_recommendations.push({
        type: 'performance',
        message: 'Increase max_concurrent_loads for better performance on modern systems',
        impact: 'low'
      });
    }

    if (!this.configuration.security.validate_sources) {
      insights.optimization_recommendations.push({
        type: 'security',
        message: 'Enable source validation for better security',
        impact: 'high'
      });
    }

    if (validation.warnings.length > 0) {
      insights.optimization_recommendations.push({
        type: 'configuration',
        message: `Address ${validation.warnings.length} configuration warnings`,
        impact: 'medium'
      });
    }

    return insights;
  }

  private async generateOptimizationWorkflow(params: OptimizationWorkflowParams) {
    // Use domain workflows for comprehensive scenario coverage
    const baseWorkflows = domainWorkflows;
    
    // Additional legacy workflow mapping
    const legacyWorkflows: Record<string, any> = {
      'slow report': {
        steps: [
          {
            step_number: 1,
            title: 'Analyze Current Data Access Patterns',
            description: 'Review report dataset access, joins, and aggregations to identify bottlenecks',
            related_topics: ['query-performance-patterns', 'sift-technology-fundamentals'],
            validation_criteria: ['Query execution times documented', 'Data volume assessed'],
            estimated_time: '30 minutes'
          },
          {
            step_number: 2,
            title: 'Implement SIFT Indexes',
            description: 'Add SIFT indexes for aggregation operations and enable MaintainSIFTIndex',
            related_topics: ['sift-index-fundamentals', 'maintainsiftindex-property-behavior'],
            validation_criteria: ['SIFT keys created', 'MaintainSIFTIndex enabled', 'Aggregations use CalcSums'],
            estimated_time: '45 minutes'
          },
          {
            step_number: 3,
            title: 'Optimize Field Loading',
            description: 'Use SetLoadFields to reduce memory usage and network traffic',
            related_topics: ['setloadfields-optimization', 'memory-optimization'],
            validation_criteria: ['SetLoadFields implemented', 'Only required fields loaded'],
            estimated_time: '20 minutes'
          },
          {
            step_number: 4,
            title: 'Performance Testing and Validation',
            description: 'Measure performance improvements and validate against targets',
            related_topics: ['performance-monitoring', 'performance-best-practices'],
            validation_criteria: ['Performance metrics collected', 'Target response time achieved'],
            estimated_time: '30 minutes'
          }
        ],
        learning_path: ['sift-technology-fundamentals', 'query-performance-patterns', 'performance-monitoring'],
        success_metrics: ['Report execution time reduced by 70%+', 'Memory usage optimized', 'User satisfaction improved'],
        common_pitfalls: ['Not enabling MaintainSIFTIndex', 'Loading unnecessary fields', 'Missing performance baselines']
      }
    };
    
    // Merge domain workflows with legacy workflows
    const allWorkflows = { ...baseWorkflows, ...legacyWorkflows };

    // Find matching workflow or create generic one
    const scenario = params.scenario.toLowerCase();
    let workflow = null;
    
    for (const [key, value] of Object.entries(allWorkflows)) {
      if (scenario.includes(key)) {
        workflow = value;
        break;
      }
    }

    if (!workflow) {
      // Generate generic optimization workflow
      workflow = {
        steps: [
          {
            step_number: 1,
            title: 'Identify Performance Bottlenecks',
            description: 'Analyze the scenario to pinpoint specific performance issues',
            related_topics: ['performance-monitoring', 'query-performance-patterns'],
            validation_criteria: ['Bottlenecks identified', 'Performance baseline established'],
            estimated_time: '30 minutes'
          },
          {
            step_number: 2,
            title: 'Apply Targeted Optimizations',
            description: 'Implement specific BC optimization patterns based on identified issues',
            related_topics: ['performance-best-practices', 'memory-optimization'],
            validation_criteria: ['Optimizations implemented', 'Code patterns improved'],
            estimated_time: '60 minutes'
          },
          {
            step_number: 3,
            title: 'Validate and Monitor',
            description: 'Test improvements and establish ongoing monitoring',
            related_topics: ['performance-monitoring'],
            validation_criteria: ['Performance improved', 'Monitoring established'],
            estimated_time: '20 minutes'
          }
        ],
        learning_path: ['performance-best-practices', 'performance-monitoring'],
        success_metrics: ['Measurable performance improvement', 'Sustainable solution implemented'],
        common_pitfalls: ['Premature optimization', 'Insufficient testing', 'Missing monitoring']
      };
    }

    return {
      scenario: params.scenario,
      workflow,
      constraints: params.constraints || [],
      target_performance: params.target_performance
    };
  }

  async run(): Promise<void> {
    try {
      console.error('🚀 BCKB MCP Server v2.0 starting...');

      // Load configuration
      console.error('📋 Loading configuration...');
      const configResult = await this.configLoader.loadConfiguration();

      if (configResult.validation_errors.length > 0) {
        console.error('❌ Configuration validation errors:');
        configResult.validation_errors.forEach(error => {
          console.error(`   - ${error.field}: ${error.message}`);
        });
        process.exit(1);
      }

      if (configResult.warnings.length > 0) {
        console.error('⚠️  Configuration warnings:');
        configResult.warnings.forEach(warning => {
          console.error(`   - ${warning.type}: ${warning.message}`);
        });
      }

      console.error(`✅ Configuration loaded with ${configResult.config.layers.length} layers`);

      // Initialize all services
      await this.initializeServices(configResult);

      // Start MCP server
      console.error('🌐 Starting MCP transport...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.error('✅ BCKB MCP Server v2.0 started successfully');
      console.error(`📊 System Status:`);
      console.error(`   - ${this.layerService.getLayers().length} layers active`);
      console.error(`   - ${this.layerService.getAllTopicIds().length} topics available`);
      console.error(`   - Configuration quality: ${await this.getConfigurationQuality()}/100`);

    } catch (error) {
      console.error('💥 Fatal error during server startup:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      process.exit(1);
    }
  }

  /**
   * Get configuration quality score for startup diagnostics
   */
  private async getConfigurationQuality(): Promise<number> {
    if (!this.configuration) return 0;

    try {
      const validator = new ConfigurationValidator();
      const validation = await validator.validate(this.configuration);
      return validation.score;
    } catch {
      return 0;
    }
  }
}

// Start the server
async function main() {
  const server = new BCKBServer();
  await server.run();
}

// Handle process termination
process.on('SIGINT', async () => {
  console.error('BCKB MCP Server shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('BCKB MCP Server shutting down...');
  process.exit(0);
});

// Run server if this is the main module
if (process.argv[1]?.endsWith('index.js')) {
  main().catch((error) => {
    console.error('Fatal error in BCKB MCP Server:', error);
    process.exit(1);
  });
}

export { BCKBServer };