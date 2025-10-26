# Changelog

All notable changes to the BC Code Intelligence MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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