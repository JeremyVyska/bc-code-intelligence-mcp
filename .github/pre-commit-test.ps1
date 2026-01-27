# Pre-commit CI simulation script (PowerShell version)
# Run this to catch CI failures before pushing

$ErrorActionPreference = "Stop"

Write-Host "🧹 Cleaning build artifacts (simulating CI clean environment)..." -ForegroundColor Cyan
Remove-Item -Path dist, node_modules\.cache, .bckb-cache, coverage, *.tsbuildinfo -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "📦 Installing dependencies (clean install)..." -ForegroundColor Cyan
npm ci --ignore-scripts

Write-Host ""
Write-Host "🔨 Building project..." -ForegroundColor Cyan
npm run build

Write-Host ""
Write-Host "✅ Running full test suite..." -ForegroundColor Cyan
npm run test:all

Write-Host ""
Write-Host "🎉 All checks passed! Safe to commit and push." -ForegroundColor Green
