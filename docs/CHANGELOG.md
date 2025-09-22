# Changelog

All notable changes to the BC Code Intelligence MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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