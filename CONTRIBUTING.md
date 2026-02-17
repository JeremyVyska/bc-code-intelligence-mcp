# Contributing to Business Central Knowledge Base MCP Server

## Overview

This repository contains the MCP server implementation providing intelligent access to BC knowledge through a layered architecture.

## Development Standards

### Code Quality

- **TypeScript**: Strict mode enabled, no any types
- **Testing**: Comprehensive unit tests for all layer resolution logic
- **Performance**: Sub-100ms response times for knowledge queries
- **MCP Compliance**: Full Model Context Protocol specification adherence

### Architecture Principles

- **Layer Integrity**: Maintain clean layer resolution hierarchy
- **Service Separation**: Keep services focused and modular
- **Interface Stability**: Preserve MCP tool signatures for backward compatibility
- **Extensibility**: Design for future layer source types (git, HTTP, etc.)

## Development Setup

```bash
git clone <repository-url>
cd bc-knowledgebase-mcp
git submodule update --init --recursive  # Initialize knowledge submodule
npm install
npm run build
npm run test
```

## How to Manually Test Drive Changes

For BC developers new to MCP testing: here's how to test your changes in real use without publishing.

### Step 1: Build Your Local Changes

```bash
npm run build
```

This compiles your TypeScript changes into the `dist/` folder that the MCP server uses.

### Step 2: Set Up Local MCP in VS Code

1. Open your VS Code settings and locate your `mcp.json` file (you can use the "MCP: Open User Configuration" command in Command Palette)

2. Add a new MCP server entry for your local version:

```json
{
  "mcpServers": {
    "bc-code-intel-production": {
      "command": "npx",
      "args": ["-y", "bc-code-intelligence-mcp"]
    },
    "bc-code-intel-local": {
      "command": "node",
      "args": ["c:\\your\\dev\\path\\bc-code-intelligence-mcp\\dist\\index.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

**Important**: Replace the path in `bc-code-intel-local` with your actual local repository path.

#### Optional: Enable Debug Logging

For verbose logging and diagnostic tools while testing, create a config file at `%USERPROFILE%\.bc-code-intel\config.yaml` (or `.json`):

```yaml
developer:
  debug_layers: true # Shows layer resolution details
  log_level: debug # Verbose logging (options: error, warn, info, debug)
  enable_diagnostic_tools: true # Adds 4 diagnostic MCP tools for git layer auth
  validate_on_startup: true # Validates knowledge structure on startup
```

Or in JSON format:

```json
{
  "developer": {
    "debug_layers": true,
    "log_level": "debug",
    "enable_diagnostic_tools": true,
    "validate_on_startup": true
  }
}
```

These settings are especially helpful when:

- Testing layer resolution changes
- Debugging git layer authentication issues
- Investigating why knowledge isn't loading correctly
- Contributing to the layer system itself

**Note**: Don't forget to restart the MCP server after creating/modifying the config file!

### Step 3: Switch Between Versions

In VS Code's MCP extension:

- **Disable** `bc-code-intel-production` (right-click → Disable)
- **Enable** `bc-code-intel-local` (right-click → Enable)

Now Copilot will use your local development version!

### Step 4: Test Your Changes

1. Open a BC AL project in VS Code
2. Ask Copilot to use BC knowledge features (e.g., "Find specialists for error handling")
3. Verify your changes work as expected
4. Check the MCP server logs in VS Code's Output panel (select "MCP Servers" from the dropdown)

### Step 5: Iterate

After making more changes:

```bash
npm run build
```

Then **restart** the MCP server in VS Code (click the restart icon in MCP extension panel, or disable/re-enable the server).

### Troubleshooting

**Issue**: "MCP server failed to start"

- Check your path in `mcp.json` is correct and uses forward slashes or escaped backslashes
- Ensure `npm run build` completed successfully
- Check VS Code's Output panel for error details
- Enable debug logging (see Step 2) for detailed diagnostics

**Issue**: "Changes not taking effect"

- Did you run `npm run build`?
- Did you restart the MCP server after rebuilding?
- Make sure the local MCP is enabled and production is disabled
- Check the Output panel with `log_level: debug` to see if your code is executing

**Issue**: "Can't find my mcp.json"

- In VS Code, open Command Palette (Ctrl+Shift+P)
- Search for "MCP: Edit Settings"
- Or manually navigate to your VS Code user settings folder

**Issue**: "Knowledge not loading as expected"

- Enable `debug_layers: true` to see layer resolution details
- Check that your changes are in the correct layer directory structure
- Verify `validate_on_startup: true` for immediate feedback on structure issues
- Use the diagnostic tools (`enable_diagnostic_tools: true`) for git layer debugging

### Pro Tips for BC Developers

- Keep both `bc-code-intel-production` and `bc-code-intel-local` in your config - easy to toggle
- Use `npm run dev` for watch mode during active development (auto-rebuilds on save)
- Test with different BC versions to ensure compatibility
- Try to break it! Test edge cases that might trip up other BC developers

## Submission Process

1. Fork the repository
2. Create feature branch from main
3. Implement changes with comprehensive tests
4. Ensure all existing MCP tools continue functioning
5. Verify layer resolution logic remains intact
6. Submit pull request with clear description

## Testing Requirements

- **Unit Tests**: All layer resolution logic
- **Integration Tests**: Complete MCP tool workflows
- **Performance Tests**: Response time validation
- **Compatibility Tests**: Existing tool functionality preserved

## Code Review Criteria

- TypeScript builds without errors or warnings
- All tests pass (unit, integration, performance)
- MCP tools maintain backward compatibility
- Layer resolution system integrity preserved
- Performance benchmarks maintained

## Common Development Areas

- **New MCP Tools**: Adding BC knowledge access capabilities
- **Layer Sources**: Supporting new knowledge source types
- **Performance**: Optimizing knowledge search and caching
- **Version Awareness**: BC version compatibility features
- **Specialist System**: AI persona management enhancements
