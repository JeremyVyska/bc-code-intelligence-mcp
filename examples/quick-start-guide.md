# BCKB Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide gets you up and running with the Business Central Knowledge Base (BCKB) MCP Server quickly.

## Prerequisites

- **Node.js 18+** installed
- **Git** for cloning repositories
- **VS Code** (optional, for extension integration)
- **Claude Desktop** or **GitHub Copilot** (optional, for AI integration)

## Installation

### 1. Clone and Build

```bash
# Clone the repository
git clone https://github.com/your-org/bc-knowledgebase-mcp.git
cd bc-knowledgebase-mcp

# Install dependencies
npm install

# Build the server
npm run build

# Verify installation
npm test
```

### 2. Quick Test

```bash
# Start the server manually to verify it works
node dist/index.js

# In another terminal, test the CLI
npx bckb status
npx bckb search "table relationships" --limit 5
```

## Basic Usage Examples

### Command Line Interface

```bash
# Search for BC knowledge
bckb search "posting procedures" --domain finance --difficulty intermediate

# Get detailed topic information
bckb get "topic-posting-routines-001"

# Analyze AL code
bckb analyze --code "
table 50100 Customer
{
    fields
    {
        field(1; No; Code[20]) { }
        field(2; Name; Text[100]) { }
    }
}" --type validation

# Check server health
bckb status --json

# Interactive mode
bckb interactive
```

### TypeScript SDK

```typescript
import { BCKBClient, BCKBClientDefaults } from './src/sdk/bckb-client.js';

// Create and connect client
const client = new BCKBClient(BCKBClientDefaults.local());
await client.connect();

// Search for topics
const topics = await client.searchTopics('purchase orders', {
  domain: 'purchase',
  difficulty: 'beginner',
  limit: 10
});

console.log(`Found ${topics.length} topics:`);
topics.forEach(topic => {
  console.log(`- ${topic.title} (${topic.domain})`);
});

// Analyze code
const analysis = await client.analyzeCode({
  code_snippet: `
    codeunit 50100 "My Codeunit"
    {
        procedure DoSomething()
        begin
            Message('Hello World');
        end;
    }
  `,
  analysis_type: 'general',
  suggest_topics: true
});

console.log('Analysis results:', analysis.issues);
console.log('Suggested topics:', analysis.suggested_topics);

await client.disconnect();
```

## IDE Integrations

### VS Code Extension

1. **Install the extension:**
   ```bash
   cd vscode-extension
   npm install && npm run compile
   vsce package
   code --install-extension bckb-knowledge-assistant-1.0.0.vsix
   ```

2. **Configure server path** in VS Code settings:
   ```json
   {
     "bckb.serverPath": "node",
     "bckb.serverArgs": ["/full/path/to/bc-knowledgebase-mcp/dist/index.js"],
     "bckb.autoConnect": true
   }
   ```

3. **Use the extension:**
   - Press `Ctrl+Alt+K` to search knowledge
   - Right-click AL code and select "Analyze with BCKB"
   - View the BCKB Knowledge panel in the sidebar

### GitHub Copilot Integration

1. **Configure the integration:**
   ```bash
   # In your VS Code settings
   echo '{
     "github.copilot.chat.participants": ["@bckb"]
   }' >> .vscode/settings.json
   ```

2. **Use in Copilot Chat:**
   ```
   @bckb search posting procedures
   @bckb analyze [paste AL code here]
   @bckb explain table relationships
   ```

### Claude Desktop Integration

