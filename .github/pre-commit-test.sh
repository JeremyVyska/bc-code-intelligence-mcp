#!/bin/bash
# Pre-commit CI simulation script
# Run this to catch CI failures before pushing

set -e

echo "🧹 Cleaning build artifacts (simulating CI clean environment)..."
rm -rf dist/ node_modules/.cache .bckb-cache/ coverage/ *.tsbuildinfo

echo ""
echo "📦 Installing dependencies (clean install)..."
npm ci --ignore-scripts

echo ""
echo "🔨 Building project..."
npm run build

echo ""
echo "✅ Running full test suite..."
npm run test:all

echo ""
echo "🎉 All checks passed! Safe to commit and push."
