# BCKB MCP Server - Alpha Testing Guide

🧪 **Alpha Release**: `bckb-mcp-server@0.1.0-alpha.1`

## Quick Start for Alpha Testers

### 1. Install via NPM (Optional)
**Note**: Claude Desktop can use `npx` to auto-install, so global installation is optional.
```bash
npm install -g bckb-mcp-server@alpha
```

### 2. Test CLI (optional)
```bash
# Search BC topics
bckb search "AL performance optimization" --limit 3

# Get specific topic
bckb topic "al-performance-optimization"

# Check server status
bckb config --status
```

### 3. Add to Claude Desktop

Update your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bckb": {
      "command": "npx",
      "args": ["--package=bckb-mcp-server@alpha", "bckb-server"]
    }
  }
}
```

**Config Location:**
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 4. Restart Claude Desktop

After adding the configuration, restart Claude Desktop to load the MCP server.

### 5. Test in Claude

Try these prompts in Claude:
```
- "Search for Business Central performance optimization topics"
- "What AL coding patterns should I avoid for performance?"
- "Show me topics about BC extension validation"
- "Give me a methodology for BC code review"
```

## What's Included

### 📚 Knowledge Base
- **58 atomic BC topics** across 24 domains
- **157 knowledge indexes** for intelligent search
- **Performance, validation, architecture** guidance
- **Sample code and patterns**

### 🛠 MCP Tools (13 focused tools)
- `find_bc_topics` - Search by tags, domain, difficulty
- `get_topic_content` - Full topic with samples
- `search_layered_topics` - Advanced AI search
- `analyze_code_patterns` - Code optimization suggestions
- `get_optimization_workflow` - Step-by-step guidance
- `validate_completeness` - Best practice validation
- And 7 more specialized tools

### 🏗 Architecture
- **Layer-based knowledge system** (embedded + overrides)
- **Intelligent caching** with relevance scoring
- **Hot-reload configuration** for development
- **Dual CLI + MCP server** deployment

## Known Alpha Limitations

- **Windows path handling**: Server must run from installation directory for now
- **TypeScript warnings**: Non-critical build warnings present
- **Limited error handling**: Some edge cases need better messaging
- **No company layer**: Git-based company knowledge not yet implemented

## Feedback & Issues

This is an **alpha release** for testing the core functionality and architecture.

**Report issues**: Please provide:
- Your OS and Node.js version
- Claude Desktop config (sanitized)
- Specific error messages or unexpected behavior
- What you were trying to accomplish

**Feedback areas**:
- MCP tool usefulness and responsiveness
- Knowledge content quality and coverage
- Claude integration smoothness
- CLI usability
- Installation process

---

🚀 **Goal**: Validate the layered MCP architecture and BC knowledge quality before broader release.