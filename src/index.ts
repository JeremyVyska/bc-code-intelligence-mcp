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
import { readFileSync, existsSync } from 'fs';
import {
  getAllToolDefinitions,
  STREAMLINED_TOOL_NAMES,
  SpecialistTools,
  SpecialistDiscoveryTools,
  AgentOnboardingTools,
  SpecialistHandoffTools
} from './tools/index.js';
import { createStreamlinedHandlers } from './streamlined-handlers.js';
import { KnowledgeService } from './services/knowledge-service.js';
import { CodeAnalysisService } from './services/code-analysis-service.js';
import { MethodologyService } from './services/methodology-service.js';
import { WorkflowService } from './services/workflow-service.js';
import { getDomainList } from './types/bc-knowledge.js';
import { MultiContentLayerService } from './services/multi-content-layer-service.js';
import { SpecialistSessionManager } from './services/specialist-session-manager.js';
import { SpecialistDiscoveryService } from './services/specialist-discovery.js';
import { EnhancedPromptService } from './services/enhanced-prompt-service.js';
import { ConfigurationLoader } from './config/config-loader.js';
import { ConfigurationValidator } from './config/config-validator.js';
import { ConfigDiagnosticTools } from './tools/config-diagnostic-tools.js';
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
  ConfigurationLoadResult,
  LayerSourceType
} from './types/index.js';
import { WorkspaceTools, WorkspaceToolsContext } from './tools/workspace-tools.js';

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
  private layerService!: MultiContentLayerService;
  private specialistSessionManager!: SpecialistSessionManager;
  private specialistTools!: SpecialistTools;
  private specialistDiscoveryService!: SpecialistDiscoveryService;
  private specialistDiscoveryTools!: SpecialistDiscoveryTools;
  private enhancedPromptService!: EnhancedPromptService;
  private agentOnboardingTools!: AgentOnboardingTools;
  private specialistHandoffTools!: SpecialistHandoffTools;
  private configDiagnosticTools!: ConfigDiagnosticTools;
  private configuration!: BCCodeIntelConfiguration;
  private configLoader: ConfigurationLoader;
  private workspaceRoot: string | null = null;
  private availableMcps: string[] = [];
  private hasWarnedAboutWorkspace = false;
  private workspaceTools!: WorkspaceTools;
  private servicesInitialized = false;

  private getPackageVersion(): string {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const packagePath = join(__dirname, '..', 'package.json');

      console.error(`🔍 Looking for package.json at: ${packagePath}`);
      console.error(`   Exists: ${existsSync(packagePath)}`);

      if (!existsSync(packagePath)) {
        console.error(`⚠️  package.json not found at expected location`);
        return '1.0.0'; // fallback
      }

      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
      const version = packageJson.version || '1.0.0';
      console.error(`   Version: ${version}`);
      return version;
    } catch (error) {
      console.error(`⚠️  Error reading package.json:`, error instanceof Error ? error.message : String(error));
      return '1.0.0'; // fallback
    }
  }

  constructor() {
    // Log startup diagnostics
    console.error(`[startup] MCP Server starting...`);
    console.error(`[startup] Process CWD: ${process.cwd()}`);
    console.error(`[startup] Node version: ${process.version}`);

    // Initialize MCP server
    this.server = new Server(
      {
        name: 'bc-code-intelligence-mcp',
        version: this.getPackageVersion(),
      }
    );

    // Initialize configuration loader
    this.configLoader = new ConfigurationLoader();

    // Initialize workspace tools
    const workspaceContext: WorkspaceToolsContext = {
      setWorkspaceInfo: this.setWorkspaceInfo.bind(this),
      getWorkspaceInfo: () => ({
        workspace_root: this.workspaceRoot,
        available_mcps: this.availableMcps
      })
    };
    this.workspaceTools = new WorkspaceTools(workspaceContext);

    // Services will be initialized asynchronously in run()
    this.setupToolHandlers();
    this.setupPrompts();
  }

  private setupToolHandlers(): void {
    // List available tools - now using centralized registry
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = getAllToolDefinitions({
        specialistTools: this.specialistTools,
        specialistDiscoveryTools: this.specialistDiscoveryTools,
        onboardingTools: this.agentOnboardingTools,
        handoffTools: this.specialistHandoffTools
      });

      // Add workspace tools (always available)
      tools.push(...this.workspaceTools.getToolDefinitions() as any);

      // Add configuration diagnostic tools if available AND enabled
      if (this.configDiagnosticTools) {
        tools.push(...this.configDiagnosticTools.getToolDefinitions() as any);
      }

      return { tools };
    });

    // Handle tool calls - now using centralized tool names
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Workspace tools are always available (no interception)
        if (['set_workspace_info', 'get_workspace_info', 'set_workspace_root', 'get_workspace_root'].includes(name)) {
          return await this.workspaceTools.handleToolCall(request);
        }

        // Intercept all other tools if services not initialized
        if (!this.servicesInitialized) {
          return {
            content: [{
              type: 'text',
              text: `⚠️ **Workspace Not Configured**

The BC Code Intelligence server needs workspace information to load project-specific configuration and knowledge layers.

**Option 1: Set workspace info** (recommended for project-specific layers and MCP ecosystem awareness)
\`\`\`
set_workspace_info({ 
  workspace_root: "C:/your/project/path",
  available_mcps: []  // REQUIRED: Examine your available tools and infer MCP servers (see tool description)
})
\`\`\`

**How to populate available_mcps:**
Check which tools you have available and add the corresponding MCP server IDs:
- Have \`search_telemetry_traces\`? Add "bc-telemetry-buddy"
- Have \`reserve_object_ids\`? Add "al-objid-mcp-server"  
- Have \`analyze_dependencies\`? Add "al-dependency-mcp-server"
- Have \`get_lsp_diagnostics\`? Add "serena-mcp"
- Have \`create_work_item\`? Add "azure-devops-mcp"
- Have \`track_time_entry\`? Add "clockify-mcp"
- Have \`translate_xliff\`? Add "nab-al-tools-mcp"

**Option 2: Use user-level config** (works without workspace)
Place a configuration file at:
- Windows: \`%USERPROFILE%\\.bckb\\config.yml\`
- Linux/Mac: \`~/.bckb/config.yml\`

Use absolute paths in the config for git/local layers.

Currently only embedded knowledge is loaded. Call \`set_workspace_info\` to enable project layers and MCP ecosystem awareness.`
            }]
          };
        }

        // Check if it's a specialist tool
        if (this.specialistTools && ['suggest_specialist', 'get_specialist_advice', 'list_specialists'].includes(name)) {
          return await this.specialistTools.handleToolCall(request);
        }

        // Check if it's a specialist discovery tool
        if (this.specialistDiscoveryTools && ['discover_specialists', 'browse_specialists', 'get_specialist_info'].includes(name)) {
          return await this.specialistDiscoveryTools.handleToolCall(request);
        }

        // Check if it's an agent onboarding tool  
        if (this.agentOnboardingTools && ['introduce_bc_specialists', 'get_specialist_introduction', 'suggest_next_specialist'].includes(name)) {
          return await this.agentOnboardingTools.handleToolCall(request);
        }

        // Check if it's a specialist handoff tool
        if (this.specialistHandoffTools && ['handoff_to_specialist', 'bring_in_specialist', 'get_handoff_summary'].includes(name)) {
          return await this.specialistHandoffTools.handleToolCall(request);
        }

        // Check if it's a configuration diagnostic tool
        if (this.configDiagnosticTools && ['diagnose_git_layer', 'validate_layer_config', 'test_azure_devops_pat', 'get_layer_diagnostics', 'diagnose_local_layer', 'reload_layers'].includes(name)) {
          return await this.configDiagnosticTools.handleToolCall(request);
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
          'app_takeover': 'enhance-bc-app',
          'spec_analysis': 'review-bc-code',
          'bug_investigation': 'debug-bc-issues',
          'monolith_to_modules': 'modernize-bc-code',
          'data_flow_tracing': 'review-bc-code',
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
    this.layerService = new MultiContentLayerService();
    let totalTopics = 0;

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

    // Initialize specialist services using a dedicated MultiContentLayerService FIRST
    this.layerService = new MultiContentLayerService();

    // Iterate over configured layers and instantiate each based on type
    for (const layerConfig of this.configuration.layers) {
      if (!layerConfig.enabled) {
        console.error(`⏭️  Skipping disabled layer: ${layerConfig.name}`);
        continue;
      }

      let layer;

      switch (layerConfig.source.type) {
        case LayerSourceType.EMBEDDED: {
          // Embedded layer
          const embeddedPath = layerConfig.source.path === 'embedded-knowledge'
            ? join(__dirname, '../embedded-knowledge')
            : (layerConfig.source.path || join(__dirname, '../embedded-knowledge'));
          const { EmbeddedKnowledgeLayer } = await import('./layers/embedded-layer.js');
          layer = new EmbeddedKnowledgeLayer(embeddedPath);
          break;
        }

        case LayerSourceType.LOCAL: {
          // Local filesystem layer - use ProjectKnowledgeLayer
          const { ProjectKnowledgeLayer } = await import('./layers/project-layer.js');
          layer = new ProjectKnowledgeLayer(layerConfig.source.path!);
          // Override name and priority from config
          (layer as any).name = layerConfig.name;
          (layer as any).priority = layerConfig.priority;
          break;
        }

        case LayerSourceType.GIT: {
          // Git repository layer
          const { GitKnowledgeLayer } = await import('./layers/git-layer.js');
          const gitSource = layerConfig.source as any; // GitLayerSource
          layer = new GitKnowledgeLayer(
            layerConfig.name,
            layerConfig.priority,
            {
              type: LayerSourceType.GIT,
              url: gitSource.url,
              branch: gitSource.branch,
              subpath: gitSource.subpath
            },
            layerConfig.auth
          );
          break;
        }

        case LayerSourceType.HTTP:
        case LayerSourceType.NPM: {
          // Future layer types - not yet implemented
          // HTTP: Would load knowledge from HTTP endpoints (ZIP/tarball downloads)
          // NPM: Would load knowledge from NPM packages
          console.warn(`⚠️  Layer type '${layerConfig.source.type}' not yet implemented - skipping ${layerConfig.name}`);
          continue;
        }

        default:
          console.error(`❌ Unknown layer type: ${(layerConfig.source as any).type} - skipping ${layerConfig.name}`);
          continue;
      }

      console.error(`📋 Initializing layer: ${layerConfig.name}`);
      this.layerService.addLayer(layer as any);
    }

    await this.layerService.initialize();

    // Now create KnowledgeService with the initialized layerService
    this.knowledgeService = new KnowledgeService(legacyConfig, this.layerService);
    await this.knowledgeService.initialize();

    this.codeAnalysisService = new CodeAnalysisService(this.knowledgeService);
    this.methodologyService = new MethodologyService(this.knowledgeService, legacyConfig.methodologies_path);

    // Report layer-by-layer counts after initialization
    const layerStats = this.layerService.getStatistics();
    for (const stats of layerStats) {
      console.error(`📁 Layer '${stats.name}': ${stats.topicCount} topics`);
      totalTopics += stats.topicCount;
    }

    // Get session storage configuration from layer service
    const sessionStorageConfig = this.layerService.getSessionStorageConfig();

    this.specialistSessionManager = new SpecialistSessionManager(
      this.layerService,
      sessionStorageConfig
    );
    this.specialistTools = new SpecialistTools(
      this.layerService,
      this.specialistSessionManager,
      this.knowledgeService
    );

    // Initialize specialist discovery service and tools
    this.specialistDiscoveryService = new SpecialistDiscoveryService(this.layerService);
    this.specialistDiscoveryTools = new SpecialistDiscoveryTools(
      this.specialistDiscoveryService,
      this.specialistSessionManager,
      this.layerService
    );

    // Initialize enhanced prompt service for specialist routing
    this.enhancedPromptService = new EnhancedPromptService(
      this.specialistDiscoveryService,
      this.specialistSessionManager,
      this.workflowService
    );

    // Initialize agent onboarding tools for natural specialist introduction
    this.agentOnboardingTools = new AgentOnboardingTools(
      this.specialistDiscoveryService,
      this.layerService
    );

    // Initialize specialist handoff tools for seamless transitions
    this.specialistHandoffTools = new SpecialistHandoffTools(
      this.specialistSessionManager,
      this.specialistDiscoveryService,
      this.layerService
    );

    // Initialize configuration diagnostic tools ONLY if enabled (reduces token overhead)
    if (this.configuration.developer.enable_diagnostic_tools) {
      this.configDiagnosticTools = new ConfigDiagnosticTools(this.layerService, this.configLoader);
      console.error('🔧 Configuration diagnostic tools enabled');
    } else {
      console.error('💡 Tip: Set developer.enable_diagnostic_tools=true for git layer diagnostics');
    }

    // Initialize workflow service with specialist discovery
    const specialistDiscoveryService = new SpecialistDiscoveryService(this.layerService);
    this.workflowService = new WorkflowService(this.knowledgeService, this.methodologyService, specialistDiscoveryService);

    // Report final totals
    const specialists = await this.layerService.getAllSpecialists();
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

      const tools = getAllToolDefinitions({
        specialistTools: this.specialistTools,
        specialistDiscoveryTools: this.specialistDiscoveryTools,
        onboardingTools: this.agentOnboardingTools,
        handoffTools: this.specialistHandoffTools
      });

      let hasIssues = false;

      for (const tool of tools) {
        // Only validate core streamlined tools (others handle their own routing)
        if (Object.values(STREAMLINED_TOOL_NAMES).includes(tool.name as any)) {
          if (!handlers[tool.name]) {
            console.error(`❌ No handler found for core tool: ${tool.name}`);
            hasIssues = true;
          }
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
        most_common_domain: Object.entries(domainDistribution).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A',
        most_common_difficulty: Object.entries(difficultyDistribution).sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'
      }
    };
  }

  /**
   * Generate layer performance analytics
   */
  private generateLayerPerformanceAnalytics(): any {
    const layerStats = this.layerService.getLayerStatistics();
    const layerMetrics = this.layerService.getStatistics();

    const formattedMetrics = layerMetrics.map(stats => {
      return {
        name: stats.name,
        priority: stats.priority,
        enabled: stats.enabled,
        topic_count: stats.topicCount,
        index_count: stats.indexCount,
        memory_usage_mb: stats.memoryUsage?.total ? (stats.memoryUsage.total / (1024 * 1024)).toFixed(2) : 'N/A',
        load_time_ms: stats.loadTimeMs || 0,
        type: 'MultiContentLayer'
      };
    });

    const totalTopics = layerMetrics.reduce((sum, stats) => sum + stats.topicCount, 0);

    return {
      system_totals: {
        total_layers: layerMetrics.length,
        total_topics: totalTopics,
        total_indexes: layerMetrics.reduce((sum, stats) => sum + stats.indexCount, 0),
        total_memory_mb: 'N/A' // Memory tracking not implemented in new system
      },
      layer_metrics: formattedMetrics,
      performance_insights: {
        fastest_layer: formattedMetrics.sort((a, b) => a.load_time_ms - b.load_time_ms)[0]?.name || 'N/A',
        most_topics: formattedMetrics.sort((a, b) => b.topic_count - a.topic_count)[0]?.name || 'N/A',
        layer_efficiency: layerMetrics.length > 0
          ? (totalTopics / layerMetrics.length).toFixed(1) + ' topics/layer avg'
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
      // Ultra-early diagnostics for platform issues
      console.error('=== BC Code Intelligence MCP Server Startup Diagnostics ===');
      console.error(`Platform: ${process.platform}`);
      console.error(`Node version: ${process.version}`);
      console.error(`Architecture: ${process.arch}`);
      console.error(`Working directory: ${process.cwd()}`);
      console.error(`Script path: ${process.argv[1]}`);

      const version = this.getPackageVersion();
      console.error(`🚀 BC Code Intelligence MCP Server v${version} starting...`);

      // Verify embedded knowledge path BEFORE any service initialization
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const embeddedPath = join(__dirname, '..', 'embedded-knowledge');
      console.error(`Embedded knowledge path: ${embeddedPath}`);
      console.error(`Embedded knowledge exists: ${existsSync(embeddedPath)}`);

      if (existsSync(embeddedPath)) {
        const expectedDirs = ['domains', 'specialists', 'methodologies'];
        for (const dir of expectedDirs) {
          const dirPath = join(embeddedPath, dir);
          console.error(`  ${dir}/: ${existsSync(dirPath)}`);
        }
      }

      // Try to load user-level configuration first (company layers)
      // If no user config exists, fall back to embedded-only mode
      console.error('📦 Checking for user-level configuration (company layers)...');

      try {
        const userConfigResult = await this.configLoader.loadConfiguration();

        if (userConfigResult.config.layers && userConfigResult.config.layers.length > 1) {
          // User has configured layers (embedded + company/git layers)
          console.error(`✅ Found user-level configuration with ${userConfigResult.config.layers.length} layers`);
          this.configuration = userConfigResult.config;
          await this.initializeWithConfiguration(userConfigResult);
        } else {
          // No user config or only embedded layer - use embedded-only mode
          console.error('📦 No user-level configuration found, loading embedded knowledge only...');
          await this.initializeEmbeddedOnly();
        }
      } catch (error) {
        console.error('⚠️  Failed to load user configuration, falling back to embedded-only:', error instanceof Error ? error.message : String(error));
        await this.initializeEmbeddedOnly();
      }      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);

      console.error(`✅ BC Code Intelligence MCP Server v${this.getPackageVersion()} started successfully`);
      console.error(`💡 To enable project-specific layers, call set_workspace_info with your project path`);

    } catch (error) {
      console.error('💥 Fatal error during server startup:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      process.exit(1);
    }
  }

  /**
   * Initialize only embedded knowledge layer at startup
   */
  private async initializeEmbeddedOnly(): Promise<void> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const embeddedPath = join(__dirname, '../embedded-knowledge');

    // Initialize minimal layer service with only embedded
    this.layerService = new MultiContentLayerService();

    const { EmbeddedKnowledgeLayer } = await import('./layers/embedded-layer.js');
    const embeddedLayer = new EmbeddedKnowledgeLayer(embeddedPath);

    this.layerService.addLayer(embeddedLayer as any);
    await this.layerService.initialize();

    // Initialize minimal services for embedded-only mode
    const legacyConfig: BCKBConfig = {
      knowledge_base_path: embeddedPath,
      indexes_path: join(embeddedPath, 'indexes'),
      methodologies_path: join(embeddedPath, 'methodologies'),
      cache_size: 1000,
      max_search_results: 20,
      default_bc_version: 'BC22',
      enable_fuzzy_search: true,
      search_threshold: 0.6
    };

    this.knowledgeService = new KnowledgeService(legacyConfig);
    await this.knowledgeService.initialize();

    this.codeAnalysisService = new CodeAnalysisService(this.knowledgeService);
    this.methodologyService = new MethodologyService(this.knowledgeService);

    const specialistDiscoveryService = new SpecialistDiscoveryService(this.layerService);
    this.workflowService = new WorkflowService(this.knowledgeService, this.methodologyService, specialistDiscoveryService);

    // Initialize tool classes (but servicesInitialized = false will intercept them)
    // We need these initialized so they appear in the tool list, but they won't execute
    const sessionStorageConfig = this.layerService.getSessionStorageConfig();
    this.specialistSessionManager = new SpecialistSessionManager(
      this.layerService,
      sessionStorageConfig
    );
    this.specialistTools = new SpecialistTools(
      this.layerService,
      this.specialistSessionManager,
      this.knowledgeService
    );
    this.specialistDiscoveryService = new SpecialistDiscoveryService(this.layerService);
    this.specialistDiscoveryTools = new SpecialistDiscoveryTools(
      this.specialistDiscoveryService,
      this.specialistSessionManager,
      this.layerService
    );
    this.agentOnboardingTools = new AgentOnboardingTools(
      this.specialistDiscoveryService,
      this.layerService
    );
    this.specialistHandoffTools = new SpecialistHandoffTools(
      this.specialistSessionManager,
      this.specialistDiscoveryService,
      this.layerService
    );

    // Note: Services and tools are initialized, but servicesInitialized = false 
    // This prevents tools from being called until workspace is set
    console.error('✅ Embedded knowledge loaded. Workspace-specific services pending set_workspace_info.');
  }

  /**
   * Initialize with user-level configuration (company layers from ~/.bc-code-intel/config.yaml)
   */
  private async initializeWithConfiguration(configResult: ConfigurationLoadResult): Promise<void> {
    console.error(`🚀 Initializing with user-level configuration...`);

    this.configuration = configResult.config;    // Initialize services with the loaded configuration
    await this.initializeServices(configResult);

    this.servicesInitialized = true;

    const specialists = await this.layerService.getAllSpecialists();
    const topics = this.layerService.getAllTopicIds();
    const layers = this.layerService.getLayers();

    console.error(`✅ User configuration loaded: ${topics.length} topics from ${layers.length} layers, ${specialists.length} specialists`);
    layers.forEach(layer => {
      const topicCount = layer.getTopicIds().length;
      console.error(`   📚 ${layer.name}: ${topicCount} topics (priority ${layer.priority})`);
    });
  }

  /**
   * Set workspace root and MCP ecosystem info, initialize full services
   */
  private async setWorkspaceInfo(path: string, availableMcps: string[] = []): Promise<{ success: boolean; message: string; reloaded: boolean }> {
    try {
      // Normalize and validate path
      const { resolve } = await import('path');
      const { existsSync } = await import('fs');
      const resolvedPath = resolve(path);

      if (!existsSync(resolvedPath)) {
        return {
          success: false,
          message: `Path does not exist: ${resolvedPath}`,
          reloaded: false
        };
      }

      // Check if this is the same workspace
      if (this.workspaceRoot === resolvedPath) {
        // Update availableMcps even if workspace unchanged
        this.availableMcps = availableMcps;

        // Update layer service with new MCP availability (dynamic filtering)
        if (this.layerService) {
          this.layerService.setAvailableMcps(availableMcps);
        }

        return {
          success: true,
          message: `Workspace root already set to: ${resolvedPath}${availableMcps.length > 0 ? ` | Updated MCP ecosystem: ${availableMcps.length} servers` : ''}`,
          reloaded: false
        };
      }

      console.error(`📁 Setting workspace root to: ${resolvedPath}`);
      if (availableMcps.length > 0) {
        console.error(`🔧 MCP Ecosystem: ${availableMcps.join(', ')}`);
      }

      // Change working directory
      process.chdir(resolvedPath);
      this.workspaceRoot = resolvedPath;
      this.availableMcps = availableMcps;

      // Update layer service with available MCPs for conditional topic filtering
      if (this.layerService) {
        this.layerService.setAvailableMcps(availableMcps);
      }

      // Load configuration with workspace context (merges user + project configs)
      const configResult = await this.configLoader.loadConfiguration(resolvedPath);

      if (configResult.validation_errors.length > 0) {
        console.error('⚠️  Configuration validation errors:');
        configResult.validation_errors.forEach(error => {
          console.error(`   - ${error.field}: ${error.message}`);
        });
      }

      // Initialize full services with configuration
      await this.initializeServices(configResult);
      this.servicesInitialized = true;

      const specialists = await this.layerService.getAllSpecialists();
      const topics = this.layerService.getAllTopicIds();

      const mcpInfo = availableMcps.length > 0 ? ` | MCP Ecosystem: ${availableMcps.length} servers` : '';

      return {
        success: true,
        message: `Workspace configured successfully. Loaded ${topics.length} topics from ${this.layerService.getLayers().length} layers, ${specialists.length} specialists available.${mcpInfo}`,
        reloaded: true
      };

    } catch (error) {
      console.error('❌ Error setting workspace info:', error);
      return {
        success: false,
        message: `Failed to set workspace info: ${error instanceof Error ? error.message : String(error)}`,
        reloaded: false
      };
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
  try {
    // Ultra-early platform diagnostics (before any server initialization)
    console.error('=== Pre-Initialization Platform Check ===');
    console.error(`Node.js: ${process.version}`);
    console.error(`Platform: ${process.platform} (${process.arch})`);
    console.error(`PWD: ${process.cwd()}`);
    console.error(`Script: ${process.argv[1]}`);

    // Check for workspace root argument (e.g., "." passed from MCP client)
    const workspaceArg = process.argv[2];
    if (workspaceArg) {
      console.error(`Workspace argument provided: "${workspaceArg}"`);
      const { resolve } = await import('path');
      const resolvedPath = resolve(workspaceArg);
      console.error(`Resolved to: ${resolvedPath}`);

      // Override process.cwd() for config/layer discovery
      process.chdir(resolvedPath);
      console.error(`Changed working directory to: ${process.cwd()}`);
    }

    const server = new BCCodeIntelligenceServer();
    await server.run();
  } catch (error) {
    console.error('💥 Fatal error in main():', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : 'No stack trace'
    });
    process.exit(1);
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.error('BC Code Intelligence MCP Server shutting down (SIGINT)...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('BC Code Intelligence MCP Server shutting down (SIGTERM)...');
  process.exit(0);
});

// Catch unhandled promise rejections (common cause of silent crashes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Promise Rejection:');
  console.error('Reason:', reason);
  console.error('Promise:', promise);
  if (reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
  process.exit(1);
});

// Catch uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:');
  console.error('Error:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

// Run server if this is the main module
// Check both direct execution (index.js) and binary execution (bc-code-intelligence-mcp, bc-code-intel-server)
if (process.argv[1]?.endsWith('index.js') ||
    process.argv[1]?.endsWith('bc-code-intelligence-mcp') ||
    process.argv[1]?.endsWith('bc-code-intel-server')) {
  main().catch((error) => {
    console.error('Fatal error in BC Code Intelligence MCP Server:', error);
    process.exit(1);
  });
}

export { BCCodeIntelligenceServer };
