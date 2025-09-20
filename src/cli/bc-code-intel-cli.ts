#!/usr/bin/env node

/**
 * BC Code Intelligence CLI - Command Line Interface for BC Code Intelligence MCP Server
 *
 * Developer-friendly CLI for interacting with BC Code Intelligence servers,
 * testing configurations, and managing knowledge content.
 */

import { Command } from 'commander';
import { BCCodeIntelClient, BCCodeIntelClientDefaults } from '../sdk/bc-code-intel-client.js';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const program = new Command();

program
  .name('bc-code-intel')
  .description('BC Code Intelligence MCP Server CLI - Business Central Code Intelligence tools')
  .version('2.0.0');

// Global options
program
  .option('--server <path>', 'Path to BC Code Intelligence server executable', 'node dist/index.js')
  .option('--debug', 'Enable debug logging')
  .option('--timeout <ms>', 'Request timeout in milliseconds', '10000');

// Search command
program
  .command('search <query>')
  .description('Search for BC knowledge topics')
  .option('-d, --domain <domain>', 'Filter by domain')
  .option('-t, --tags <tags>', 'Filter by tags (comma-separated)')
  .option('--difficulty <level>', 'Filter by difficulty level')
  .option('-l, --limit <number>', 'Maximum number of results', '10')
  .option('--json', 'Output as JSON')
  .action(async (query, options) => {
    const client = createClient(options);

    try {
      await client.connect();

      const searchOptions = {
        domain: options.domain,
        tags: options.tags?.split(','),
        difficulty: options.difficulty,
        limit: parseInt(options.limit)
      };

      const results = await client.searchTopics(query, searchOptions);

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`\n🔍 Found ${results.length} topics for "${query}":\n`);

        results.forEach((topic, index) => {
          console.log(`${index + 1}. ${topic.title}`);
          console.log(`   ID: ${topic.id}`);
          console.log(`   Domain: ${topic.domain} | Difficulty: ${topic.difficulty}`);
          console.log(`   Tags: ${topic.tags.join(', ')}`);
          if (topic.estimated_time) {
            console.log(`   Time: ${topic.estimated_time}`);
          }
          console.log(`   Relevance: ${(topic.relevance_score * 100).toFixed(1)}%`);
          console.log();
        });
      }

      await client.disconnect();

    } catch (error) {
      console.error('❌ Search failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Get topic command
program
  .command('get <topic-id>')
  .description('Get detailed information about a specific topic')
  .option('--no-samples', 'Exclude code samples')
  .option('--json', 'Output as JSON')
  .action(async (topicId, options) => {
    const client = createClient(options);

    try {
      await client.connect();

      const topic = await client.getTopic(topicId, !options.noSamples);

      if (!topic) {
        console.error(`❌ Topic not found: ${topicId}`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(topic, null, 2));
      } else {
        console.log(`\n📄 ${topic.title}`);
        console.log('='.repeat(topic.title.length + 4));
        console.log(`ID: ${topic.id}`);
        console.log(`Domain: ${topic.domain}`);
        console.log(`Difficulty: ${topic.difficulty}`);
        console.log(`BC Versions: ${topic.bc_versions}`);

        if (topic.tags.length > 0) {
          console.log(`Tags: ${topic.tags.join(', ')}`);
        }

        if (topic.prerequisites.length > 0) {
          console.log(`Prerequisites: ${topic.prerequisites.join(', ')}`);
        }

        if (topic.estimated_time) {
          console.log(`Estimated Time: ${topic.estimated_time}`);
        }

        console.log(`\nContent (${topic.word_count} words):`);
        console.log('-'.repeat(40));
        console.log(topic.content);

        if (topic.samples) {
          console.log('\nCode Samples:');
          console.log('-'.repeat(40));
          console.log(topic.samples.code);
        }

        if (topic.layer_info) {
          console.log('\nLayer Information:');
          console.log('-'.repeat(40));
          console.log(`Source Layer: ${topic.layer_info.source_layer}`);
          console.log(`Is Override: ${topic.layer_info.is_override}`);
          if (topic.layer_info.overridden_count > 0) {
            console.log(`Overridden Layers: ${topic.layer_info.overridden_count}`);
          }
        }
      }

      await client.disconnect();

    } catch (error) {
      console.error('❌ Failed to get topic:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Analyze code command
program
  .command('analyze')
  .description('Analyze AL code for patterns and recommendations')
  .option('-f, --file <path>', 'Path to AL code file')
  .option('-c, --code <code>', 'AL code string to analyze')
  .option('--type <type>', 'Analysis type (performance|validation|architecture|general)', 'general')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const client = createClient(options);

    try {
      let codeToAnalyze: string;

      if (options.file) {
        codeToAnalyze = await readFile(options.file, 'utf8');
      } else if (options.code) {
        codeToAnalyze = options.code;
      } else {
        console.error('❌ Please provide code via --file or --code option');
        process.exit(1);
      }

      await client.connect();

      const analysis = await client.analyzeCode({
        code_snippet: codeToAnalyze,
        analysis_type: options.type,
        suggest_topics: true
      });

      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
      } else {
        console.log('\n🔍 Code Analysis Results:\n');

        if (analysis.issues.length > 0) {
          console.log('Issues Found:');
          analysis.issues.forEach((issue: any, index: number) => {
            const severityIcon = {
              'low': '💡',
              'medium': '⚠️',
              'high': '🚨',
              'critical': '💥'
            }[issue.severity] || '❓';

            console.log(`${index + 1}. ${severityIcon} ${issue.type.toUpperCase()}`);
            console.log(`   ${issue.description}`);
            console.log(`   Suggestion: ${issue.suggestion}`);
            if (issue.related_topics.length > 0) {
              console.log(`   Related Topics: ${issue.related_topics.join(', ')}`);
            }
            console.log();
          });
        }

        if (analysis.patterns_detected.length > 0) {
          console.log('Patterns Detected:');
          analysis.patterns_detected.forEach((pattern: string) => {
            console.log(`• ${pattern}`);
          });
          console.log();
        }

        if (analysis.optimization_opportunities.length > 0) {
          console.log('Optimization Opportunities:');
          analysis.optimization_opportunities.forEach((opp: any, index: number) => {
            console.log(`${index + 1}. ${opp.description} (Impact: ${opp.impact}, Difficulty: ${opp.difficulty})`);
            if (opp.related_topics.length > 0) {
              console.log(`   Related Topics: ${opp.related_topics.join(', ')}`);
            }
          });
          console.log();
        }

        if (analysis.suggested_topics.length > 0) {
          console.log('Suggested Learning Topics:');
          analysis.suggested_topics.forEach((topic: any, index: number) => {
            console.log(`${index + 1}. ${topic.title} (${topic.difficulty})`);
          });
        }
      }

      await client.disconnect();

    } catch (error) {
      console.error('❌ Code analysis failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Check BCKB server status and health')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const client = createClient(options);

    try {
      await client.connect();

      const [status, health, layerInfo] = await Promise.all([
        client.getSystemStatus(),
        client.healthCheck(),
        client.getLayerInfo()
      ]);

      if (options.json) {
        console.log(JSON.stringify({ status, health, layers: layerInfo }, null, 2));
      } else {
        const healthIcon = status.overall_health === 'healthy' ? '✅' :
                          status.overall_health === 'degraded' ? '⚠️' : '❌';

        console.log(`\n${healthIcon} BCKB Server Status: ${status.overall_health.toUpperCase()}`);
        console.log('='.repeat(40));
        console.log(`Configuration: ${status.configuration_loaded ? '✅ Loaded' : '❌ Not loaded'}`);
        console.log(`Active Layers: ${status.layers_active}`);
        console.log(`Total Topics: ${status.total_topics.toLocaleString()}`);
        console.log(`Cache Hit Rate: ${status.cache_hit_rate.toFixed(1)}%`);
        console.log(`Uptime: ${Math.floor(status.uptime_seconds / 3600)}h ${Math.floor((status.uptime_seconds % 3600) / 60)}m`);

        console.log(`\n🏥 Health Check: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        console.log(`Response Time: ${health.latency_ms}ms`);

        if (layerInfo.layers && layerInfo.layers.length > 0) {
          console.log('\n📚 Layer Information:');
          layerInfo.layers.forEach((layer: any, index: number) => {
            const statusIcon = layer.enabled ? '✅' : '❌';
            console.log(`${index + 1}. ${statusIcon} ${layer.name} (Priority: ${layer.priority})`);
            if (layer.statistics) {
              console.log(`   Topics: ${layer.statistics.topicCount}, Load Time: ${layer.statistics.loadTimeMs || 0}ms`);
            }
          });
        }
      }

      await client.disconnect();

    } catch (error) {
      console.error('❌ Status check failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Manage BCKB server configuration')
  .option('--validate', 'Validate current configuration')
  .option('--reload', 'Reload configuration')
  .option('--export <path>', 'Export configuration to file')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const client = createClient(options);

    try {
      await client.connect();

      if (options.validate) {
        const result = await client.callTool('reload_configuration', {
          validate_only: true,
          force: false
        });
        const validation = JSON.parse(result.content[0].text);

        if (options.json) {
          console.log(JSON.stringify(validation, null, 2));
        } else {
          const icon = validation.is_valid ? '✅' : '❌';
          console.log(`\n${icon} Configuration Validation: ${validation.is_valid ? 'VALID' : 'INVALID'}`);
          console.log(`Quality Score: ${validation.quality_score}/100`);

          if (validation.errors && validation.errors.length > 0) {
            console.log('\nErrors:');
            validation.errors.forEach((error: any) => {
              console.log(`❌ ${error.field}: ${error.message}`);
            });
          }

          if (validation.warnings && validation.warnings.length > 0) {
            console.log('\nWarnings:');
            validation.warnings.forEach((warning: any) => {
              console.log(`⚠️  ${warning.type}: ${warning.message}`);
            });
          }
        }
      }

      if (options.reload) {
        const result = await client.reloadConfiguration(true);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          if (result.reloaded) {
            console.log('✅ Configuration reloaded successfully');
            console.log(`Layers reinitialized: ${result.layers_reinitialized}`);
          } else {
            console.log('ℹ️  Configuration unchanged, no reload needed');
          }
        }
      }

      if (options.export) {
        const analytics = await client.getSystemAnalytics();
        await writeFile(options.export, JSON.stringify(analytics, null, 2));
        console.log(`✅ Configuration exported to: ${options.export}`);
      }

      await client.disconnect();

    } catch (error) {
      console.error('❌ Configuration operation failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Interactive mode command
program
  .command('interactive')
  .alias('i')
  .description('Start interactive BCKB session')
  .action(async (options) => {
    const client = createClient(options);

    try {
      await client.connect();
      console.log('🚀 BCKB Interactive Session Started');
      console.log('Type "help" for available commands or "exit" to quit\n');

      // Import readline dynamically for interactive mode
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'bckb> '
      });

      rl.prompt();

      rl.on('line', async (input) => {
        const [command, ...args] = input.trim().split(' ');

        try {
          switch (command.toLowerCase()) {
            case 'help':
              console.log('Available commands:');
              console.log('  search <query>    - Search for topics');
              console.log('  get <topic-id>    - Get topic details');
              console.log('  status            - Show server status');
              console.log('  layers            - Show layer information');
              console.log('  analytics         - Show system analytics');
              console.log('  help              - Show this help');
              console.log('  exit              - Exit interactive mode');
              break;

            case 'search':
              if (args.length === 0) {
                console.log('Usage: search <query>');
                break;
              }
              const results = await client.searchTopics(args.join(' '), { limit: 5 });
              console.log(`Found ${results.length} topics:`);
              results.forEach((topic, i) => {
                console.log(`${i + 1}. ${topic.title} (${topic.id})`);
              });
              break;

            case 'get':
              if (args.length === 0) {
                console.log('Usage: get <topic-id>');
                break;
              }
              const topic = await client.getTopic(args[0]);
              if (topic) {
                console.log(`${topic.title}\n${topic.content.substring(0, 200)}...`);
              } else {
                console.log('Topic not found');
              }
              break;

            case 'status':
              const status = await client.getSystemStatus();
              console.log(`Status: ${status.overall_health}`);
              console.log(`Layers: ${status.layers_active}, Topics: ${status.total_topics}`);
              break;

            case 'layers':
              const layerInfo = await client.getLayerInfo();
              layerInfo.layers.forEach((layer: any) => {
                console.log(`${layer.name}: ${layer.enabled ? 'enabled' : 'disabled'}`);
              });
              break;

            case 'analytics':
              const analytics = await client.getSystemAnalytics();
              console.log(`System Overview:`);
              console.log(`- Server Version: ${analytics.system_overview.server_version}`);
              console.log(`- Active Layers: ${analytics.system_overview.layers_active}`);
              console.log(`- Total Topics: ${analytics.system_overview.total_topics}`);
              break;

            case 'exit':
              console.log('👋 Goodbye!');
              rl.close();
              await client.disconnect();
              process.exit(0);
              break;

            case '':
              break; // Empty line, do nothing

            default:
              console.log(`Unknown command: ${command}. Type "help" for available commands.`);
              break;
          }
        } catch (error) {
          console.error('❌ Command failed:', error instanceof Error ? error.message : String(error));
        }

        rl.prompt();
      });

      rl.on('close', async () => {
        await client.disconnect();
        process.exit(0);
      });

    } catch (error) {
      console.error('❌ Interactive session failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Helper function to create client with global options
function createClient(options: any): BCCodeIntelClient {
  const globalOpts = program.opts();

  const config = BCCodeIntelClientDefaults.local(globalOpts.server);
  config.debug_logging = globalOpts.debug || options.debug || false;
  config.request_timeout_ms = parseInt(globalOpts.timeout);

  return new BCCodeIntelClient(config);
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

// Parse command line arguments
program.parse();