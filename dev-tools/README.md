# Development Tools & Manual Test Harnesses

This directory contains manual test scripts and development utilities that are used for testing the BC Code Intelligence MCP Server during development. These are NOT part of the automated test suite and are excluded from the distribution package.

## Purpose

These scripts provide interactive testing and debugging capabilities for developers working on the MCP server. They allow manual verification of complex features like configuration loading, layer initialization, and Git authentication.

## Test Scripts

### test-config-loader.ts

**Purpose**: Manual testing of the configuration system

**What it tests**:
- Configuration loading from multiple sources (user, project, environment)
- Configuration validation and quality scoring
- Layer priority ordering
- Configuration diagnostics

**How to run**:
```bash
npm run dev -- --test-config
```

**Environment variables**:
- `BCKB_COMPANY_KNOWLEDGE_URL` - Optional Git repository URL for company layer testing
- `GITHUB_TOKEN` - Optional GitHub token for authenticated Git access

---

### test-enhanced-layers.ts

**Purpose**: Manual testing of the multi-content layer service

**What it tests**:
- Configuration-based layer initialization
- Topic resolution across layers
- Layer statistics and performance metrics
- Fuzzy search functionality

**How to run**:
```bash
npm run dev -- --test-enhanced-layers
```

**Notes**:
- Tests use the configuration loaded from the config loader
- Can add test Git layers for demonstration purposes
- Shows detailed initialization results for each layer

---

### test-git-layer.ts

**Purpose**: Manual testing of Git repository knowledge layers

**What it tests**:
- Git repository cloning and caching
- Authentication methods (token, SSH, Azure CLI)
- Topic discovery in Git repositories
- Layer source information

**How to run**:
```bash
npm run dev -- --test-git
```

**Notes**:
- Uses a public test repository by default (microsoft/AL-Go)
- Can be modified to test private repositories with authentication
- Creates a `.bckb-cache-test` directory for Git clones

---

### test-mcp-server.ts

**Purpose**: Manual testing of enhanced MCP server features

**What it tests**:
- Configuration status tool
- Layer information tool
- Topic resolution across layers
- Layered search functionality
- Configuration reload

**How to run**:
```bash
npm run dev -- --test-mcp-server
```

**Notes**:
- Simulates MCP tool calls without starting the full MCP server
- Useful for testing new MCP tools during development
- Tests the Phase 2B enhanced features

---

## Key Differences from Automated Tests

| Aspect | Automated Tests (`/tests`) | Manual Test Harnesses (`/dev-tools`) |
|--------|---------------------------|-------------------------------------|
| **Purpose** | CI/CD quality gates | Developer debugging & exploration |
| **Execution** | Automated via `npm test` | Manual via `npm run dev --` |
| **Scope** | Unit and integration tests | End-to-end feature testing |
| **Environment** | Isolated test environment | Live development environment |
| **Output** | Pass/fail results | Detailed diagnostic output |
| **Distribution** | Included in source | Excluded from npm package |

## Adding New Test Harnesses

When adding new manual test scripts to this directory:

1. **Naming convention**: Use `test-*.ts` pattern
2. **Export function**: Export the main test function for potential reuse
3. **CLI flag**: Check for a specific `--test-*` flag in `process.argv`
4. **Documentation**: Add entry to this README with purpose and usage
5. **Import paths**: Use relative imports from `../src/` for source code

Example structure:
```typescript
/**
 * Test [Feature Name]
 * Run with: npm run dev -- --test-feature
 */

import { SomeService } from '../src/services/some-service.js';

async function testFeature() {
  console.log('🔧 Testing Feature...');
  // Test implementation
}

export { testFeature };

if (process.argv.includes('--test-feature')) {
  testFeature().catch(console.error);
}
```

## Why These Aren't in /tests

These scripts differ from the automated test suite in several ways:

- They require manual inspection of output
- They may have external dependencies (Git repositories, network access)
- They test against live configuration rather than mock data
- They're primarily for developer exploration and debugging
- They produce verbose console output for human analysis

The automated test suite in `/tests` focuses on:
- Deterministic pass/fail results
- Fast execution with mocked dependencies
- Coverage metrics and CI/CD integration
- Regression detection

## Distribution

These development tools are excluded from the npm package via `.npmignore`. They are only available in the source repository for contributors and maintainers working on the MCP server itself.
