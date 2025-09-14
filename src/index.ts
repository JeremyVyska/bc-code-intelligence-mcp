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
import { domainWorkflows } from './workflows/domain-workflows.js';
import {
  TopicSearchParams,
  CodeAnalysisParams,
  OptimizationWorkflowParams,
  BCKBConfig
} from './types/bc-knowledge.js';

/**
 * BCKB MCP Server
 * 
 * Business Central Knowledge Base Model Context Protocol Server
 * Surfaces atomic BC knowledge topics for intelligent AI consumption
 * via GitHub Copilot, Claude, and other LLM tools.
 */
class BCKBServer {
  private server: Server;
  private knowledgeService: KnowledgeService;
  private codeAnalysisService: CodeAnalysisService;
  private methodologyService: MethodologyService;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'bckb-server',
        version: '1.0.0',
      }
    );

    // Initialize BC knowledge services with embedded knowledge base
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    
    const config: BCKBConfig = {
      knowledge_base_path: process.env['BCKB_KB_PATH'] || join(__dirname, '../knowledge-base'),
      indexes_path: process.env['BCKB_INDEXES_PATH'] || join(__dirname, '../knowledge-base/indexes'),
      methodologies_path: process.env['BCKB_METHODOLOGIES_PATH'] || join(__dirname, '../methodologies'),
      cache_size: 1000,
      max_search_results: 20,
      default_bc_version: 'BC22',
      enable_fuzzy_search: true,
      search_threshold: 0.6
    };

    this.knowledgeService = new KnowledgeService(config);
    this.codeAnalysisService = new CodeAnalysisService(this.knowledgeService);
    this.methodologyService = new MethodologyService(config.methodologies_path);

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
            const result = this.methodologyService.loadMethodology({ user_request, domain });

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
            const result = this.methodologyService.getPhaseGuidance({ phase_name, step });

            if ('error' in result) {
              throw new McpError(ErrorCode.InvalidRequest, result.error);
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
            const result = this.methodologyService.validateCompleteness({ phase, completed_items });

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
      console.error('BCKB MCP Server starting...');
      console.error('Knowledge base path:', this.knowledgeService['config'].knowledge_base_path);
      console.error('Indexes path:', this.knowledgeService['config'].indexes_path);
      
      // Initialize methodology service
      console.error('Initializing methodology service...');
      console.error('Methodology path:', this.methodologyService['methodologyPath']);
      
      // Initialize knowledge services
      console.error('Initializing knowledge services...');
      await this.knowledgeService.initialize();
      console.error('Knowledge services initialized successfully');

      // Start MCP server
      console.error('Starting MCP transport...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error('BCKB MCP Server started successfully');
    } catch (error) {
      console.error('Fatal error during server startup:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      process.exit(1);
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