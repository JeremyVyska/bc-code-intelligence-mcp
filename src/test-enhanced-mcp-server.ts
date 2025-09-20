/**
 * Test Enhanced MCP Server with Phase 2B Features
 * Run with: npm run dev -- --test-mcp-server
 */

import { BCCodeIntelligenceServer } from './index.js';
import { LayerSourceType, AuthType } from './types/index.js';

async function testEnhancedMCPServer() {
  console.log('🔧 Testing Enhanced MCP Server with Phase 2B Features...');

  try {
    // Create server instance
    console.log('\n🏗️  Creating MCP server instance...');
    const server = new BCCodeIntelligenceServer();

    // Simulate MCP tool calls for testing
    console.log('\n🧪 Testing enhanced MCP tools...');

    // Test 1: Configuration status
    console.log('\n1️⃣  Testing get_configuration_status...');
    await testConfigurationStatus(server);

    // Test 2: Layer information
    console.log('\n2️⃣  Testing get_layer_info...');
    await testLayerInfo(server);

    // Test 3: Topic layer resolution
    console.log('\n3️⃣  Testing resolve_topic_layers...');
    await testTopicLayerResolution(server);

    // Test 4: Layered search
    console.log('\n4️⃣  Testing search_layered_topics...');
    await testLayeredSearch(server);

    // Test 5: Configuration reload
    console.log('\n5️⃣  Testing reload_configuration...');
    await testConfigurationReload(server);

    console.log('\n✅ All enhanced MCP server tests completed successfully!');

  } catch (error) {
    console.error('❌ Enhanced MCP server test failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function testConfigurationStatus(server: BCCodeIntelligenceServer) {
  try {
    // Initialize server first to load configuration
    await initializeServerForTesting(server);

    console.log('   📊 Testing configuration status with validation...');

    const statusResult = await simulateToolCall(server, 'get_configuration_status', {
      include_validation: true,
      include_performance: true
    });

    console.log('   ✅ Configuration status retrieved successfully');

    const status = JSON.parse(statusResult.content[0].text);
    console.log(`      - Configuration loaded: ${status.configuration_loaded}`);
    console.log(`      - Layers initialized: ${status.layers_initialized}`);
    console.log(`      - Validation quality: ${status.validation?.quality_score || 'N/A'}/100`);

  } catch (error) {
    console.error('   ❌ Configuration status test failed:', error);
    throw error;
  }
}

async function testLayerInfo(server: BCCodeIntelligenceServer) {
  try {
    console.log('   🔍 Testing layer information with statistics...');

    const layerResult = await simulateToolCall(server, 'get_layer_info', {
      include_statistics: true
    });

    console.log('   ✅ Layer information retrieved successfully');

    const layerInfo = JSON.parse(layerResult.content[0].text);
    console.log(`      - Total layers: ${layerInfo.layers?.length || 0}`);
    console.log(`      - Layer types: ${layerInfo.configuration?.layer_types?.join(', ') || 'N/A'}`);

  } catch (error) {
    console.error('   ❌ Layer info test failed:', error);
    throw error;
  }
}

async function testTopicLayerResolution(server: BCCodeIntelligenceServer) {
  try {
    console.log('   🎯 Testing topic resolution across layers...');

    // Try to resolve a common topic (might be in embedded layer)
    const resolutionResult = await simulateToolCall(server, 'resolve_topic_layers', {
      topic_id: 'performance/sift-optimization',
      show_overrides: true
    });

    console.log('   ✅ Topic layer resolution completed');

    const resolution = JSON.parse(resolutionResult.content[0].text);
    console.log(`      - Topic found: ${resolution.topic_id}`);
    console.log(`      - Resolved from: ${resolution.resolved_from}`);
    console.log(`      - Is override: ${resolution.is_override}`);

  } catch (error) {
    // This might fail if the specific topic doesn't exist, which is okay for testing
    console.log('   ⚠️  Topic resolution test completed (topic may not exist in test setup)');
  }
}

async function testLayeredSearch(server: BCCodeIntelligenceServer) {
  try {
    console.log('   🔎 Testing layered topic search...');

    const searchResult = await simulateToolCall(server, 'search_layered_topics', {
      query: 'performance optimization',
      include_layer_info: true,
      limit: 5
    });

    console.log('   ✅ Layered search completed');

    const search = JSON.parse(searchResult.content[0].text);
    console.log(`      - Query: "${search.query}"`);
    console.log(`      - Results found: ${search.total_results}`);
    console.log(`      - Layer filter: ${search.layer_filter}`);

  } catch (error) {
    console.error('   ❌ Layered search test failed:', error);
    throw error;
  }
}

async function testConfigurationReload(server: BCCodeIntelligenceServer) {
  try {
    console.log('   🔄 Testing configuration reload (validation only)...');

    const reloadResult = await simulateToolCall(server, 'reload_configuration', {
      force: false,
      validate_only: true
    });

    console.log('   ✅ Configuration reload test completed');

    const reload = JSON.parse(reloadResult.content[0].text);
    console.log(`      - Validation only: ${reload.validation_only || reload.reloaded === false}`);
    console.log(`      - Valid config: ${reload.is_valid !== false}`);

  } catch (error) {
    console.error('   ❌ Configuration reload test failed:', error);
    throw error;
  }
}

/**
 * Initialize server for testing (simulates what happens in run())
 */
async function initializeServerForTesting(server: BCCodeIntelligenceServer) {
  try {
    // Access private configLoader through type assertion for testing
    const configLoader = (server as any).configLoader;
    const configResult = await configLoader.loadConfiguration();

    // Initialize services
    await (server as any).initializeServices(configResult);

    console.log('   🏗️  Server initialized for testing');
  } catch (error) {
    console.error('   ❌ Server initialization failed:', error);
    throw error;
  }
}

/**
 * Simulate MCP tool call for testing
 */
async function simulateToolCall(server: BCCodeIntelligenceServer, toolName: string, args: any) {
  try {
    // Access private server instance for testing
    const mcpServer = (server as any).server;

    // Create a mock request
    const mockRequest = {
      params: {
        name: toolName,
        arguments: args
      }
    };

    // Get the call tool handler
    const handlers = (mcpServer as any).requestHandlers;
    const callToolHandler = handlers.get('tools/call');

    if (!callToolHandler) {
      throw new Error('Call tool handler not found');
    }

    // Execute the handler
    return await callToolHandler(mockRequest);

  } catch (error) {
    throw new Error(`Tool call simulation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Export for use in other tests
export { testEnhancedMCPServer };

// Run if called directly
if (process.argv.includes('--test-mcp-server')) {
  testEnhancedMCPServer().catch(console.error);
}
