#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { streamlinedTools } from './streamlined-tools.js';
import { createStreamlinedHandlers } from './streamlined-handlers.js';
import { KnowledgeService } from './services/knowledge-service.js';
import { CodeAnalysisService } from './services/code-analysis-service.js';
import { MethodologyService } from './services/methodology-service.js';
import { WorkflowService } from './services/workflow-service.js';
import { LayerService } from './layers/layer-service.js';
import { getDomainList } from './types/bc-knowledge.js';
import { MultiContentLayerService } from './services/multi-content-layer-service.js';
import { SpecialistSessionManager } from './services/specialist-session-manager.js';
import { SpecialistTools } from './tools/specialist-tools.js';
import { SpecialistDiscoveryService } from './services/specialist-discovery.js';
import { SpecialistDiscoveryTools } from './tools/specialist-discovery-tools.js';
import { EnhancedPromptService } from './services/enhanced-prompt-service.js';
import { AgentOnboardingService } from './services/agent-onboarding-service.js';
import { SpecialistHandoffService } from './services/specialist-handoff-service.js';
import { ConfigurationLoader } from './config/config-loader.js';
import { ConfigurationValidator } from './config/config-validator.js';
import { domainWorkflows } from './workflows/domain-workflows.js';
import {
  TopicSearchParams,
  CodeAnalysisParams,
  OptimizationWorkflowParams,
  BCKBConfig
} from './types/bc-knowledge.js';
import { SpecialistDefinition } from './services/specialist-loader.js';
import { WorkflowType, WorkflowStartRequest, WorkflowAdvanceRequest } from './services/workflow-service.js';
import {
  BCCodeIntelConfiguration,
  ConfigurationLoadResult
} from './types/index.js';

/**
 * BC Code Intelligence MCP Server
 * 
 * Business Central Code Intelligence Model Context Protocol Server
 * Surfaces atomic BC knowledge topics for intelligent AI consumption
 * via GitHub Copilot, Claude, and other LLM tools.
 */
class BCCodeIntelligenceServer {
  private server: Server;
  private knowledgeService!: KnowledgeService;
  private codeAnalysisService!: CodeAnalysisService;
  private methodologyService!: MethodologyService;
  private workflowService!: WorkflowService;
  private layerService!: LayerService;
  private multiContentLayerService!: MultiContentLayerService;
  private specialistSessionManager!: SpecialistSessionManager;
  private specialistTools!: SpecialistTools;
  private specialistDiscoveryService!: SpecialistDiscoveryService;
  private specialistDiscoveryTools!: SpecialistDiscoveryTools;
  private enhancedPromptService!: EnhancedPromptService;
  private agentOnboardingService!: AgentOnboardingService;
  private specialistHandoffService!: SpecialistHandoffService;
  private configuration!: BCCodeIntelConfiguration;
  private configLoader: ConfigurationLoader;

