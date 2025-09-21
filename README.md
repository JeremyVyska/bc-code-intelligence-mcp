# BC Code Intelligence MCP Server

[![NPM Version](https://img.shields.io/npm/v/bc-code-intelligence-mcp)](https://www.npmjs.com/package/bc-code-intelligence-mcp)
[![Install with NPX in VS Code](https://img.shields.io/badge/Install%20with%20NPX-VS%20Code-blue?style=for-the-badge&logo=visual-studio-code)](https://vscode.dev/redirect/mcp/install?name=bc-code-intel&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22bc-code-intelligence-mcp%22%5D%7D)

**Transform your Business Central development** with intelligent specialist consultation, seamless handoffs, smart discovery, and context-preserving workflows.

---

## ✨ Enhanced Developer Workflows

### 🎯 Core Features
- **🤖 Smart Specialist Discovery**: Intelligent routing to 14 BC domain experts based on query analysis
- **🔄 Seamless Handoffs**: Context-preserving transitions between specialists with full conversation history
- **🚀 Agent-Friendly Onboarding**: Natural specialist team introduction optimized for coding agents
- **💬 Persistent Sessions**: Long-running conversations with accumulated context and recommendations
- **🧠 Multi-Specialist Collaboration**: Bring multiple experts into the same conversation for complex challenges

### 🛠️ Development Infrastructure  
- **📋 20+ MCP Tools**: Complete toolkit for knowledge discovery, specialist engagement, and workflow management
- **🔄 9 Workflow Orchestration**: Persona-driven development pipelines with structured guidance
- **🎯 MCP Prompts**: Discoverable workflow initiation through standardized prompts
- **� Layered Knowledge**: Embedded → Company → Team → Project override system
- **⚙️ Zero Configuration**: Works immediately with embedded knowledge
- **🔧 Extensible Architecture**: Support for git repositories, company standards, and project overrides

## � BC Specialist Team (14 Experts)

**Core Development Specialists:**
- **🏗️ Alex Architect** - Solution Design & Requirements Expert
- **💻 Sam Coder** - Expert Development Accelerator  
- **🔍 Dean Debug** - Performance & Troubleshooting Specialist
- **⚠️ Eva Errors** - Error Handling & Exception Management

**Quality & Security Specialists:**
- **🧪 Quinn Tester** - Testing Strategy & Validation Expert
- **📝 Roger Reviewer** - Code Quality & Standards Guardian
- **🔒 Seth Security** - Security & Permission Management

**Integration & Architecture Specialists:**
- **🌉 Jordan Bridge** - Integration & Extensibility Architect
- **🏛️ Logan Legacy** - Code Archaeology & System Analysis

**User Experience & Business Specialists:**
- **🎨 Uma UX** - User Experience & Interface Design
- **🏪 Morgan Market** - AppSource & ISV Business Expert

**Knowledge & Learning Specialists:**
- **📚 Taylor Docs** - Documentation & Knowledge Management
- **👩‍🏫 Maya Mentor** - Teaching-Focused Development Guide
- **🤖 Casey Copilot** - AI-Enhanced Development Coach

## 🤖 Specialist Bundle Experience

Experience collaborative BC development with intelligent specialist routing and seamless handoffs:

### Quick Start - Agent Integration
```javascript
// 1. Discover the specialist team (agents do this automatically)
const team = await mcp.call('introduce_bc_specialists', {
  context: 'Business Central development',
  focus_areas: ['performance', 'security', 'architecture']
});

// 2. Smart routing based on your challenge
const suggestions = await mcp.call('discover_specialists', {
  query: 'My AL extension has performance issues with database queries'
});

// 3. Engage with the recommended specialist
const session = await mcp.call('suggest_specialist', {
  specialist_id: 'dean-debug',
  user_query: 'Performance optimization needed',
  context: 'Business Central extension development'
});

// 4. Seamless handoffs when different expertise is needed
await mcp.call('handoff_to_specialist', {
  target_specialist_id: 'alex-architect',
  handoff_type: 'transfer',
  handoff_reason: 'Need architectural review after performance fixes',
  work_completed: ['Optimized queries', 'Added caching'],
  continuation_points: ['Review overall architecture', 'Design scalability']
});
```

### Specialist Bundle Tools

**Discovery & Routing:**
- `discover_specialists` - Intelligent specialist suggestions based on query analysis
- `browse_specialists` - Browse by domain or expertise area
- `get_specialist_info` - Detailed information about any specialist

**Engagement & Sessions:**
- `suggest_specialist` - Start/continue specialist conversations
- `get_specialist_advice` - Get expert guidance on specific topics
- `list_specialists` - See all available specialists

**Onboarding & Navigation:**
- `introduce_bc_specialists` - Agent-friendly team introduction
- `get_specialist_introduction` - Individual specialist details
- `suggest_next_specialist` - Intelligent next-step recommendations

**Handoffs & Collaboration:**
- `handoff_to_specialist` - Context-preserving specialist transitions
- `bring_in_specialist` - Multi-specialist consultation
- `get_handoff_summary` - Session history and analytics

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
Knowledge content is linked via git submodule from [bc-code-intelligence](../bc-code-intelligence).