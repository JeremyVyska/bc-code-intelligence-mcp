#!/usr/bin/env node

/**
 * Post-install setup script for BCKB MCP Server
 *
 * Runs after npm install to:
 * - Create necessary directories
 * - Set up default configuration
 * - Display setup instructions
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');

async function postInstall() {
  console.log('🚀 Setting up BCKB MCP Server...\n');

  try {
    // Create config directory
    const configDir = join(packageRoot, 'config');
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
      console.log('✅ Created config directory');
    }

    // Create default configuration if it doesn't exist
    const configPath = join(configDir, 'server-config.json');
    if (!existsSync(configPath)) {
      const defaultConfig = {
        server: {
          name: "BCKB MCP Server",
          version: "0.1.0-alpha.1",
          port: 3000,
          host: "localhost"
        },
        logging: {
          level: "info",
          debug_layers: false
        },
        cache: {
          enabled: true,
          ttl_seconds: 600
        },
        layers: [
          {
            name: "base",
            type: "embedded",
            path: "./knowledge-base",
            priority: 100,
            enabled: true
          }
        ]
      };

      writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log('✅ Created default configuration');
    }

    // Display setup instructions
    console.log('\n📋 BCKB MCP Server installed successfully!\n');
    console.log('🔧 Quick Start:');
    console.log('   1. Test the server: npx @bckb/mcp-server');
    console.log('   2. Use the CLI: npx bckb status');
    console.log('   3. Search knowledge: npx bckb search "posting routines"');
    console.log('\n🔗 Integration Setup:');
    console.log('   • Claude Desktop: Add to claude_desktop_config.json');
    console.log('   • VS Code: Install the BCKB extension');
    console.log('   • GitHub Copilot: Configure @bckb participant');
    console.log('\n📚 Documentation: https://github.com/bc-knowledge-base/bckb-mcp-server');
    console.log('🐛 Issues: https://github.com/bc-knowledge-base/bckb-mcp-server/issues');
    console.log('\n🎉 Ready to explore Business Central knowledge!\n');

  } catch (error) {
    console.error('❌ Post-install setup failed:', error);
    console.log('You can still use the server, but you may need to create configuration manually.');
  }
}

// Run post-install if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  postInstall();
}

export { postInstall };