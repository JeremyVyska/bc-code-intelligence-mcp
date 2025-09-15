#!/usr/bin/env node

/**
 * Alpha publishing script for BCKB MCP Server
 *
 * Prepares and publishes alpha version to NPM
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const packagePath = join(process.cwd(), 'package.json');

function runCommand(command, description) {
  console.log(`🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function updateVersion() {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
  const currentVersion = pkg.version;

  // Increment alpha version
  const versionParts = currentVersion.split('-');
  if (versionParts.length > 1 && versionParts[1].startsWith('alpha')) {
    const alphaParts = versionParts[1].split('.');
    const alphaNumber = parseInt(alphaParts[1]) + 1;
    pkg.version = `${versionParts[0]}-alpha.${alphaNumber}`;
  } else {
    // First alpha version
    const baseParts = currentVersion.split('.');
    const patch = parseInt(baseParts[2]) + 1;
    pkg.version = `${baseParts[0]}.${baseParts[1]}.${patch}-alpha.1`;
  }

  writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
  console.log(`📦 Version updated: ${currentVersion} → ${pkg.version}`);

  return pkg.version;
}

async function publishAlpha() {
  console.log('🚀 Publishing BCKB MCP Server Alpha Version\n');

  // Pre-flight checks
  runCommand('npm audit --audit-level high', 'Security audit');
  runCommand('npm run lint', 'Linting');
  runCommand('npm test', 'Running tests');

  // Build
  runCommand('npm run build', 'Building TypeScript');

  // Update version
  const newVersion = updateVersion();

  // Publish to NPM with alpha tag
  runCommand('npm publish --tag alpha --access public', `Publishing v${newVersion} to NPM`);

  console.log('\n🎉 Alpha version published successfully!');
  console.log('\n📋 Share with alpha testers:');
  console.log(`   npm install -g @bckb/mcp-server@alpha`);
  console.log(`   npx @bckb/mcp-server@alpha`);
  console.log('\n🔗 Claude Desktop config:');
  console.log('   "command": "npx"');
  console.log('   "args": ["@bckb/mcp-server@alpha"]');

  console.log('\n✅ Ready for alpha testing!');
}

publishAlpha().catch(console.error);