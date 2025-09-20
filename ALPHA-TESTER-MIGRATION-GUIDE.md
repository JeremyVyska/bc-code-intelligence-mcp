# BC Code Intelligence Migration Guide for Alpha Testers

## 🚨 IMPORTANT: Repository Rename Complete

The **Business Central Knowledge Base MCP** has been renamed to **BC Code Intelligence MCP** as of September 20, 2025.

## 📋 Migration Checklist

### 1. Uninstall Old Package
```bash
# If installed globally
npm uninstall -g bckb-mcp-server

# If installed locally
npm uninstall bckb-mcp-server
```

### 2. Install New Package
```bash
# Install new package globally (recommended)
npm install -g bc-code-intelligence-mcp

# Or install locally in your project
npm install bc-code-intelligence-mcp
```

### 3. Update MCP Configuration

#### Claude Desktop (`~/.claude_desktop_config.json`)
**OLD Configuration:**
```json
{
  "mcpServers": {
    "bckb": {
      "command": "npx",
      "args": ["bckb-mcp-server"]
    }
  }
}
```

**NEW Configuration:**
```json
{
  "mcpServers": {
    "bc-code-intel": {
      "command": "npx", 
      "args": ["bc-code-intelligence-mcp"]
    }
  }
}
```

#### VS Code MCP Extension
**OLD:**
```json
{
  "command": "npx",
  "args": ["bckb-mcp-server"]
}
```

**NEW:**
```json
{
  "command": "npx",
  "args": ["bc-code-intelligence-mcp"]
}
```

### 4. Update Configuration Files

#### Rename Configuration Files
```bash
# Rename main config file
mv .bckb-config.json .bc-code-intel-config.json
mv .bckb-config.yaml .bc-code-intel-config.yaml

# Rename overrides directory
mv bckb-overrides bc-code-intel-overrides

# Rename company config directory (if exists)
mv .bckb .bc-code-intel
```

#### Update Configuration Content
Your configuration files need content updates:

**OLD Environment Variables:**
- `BCKB_LOG_LEVEL` → `BC_CODE_INTEL_LOG_LEVEL`
- `BCKB_CACHE_ENABLED` → `BC_CODE_INTEL_CACHE_ENABLED`
- `BCKB_CONFIG_PATH` → `BC_CODE_INTEL_CONFIG_PATH`
- `BCKB_PROJECT_OVERRIDES_PATH` → `BC_CODE_INTEL_PROJECT_OVERRIDES_PATH`

**OLD Configuration Paths:**
- `./bckb-overrides` → `./bc-code-intel-overrides`
- `.bckb/config.yaml` → `.bc-code-intel/config.yaml`

### 5. Update Scripts and Automation

#### Package.json Scripts
```json
{
  "scripts": {
    "mcp:start": "bc-code-intelligence-mcp",
    "mcp:debug": "DEBUG=bc-code-intel:* bc-code-intelligence-mcp"
  }
}
```

#### Docker/CI Configuration
Update any Docker files or CI scripts:
```dockerfile
# OLD
RUN npm install -g bckb-mcp-server
CMD ["bckb-mcp-server"]

# NEW  
RUN npm install -g bc-code-intelligence-mcp
CMD ["bc-code-intelligence-mcp"]
```

### 6. Update Debug Configuration

#### Debug Environment Variables
```bash
# OLD
export DEBUG="bckb:*"
export BCKB_LOG_LEVEL=debug

# NEW
export DEBUG="bc-code-intel:*" 
export BC_CODE_INTEL_LOG_LEVEL=debug
```

#### Log File Paths
```bash
# OLD
tail -f /tmp/bckb-debug.log

# NEW
tail -f /tmp/bc-code-intel-debug.log
```

## 🔍 Verification Steps

### 1. Test Installation
```bash
# Check version
npx bc-code-intelligence-mcp --version

# Test health check
npx bc-code-intelligence-mcp --health-check
```

