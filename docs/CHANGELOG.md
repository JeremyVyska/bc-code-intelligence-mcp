# Changelog

All notable changes to the BC Code Intelligence MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.6] - 2025-11-28

### 🐛 Bug Fixes

**Fixed Embedded Layer Loading Issue with Git Repo Configurations**
- **BREAKING LOGIC CHANGE**: `type: embedded` now always uses server's built-in knowledge directory, ignoring user-specified `path` field
- Resolves issue where embedded layers showed 0 topics when users had git repo layers configured with paths like `./embedded-knowledge`
- Simplifies configuration: `type: embedded` now clearly means "use built-in knowledge regardless of path"
- Eliminates path resolution confusion that could break embedded layer loading
- **User Impact**: Users with `type: embedded` layers will no longer experience 0 topic counts due to path resolution issues

**Enhanced Path Resolution Logic**
- Embedded layers now consistently resolve to server's `embedded-knowledge/` directory
- Removes ambiguity between relative paths (`./embedded-knowledge`) and server paths (`embedded-knowledge`)
- Improves reliability when mixing embedded layers with git/local layers

### 🧪 Testing

**Comprehensive Test Coverage for Path Resolution**
- Added integration tests specifically for embedded layer path resolution scenarios
- Validates fix works correctly with user configs containing various path formats
- Ensures embedded layers load properly regardless of git layer configuration

## [1.5.5] - 2025-11-27

### 🚀 Features

