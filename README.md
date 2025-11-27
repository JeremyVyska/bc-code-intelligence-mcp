# BC Code Intelligence MCP Server

[![NPM Version](https://img.shields.io/npm/v/bc-code-intelligence-mcp)](https://www.npmjs.com/package/bc-code-intelligence-mcp)
[![Install with NPX in VS Code](https://img.shields.io/badge/Install%20with%20NPX-VS%20Code-blue?style=for-the-badge&logo=visual-studio-code)](https://vscode.dev/redirect/mcp/install?name=bc-code-intel&config=%7B%22type%22%3A%22stdio%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22bc-code-intelligence-mcp%22%5D%7D)
[![Installation Guide](https://img.shields.io/badge/Installation%20Guide-All%20Platforms-green?style=for-the-badge&logo=github)](https://github.com/JeremyVyska/bc-code-intelligence-mcp/wiki/Installation-Guide)

**Transform your Business Central development** with intelligent specialist consultation, seamless handoffs, smart discovery, and context-preserving workflows.

---

## 📚 Quick Links

- **[Company Layer Setup Guide](./examples/company-layer-setup.md)** - Add your company's BC standards
- **[Installation Guide](https://github.com/JeremyVyska/bc-code-intelligence-mcp/wiki/Installation-Guide)** - Install in Claude, Copilot, or any MCP client
- **[Configuration Examples](./bc-code-intel-config.example.yaml)** - All configuration options
- **[Specialist Bundle](#-specialist-bundle-experience)** - Meet the 14 BC experts

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

**🎯 When to Use Each Tool Type:**

**For Direct Conversations & Questions:**
- `ask_bc_expert` - **USE FOR**: "Talk to Sam", "Ask Dean about debugging", "I took over this BC app" 
  - ✅ **Direct questions get immediate specialist responses** (no methodology setup required)
  - ✅ **Broader requests** get structured methodology onboarding for systematic guidance
- `suggest_specialist` - Start/continue specialist conversations  
- `get_specialist_advice` - Get expert guidance on specific topics
  - ✅ **Smart name matching**: "Sam" automatically finds "sam-coder", "Dean" finds "dean-debug"

**For Structured Development Processes:**
- `start_bc_workflow` - **USE FOR**: "Optimize my code systematically", "Conduct architecture review", "Security audit"

**Discovery & Routing:**
- `discover_specialists` - Intelligent specialist suggestions based on query analysis
- `browse_specialists` - Browse by domain or expertise area
- `get_specialist_info` - Detailed information about any specialist
- `list_specialists` - See all available specialists

**Onboarding & Navigation:**
- `introduce_bc_specialists` - Agent-friendly team introduction
- `get_specialist_introduction` - Individual specialist details
- `suggest_next_specialist` - Intelligent next-step recommendations

**Handoffs & Collaboration:**
- `handoff_to_specialist` - Context-preserving specialist transitions (auto-creates sessions)
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

## 🏢 Company Layer Setup

Add your company's BC knowledge and standards to the MCP server using the **Company Layer** feature.

> **📖 Complete guide:** See [Company Layer Setup Guide](./examples/company-layer-setup.md) for detailed step-by-step instructions.

### Quick Setup (3 Steps)

**1. Create your configuration directory:**
```powershell
# Windows (PowerShell)
mkdir $env:USERPROFILE\.bc-code-intel

# macOS/Linux (Bash)
mkdir ~/.bc-code-intel
```

**2. Create your configuration file:**

Create `~/.bc-code-intel/config.yaml` (Windows: `%USERPROFILE%\.bc-code-intel\config.yaml`)

**3. Add your company layer:**

```yaml
layers:
  # Embedded layer (required) - base BC knowledge
  - name: embedded
    priority: 0
    source:
      type: embedded
      path: ./embedded-knowledge
    enabled: true

  # Company layer - YOUR COMPANY STANDARDS
  - name: company
    priority: 20
    source:
      type: git
      url: "https://github.com/yourcompany/bc-knowledge"  # Your Git repo URL
      branch: main                                         # Your branch name
      subpath: ""                                          # Optional: subdirectory path
    auth:
      type: token                    # or: az_cli, ssh_key, basic
      token_env_var: GITHUB_TOKEN    # Environment variable with token
    enabled: true

  # Project layer (optional) - local workspace overrides
  - name: project
    priority: 100
    source:
      type: local
      path: ./bc-code-intel-overrides
    enabled: true
```

### Repository Structure

Your company Git repository should contain:

```
your-bc-knowledge-repo/
├── domains/              # OR topics/ (both supported!)
│   ├── naming-conventions.md
│   ├── error-handling.md
│   └── company-patterns.md
├── specialists/          # Optional: company-specific specialists
│   └── company-expert.md
└── methodologies/        # Optional: company workflows
    └── company-review.md
```

**Note:** Both `domains/` and `topics/` directory names are supported!

### Authentication Methods

<details>
<summary><b>GitHub (Personal Access Token)</b></summary>

```yaml
auth:
  type: token
  token_env_var: GITHUB_TOKEN  # Set: export GITHUB_TOKEN="ghp_yourtoken"
```

Create token at: https://github.com/settings/tokens (needs `repo` scope)
</details>

<details>
<summary><b>Azure DevOps (Azure CLI)</b></summary>

```yaml
auth:
  type: az_cli  # Uses Azure CLI authentication
```

Prerequisites:
```powershell
az login  # Login once, credentials are cached
```
</details>

<details>
<summary><b>GitLab (Personal Access Token)</b></summary>

```yaml
auth:
  type: token
  token_env_var: GITLAB_TOKEN  # Set: export GITLAB_TOKEN="glpat-yourtoken"
```
</details>

<details>
<summary><b>SSH Key</b></summary>

```yaml
auth:
  type: ssh_key
  ssh_key_path: "~/.ssh/id_rsa"
```
</details>

### Configuration Discovery

The MCP server automatically searches for configuration in this order:

1. **User-level** (recommended): `~/.bc-code-intel/config.yaml`
2. **Project-level**: `./bc-code-intel-config.yaml` (workspace root)
3. **Environment variable**: `BC_CODE_INTEL_CONFIG_PATH`

**Important:** User-level configuration (including company layers) is **automatically loaded at startup**. No need to call `set_workspace_info` or configure per-workspace - your company standards are available globally across all projects!

### Priority System

Lower numbers = higher priority. Company layers (priority 20) override embedded knowledge (priority 0):

- **Priority 0**: Embedded base knowledge (always loaded)
- **Priority 20**: Company standards (overrides embedded)
- **Priority 100**: Project-specific (overrides everything)

When topics have the same ID, the **higher priority layer wins**.

### Example Configurations

**📖 Full Setup Guide:** See [**Company Layer Setup Guide**](./examples/company-layer-setup.md) for complete step-by-step instructions.

**Full Example:**
See [`bc-code-intel-config.example.yaml`](./bc-code-intel-config.example.yaml) for all configuration options.

**Minimal Company Setup:**
```yaml
layers:
  - name: embedded
    priority: 0
    source:
      type: embedded
    enabled: true

  - name: company
    priority: 20
    source:
      type: git
      url: "https://dev.azure.com/YourOrg/YourProject/_git/BCGuidelines"
      branch: master
      subpath: "bc-company-guidelines"  # Optional subdirectory
    auth:
      type: az_cli
    enabled: true
```

### Verification

Test your configuration:
```bash
# From the MCP server directory
npx tsx -e "
import { ConfigurationLoader } from './src/config/config-loader.js';
const config = await ConfigurationLoader.loadConfiguration();
console.log('✅ Config loaded:', config.layers.map(l => l.name));
"
```

### Troubleshooting

**Config not loading?**
- Check file location: `~/.bc-code-intel/config.yaml`
- Verify YAML syntax (use a YAML validator)
- Check file permissions

**Git authentication failing?**
- Token: Verify environment variable is set: `echo $GITHUB_TOKEN`
- Azure CLI: Run `az login` and verify with `az account show`
- SSH: Ensure key is added to ssh-agent: `ssh-add ~/.ssh/id_rsa`

**No topics loading from company layer?**
- Verify repository structure has `domains/` or `topics/` directory
- Check branch name matches config
- If using `subpath`, verify the path exists in your repo

For more examples, see the [`examples/`](./examples/) directory.

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