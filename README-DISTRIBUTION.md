# BCKB MCP Server - Distribution Guide

## Quick Installation for Alpha Testers

### Option 1: NPM Install (Easiest)

```bash
# Install globally for CLI access
npm install -g @bckb/mcp-server

# Test the installation
bckb status
bckb search "table relationships"
```

### Option 2: NPX (No Installation)

```bash
# Run without installing
npx @bckb/mcp-server

# Use CLI commands
npx bckb search "posting procedures"
npx bckb analyze --code "your AL code here"
```

## Integration Setup

### Claude Desktop Integration

1. **Add to Claude Desktop config** (auto-detects NPM installation):

```json
{
  "mcpServers": {
    "bckb": {
      "command": "npx",
      "args": ["@bckb/mcp-server"],
      "env": {
        "BCKB_LOG_LEVEL": "info"
      }
    }
  }
}
```

**Config file locations:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

2. **Restart Claude Desktop**

3. **Test the integration:**
   - Ask: "How do I implement posting routines in Business Central?"
   - You should see enhanced responses with BC knowledge supplements

### VS Code Extension (Coming Soon)

The VS Code extension will be available on the marketplace:

```bash
# Install from marketplace (when published)
code --install-extension bckb.knowledge-assistant

# Or install VSIX for alpha testing
code --install-extension bckb-knowledge-assistant-0.1.0.vsix
```

### GitHub Copilot Integration

Add to your VS Code `settings.json`:

```json
{
  "github.copilot.chat.participants": ["@bckb"]
}
```

Then use in Copilot Chat:
```
@bckb search posting procedures
@bckb analyze [paste AL code]
```

## Alpha Testing Feedback

### What to Test

1. **Basic Functionality:**
   ```bash
   bckb status
   bckb search "purchase orders"
   bckb search "performance optimization"
   ```

2. **Claude Desktop Integration:**
   - Ask BC-related questions
   - Paste AL code for review
   - Look for knowledge supplements in responses

3. **Code Analysis:**
   ```bash
   bckb analyze --code "your AL codeunit here"
   ```

### Report Issues

- **GitHub Issues**: https://github.com/bc-knowledge-base/bckb-mcp-server/issues
- **Email**: your-email@example.com
- **Discord/Slack**: [Your community channel]

### Feedback Categories

- 🐛 **Bugs**: Something broken or not working
- 💡 **Feature Requests**: Missing functionality you need
- 📚 **Knowledge Gaps**: Missing or incorrect BC knowledge
- ⚡ **Performance**: Slow responses or high resource usage
- 🔧 **Integration Issues**: Problems with Claude/VS Code/Copilot

## Development/Advanced Setup

### Local Development

```bash
# Clone and build from source
git clone https://github.com/bc-knowledge-base/bckb-mcp-server.git
cd bckb-mcp-server
npm install
npm run build
npm start
```

### Custom Configuration

Create `config/server-config.json`:

```json
{
  "server": {
    "name": "My BCKB Server",
    "port": 3000
  },
  "logging": {
    "level": "debug",
    "debug_layers": true
  },
  "layers": [
    {
      "name": "base",
      "type": "embedded",
      "path": "./knowledge-base",
      "priority": 100,
      "enabled": true
    },
    {
      "name": "company",
      "type": "git",
      "url": "https://github.com/your-org/bc-knowledge",
      "priority": 200,
      "enabled": true
    }
  ]
}
```

### Environment Variables

```bash
# Logging
export BCKB_LOG_LEVEL=debug
export BCKB_DEBUG_LAYERS=true

# Performance
export BCKB_CACHE_ENABLED=true
export BCKB_CACHE_TTL_SECONDS=1800

# Custom knowledge sources
export BCKB_COMPANY_KNOWLEDGE_URL=https://github.com/your-org/bc-knowledge
```

## Troubleshooting

### Common Issues

**"Command not found: bckb"**
```bash
# Try with npx
npx bckb status

# Or install globally
npm install -g @bckb/mcp-server
```

**Claude Desktop not connecting**
```bash
# Test server manually
npx @bckb/mcp-server

# Check configuration file path
# Restart Claude Desktop after config changes
```

**Performance issues**
```bash
# Enable caching
export BCKB_CACHE_ENABLED=true

# Check server status
bckb status --json
```

### Debug Mode

```bash
# Run with debug logging
BCKB_LOG_LEVEL=debug npx @bckb/mcp-server

# CLI debug mode
BCKB_LOG_LEVEL=debug bckb search "your query" --debug
```

## Version Information

- **Current Version**: 0.1.0-alpha.1
- **Node.js**: Requires 18.0.0 or higher
- **Platform**: Windows, macOS, Linux
- **License**: MIT

---

**Happy testing!** 🚀

Your feedback will help shape the future of Business Central knowledge tooling.