# Claude Desktop Integration Setup Guide

## Overview

This guide helps you integrate the BCKB (Business Central Knowledge Base) MCP server with Claude Desktop for enhanced Business Central development assistance.

## Prerequisites

- Claude Desktop application installed
- Node.js 18+ installed
- BCKB MCP server built and ready (`npm run build`)

## Installation Steps

### 1. Build the MCP Server

```bash
# Navigate to the MCP server directory
cd bc-knowledgebase-mcp

# Install dependencies and build
npm install
npm run build

# Test the server
npm test
```

### 2. Configure Claude Desktop

#### Option A: Automatic Configuration

Copy the provided configuration file to your Claude Desktop config directory:

**Windows:**
```bash
# Copy the configuration
copy integrations\claude-desktop\claude-desktop-config.json %APPDATA%\Claude\claude_desktop_config.json
```

**macOS:**
```bash
# Copy the configuration
cp integrations/claude-desktop/claude-desktop-config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Linux:**
```bash
# Copy the configuration
cp integrations/claude-desktop/claude-desktop-config.json ~/.config/claude/claude_desktop_config.json
```

#### Option B: Manual Configuration

1. Open your Claude Desktop configuration file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/claude/claude_desktop_config.json`

2. Add the BCKB MCP server configuration:

```json
{
  "mcpServers": {
    "bckb": {
      "command": "node",
      "args": ["/path/to/bc-knowledgebase-mcp/dist/index.js"],
      "env": {
        "BCKB_LOG_LEVEL": "info",
        "BCKB_DEBUG_LAYERS": "false",
        "BCKB_COMPANY_KNOWLEDGE_URL": "https://github.com/your-org/bc-knowledge",
        "BCKB_CACHE_ENABLED": "true"
      }
    }
  }
}
```

**Important:** Update the path in `args` to match your actual installation directory.

### 3. Environment Configuration

Set up environment variables for your specific needs:

```bash
# Basic configuration (in your shell profile)
export BCKB_LOG_LEVEL=info
export BCKB_COMPANY_KNOWLEDGE_URL=https://github.com/your-org/bc-knowledge
export BCKB_CACHE_ENABLED=true

# Advanced configuration
export BCKB_DEBUG_LAYERS=false
export BCKB_CACHE_TTL_SECONDS=600
export BCKB_MAX_SEARCH_RESULTS=10
```

### 4. Restart Claude Desktop

After updating the configuration, restart Claude Desktop to load the BCKB integration.

## Usage Examples

### Basic Knowledge Search

```
Ask Claude: "How do I implement posting routines in Business Central?"

Enhanced response will include:
- Relevant BC knowledge topics
- Code samples and patterns
- Related documentation links
- Best practice recommendations
```

### Code Analysis

```
Paste AL code and ask: "Can you review this codeunit for performance issues?"

Claude will:
- Analyze the code using BCKB patterns
- Suggest optimizations
- Reference relevant BC topics
- Provide layered knowledge insights
```

### Contextual Learning

```
Ask: "I'm working on sales order processing, what should I learn first?"

Claude provides:
- Progressive learning path
- Domain-specific topics
- Difficulty-appropriate content
- Hands-on coding examples
```

## Advanced Features

### Layer-Aware Knowledge

The integration provides access to layered knowledge:
- **Base Layer**: Core BC knowledge
- **Company Layer**: Your organization's standards
- **Project Layer**: Project-specific overrides

### Smart Recommendations

Based on your conversation context:
- Suggests relevant topics
- Recommends next learning steps
- Identifies optimization opportunities
- Provides contextual code analysis

### Performance Monitoring

Monitor integration health:
- Response times
- Cache hit rates
- Knowledge layer status
- Connection stability

## Troubleshooting

### Connection Issues

1. **Server Not Starting:**
   ```bash
   # Check if the server runs manually
   cd bc-knowledgebase-mcp
   node dist/index.js
   ```

2. **Path Issues:**
   - Verify the `args` path in your configuration
   - Use absolute paths for reliability
   - Check file permissions

3. **Environment Variables:**
   ```bash
   # Test environment variables
   echo $BCKB_LOG_LEVEL
   echo $BCKB_COMPANY_KNOWLEDGE_URL
   ```

### Performance Issues

1. **Enable Caching:**
   ```json
   "env": {
     "BCKB_CACHE_ENABLED": "true",
     "BCKB_CACHE_TTL_SECONDS": "600"
   }
   ```

2. **Adjust Log Level:**
   ```json
   "env": {
     "BCKB_LOG_LEVEL": "warn"
   }
   ```

3. **Optimize Layer Loading:**
   ```json
   "env": {
     "BCKB_DEBUG_LAYERS": "false",
     "BCKB_LAZY_LAYER_LOADING": "true"
   }
   ```

### Debug Mode

For development and troubleshooting:

```json
{
  "mcpServers": {
    "bckb": {
      "command": "npm",
      "args": ["run", "dev"],
      "env": {
        "BCKB_LOG_LEVEL": "debug",
        "BCKB_DEBUG_LAYERS": "true"
      }
    }
  }
}
```

## Configuration Reference

### Required Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `command` | Executable command | `"node"` |
| `args` | Command arguments | `["dist/index.js"]` |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BCKB_LOG_LEVEL` | `info` | Logging level: debug, info, warn, error |
| `BCKB_CACHE_ENABLED` | `true` | Enable response caching |
| `BCKB_CACHE_TTL_SECONDS` | `600` | Cache time-to-live in seconds |
| `BCKB_DEBUG_LAYERS` | `false` | Enable layer debugging |
| `BCKB_COMPANY_KNOWLEDGE_URL` | - | Company knowledge repository URL |
| `BCKB_MAX_SEARCH_RESULTS` | `10` | Maximum search results to return |

### Optional Features

```json
{
  "integrationSettings": {
    "autoStart": true,
    "reconnect": true,
    "maxRetries": 3,
    "timeoutMs": 10000
  },
  "knowledgeIntegration": {
    "contextAware": true,
    "smartRecommendations": true,
    "codeAnalysis": true,
    "layeredSearch": true
  }
}
```

## Support

### Log Files

Check Claude Desktop logs for integration issues:
- Windows: `%APPDATA%\Claude\logs\`
- macOS: `~/Library/Logs/Claude/`
- Linux: `~/.local/share/claude/logs/`

### Health Check

Test the integration manually:

```typescript
import { ClaudeIntegration, ClaudeIntegrationDefaults } from './claude-integration.js';

const integration = new ClaudeIntegration(ClaudeIntegrationDefaults.local());
await integration.initialize();
const status = await integration.getIntegrationStatus();
console.log('Integration Status:', status);
```

### Community Support

- GitHub Issues: Report integration problems
- Documentation: Additional setup guides
- Examples: Sample configurations and use cases

---

**Next Steps:** After successful setup, explore the comprehensive Business Central knowledge base through natural conversations with Claude, enhanced by contextual BC expertise and intelligent code analysis.