**Auto-load User-Level Company Layers at Startup** (PR #22 - @waldo1001)
- Server now automatically checks for `~/.bc-code-intel/config.yaml` at startup
- Company Git layers are loaded automatically if configured - no workspace-specific setup needed
- Graceful fallback to embedded-only mode if no user config exists
- Company BC standards are now truly global across all workspaces

**Support Both `domains/` and `topics/` Directory Names**
- `embedded-layer.ts` and `git-layer.ts` now accept both `domains/` and `topics/` directories
- Resolves confusion from mixed guidance in documentation

**Comprehensive Company Layer Documentation**
- New `examples/company-layer-setup.md`: 20+ page detailed setup guide with:
  - Step-by-step configuration instructions
  - All authentication methods (GitHub, Azure DevOps, GitLab, SSH)
  - Real-world examples and troubleshooting
  - Repository structure requirements
- Enhanced `bc-code-intel-config.example.yaml` with better comments

### 🐛 Bug Fixes

**MCP Server Fails to Start When Installed Globally via npm** (PR #21 - @StefanMaron)
- Fixed condition checks for server execution in main module
- Server now starts correctly when executed as a globally installed binary (e.g., `bc-code-intelligence-mcp`)
- Previously only matched when running the file directly with `index.js`
- Fixes Issue #20

### 📦 Maintenance

- Updated Node.js dependencies

## [1.5.4] - 2025-01-17

### 🤖 Phase 1: Autonomous Agent Mode for GitHub Coding Agents

**NEW: Token-Efficient Autonomous Mode Extensions**

Extended 3 core MCP tools with autonomous capabilities for GitHub Coding Agents and Issue → PR workflows. Achieves 70% token savings (~600 tokens vs 2000 for 8 specialized tools) while enabling autonomous decision-making.

**Enhanced Tools:**

**1. `ask_bc_expert` - Autonomous Action Plans**
- **New Parameter**: `autonomous_mode: boolean` (default: `false`)
- **Interactive Mode** (default): Returns conversational specialist consultation
- **Autonomous Mode**: Returns structured JSON action plan:
  ```json
  {
    "response_type": "autonomous_action_plan",
    "action_plan": {
      "primary_action": "Main recommendation",
      "steps": ["Step 1", "Step 2", "..."],
      "required_tools": ["tool-ids"],
      "confidence": 0.85,
      "blocking_issues": [...],
      "alternatives": [...]
    }
  }
  ```
- **Use Case**: GitHub Coding Agents analyzing issues and planning PRs

**2. `analyze_al_code` - Validation & Auto-Fix Suggestions**
- **New Parameter**: `operation: 'analyze' | 'validate' | 'suggest_fixes'` (default: `'analyze'`)
- **analyze** (default): Conversational code analysis with explanations
- **validate**: Compliance report with auto-fix suggestions:
  ```json
  {
    "response_type": "validation_report",
    "compliance_issues": [...],
    "auto_fix_suggestions": [{
      "issue": "pattern",
      "fix_action": "recommended action",
      "confidence": 0.9
    }],
    "blocking_issues": [...],
    "warnings": [...]
  }
  ```
- **suggest_fixes**: Code transformation recommendations:
  ```json
  {
    "response_type": "code_transformations",
    "transformations": [{
      "pattern": "anti-pattern found",
      "before_code": "current code",
      "after_code": "suggested code",
      "impact": "medium",
      "confidence": 0.85
    }]
  }
  ```
- **Use Case**: Automated code validation and fix generation for PRs

**3. `start_bc_workflow` - Multi-Session Autonomous Workflows**
- **New Parameters**:
  - `execution_mode: 'interactive' | 'autonomous'` (default: `'interactive'`)
  - `checkpoint_id: string` - Resume from saved workflow state
- **interactive** (default): Human-in-loop with conversational guidance
- **autonomous**: Returns next action for automated execution:
  ```json
  {
    "response_type": "workflow_next_action",
    "checkpoint_id": "session-id-for-resume",
    "next_action": {
      "action_type": "execute_phase",
      "phase": "current phase",
      "specialist": "specialist-id",
      "required_inputs": [...],
      "expected_outputs": [...],
      "guidance": "phase description"
    },
    "can_proceed": true,
    "blocking_issues": [],
    "progress": 40
  }
  ```
- **Checkpoint Support**: Resume workflows across multiple invocations using `checkpoint_id`
- **Use Case**: Multi-session Issue → PR workflows spanning multiple agent invocations

**Benefits:**
- ✅ **Token Efficient**: ~600 tokens vs 2000 for 8 new tools (70% savings)
- ✅ **Zero Breaking Changes**: All parameters optional with safe defaults
- ✅ **Structured Responses**: JSON action plans for autonomous decision-making
- ✅ **Multi-Session Support**: Checkpoint-based workflow resumption
- ✅ **Self-Correcting**: Confidence scores + blocking issues enable retry logic
- ✅ **Production Ready**: All 246 tests passing (122 unit + 120 integration + 4 contracts + 6 prompts)

**Implementation Details:**
- `src/tools/core-tools.ts`: Extended tool definitions with autonomous parameters
- `src/streamlined-handlers.ts`: Handler logic for mode detection and structured responses
- Response type discrimination via `response_type` field for autonomous parsing
- Maintains backward compatibility - existing clients unaffected

## [1.5.3] - 2025-10-30

### 🔧 Configuration Discovery Fix: User + Project Config Merge

**Fixed Issue #19: User configuration file not discovered**

**Problem:** 
- User config at `~/.bc-code-intel/config.json` was not being discovered
- Only ONE config file loaded (first found wins)
- Legacy paths (`~/.bckb/`) checked before new branding paths
- No way to combine user-level and project-level configurations

**Solution: VSCode-Style Config Merge**
- ✅ Load BOTH user-level AND project-level configurations
- ✅ Intelligent priority-based merge strategy
- ✅ Project config overrides user config at same priority
- ✅ Different priorities combine (all layers included)

**Configuration Loading Flow (v1.5.3):**

**Phase 1: Startup (User Config)**
```
MCP Server starts → Load ~/.bc-code-intel/config.json
User layers available immediately
```

**Phase 2: Workspace Discovery (User + Project Merge)**
```
set_workspace_info called → Load ./bc-code-intel-config.json
Merge with user config using priority-based strategy
```

**Merge Strategy:**
- **Same priority**: Project layer **wins** (overrides user layer)
- **Different priorities**: Both layers **included** (sorted by priority)

**Example Merge:**
```
User config:    [Layer A (priority 20), Layer B (priority 30), Layer C (priority 80)]
Project config: [Layer X (priority 30), Layer Y (priority 40), Layer Z (priority 50)]
Result:         [Layer A (20), Layer X (30), Layer Y (40), Layer Z (50), Layer C (80)]
                               ↑ Project wins conflict at priority 30
```

**Configuration Path Recommendations:**

**User-Level Config:**
- ✅ **Recommended**: `~/.bc-code-intel/config.json` or `.yaml`
- ⚠️ **Legacy (deprecated)**: `~/.bckb/config.json` (shows warning)
- **Use for**: Company-wide layers, personal auth, default preferences

**Project-Level Config:**
- ✅ **Recommended**: `bc-code-intel-config.json` or `.yaml` (in workspace root)
- ⚠️ **Legacy (deprecated)**: `bckb-config.json` (shows warning)
- **Use for**: Project-specific layers, team-shared config (in repo)

**Implementation Changes:**

**`src/config/config-loader.ts`:**
- Split `CONFIG_PATHS` into `USER_CONFIG_PATHS` and `PROJECT_CONFIG_PATHS`
- Updated `loadConfiguration(workspaceRoot?: string)` - now accepts workspace root parameter
- Added `loadUserConfig()` - searches user-level paths
- Added `loadProjectConfig(workspaceRoot)` - searches project-level paths
- Updated `mergeConfigurations()` - changed from name-based to priority-based merge
  - OLD: `Map<string, LayerConfiguration>` (by layer name)
  - NEW: `Map<number, LayerConfiguration>` (by priority)
- Added deprecation warnings for legacy `bckb-*` paths

**`src/index.ts`:**
- Updated `set_workspace_info` to pass `workspaceRoot` to `loadConfiguration()`
- Enables project config discovery when workspace becomes known

**Testing:**
- Added comprehensive integration test suite: `tests/services/config-merge.integration.test.ts`
- 7 test scenarios covering merge behavior, conflicts, YAML support, deprecation warnings
- All tests passing ✓

**Documentation Updates:**
- Chris Config specialist: Complete rewrite of configuration-file-discovery.md
- Added merge strategy documentation with priority conflict examples
- Added "When to use User vs Project Config" guidance
- Updated troubleshooting section for merge-specific issues
- Updated all scenarios to reflect v1.5.3 behavior

**Benefits:**
- ✅ User config at `~/.bc-code-intel/config.json` now discovered correctly
- ✅ Company-wide layers in user config apply to all projects
- ✅ Project-specific overrides in project config (can be committed to repo)
- ✅ VSCode-familiar behavior (project overrides user)
- ✅ Backward compatible (existing single-config setups still work)
- ✅ Clear migration path from legacy paths with warnings

---

## [1.5.2] - 2025-10-29

### 🔐 Azure CLI Authentication for Azure DevOps Git Layers

**New Authentication Type: `az_cli`** - Simplified Azure DevOps authentication

**Features:**
- **Azure CLI Authentication**: Use `az login` session for Git layer authentication
- **No Token Management**: Git credential manager automatically provides tokens from Azure CLI
- **MFA Support**: Works seamlessly with MFA and conditional access policies
- **Zero Expiration**: No PAT token expiration headaches
- **Simple Configuration**: Just set `auth.type` to `"az_cli"` - no tokens or environment variables

**Implementation:**
- Added `AZ_CLI` to `AuthType` enum in `config-types.ts`
- Implemented `verifyAzCliInstalled()` - checks for Azure CLI installation
- Implemented `verifyAzCliAuthenticated()` - verifies user is logged in via `az account show`
- Updated `configureAuthentication()` to handle Azure CLI authentication flow
- Updated `prepareUrlWithAuth()` to skip URL modification (Git credential manager handles automatically)
- Added Azure DevOps configuration examples to `bc-code-intel-config.example.json` and `.yaml`

**Configuration Example:**
```json
{
  "knowledge_layers": [
    {
      "name": "Company Standards",
      "type": "git",
      "priority": 20,
      "source": {
        "repository_url": "https://dev.azure.com/myorg/BC-Knowledge/_git/standards",
        "branch": "main",
        "auth": {
          "type": "az_cli"
        }
      }
    }
  ]
}
```

**Prerequisites:**
- Azure CLI installed: https://aka.ms/install-az-cli
- User authenticated: `az login`

**Benefits Over PAT Tokens:**
- ✅ No token expiration management
- ✅ Works with MFA and conditional access policies
- ✅ Single sign-on via `az login`
- ✅ Simpler configuration (no environment variables)
- ✅ Automatic token refresh

**Knowledge Updates:**
- Chris Config specialist documentation updated to prefer Azure CLI authentication
- All Azure DevOps examples now show `az_cli` as recommended approach
- PAT token authentication remains available as fallback option

**Technical Details:**
Leverages Git's built-in credential manager to automatically provide tokens from Azure CLI session. No manual token handling or URL manipulation required.

## [1.5.1] - 2025-10-28

### 🔧 Improved MCP Discovery for Ecosystem-Aware Workflows

**Enhanced `set_workspace_info` Tool** - Supporting v1.5.0 MCP-aware workflows

- **Made `available_mcps` Required**: Changed from optional to required parameter to ensure agents provide MCP ecosystem context
- **Tool Signature Mapping**: Added `MCP_TOOL_SIGNATURES` constant mapping 42 signature tools to 7 BC MCP servers
- **Automatic Discovery Instructions**: Updated tool description with explicit guidance on inferring MCP servers from available tools:
  - If `search_telemetry_traces` exists → bc-telemetry-buddy is available
  - If `reserve_object_ids` exists → al-objid-mcp-server is available
  - If `analyze_dependencies` exists → al-dependency-mcp-server is available
  - If `get_lsp_diagnostics` exists → serena-mcp is available
  - If `create_work_item` exists → azure-devops-mcp is available
  - If `track_time_entry` exists → clockify-mcp is available
  - If `translate_xliff` exists → nab-al-tools-mcp is available
- **Updated Intercept Message**: Changed workspace configuration prompt from "Optional" to "REQUIRED" with discovery instructions
- **Consistent Logging**: Fixed server logs to reference `set_workspace_info` instead of legacy `set_workspace_root`

**Why This Matters:**
- Agents can't see which MCP servers are connected (MCP protocol limitation)
- Agents CAN list available tools in their context
- Tool signature matching enables automatic MCP ecosystem discovery
- Specialists can now provide ecosystem-aware recommendations and tool delegation
- Prevents agents from skipping MCP ecosystem information

**Migration:**
All `set_workspace_info` calls now require the `available_mcps` parameter (can be empty array `[]`):
```typescript
// Before (v1.5.0):
set_workspace_info({ workspace_root: "C:/project/path" })

// After (v1.5.1):
set_workspace_info({ 
  workspace_root: "C:/project/path",
  available_mcps: []  // Or discover via tools: ["bc-telemetry-buddy", "al-objid-mcp-server"]
})
```

## [1.5.0] - 2025-10-28

### 🎯 Workspace Management Tools
- **New Tool**: `set_workspace_info` - Configure workspace root and MCP ecosystem context
- **New Tool**: `get_workspace_info` - Query currently configured workspace and available MCPs
- **Lazy Initialization**: Server starts with only embedded knowledge, defers project/company layers until workspace is set
- **First-Call Interception**: Tools provide helpful guidance to set workspace before allowing operations
- **VS Code Workaround**: Solves VS Code bug #245905 (${workspaceFolder} doesn't work in user-level MCP settings)
- **Automatic Reload**: Setting workspace triggers full config reload with project-local layers
- **MCP Ecosystem Awareness**: Track available BC MCP servers for conditional knowledge loading

**Why This Was Needed:**
- MCP servers launched by VS Code extension run from user home/npm cache, not workspace folder
- Config file discovery (`bckb-config.yml`) and project layers (`./bc-code-intel-overrides`) failed
- No standard MCP protocol for workspace context passing
- Lazy initialization prevents startup failures while maintaining zero-config embedded knowledge
- Specialists need to know what other BC tools are available for delegation and integration

**Usage:**
```json
// After server starts, configure workspace with MCP ecosystem:
{
  "tool": "set_workspace_info",
  "arguments": {
    "path": "C:\\Users\\YourName\\Projects\\your-bc-project",
    "available_mcps": ["bc-telemetry-buddy", "al-objid-mcp-server"]
  }
}

// Server responds with reload status and MCP categorization:
{
  "success": true,
  "workspace_root": "C:\\Users\\YourName\\Projects\\your-bc-project",
  "available_mcps": {
    "known": [
      "bc-telemetry-buddy: BC Telemetry Buddy - Advanced telemetry analysis",
      "al-objid-mcp-server: Object ID Ninja - AL object ID management"
    ],
    "unknown": []
  },
  "message": "Workspace configured. Loaded 145 topics from 3 layers, 15 specialists available.",
  "reloaded": true
}
```

**Legacy Tool Names:**
- `set_workspace_root` → Now `set_workspace_info` (legacy name still intercepted)
- `get_workspace_root` → Now `get_workspace_info` (legacy name still intercepted)

### 📚 Universal Content Type Support - ALL Layers
- **Breaking Architecture Fix**: ALL layers (embedded, git, project) now support all three content types
  - Topics (domains/) - BC knowledge articles  
  - Specialists (specialists/) - AI persona definitions
  - Methodologies (methodologies/) - Systematic workflows
- **BaseKnowledgeLayer Enhancement**: Added `specialists` and `methodologies` Maps to base class
- **Git Layer**: Now loads from `domains/`, `specialists/`, and `methodologies/` subdirectories
- **Project Layer**: Enhanced to support all content types for local overrides
- **Consistent Interface**: All layers implement `getContentIds()`, `getContent()`, `hasContent()`, `searchContent()`

**Why This Matters:**
- Companies can add custom specialists via git layers (e.g., company-specific code reviewers)
- Projects can override methodologies for team-specific workflows
- Consistent multi-content support across all layer types
- Fixes incomplete MultiContentLayerService implementation

**Migration Notes:**
- Git repositories should organize content in standard directories:
  - `domains/` for knowledge topics
  - `specialists/` for specialist definitions  
  - `methodologies/` for workflow definitions
- Specialist markdown files require proper YAML frontmatter (see embedded specialists for format)

### 🔧 Configuration Loader Improvements
- Added support for additional config file names and locations:
  - `bc-code-intel-config.{json|yaml|yml}` in project root
  - `.bc-code-intel/config.{json|yaml|yml}` in project
  - Home directory equivalents under `.bc-code-intel/`
- Added support for `BC_CODE_INTEL_CONFIG_PATH` env var (in addition to legacy `BCKB_CONFIG_PATH`)
- The loader now logs which configuration file was loaded, or explicitly states when no file was found and defaults (plus any environment overrides) are used
- **Startup Diagnostics**: Logs process.cwd(), Node version, platform for troubleshooting CWD issues

### 🐛 Bug Fixes
- **ES Module Compatibility**: Fixed `__dirname` errors in `MethodologyService` and `ConfigValidator`
  - Added proper `fileURLToPath` and `dirname` imports for ES modules
  - Resolves `ReferenceError: __dirname is not defined` crashes

### 🔇 Reduced Debug Output
- Removed excessive "No directory" messages from layer loading
- Layer initialization now only logs successful loads and specialist counts
- Tool call debugging removed from production (kept for diagnostic tools when enabled)

### 📖 Chris Config Knowledge Restructure
- **Specialist Optimization**: Condensed `chris-config.md` from 541 to 135 lines
- **Domain Knowledge Architecture**: Moved detailed configuration knowledge to `domains/chris-config/`
- **New Configuration Topics**:
  - `configuration-file-formats.md` - Complete guide to creating JSON/YAML configs with schema reference
  - `configuration-file-discovery.md` - Config search priority and path resolution (env var → workspace → home)
  - `layer-system-fundamentals.md` - Deep dive into 4-layer architecture and override behavior
  - `content-types-structure.md` - YAML frontmatter formats for topics, specialists, methodologies
  - `workspace-detection-solutions.md` - VS Code workspace management integration and troubleshooting
- **Knowledge-First Pattern**: Chris now references domain topics instead of inline documentation
- **Improved Discoverability**: Configuration knowledge can be searched and discovered via `find_bc_knowledge`

**Benefits:**
- Modular, maintainable configuration documentation
- Easier to update individual topics without specialist file bloat
- Supports v1.5.0 workspace management and universal content types
- Reference architecture for other specialists with extensive knowledge domains

### 🌐 MCP Ecosystem Awareness
- **MCP Discovery**: New `available_mcps` parameter in workspace tools reports other BC MCP servers in environment
- **Known BC MCPs Registry**: Built-in registry of 8 BC-related MCP servers:
  - **AL & BC Development**: bc-code-intelligence-mcp, al-dependency-mcp-server, serena-mcp, al-objid-mcp-server (Object ID Ninja), bc-telemetry-buddy
  - **DevOps & Productivity**: azure-devops-mcp, clockify-mcp, nab-al-tools-mcp
- **Conditional Knowledge Topics**: Specialists gain tool-specific expertise when related MCPs detected
- **Ecosystem-Aware Guidance**: Specialists provide context-aware recommendations based on available tools

**New Conditional Knowledge Topics:**
- **Alex Architect - Object ID Ninja Integration** (`object-id-ninja-integration.md`, 380 lines)
  - Detects `al-objid-mcp-server` via workspace info
  - Delegation patterns: "I see you have Object ID Ninja available - let me use it to find safe IDs..."
  - LITE mode (individual pools) vs STANDARD mode (team backend coordination)
  - Tools: `objid_get_next_available`, `objid_reserve_id`, `objid_check_availability`
  - Fallback strategy: Manual guidance (50000-99999 ranges) when MCP not available
  - Team collaboration and AppSource publisher range management
  
- **Dean Debug - BC Telemetry Buddy Integration** (`bc-telemetry-buddy-integration.md`, 354 lines)
  - Detects `bc-telemetry-buddy` MCP for real telemetry data access
  - **11 MCP Tools** documented:
    - Discovery: `bctb_get_event_catalog`, `bctb_get_event_field_samples`, `bctb_get_event_schema`, `bctb_get_categories`
    - Execution: `bctb_query_telemetry`
    - Library: `bctb_get_saved_queries`, `bctb_search_queries`, `bctb_save_query`
    - Context: `bctb_get_external_queries`, `bctb_get_tenant_mapping`
    - Analysis: `bctb_get_recommendations`
  - **Discovery-First Workflow**: Event catalog → Field samples → Targeted KQL query → Recommendations
  - **Data-Driven Performance Analysis**: "I found 47 database calls taking over 2 seconds - here are the specific targets" vs theoretical guidance
  - Customer-specific troubleshooting with tenant mapping
  - Query library for saving and reusing KQL patterns
  - Fallback to theoretical guidance when telemetry not available

**Conditional MCP Filtering Implementation:**
- **Dynamic Topic Loading**: Knowledge base adapts based on available MCP servers (no restart required)
- **Dual Conditional Pattern**:
  - `conditional_mcp`: Topic appears ONLY when specified MCP is available (integration topics)
  - `conditional_mcp_missing`: Topic appears ONLY when specified MCP is NOT available (recommendation topics)
- **Progressive Enhancement Architecture**:
  - **Baseline Topics**: Always available (no conditional frontmatter)
  - **Recommendation Topics**: Show when tool missing - guide users to install and explain benefits
  - **Integration Topics**: Show when tool present - provide tool-specific workflows and delegation patterns
- **Filter Timing**: Dynamic filtering at search/query time (not load time)
  - `MultiContentLayerService.shouldIncludeTopic()` checks conditionals before returning results
  - `setAvailableMcps()` updates MCP list and clears cache for immediate filtering updates
  - Specialists see tool-specific knowledge appear/disappear as ecosystem changes
- **New Recommendation Topics** (450+ lines total):
  - `dean-debug/recommend-bc-telemetry-buddy.md` - "What you're missing: data-driven vs theoretical guidance"
  - `alex-architect/recommend-object-id-ninja.md` - "Object ID collision risks and manual fallback strategies"

**Frontmatter Schema:**
```yaml
# Integration topic (only show when MCP present)
conditional_mcp: "bc-telemetry-buddy"

# Recommendation topic (only show when MCP absent)  
conditional_mcp_missing: "al-objid-mcp-server"

# Baseline topic (always show - no conditional field)
```

**Implementation:**
- Enhanced `AtomicTopicFrontmatterSchema` with optional `conditional_mcp` and `conditional_mcp_missing` fields
- `MultiContentLayerService` filtering logic:
  - `setAvailableMcps(mcps: string[])` - Update available MCPs and clear cache
  - `getAvailableMcps()` - Query current MCP availability
  - `shouldIncludeTopic(topic)` - Boolean filter based on conditionals
- Integrated with `set_workspace_info` tool - MCP list updates trigger dynamic filtering
- **99 Integration Tests Passing** - Comprehensive filtering test coverage validates all scenarios

**Usage:**
```json
// Configure workspace with available MCP servers
{
  "tool": "set_workspace_info",
  "arguments": {
    "path": "C:\\Users\\YourName\\Projects\\bc-project",
    "available_mcps": ["bc-telemetry-buddy", "al-objid-mcp-server"]
  }
}

// Server categorizes and responds with ecosystem details
{
  "success": true,
  "workspace_root": "C:\\Users\\YourName\\Projects\\bc-project",
  "available_mcps": {
    "known": [
      "bc-telemetry-buddy: BC Telemetry Buddy - Advanced telemetry analysis for BC",
      "al-objid-mcp-server: Object ID Ninja - AL object ID management"
    ],
    "unknown": []
  },
  "message": "Workspace configured. Dean can now use BC Telemetry Buddy for data-driven performance analysis. Alex can delegate to Object ID Ninja for ID collision prevention."
}
```

**Why This Matters:**
- **Data-Driven Debugging**: Dean provides REAL performance numbers instead of theoretical guidance
- **ID Collision Prevention**: Alex delegates to Object ID Ninja for team coordination
- **Tool Discovery**: Specialists recommend complementary tools when gaps identified
- **Graceful Degradation**: Full fallback when MCPs not available
- **Extensible Registry**: Easy to add new BC MCP servers as ecosystem grows

**Technical Implementation:**
- `WorkspaceInfo` interface tracks `{ workspace_root, available_mcps }`
- MCP categorization: Known vs unknown servers with descriptions
- Conditional knowledge via `conditional_mcp` frontmatter field
- Specialists check `get_workspace_info()` to detect available tools
- Backward compatible: `available_mcps` defaults to empty array

## [1.4.5] - 2025-10-26

### 📚 Enhanced Knowledge - Alex Architect Copilot Agent Delegation
- **New Knowledge Topic**: "Delegating Coding Tasks to GitHub Copilot Agents"
- **Strategic AI-to-AI Handoff**: Comprehensive guide for creating effective Issues for Copilot Agent task delegation
- **BC-Specific Context Templates**: Object IDs, naming conventions, data models, validation rules
- **Layer Integration**: Extract standards from company/team layers for consistent code generation
- **Complete Issue Template**: Real-world example (Sales Priority Management) showing all context elements
- **Best Practices**: Front-load context, reference layers, provide examples, specify acceptance criteria

**What Alex Can Now Guide:**
- Crafting Issues with complete BC context (object IDs, field types, relationships)
- Extracting naming conventions from loaded company/team layers
- Incorporating data architecture standards from organizational knowledge
- Providing validation and error handling patterns from layer-based best practices
- Creating testable acceptance criteria for Copilot Agent deliverables

**Why This Matters:**
- GitHub Copilot Agents can't ask clarifying questions - all context must be in the Issue
- Company/team layer standards ensure generated code follows organizational patterns
- Complete upfront context reduces iteration cycles and improves code quality
- Enables effective AI-to-AI delegation while maintaining standards compliance

### ✨ Added - Git Layer Diagnostics (Advanced Users Only)
- **Optional Diagnostic Tools**: New `developer.enable_diagnostic_tools` config flag (default: false)
- **Reduces Token Overhead**: Diagnostic tools only load when explicitly enabled (saves ~1000 tokens per request)
- **Git Authentication Testing**: `diagnose_git_layer` tool for Azure DevOps PAT troubleshooting
- **Local Layer Diagnostics**: `diagnose_local_layer` tool for troubleshooting project override layers
- **Layer Validation**: `validate_layer_config` and `get_layer_diagnostics` for configuration debugging
- **Azure DevOps Support**: `test_azure_devops_pat` specifically for Azure DevOps authentication issues
- **Hot Reload**: `reload_layers` command to reload layers after config changes WITHOUT restarting MCP
- **Environment Variable**: Set `BC_CODE_INTEL_ENABLE_DIAGNOSTICS=true` to enable

**6 Diagnostic Tools Total:**
1. `diagnose_git_layer` - Comprehensive git auth & connectivity testing
2. `test_azure_devops_pat` - Azure DevOps PAT validation
3. `diagnose_local_layer` - Local layer path, permissions, and content validation
4. `get_layer_diagnostics` - Layer status and performance metrics
5. `validate_layer_config` - Configuration file validation (planned)
6. `reload_layers` - Reload layers after config changes (no restart needed!)

**Local Layer Diagnostics Features:**
- Path existence and accessibility checks
- Permission validation (read/write)
- Content discovery (markdown file counting)
- Subdirectory structure validation (domains/, topics/, overrides/)
- Sample markdown frontmatter validation
- Specific recommendations for each failure type

**Reload Layers Features:**
- Reload configuration file dynamically
- Refresh layer cache without MCP restart
- Reload specific layer or all layers
- Shows updated topic counts and load status
- Perfect for testing configuration changes iteratively

**To enable diagnostic tools:**
```yaml
# In bc-code-intel-config.yaml
developer:
  enable_diagnostic_tools: true
```

Or via environment variable:
```bash
export BC_CODE_INTEL_ENABLE_DIAGNOSTICS=true
```

This adds 2 specialized tools for Chris Config to diagnose git layer authentication issues without adding token overhead for users who don't use layers.

### 🔧 Fixed - macOS Startup Issues (Issue #18)
- **Platform Diagnostics**: Added comprehensive pre-initialization platform checks for macOS compatibility
- **Enhanced Error Logging**: Unhandled promise rejections and uncaught exceptions now log before exit
- **Path Validation**: Embedded knowledge directory validation with detailed error messages
- **Cross-Platform Glob**: Improved glob pattern handling for macOS/Linux path conventions
- **Diagnostic Output**: Early logging captures errors that occur before stdio transport initialization

## [1.4.4] - 2025-10-16

### 🐛 Bug Fixes - Issue #17: Token-Based Specialist Auto-Detection

#### Fixed - Specialist Discovery for Complex/Compound Queries
- **Token-Based Matching**: Implemented intelligent query tokenization for specialist discovery
  - Queries now split into individual keywords for matching (e.g., "review" matches "code-review")
  - Bidirectional partial matching: tokens match field substrings and vice versa
  - Short words (≤3 characters) filtered out for better precision
  - Applied across all specialist discovery services: `roleplay-engine.ts`, `multi-content-layer-service.ts`, `specialist-discovery.ts`

- **Improved Confidence Scoring**: Lowered threshold from 0.3 to 0.15
  - Specialists now match with fewer keyword hits (more permissive)
  - Still filters irrelevant results (e.g., "weather forecast" returns no BC specialists)
  - Granular scoring: 0.15 for primary expertise, 0.10 for secondary, 0.05 for domains

- **Enhanced Query Robustness**: 
  - Handles compound queries: "code review standards compliance naming conventions error handling"
  - Handles punctuation and special characters gracefully
  - Case-insensitive matching across all query variations
  - Very long queries (50+ words) work correctly

#### Fixed - Core Tools Now Work with Natural Language
- **`ask_bc_expert`**: No longer throws "No suitable specialist found" for compound queries
  - Previously: Required exact substring matches
  - Now: Token-based matching finds appropriate specialists for complex questions
  
- **`suggest_specialist`**: Returns relevant specialists with proper confidence scores
  - Previously: Empty results for multi-term queries
  - Now: Suggests Roger Reviewer, Dean Debug, Eva Errors correctly based on keywords

- **`get_specialist_advice`**: Auto-detection improved via better specialist discovery
  - Works seamlessly with natural language queries
  - Finds specialists even when query contains multiple domain-specific terms

#### Added - Comprehensive Integration Tests
- **`tests/integration/specialist-auto-detection.test.ts`**: 17 new integration tests (all passing)
  - Token-based matching validation (6 tests)
  - Confidence calculation validation (5 tests)
  - Edge cases and robustness (4 tests)
  - End-to-end integration (2 tests)
  - Validates exact scenarios from Issue #17 bug report

#### Impact
- **Usability**: AI agents can now use natural, compound questions with `ask_bc_expert`
- **Discovery**: Specialist suggestions work with multi-domain queries
- **Reliability**: No more "No suitable specialist found" errors for valid queries
- **GitHub Copilot**: Improved integration with natural language queries

### 🔧 Technical Changes
- Modified: `src/services/roleplay-engine.ts` - `calculateSpecialistConfidence()` now uses token matching
- Modified: `src/services/multi-content-layer-service.ts` - `matchesSpecialistQuery()` tokenizes queries
- Modified: `src/services/specialist-discovery.ts` - `analyzeSpecialistMatch()` implements token-based scoring
- Added: `tests/integration/specialist-auto-detection.test.ts` - 17 comprehensive tests

## [1.4.3] - 2025-10-15

### 🐛 Bug Fixes - Issue #16: Company Knowledge Layer Loading

#### Fixed - Critical `.includes()` Crashes
- **Specialist Discovery**: Fixed `Cannot read properties of undefined (reading 'includes')` errors when querying specialists with incomplete metadata
  - Added null safety checks in `specialist-discovery.ts` for `expertise.primary`, `expertise.secondary`, and `domains` arrays
  - Added null safety checks in `specialist-loader.ts` for `suggestSpecialist()` and `getSpecialistsByDomain()` methods
  - Added null safety check in `multi-content-layer-service.ts` for `supported_content_types` array
- **Company Layer Queries**: Company-specific knowledge now loads and surfaces correctly when using company context phrases
  - Domain content from company knowledge layers now properly retrieved via `searchTopics()`
  - Specialist queries no longer crash when company layer specialists have undefined metadata fields

#### Added - Comprehensive Integration Tests
- **Real Knowledge Validation**: Tests that validate actual knowledge loading (not mocks)
  - `tests/integration/real-knowledge-validation.test.ts` - Validates real specialists and topics load from embedded-knowledge
  - Tests edge cases with incomplete specialist metadata without crashing
  - Validates performance requirements with real data
- **Company Layer Loading**: Complete scenario testing for custom company knowledge
  - `tests/integration/company-layer-loading.test.ts` - 16 tests validating company knowledge layers
  - Creates sample company layer with custom domain topics and specialist overrides
  - Validates domain content surfaces when searched ("myPartner naming conventions" scenario)
  - Tests graceful degradation and error recovery with missing metadata

#### Impact
- Users can now successfully use company-specific knowledge layers without crashes
- Queries like "Using [company name] company standards, [question]" now work as intended
- Company domain knowledge (naming conventions, coding standards, etc.) properly loads and returns in search results

## [1.4.1] - 2025-09-30

### 🚀 New Feature - Self-Documenting Configuration

#### Added - Chris-Config Specialist Domain
- **Multi-Team Layer Configuration**: Comprehensive organizational setup guidance available through MCP tools
  - VS Code `mcp.json` integration examples with Windows/macOS compatibility
  - Git repository layer configuration for team and company knowledge sharing
  - Authentication setup (GitHub tokens, SSH keys) with troubleshooting guides
  - Real capabilities documentation vs. fantasy enterprise features
- **Knowledge Content Creation**: Complete authoring guide for custom BC knowledge
  - YAML frontmatter reference and markdown structure best practices
  - AL code example standards with compilable, realistic samples
  - Override configuration and merge strategies for layer system
  - Quality standards and development workflow guidance

#### Improved - Discoverability
- **Self-Documenting System**: Users can now discover configuration guidance through MCP tools themselves
  - Ask: "How do I set up multi-team knowledge layers?" → Gets embedded knowledge response
  - Ask: "How do I create custom BC knowledge content?" → Gets comprehensive authoring guide
  - Configuration help available via `find_bc_topics` searches for "configuration", "layers", "overrides"
- **Layer-Ready Documentation**: Configuration guides follow the same layer override system they document

#### Developer Experience
- **No External Dependencies**: Configuration guidance embedded in knowledge base, no wiki hunting required
- **Override-Ready Content**: Teams can customize configuration guides with company-specific instructions
- **Cross-Referenced**: Proper topic linking between configuration and content creation workflows

## [1.4.2] - 2025-10-01

## [1.3.2] - 2025-09-22

### 🔧 Major Discovery Improvements - Enhanced Specialist Discovery

#### Fixed - Specialist Discovery Core Issues
- **Name-First Matching Logic**: Queries like "Sam the BC specialist" now prioritize name extraction over content matching
- **Structured JSON Output**: Replaced markdown text with parseable JSON structure for reliable AI agent integration
- **Direct Name Resolution**: 95% confidence for direct name matches vs. previous weak content matching

#### Added - Complete Specialist Context
- **Full Specialist Roster**: Every discovery response includes complete `all_specialists` array with ID, title, and role
- **Match Type Classification**: Clear indicators for `name_match`, `content_match`, `keyword_match`
- **Enhanced Debugging**: Detailed match reasons and keywords for transparency

#### Improved - Developer Experience
- **Reliable Name Matching**: Fuzzy search now correctly identifies specialists by informal names
- **Structured Data Response**: AI agents can programmatically parse and use discovery results
- **Complete Context**: Full specialist roster available for informed decision-making

## [1.3.1] - 2025-09-22

### 🔧 Improvements - Enhanced Specialist Discovery & Safety

#### Fixed - Specialist Discovery UX
- **Specialist ID Output**: `discover_specialists` now includes specialist IDs in output for precise tool calls
- **Fuzzy Name Matching**: Added robust case-insensitive and partial name matching for specialist lookup
  - Support for informal names (e.g., 'Sam' → 'sam-coder', 'Alex' → 'alex-architect')
  - Handles case variations and common abbreviations
  - Applies to all specialist tools: `get_specialist_advice`, `handoff_to_specialist`, `bring_in_specialist`

#### Added - Platform-Level AL/BC Constraints
- **System-Level Safety Rails**: All specialist tools now enforce Business Central/AL platform constraints
- **Weaker Model Protection**: Tool descriptions include explicit AL/BC best practice guidance
- **Consistent Architecture**: Platform-level constraints without cluttering individual specialist personas

#### Improved - Developer Experience
- **Better Tool Discovery**: Agents can now reliably identify and use correct specialist IDs
- **Flexible Naming**: More natural specialist interactions with fuzzy matching
- **AL/BC Compliance**: All specialist responses automatically scoped for Business Central development

## [1.3.0] - 2025-09-20

### 🎯 Major Features - Enhanced Developer Workflows

#### Added - Comprehensive Workflow Prompts
- **New Workflow Prompts**: 5 new prompts covering complete developer lifecycle
  - `app_takeover` - Analyze and orient developer taking over unfamiliar BC app
  - `spec_analysis` - Requirements analysis and development readiness gating
  - `bug_investigation` - Context-aware debugging with call stack/repro support
  - `monolith_to_modules` - SOLID refactoring with dependency injection patterns
  - `data_flow_tracing` - Field/table dependency investigation across codeunits

#### Added - Universal MCP Discovery
- **External MCP Tool Discovery**: Automatic guidance for external AL/BC MCP servers
  - Object ID Ninja MCP server integration guidance
  - AL Dependency MCP server integration guidance
  - Future-proof support for any AL/BC specialized tooling
- **Enhanced Prompt Service**: All workflows now include external tool discovery guidance

#### Improved - Architecture
- **Dynamic Specialist Discovery**: Removed hard-coded specialist logic for extensibility
- **Workflow Type Mapping**: Added new workflow types for enhanced prompt support
- **Complete Developer Coverage**: From requirements → support with specialized prompts

### 🔧 Technical Improvements
- Enhanced Enhanced Prompt Service with MCP discovery guidance
- Updated workflow orchestration for new prompt types
- Improved specialist consultation system extensibility

### 📚 Documentation
- Updated version references throughout documentation
- Enhanced README with new workflow capabilities
- Updated distribution guide for v1.3.0 features

## [1.2.0] - 2025-01-21

### 🎯 Major Features - Complete Specialist Bundle

#### Added - Specialist Discovery System
- **Smart Specialist Discovery Service**: Intelligent query analysis and specialist routing based on keywords, domains, and expertise matching
- **MCP Tools**: `discover_specialists`, `browse_specialists`, `get_specialist_info`
- **Fuzzy Search Integration**: Advanced matching algorithms for optimal specialist recommendations
- **Reasoning Engine**: Provides explanations for specialist suggestions with confidence scores

#### Added - Agent-Friendly Onboarding
- **Agent Onboarding Service**: Natural specialist team introduction optimized for coding agents
- **MCP Tools**: `introduce_bc_specialists`, `get_specialist_introduction`, `suggest_next_specialist`
- **Context-Aware Suggestions**: Intelligent next-step recommendations based on current work and project context
- **Automatic Invocation**: Agents naturally discover and engage specialists in BC/AL development contexts

#### Added - Seamless Specialist Handoffs
- **Specialist Handoff Service**: Context-preserving transitions between specialists with complete conversation history
- **MCP Tools**: `handoff_to_specialist`, `bring_in_specialist`, `get_handoff_summary`
- **Multiple Handoff Types**: Transfer (complete), consultation (temporary), collaboration (joint), escalation (senior expert)
- **Session Analytics**: Comprehensive handoff tracking and session summaries

#### Added - Enhanced Session Management
- **Persistent Sessions**: Long-running conversations with accumulated context, recommendations, and history
- **Context Preservation**: Full conversation history and problem context transfers seamlessly between specialists
- **Configurable Storage**: Layer-configurable session persistence (memory, file, database, MCP)
- **Session Analytics**: Rich session summaries, handoff patterns, and specialist engagement metrics

#### Added - Enhanced Prompt Integration
- **Enhanced Prompt Service**: Existing workflow prompts now include specialist routing and guidance
- **Strategic Specialist Routing**: MCP prompts naturally steer conversations toward appropriate specialists
- **Workflow Integration**: Seamless specialist engagement embedded in existing development workflows

### 🛠️ Technical Improvements

#### Enhanced - MCP Tool Suite
- **20+ MCP Tools**: Expanded from 16+ to comprehensive specialist consultation toolkit
- **Unified Tool Architecture**: Consistent error handling, validation, and response formatting across all tools
- **Tool Discovery**: Enhanced tool descriptions and parameters for better agent integration

#### Enhanced - Service Architecture
- **Multi-Content Layer Service**: Enhanced specialist loading and management with comprehensive validation
- **Layer System Integration**: Specialist definitions fully integrated with existing knowledge layer architecture
- **Service Orchestration**: Improved coordination between discovery, session management, and handoff services

#### Enhanced - Error Handling & Validation
- **Comprehensive Input Validation**: Zod schema validation for all specialist tools and services
- **Graceful Error Recovery**: Robust error handling with meaningful error messages for agents
- **Service Health Monitoring**: Enhanced service initialization and health checking

### 📚 Documentation

#### Added - Specialist Bundle Documentation
- **Complete Feature Guide**: Comprehensive documentation of all specialist bundle features and capabilities
- **MCP Tools Reference**: Detailed documentation for all 20+ MCP tools with examples
- **Integration Patterns**: Best practices for agent integration and specialist workflow patterns
- **Quick Start Guides**: Agent-focused getting started documentation

#### Enhanced - README & Distribution
- **Updated Main README**: Comprehensive v1.2.0 feature documentation with accurate tool and specialist counts
- **Distribution Documentation**: Enhanced installation and usage instructions for v1.2.0
- **Example Integration**: Complete integration examples for various coding agents and clients

### 🎭 Specialist Team

#### Confirmed - 14 BC Domain Experts
- **Core Development**: Alex Architect, Sam Coder, Dean Debug, Eva Errors
- **Quality & Security**: Quinn Tester, Roger Reviewer, Seth Security  
- **Integration & Architecture**: Jordan Bridge, Logan Legacy
- **User Experience & Business**: Uma UX, Morgan Market
- **Knowledge & Learning**: Taylor Docs, Maya Mentor, Casey Copilot

### 🧪 Testing & Validation

#### Added - Comprehensive Test Suite
- **Integration Tests**: Complete specialist bundle workflow testing
- **Service Unit Tests**: Individual service and tool validation
- **End-to-End Scenarios**: Real-world specialist consultation workflows
- **Performance Validation**: Response time and resource usage testing

### 🔧 Bug Fixes

#### Fixed - Production Issues
- **Layer Initialization**: Fixed `content_counts` null reference error in multi-content layer service
- **Startup Stability**: Improved error handling during embedded layer initialization
- **Memory Safety**: Enhanced null checking throughout the specialist loading process

### 🔧 Configuration & Extensibility

#### Enhanced - Layer System
- **Specialist Customization**: Support for local specialist overrides via `./bc-code-intel-overrides/`
- **Session Configuration**: Flexible session storage configuration through layer system
- **Enterprise Ready**: Foundation for company, team, and project-specific specialist customization

### 📊 Analytics & Monitoring

#### Added - Usage Analytics
- **Specialist Engagement Tracking**: Monitor which specialists are most frequently used
- **Handoff Pattern Analysis**: Understand common specialist transition flows
- **Session Duration Metrics**: Track conversation lengths and outcomes
- **Query Analysis**: Analyze common development challenges and routing patterns

### 🔄 Migration & Compatibility

#### Backward Compatibility
- **Existing Tool Support**: All existing MCP tools continue to work unchanged
- **Configuration Compatibility**: Existing layer configurations remain valid
- **Workflow Integration**: Specialist bundle enhances but does not replace existing workflows

#### Breaking Changes
- **None**: v1.2.0 is fully backward compatible with v1.1.x

### 🚀 Performance Improvements

#### Optimized - Service Performance
- **Lazy Loading**: Specialists and knowledge loaded on-demand for faster startup
- **Caching**: Intelligent caching of specialist metadata and discovery results
- **Memory Management**: Optimized memory usage for long-running sessions
- **Response Times**: All specialist tools respond in <100ms for optimal agent experience

### 🎯 Agent Integration

#### Enhanced - Coding Agent Support
- **Natural Discovery**: Agents automatically discover and engage specialists in BC contexts
- **Context Awareness**: Specialists receive full development context for relevant guidance
- **Seamless Workflows**: Agent-driven specialist consultation feels natural and conversational
- **Multi-Agent Support**: Multiple agents can collaborate through the specialist system

---

## [1.1.1] - Previous Release

### Added
- Initial specialist system foundation
- Basic workflow orchestration
- Layer-based knowledge architecture
- Core MCP tools for BC knowledge discovery

---

## Future Releases

### Planned for v1.3.0
- **Real-time Collaboration**: Live multi-specialist sessions
- **Advanced Analytics**: ML-powered usage insights and specialist optimization
- **Custom Workflows**: Specialist-specific development workflow templates
- **Enterprise Features**: Advanced team-based specialist customization and governance