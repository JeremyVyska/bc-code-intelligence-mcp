# Business Central Knowledge Base MCP Server

[![Install with NPX in VS Code](https://img.shields.io/badge/Install%20with%20NPX-VS%20Code-blue?style=for-the-badge&logo=visual-studio-code)](https://vscode.dev/redirect/mcp/install?name=bckb&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22bckb-mcp-server%22%5D%7D)

Model Context Protocol server providing intelligent access to Business Central knowledge through a layered architecture system.

## Features
- **🔄 Workflow Orchestration**: 9 persona-driven development pipelines with structured guidance
- **🎯 MCP Prompts**: Discoverable workflow initiation through standardized prompts
- **👥 Specialist System**: 14 AI personas with domain expertise and consultation styles
- **📚 Layered Knowledge**: Embedded → Company → Team → Project overrides
- **🛠️ 16+ MCP Tools**: Knowledge discovery, workflow management, and methodology guidance
- **⚙️ Zero Configuration**: Works immediately with embedded knowledge
- **🔧 Extensible**: Support for git repositories, company standards, project overrides

## 🚀 Workflow Orchestration

Transform your BC development process with structured, persona-driven workflows:

### Available Workflows
- **`workflow_code_optimization`** - Systematic code optimization with performance analysis
- **`workflow_architecture_review`** - Comprehensive solution architecture evaluation  
- **`workflow_security_audit`** - Security analysis and compliance verification
- **`workflow_performance_analysis`** - Performance bottleneck identification and resolution
- **`workflow_integration_design`** - Robust integration pattern development
- **`workflow_upgrade_planning`** - BC version upgrade with risk assessment
- **`workflow_testing_strategy`** - Comprehensive testing approach development
- **`workflow_new_developer_onboarding`** - Structured developer guidance and training
- **`workflow_pure_review`** - Analysis-only workflow without implementation changes

### How It Works
1. **Discover Workflows**: Use MCP Prompts to see available workflows in your client
2. **Start Pipeline**: Initiate with project context and requirements
3. **Guided Phases**: Progress through specialist-led phases with targeted guidance
4. **Track Progress**: Monitor advancement and validate methodology compliance
5. **Constitutional Gates**: Ensure BC best practices and extensibility principles

### Example Usage
```typescript
// In any MCP-compatible client (Claude, VS Code, etc.)
// Prompts appear automatically for discovery

// Start a workflow
workflow_code_optimization({
  code_location: "src/MyCustomization.al",
  bc_version: "23.1"
})

// Advance through phases
advance_workflow({
  workflow_id: "workflow-123",
  phase_results: "Completed performance analysis..."
})

// Check status
get_workflow_status({ workflow_id: "workflow-123" })
```

## 🛠️ MCP Tools Reference

### Knowledge Discovery
- **`find_bc_topics`** - Search BC knowledge by specialist persona or expertise
- **`consult_bc_specialist`** - Get specialist consultation and guidance
- **`get_specialist_roster`** - List available specialists and their expertise
- **`get_topic_content`** - Retrieve detailed topic information

### Workflow Management
- **`advance_workflow`** - Progress workflow to next phase with results
- **`get_workflow_status`** - Check current workflow progress and state
- **`get_workflow_guidance`** - Get detailed phase-specific guidance

### Code Analysis
- **`analyze_code_patterns`** - Analyze AL code for patterns and improvements
- **`get_optimization_workflow`** - Get tailored optimization recommendations

### Methodology Support
- **`load_methodology`** - Load structured development methodologies
- **`get_phase_guidance`** - Get methodology phase-specific instructions
- **`validate_completeness`** - Validate methodology phase completion

### System Management
- **`get_layer_info`** - Information about configured knowledge layers
- **`resolve_topic_layers`** - See layer resolution for specific topics
- **`search_layered_topics`** - Search across all configured layers
- **`get_configuration_status`** - System configuration and health status
- **`reload_configuration`** - Reload configuration without restart
- **`get_system_analytics`** - Usage analytics and performance metrics

## Quick Start
```bash
npm install
npm run build
npm start
```

## Architecture
- **🔄 Workflow Orchestration**: Persona-driven pipeline management with session state
- **📊 Layer Resolution**: Multi-source knowledge with intelligent override system
- **📋 Methodology Integration**: Structured development workflows with validation
- **🎯 MCP Prompts**: Client-agnostic workflow discovery and initiation
- **🔍 Version Awareness**: BC version compatibility filtering throughout
- **👥 Specialist System**: AI persona management with domain expertise
- **⚡ Constitutional Gates**: BC development best practices enforcement
- **🏗️ Pure TypeScript**: Clean separation from knowledge content

## Knowledge Source
Knowledge content is linked via git submodule from [bc-knowledgebase](../bc-knowledgebase).