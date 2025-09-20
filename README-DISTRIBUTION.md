# BC Code Intelligence MCP Server v1.2.0 - Distribution Guide

## ✨ What's New in v1.2.0 - Complete Specialist Bundle

The v1.2.0 release introduces a revolutionary **Specialist Bundle** that transforms BC/AL development into a collaborative, expert-driven experience:

- **🤖 14 BC Domain Specialists**: From Alex Architect to Uma UX, each with specialized expertise
- **🔍 Smart Discovery**: AI-powered specialist routing based on your specific challenges  
- **🔄 Seamless Handoffs**: Context-preserving transitions between specialists
- **💬 Persistent Sessions**: Long-running conversations with accumulated knowledge
- **🛠️ 20+ MCP Tools**: Complete toolkit for specialist consultation and workflow management

## Quick Installation

### Option 1: NPX (Recommended - No Installation Required)

```bash
# Run the latest version instantly
npx bc-code-intelligence-mcp

# Test specialist discovery
npx bc-code-intelligence-mcp introduce_bc_specialists
```

### Option 2: NPM Install (For CLI Access)

```bash
# Install globally
npm install -g bc-code-intelligence-mcp

# Test the installation
bc-code-intel status
bc-code-intel search "table relationships"
```

## 🤖 Agent Integration Setup

### Claude Desktop Integration

Add to your Claude Desktop config for full specialist consultation:

```json
{
  "mcpServers": {
    "bc-code-intel": {
      "command": "npx",
      "args": ["bc-code-intelligence-mcp"],
      "env": {
        "BC_LOG_LEVEL": "info"
      }
    }
  }
}
```

**Config file locations:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

### GitHub Copilot Integration

The specialist system works seamlessly with GitHub Copilot. No additional configuration needed - Copilot will automatically discover and engage specialists when working in BC/AL contexts.

### VS Code MCP Extension

Install the MCP extension for VS Code:

```bash
# Install the MCP extension
code --install-extension modelcontextprotocol.mcp
```

Then configure your VS Code settings to include the BC specialist server.

## 🎯 Quick Start - Specialist Experience

### 1. Discover Your Specialist Team

```javascript
// Ask Claude or any MCP client:
"Introduce me to the BC specialist team"

// Or use the tool directly:
introduce_bc_specialists({
  context: "Business Central development",
  focus_areas: ["performance", "security", "architecture"]
})
```

### 2. Get Smart Specialist Suggestions

```javascript
// Describe your challenge:
discover_specialists({
  query: "My AL extension has performance issues with database queries",
  include_reasoning: true
})

// Get recommendations with explanations
```

### 3. Engage with Specialists

```javascript
// Start a session with the recommended specialist:
suggest_specialist({
  specialist_id: "dean-debug",
  user_query: "Performance optimization needed",
  context: "Business Central extension development"
})
```

### 4. Seamless Handoffs

```javascript
// When you need different expertise:
handoff_to_specialist({
  target_specialist_id: "alex-architect",
  handoff_type: "transfer", 
  handoff_reason: "Need architectural review",
  work_completed: ["Fixed queries", "Added caching"]
})
```

## 🧪 Testing the v1.2.0 Specialist Bundle

### Core Functionality Tests

1. **Specialist Discovery:**
   ```bash
   # Test agent onboarding
   npx bc-code-intelligence-mcp introduce_bc_specialists
   
   # Test smart routing
   npx bc-code-intelligence-mcp discover_specialists "performance issues"
   ```

2. **Specialist Engagement:**
   ```bash
   # Start a specialist session
   npx bc-code-intelligence-mcp suggest_specialist dean-debug "AL performance problems"
   
   # Browse available specialists
   npx bc-code-intelligence-mcp browse_specialists
   ```

3. **Context Preservation:**
   ```bash
   # Test handoff capabilities
   npx bc-code-intelligence-mcp handoff_to_specialist alex-architect transfer
   
   # Get session summary
   npx bc-code-intelligence-mcp get_handoff_summary
   ```

### Integration Testing

1. **Claude Desktop Integration:**
   - Ask: "Introduce me to the BC specialist team"
   - Follow up: "I need help with AL performance optimization"
   - Test specialist handoffs and context preservation

2. **GitHub Copilot Integration:**
   - Open BC/AL code in VS Code
   - Copilot should naturally suggest specialist consultation
   - Test multi-specialist collaboration workflows

3. **Workflow Integration:**
   - Use MCP prompts to discover available workflows
   - Start specialist-guided development pipelines
   - Validate specialist routing within workflows

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