1. **Add to Claude config** (`~/.claude/claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "bckb": {
         "command": "node",
         "args": ["/full/path/to/bc-knowledgebase-mcp/dist/index.js"],
         "env": {
           "BCKB_LOG_LEVEL": "info",
           "BCKB_CACHE_ENABLED": "true"
         }
       }
     }
   }
   ```

2. **Restart Claude Desktop** to load the integration

3. **Enhanced conversations:**
   - Ask: "How do I implement posting routines in BC?"
   - Paste AL code for review and analysis
   - Get contextual BC knowledge in any conversation

## Configuration

### Basic Configuration

Create a `.env` file in the project root:

```bash
# Logging
BCKB_LOG_LEVEL=info
BCKB_DEBUG_LAYERS=false

# Caching
BCKB_CACHE_ENABLED=true
BCKB_CACHE_TTL_SECONDS=600

# Knowledge Sources
BCKB_COMPANY_KNOWLEDGE_URL=https://github.com/your-org/bc-knowledge
BCKB_PROJECT_OVERRIDES_PATH=./bckb-overrides

# Performance
BCKB_MAX_SEARCH_RESULTS=10
BCKB_REQUEST_TIMEOUT_MS=10000
```

### Layer Configuration

```yaml
# config/layers.yaml
layers:
  - name: "base"
    type: "embedded"
    path: "./knowledge/base"
    priority: 100
    enabled: true

  - name: "company"
    type: "git"
    url: "${BCKB_COMPANY_KNOWLEDGE_URL}"
    priority: 200
    enabled: true

  - name: "project"
    type: "local"
    path: "${BCKB_PROJECT_OVERRIDES_PATH}"
    priority: 300
    enabled: true
```

## Common Use Cases

### 1. Learning BC Development

```bash
# Start with beginner topics
bckb search "AL basics" --difficulty beginner --limit 10

# Get specific topic details
bckb get "al-development-fundamentals-001"

# Progress to intermediate topics
bckb search "table design patterns" --difficulty intermediate
```

### 2. Code Review and Analysis

```bash
# Analyze a specific AL file
bckb analyze --file src/MyCodeunit.al --type performance

# Check for best practices
bckb analyze --code "$(cat MyTable.al)" --type validation --json

# Get optimization suggestions
bckb analyze --file MyReport.al --type optimization
```

### 3. Architecture Planning

```bash
# Search for architectural patterns
bckb search "integration patterns" --domain "integration" --limit 20

# Get workflow recommendations
bckb interactive
bckb> search microservices patterns
bckb> get integration-api-patterns-001
bckb> exit
```

### 4. Troubleshooting

```typescript
// Check integration health
const client = new BCKBClient(BCKBClientDefaults.local());
await client.connect();

const health = await client.healthCheck();
console.log('Server Health:', health);

const status = await client.getSystemStatus();
console.log('System Status:', status);

// Get detailed analytics
const analytics = await client.getSystemAnalytics();
console.log('Usage Analytics:', analytics);
```

## Development Workflow

### 1. Daily Development

```bash
# Morning: Check what's new
bckb status
bckb search "latest BC features" --limit 5

# During coding: Analyze as you go
bckb analyze --file current-work.al --type general

# Evening: Review learning progress
bckb config --export daily-analytics.json
```

### 2. Code Reviews

```bash
# Before review: Run analysis
bckb analyze --file feature-branch/*.al --type validation --json > review-report.json

# During review: Quick checks
bckb search "error handling patterns" --domain "development"
bckb get "al-error-handling-best-practices"
```

### 3. Knowledge Sharing

```typescript
// Extract team insights
const client = new BCKBClient(BCKBClientDefaults.local());
await client.connect();

// Get popular topics for team knowledge sharing
const analytics = await client.getSystemAnalytics();
const popularTopics = analytics.usage_patterns.most_accessed_topics;

console.log('Share these topics with the team:');
popularTopics.slice(0, 5).forEach(topic => {
  console.log(`- ${topic.title}: ${topic.access_count} views`);
});
```

## Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check Node.js version
node --version  # Should be 18+

# Verify build
npm run build
ls dist/  # Should contain index.js

# Check permissions
ls -la dist/index.js
```

**Integration not working:**
```bash
# Test server manually
node dist/index.js &
curl http://localhost:3000/health

# Check environment variables
env | grep BCKB

# Validate configuration
bckb config --validate
```

**Performance issues:**
```bash
# Enable caching
export BCKB_CACHE_ENABLED=true
export BCKB_CACHE_TTL_SECONDS=1800

# Check cache hit rate
bckb status --json | jq .cache_hit_rate
```

### Debug Mode

```bash
# Enable debug logging
export BCKB_LOG_LEVEL=debug
export BCKB_DEBUG_LAYERS=true

# Start server with debug output
npm run dev

# Check detailed logs
tail -f logs/bckb-debug.log
```

## Next Steps

### Explore Advanced Features

1. **Layer System**: Learn about knowledge layering and overrides
2. **Custom Analysis**: Create custom code analysis patterns
3. **Integration APIs**: Build custom integrations using the SDK
4. **Performance Tuning**: Optimize for your specific use cases

### Join the Community

- **Documentation**: Read the full documentation in `/docs`
- **Examples**: Explore more examples in `/examples`
- **Issues**: Report bugs and request features on GitHub
- **Discussions**: Join community discussions and share knowledge

### Extend and Customize

```typescript
// Create custom analysis tools
import { BCKBClient } from './src/sdk/bckb-client.js';

class CustomAnalyzer {
  constructor(private client: BCKBClient) {}

  async analyzeProject(projectPath: string) {
    // Your custom analysis logic
    const files = await this.getAllALFiles(projectPath);
    const analyses = await Promise.all(
      files.map(file => this.client.analyzeCode({
        code_snippet: file.content,
        analysis_type: 'custom'
      }))
    );
    return this.consolidateResults(analyses);
  }
}
```

---

**🎉 You're Ready!** You now have the BCKB MCP Server running and integrated with your development environment. Start exploring BC knowledge and enhancing your development workflow!