  private getPackageVersion(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packagePath = join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      return packageJson.version;
    } catch {
      return '1.0.0'; // fallback
    }
  }

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'bc-code-intelligence-mcp',
        version: this.getPackageVersion(),
      }
    );

    // Initialize configuration loader
    this.configLoader = new ConfigurationLoader();

    // Services will be initialized asynchronously in run()
    this.setupToolHandlers();
    this.setupPrompts();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [...streamlinedTools];
      
      // Add specialist tools if available
      if (this.specialistTools) {
        tools.push(...this.specialistTools.getToolDefinitions() as any);
      }
      
      // Add specialist discovery tools if available
      if (this.specialistDiscoveryTools) {
        tools.push(...this.specialistDiscoveryTools.getToolDefinitions() as any);
      }
      
      // Add agent onboarding tools if available
      if (this.agentOnboardingService) {
        tools.push(...this.agentOnboardingService.getToolDefinitions() as any);
      }
      
      // Add specialist handoff tools if available
      if (this.specialistHandoffService) {
        tools.push(...this.specialistHandoffService.getToolDefinitions() as any);
      }
      
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Check if it's a specialist tool
        if (this.specialistTools && ['suggest_specialist', 'get_specialist_advice', 'list_specialists'].includes(name)) {
          return await this.specialistTools.handleToolCall(request);
        }

        // Check if it's a specialist discovery tool
        if (this.specialistDiscoveryTools && ['discover_specialists', 'browse_specialists', 'get_specialist_info'].includes(name)) {
          return await this.specialistDiscoveryTools.handleToolCall(request);
        }

        // Check if it's an agent onboarding tool  
        if (this.agentOnboardingService && ['introduce_bc_specialists', 'get_specialist_introduction', 'suggest_next_specialist'].includes(name)) {
          return await this.agentOnboardingService.handleToolCall(request);
        }

        // Check if it's a specialist handoff tool
        if (this.specialistHandoffService && ['handoff_to_specialist', 'bring_in_specialist', 'get_handoff_summary'].includes(name)) {
          return await this.specialistHandoffService.handleToolCall(request);
        }

        // Create streamlined handlers with all services
        const handlers = createStreamlinedHandlers(this.server, {
          knowledgeService: this.knowledgeService,
          codeAnalysisService: this.codeAnalysisService,
          methodologyService: this.methodologyService,
          workflowService: this.workflowService,
          layerService: this.layerService
        });

        // Execute the appropriate handler
        const handler = handlers[name as keyof typeof handlers];
        if (!handler) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        return await handler(args);
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  /**
   * Setup prompts for workflow pipelines
   */
  private setupPrompts(): void {
    console.error('🎯 Setting up MCP Prompts for workflow pipelines...');

    // Define workflow prompts that guide users through structured pipelines
    const workflowPrompts = [
      {
        name: 'code_optimization',
        description: 'Optimize existing Business Central code using systematic analysis phases',
        arguments: [
          {
            name: 'code_location',
            description: 'Path to the code file or description of the code to optimize',
            required: false // No more required fields - specialist will ask conversationally
          }
        ]
      },
      {
        name: 'architecture_review',
        description: 'Conduct comprehensive architecture review of Business Central solution',
        arguments: [
          {
            name: 'scope',
            description: 'Scope of review (module, solution, or specific components)',
            required: false // Specialist will ask about scope naturally
          }
        ]
      },
      {
        name: 'security_audit',
        description: 'Perform security analysis and compliance check for Business Central implementation',
        arguments: [
          {
            name: 'audit_scope',
            description: 'Security audit scope (permissions, data access, API security, etc.)',
            required: false // Specialist will gather this in conversation
          }
        ]
      },
      {
        name: 'perf_review',
        description: 'Analyze and optimize Business Central performance issues',
        arguments: [
          {
            name: 'performance_concern',
            description: 'Description of performance issue or area to analyze',
            required: false
          }
        ]
      },
      {
        name: 'integration_design',
        description: 'Design robust integration patterns for Business Central',
        arguments: [
          {
            name: 'integration_type',
            description: 'Type of integration (API, data sync, external service, etc.)',
            required: false
          }
        ]
      },
      {
        name: 'upgrade_planning',
        description: 'Plan Business Central version upgrade with risk assessment',
        arguments: [
          {
            name: 'current_version',
            description: 'Current Business Central version',
            required: false
          },
          {
            name: 'target_version',
            description: 'Target Business Central version',
            required: false
          }
        ]
      },
      {
        name: 'testing_strategy',
        description: 'Develop comprehensive testing strategy for Business Central solutions',
        arguments: [
          {
            name: 'testing_scope',
            description: 'Scope of testing (unit, integration, user acceptance, etc.)',
            required: false
          }
        ]
      },
      {
        name: 'dev_onboarding',
        description: 'Guide new developer through Business Central development onboarding',
        arguments: [
          {
            name: 'experience_level',
            description: 'Developer experience level (beginner, intermediate, expert)',
            required: false
          },
          {
            name: 'focus_area',
            description: 'Primary focus area for onboarding (development, customization, integration)',
            required: false
          }
        ]
      },
      {
        name: 'app_takeover',
        description: 'Analyze and orient developer taking over an unfamiliar Business Central app',
        arguments: [
          {
            name: 'app_source',
            description: 'Source of the app (path, repository, AppSource, or description)',
            required: false
          },
          {
            name: 'takeover_context',
            description: 'Context for takeover (maintenance, enhancement, migration, or handoff scenario)',
            required: false
          }
        ]
      },
      {
        name: 'spec_analysis',
        description: 'Analyze requirements and specifications to determine development readiness',
        arguments: [
          {
            name: 'spec_source',
            description: 'Source of specifications (document, user story, requirements, or description)',
            required: false
          },
          {
            name: 'analysis_focus',
            description: 'Analysis focus (completeness, feasibility, technical-gaps, or dependencies)',
            required: false
          }
        ]
      },
      {
        name: 'bug_investigation',
        description: 'Systematically investigate and resolve Business Central bugs and issues',
        arguments: [
          {
            name: 'bug_context',
            description: 'Available context (call-stack, repro-steps, snapshot, sandbox-access, or description)',
            required: false
          },
          {
            name: 'issue_severity',
            description: 'Issue severity level (critical, high, medium, low)',
            required: false
          }
        ]
      },
      {
        name: 'monolith_to_modules',
        description: 'Refactor monolithic Business Central code into modular architecture using SOLID principles',
        arguments: [
          {
            name: 'current_structure',
            description: 'Current code structure (monolithic-object, large-codeunit, tightly-coupled, or description)',
            required: false
          },
          {
            name: 'modularization_goal',
            description: 'Modularization goal (dependency-injection, interface-patterns, loose-coupling, or testability)',
            required: false
          }
        ]
      },
      {
        name: 'data_flow_tracing',
        description: 'Trace data flow and dependencies across Business Central objects and codeunits',
        arguments: [
          {
            name: 'trace_target',
            description: 'What to trace (field-usage, table-relationships, posting-flow, or process-chain)',
            required: false
          },
          {
            name: 'trace_scope',
            description: 'Tracing scope (single-object, module-level, cross-module, or end-to-end)',
            required: false
          }
        ]
      },
      {
        name: 'full_review',
        description: 'Conduct comprehensive review and analysis without implementation changes',
        arguments: [
          {
            name: 'review_target',
            description: 'What to review (code, architecture, documentation, processes)',
            required: false
          },
          {
            name: 'review_depth',
            description: 'Review depth (surface, detailed, comprehensive)',
            required: false
          }
        ]
      }
    ];

    // Register prompt list handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: workflowPrompts.map(p => ({
        name: p.name,
        description: p.description,
        arguments: p.arguments
      }))
    }));

    // Register get prompt handler for all workflows
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      const prompt = workflowPrompts.find(p => p.name === name);
      if (!prompt) {
        throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
      }

        try {
          // Convert workflow name to type and create start request
          const workflowTypeMap: Record<string, string> = {
            'code_optimization': 'new-bc-app',
            'architecture_review': 'enhance-bc-app',
            'security_audit': 'debug-bc-issues',
            'perf_review': 'debug-bc-issues',
            'integration_design': 'add-ecosystem-features',
            'upgrade_planning': 'upgrade-bc-version',
            'testing_strategy': 'modernize-bc-code',
            'dev_onboarding': 'onboard-developer',
            'app_takeover': 'app-takeover-analysis',
            'spec_analysis': 'requirements-analysis',
            'bug_investigation': 'debug-bc-issues',
            'monolith_to_modules': 'refactor-architecture',
            'data_flow_tracing': 'trace-dependencies',
            'full_review': 'review-bc-code'
          };
          
          const workflowType = workflowTypeMap[name] as any;
          if (!workflowType) {
            throw new Error(`Unknown workflow type: ${name}`);
          }
          
          const startRequest = {
            workflow_type: workflowType,
            project_context: args?.code_location || args?.scope || args?.audit_scope || 
                           args?.performance_concern || args?.integration_type || 
                           args?.testing_scope || args?.review_target || 
                           'General workflow request',
            bc_version: args?.target_version || args?.current_version,
            additional_context: args
          };
          
          // Start the workflow session
          const session = await this.workflowService.startWorkflow(startRequest);
          
          // Get the initial guidance for this workflow
          const initialGuidance = await this.workflowService.getPhaseGuidance(session.id);
          
          // Enhance with specialist routing
          const userContext = args?.code_location || args?.scope || args?.audit_scope || 
                             args?.performance_concern || args?.integration_type || 
                             args?.testing_scope || args?.review_target || 
                             'General workflow request';
          
          const enhancedResult = await this.enhancedPromptService.enhanceWorkflowPrompt(
            name,
            userContext,
            initialGuidance
          );
          
          // Construct explicit prompt that bypasses VS Code prompt creation
          const promptContent = `# ${prompt.description}

**IMPORTANT: This is a complete, ready-to-use prompt. Do not create additional prompts or ask for more information. Proceed directly with the requested workflow.**

${enhancedResult.enhancedContent}

## 🎯 Next Actions

**Use these MCP tools immediately to proceed:**
${enhancedResult.routingOptions.map(option => `- ${option.replace('🎯 Start session with', '**Use MCP tool:**')}`).join('\n')}

**Remember:** You have access to 20+ MCP tools from bc-code-intelligence-mcp. Use them actively for specialist consultation and knowledge access.`;

          return {
            description: `Starting ${workflowType} workflow with specialist guidance`,
            messages: [
              {
                role: 'user',
                content: {
                  type: 'text',
                  text: promptContent
                }
              }
            ]
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to start workflow: ${error instanceof Error ? error.message : String(error)}`);
        }
      });

    console.error('✅ MCP Prompts configured for workflow orchestration');
  }

  /**
   * Initialize all services with configuration
   */
  private async initializeServices(configResult: ConfigurationLoadResult): Promise<void> {
    // Store configuration
    this.configuration = configResult.config;

    // Initialize layer service with configuration
    this.layerService = new LayerService();
    await this.layerService.initializeFromConfiguration(this.configuration);

    // Report layer-by-layer counts
    const layers = this.layerService.getLayers();
    let totalTopics = 0;
    for (const layer of layers) {
      const stats = layer.getStatistics();
      console.error(`📁 Layer '${stats.name}': ${stats.topicCount} topics`);
      totalTopics += stats.topicCount;
    }

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
    
    // Initialize specialist services using a dedicated MultiContentLayerService
    this.multiContentLayerService = new MultiContentLayerService();
    
    // Add embedded layer for specialists
    const embeddedPath = join(__dirname, '../embedded-knowledge');
    const { EmbeddedKnowledgeLayer } = await import('./layers/embedded-layer.js');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    this.multiContentLayerService.addLayer(embeddedLayer as any); // Cast to avoid type issues
    await this.multiContentLayerService.initialize();
    
    // Get session storage configuration from layer service
    const sessionStorageConfig = this.layerService.getSessionStorageConfig();
    
    this.specialistSessionManager = new SpecialistSessionManager(
      this.multiContentLayerService, 
      sessionStorageConfig
    );
    this.specialistTools = new SpecialistTools(
      this.multiContentLayerService, 
      this.specialistSessionManager,
      this.knowledgeService
    );
    
    // Initialize specialist discovery service and tools
    this.specialistDiscoveryService = new SpecialistDiscoveryService(this.multiContentLayerService);
    this.specialistDiscoveryTools = new SpecialistDiscoveryTools(
      this.specialistDiscoveryService,
      this.specialistSessionManager,
      this.multiContentLayerService
    );
    
    // Initialize enhanced prompt service for specialist routing
    this.enhancedPromptService = new EnhancedPromptService(
      this.specialistDiscoveryService,
      this.specialistSessionManager,
      this.workflowService
    );
    
    // Initialize agent onboarding service for natural specialist introduction
    this.agentOnboardingService = new AgentOnboardingService(
      this.specialistDiscoveryService,
      this.multiContentLayerService
    );
    
    // Initialize specialist handoff service for seamless transitions
    this.specialistHandoffService = new SpecialistHandoffService(
      this.specialistSessionManager,
      this.specialistDiscoveryService,
      this.multiContentLayerService
    );
    
    // Initialize workflow service with specialist discovery
    const specialistDiscoveryService = new SpecialistDiscoveryService(this.multiContentLayerService);
    this.workflowService = new WorkflowService(this.knowledgeService, this.methodologyService, specialistDiscoveryService);

    // Report final totals
    const specialists = await this.multiContentLayerService.getAllSpecialists();
    console.error(`📊 Total: ${totalTopics} topics, ${specialists.length} specialists`);
    
    // Validate tool contracts at startup
    await this.validateToolContracts();
  }

  /**
   * Validate that all tool schemas match service implementations
   */
  private async validateToolContracts(): Promise<void> {
    try {
      const handlers = createStreamlinedHandlers(this.server, {
        knowledgeService: this.knowledgeService,
        codeAnalysisService: this.codeAnalysisService,
        methodologyService: this.methodologyService,
        workflowService: this.workflowService,
        layerService: this.layerService
      }) as any;
      
      let hasIssues = false;
      
      for (const tool of streamlinedTools) {
        if (!handlers[tool.name]) {
          console.error(`❌ No handler found for tool: ${tool.name}`);
          hasIssues = true;
        }
      }
      
      if (hasIssues) {
        console.error('💥 Contract validation failed! Server may have dead ends.');
        // Don't fail startup, but warn loudly
      }
    } catch (error) {
      console.error(`⚠️  Contract validation error: ${error}`);
      // Don't fail startup for validation errors
    }
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
        server_version: this.getPackageVersion(),
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
        const domains = getDomainList(resolution.topic.frontmatter.domain);
        const difficulty = resolution.topic.frontmatter.difficulty;

        // Count each domain the topic belongs to
        for (const domain of domains) {
          domainDistribution[domain] = (domainDistribution[domain] || 0) + 1;
        }
        if (difficulty) {
          difficultyDistribution[difficulty] = (difficultyDistribution[difficulty] || 0) + 1;
        }
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
      console.error(`🚀 BC Code Intelligence MCP Server v${this.getPackageVersion()} starting...`);

      // Load configuration
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

      // Initialize all services (this will now show layer counts)
      await this.initializeServices(configResult);

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.error(`✅ BC Code Intelligence MCP Server v${this.getPackageVersion()} started successfully`);

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
  const server = new BCCodeIntelligenceServer();
  await server.run();
}

// Handle process termination
process.on('SIGINT', async () => {
  console.error('BC Code Intelligence MCP Server shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('BC Code Intelligence MCP Server shutting down...');
  process.exit(0);
});

// Run server if this is the main module
if (process.argv[1]?.endsWith('index.js')) {
  main().catch((error) => {
    console.error('Fatal error in BC Code Intelligence MCP Server:', error);
    process.exit(1);
  });
}

export { BCCodeIntelligenceServer };