### 2. Verify MCP Connection
Start your MCP client (Claude Desktop, VS Code) and verify:
- [ ] MCP server connects successfully
- [ ] BC Code Intelligence tools are available
- [ ] Knowledge base content loads correctly
- [ ] Specialist system responds to queries

### 3. Test Core Functions
Try these basic operations:
```bash
# Test knowledge search (in MCP client)
find_bc_topics("performance optimization")

# Test specialist consultation  
consult_bc_specialist("alex-architect", "How to design scalable BC architecture?")

# Test workflow initiation
workflow_code_optimization({ code_location: "src/test.al" })
```

## 🏃 Quick Migration (One-liner)
For experienced users, here's a quick migration script:

```bash
npm uninstall -g bckb-mcp-server && \
npm install -g bc-code-intelligence-mcp && \
mv .bckb-config.json .bc-code-intel-config.json 2>/dev/null || true && \
mv bckb-overrides bc-code-intel-overrides 2>/dev/null || true && \
echo "✅ Migration complete! Update your MCP client configuration."
```

## 📚 Updated Repository URLs

- **Main Repository**: https://github.com/JeremyVyska/bc-code-intelligence-mcp
- **Knowledge Content**: https://github.com/JeremyVyska/bc-code-intelligence  
- **Documentation**: https://github.com/JeremyVyska/bc-code-intelligence-mcp/wiki
- **NPM Package**: https://www.npmjs.com/package/bc-code-intelligence-mcp

## 🔧 Troubleshooting

### Common Issues

#### "Command not found: bc-code-intelligence-mcp"
```bash
# Ensure global install
npm install -g bc-code-intelligence-mcp

# Or use npx
npx bc-code-intelligence-mcp --version
```

#### "Configuration file not found"
```bash
# Check config file exists
ls -la .bc-code-intel-config.*

# Use environment variable if needed
export BC_CODE_INTEL_CONFIG_PATH="/path/to/your/config.json"
```

#### "MCP server connection failed"
1. Verify package is installed: `npm list -g bc-code-intelligence-mcp`
2. Test server manually: `npx bc-code-intelligence-mcp --health-check`
3. Check MCP client configuration has updated package name
4. Restart MCP client after configuration changes

#### "Old knowledge base path errors"
Update any hardcoded paths in your configuration:
```json
{
  "layers": {
    "project": {
      "location": "./bc-code-intel-overrides"
    }
  }
}
```

### Getting Help

If you encounter issues:

1. **Check Installation**: `npx bc-code-intelligence-mcp --health-check --verbose`
2. **Enable Debug Logging**: `DEBUG=bc-code-intel:* npx bc-code-intelligence-mcp`
3. **Review Configuration**: Ensure all paths point to new directories
4. **GitHub Issues**: Report problems at https://github.com/JeremyVyska/bc-code-intelligence-mcp/issues

## 🎯 What's New

With the rebrand comes enhanced features:
- **Improved workflow orchestration** with 9 persona-driven pipelines
- **Enhanced MCP tool integration** with 16+ tools
- **Better layer resolution system** for knowledge overrides
- **Streamlined configuration** with more intuitive naming

## 📅 Timeline

- **September 20, 2025**: Repository rename and package migration
- **October 1, 2025**: Old package (`bckb-mcp-server`) will be deprecated on NPM
- **November 1, 2025**: Old package support discontinued

## ✅ Migration Complete

Once you've completed all steps:
- [ ] Old package uninstalled
- [ ] New package installed and tested
- [ ] Configuration files renamed and updated
- [ ] MCP client configuration updated
- [ ] Environment variables updated
- [ ] Scripts and automation updated
- [ ] Basic functionality verified

Welcome to **BC Code Intelligence**! The same powerful Business Central knowledge system with a clearer, more focused identity.

---

*Need help? Create an issue at https://github.com/JeremyVyska/bc-code-intelligence-mcp/issues*