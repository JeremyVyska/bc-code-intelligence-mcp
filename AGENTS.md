# AGENTS.md - Repository Context for AI Assistants

## Repository Purpose
This is the **MCP server implementation** for the Business Central Knowledge Base (BCKB) system.

## What This Repo Contains
- **TypeScript MCP Server**: Full Model Context Protocol implementation
- **Layer Resolution System**: Multi-source knowledge with intelligent override system
- **MCP Tools**: 7+ tools providing BC knowledge access (find_bc_topics, get_bc_knowledge, etc.)
- **Service Architecture**: Modular services for knowledge, methodologies, code analysis
- **Build System**: Complete TypeScript build pipeline with testing

## What This Repo Does NOT Contain
- **Knowledge Content**: Actual BC knowledge is in bc-knowledgebase repo (linked via submodule)
- **Markdown Files**: No knowledge content directly in this repository
- **Domain Expertise**: Business logic focuses on layer resolution, not BC domain knowledge

## Repository Structure
```
src/
├── layers/                 # Layer resolution system
│   ├── layer-service.ts   # Core layer management and resolution
│   ├── embedded-layer.ts  # Reads from embedded-knowledge/ submodule
│   ├── project-layer.ts   # Local ./bckb-overrides/ detection
│   └── git-layer.ts       # Future: Git repository layers
├── services/              # MCP tools and business logic
│   ├── knowledge-service.ts    # Knowledge discovery and retrieval
│   ├── methodology-service.ts  # Workflow and systematic analysis
│   └── code-analysis-service.ts # BC code pattern analysis
├── types/                 # TypeScript interfaces and types
│   ├── bc-knowledge.ts    # Knowledge content interfaces
│   ├── layer-types.ts     # Layer system types
│   └── mcp-types.ts       # MCP protocol extensions
└── index.ts              # MCP server entry point

embedded-knowledge/        # Git submodule → bc-knowledgebase
package.json              # Dependencies and build scripts
tsconfig.json            # TypeScript configuration
```

## Architecture Principles
- **Clean Separation**: Server implementation vs knowledge content via submodule
- **Layer-Based Resolution**: Embedded → Company → Team → Project override system
- **Zero-Config Experience**: Works immediately with embedded knowledge via submodule
- **Extensible Design**: Foundation ready for enterprise customization layers
- **Version Awareness**: BC version compatibility filtering throughout
- **Protocol Compliance**: Full MCP specification implementation

## Key Technologies
- **Model Context Protocol (MCP)**: Primary interface for AI tool integration
- **TypeScript**: Strict typing throughout for reliability
- **Git Submodules**: Clean knowledge content integration
- **Fuse.js**: Intelligent knowledge search and discovery
- **YAML**: Frontmatter parsing for knowledge metadata

## AI Assistant Guidelines When Working With This Repo
1. **Code Quality**: Maintain TypeScript strict mode compliance
2. **MCP Compatibility**: Preserve protocol compatibility in all tool implementations
3. **Layer Architecture**: Respect layer resolution order and override logic
4. **Backward Compatibility**: Ensure existing MCP tools continue functioning
5. **Performance**: Maintain sub-100ms response times for knowledge queries
6. **Testing**: Comprehensive test coverage for all layer resolution scenarios
7. **NO Knowledge Content**: This repo contains no knowledge - it comes from submodule

## Common Development Tasks
- Implementing new MCP tools for BC knowledge access
- Extending layer resolution system (git repos, HTTP sources, etc.)
- Adding BC version compatibility filtering
- Enhancing knowledge search and discovery algorithms
- Optimizing layer caching and performance

## Integration Points
- **Knowledge Source**: embedded-knowledge/ submodule from bc-knowledgebase
- **Client Integration**: MCP protocol for AI development tools
- **Layer Sources**: Local overrides, git repos, HTTP endpoints (extensible)