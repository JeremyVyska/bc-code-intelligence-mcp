#!/usr/bin/env node
/**
 * Clean build artifacts and caches
 * Cross-platform alternative to shell commands
 */

import { rmSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const pathsToClean = [
  'dist',
  'coverage',
  '.bckb-cache',
  'tsconfig.tsbuildinfo'
];

console.log('🧹 Cleaning build artifacts...');

for (const path of pathsToClean) {
  const fullPath = resolve(root, path);
  try {
    rmSync(fullPath, { recursive: true, force: true });
    console.log(`  ✅ Removed: ${path}`);
  } catch (err) {
    // Ignore if path doesn't exist
    if (err.code !== 'ENOENT') {
      console.log(`  ⚠️  Could not remove: ${path}`);
    }
  }
}

console.log('✨ Clean complete!');
