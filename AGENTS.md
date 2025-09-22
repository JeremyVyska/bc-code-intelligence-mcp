# AGENTS.md - Repository Context for AI Assistants

## Repository Purpose
This is the **MCP server implementation** for the BC Code Intelligence (bc-code-intel) system.

## What This Repo Contains
- **TypeScript MCP Server**: Full Model Context Protocol implementation
- **Layer Resolution System**: Multi-source knowledge with intelligent override system
- **MCP Tools**: 20+ tools providing BC knowledge access, specialist discovery, and handoff management
- **Service Architecture**: Modular services for knowledge, methodologies, code analysis, and specialist management
- **Build System**: Complete TypeScript build pipeline with testing

## What This Repo Does NOT Contain
- **Knowledge Content**: Actual BC knowledge is in bc-code-intelligence repo (linked via submodule)
- **Markdown Files**: No knowledge content directly in this repository
- **Domain Expertise**: Business logic focuses on layer resolution, not BC domain knowledge

## Repository Structure
```
src/
├── layers/                 # Layer resolution system
│   ├── layer-service.ts   # Core layer management and resolution
│   ├── embedded-layer.ts  # Reads from embedded-knowledge/ submodule
│   ├── project-layer.ts   # Local ./bc-code-intel-overrides/ detection
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

embedded-knowledge/        # Git submodule → bc-code-intelligence
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

## GitHub Copilot Coding Agent Guidelines

### TypeScript Development Patterns
- **Strict Mode**: All code must pass TypeScript strict mode compilation
- **Interface First**: Define interfaces before implementations in `types/`
- **Error Handling**: Use Result pattern for operations that can fail
- **Async/Await**: Prefer async/await over Promise chains
- **Null Safety**: Use optional chaining and nullish coalescing

### MCP Tool Implementation Patterns
When creating new MCP tools, follow this signature pattern:
```typescript
export async function toolName(
  args: ToolArgs,
  context: MCP.ServerContext
): Promise<MCP.CallToolResult> {
  try {
    // Validate input
    const validatedArgs = validateToolArgs(args);
    
    // Execute business logic
    const result = await serviceMethod(validatedArgs);
    
    // Return formatted response
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
}
```

### Layer Service Integration Patterns
- **Layer Resolution Order**: Embedded → Company → Team → Project
- **Cache Invalidation**: Clear caches when layer configuration changes
- **Override Detection**: Check local ./bc-code-intel-overrides/ before embedded knowledge
- **Version Filtering**: Apply BC version compatibility at query time
- **Error Propagation**: Layer failures should fallback to next layer

### Service Architecture Patterns
```typescript
// Service interface pattern
interface ServiceInterface {
  readonly layerService: LayerService;
  initialize(): Promise<void>;
  query(criteria: QueryCriteria): Promise<ServiceResult>;
  dispose(): void;
}

// Service implementation pattern
export class ConcreteService implements ServiceInterface {
  constructor(
    public readonly layerService: LayerService,
    private readonly config: ServiceConfig
  ) {}
}
```

### Testing Requirements
- **Unit Tests**: 100% coverage for service logic
- **Integration Tests**: Layer resolution scenarios
- **MCP Tests**: Tool invocation and response validation
- **Performance Tests**: Sub-100ms response time validation
- **Mock Patterns**: Use dependency injection for testability

### File Organization Rules
```
src/
├── layers/           # Layer system core - handle with extreme care
├── services/         # Business logic - main development area
├── types/           # TypeScript interfaces - define before implementing
├── tools/           # MCP tool definitions - follow signature patterns
└── utils/           # Shared utilities - pure functions only
```

### Build and Development Workflow
1. **Development**: `npm run dev` for watch mode with hot reload
2. **Type Checking**: `npm run type-check` before commits
3. **Testing**: `npm test` with coverage reporting
4. **Linting**: `npm run lint` with auto-fix where possible
5. **Building**: `npm run build` for production distribution

### Submodule Management
- **Updates**: Use `git submodule update --remote` carefully
- **Never Modify**: embedded-knowledge/ is read-only from this repo
- **Version Sync**: Keep submodule in sync with main repo releases
- **Testing**: Always test after submodule updates

### Performance Guidelines
- **Response Times**: All MCP tools must respond in <100ms
- **Memory Usage**: Implement proper cleanup in dispose methods
- **Caching**: Use intelligent caching with proper invalidation
- **Batch Operations**: Group related queries when possible
- **Lazy Loading**: Load layers and knowledge on-demand

### Common Anti-Patterns to Avoid
- ❌ **Knowledge in Server**: Never add knowledge content to this repo
- ❌ **Breaking MCP**: Don't change tool signatures without versioning
- ❌ **Layer Bypass**: Always use LayerService for knowledge access
- ❌ **Synchronous Operations**: Avoid blocking operations in tools
- ❌ **Direct File Access**: Use layer system instead of direct file reads
- ❌ **Memory Leaks**: Always implement proper cleanup and disposal
- ❌ **Version Proliferation**: Avoid scattering version numbers across documentation
- ❌ **File Proliferation**: Resist creating redundant/overlapping documentation files

## Hard-Learned Lessons

### Documentation Maintenance
- **Version-Agnostic Docs**: Keep version numbers ONLY in package.json and CHANGELOG.md
- **Single Source of Truth**: Avoid duplicating installation/feature info across multiple files
- **File Discipline**: Regularly audit and remove outdated/redundant documentation
- **Evergreen Content**: Write documentation that doesn't need version updates

### Repository Hygiene
- **Agent Oversight**: AI agents may create unwanted directories (like vscode-extension/) - regularly audit
- **Submodule Clarity**: Keep the boundary between MCP server and knowledge content crystal clear
- **Cleanup Discipline**: Delete temporary files, migration guides, and alpha docs when no longer needed

## Common Development Tasks
- Implementing new MCP tools for BC knowledge access
- Extending layer resolution system (git repos, HTTP sources, etc.)
- Adding BC version compatibility filtering
- Enhancing knowledge search and discovery algorithms
- Optimizing layer caching and performance

## GitHub Copilot Development Workflows

### New MCP Tool Creation Workflow
1. **Interface Definition**: Define tool interface in `types/mcp-types.ts`
2. **Tool Implementation**: Create tool function in `tools/` directory
3. **Service Integration**: Connect to appropriate service layer
4. **Validation Logic**: Add input validation and error handling
5. **Testing Suite**: Write unit and integration tests
6. **Registration**: Register tool in main MCP server configuration
7. **Documentation**: Update tool documentation and examples

### Layer System Extension Workflow
1. **Layer Interface**: Extend base layer interface if needed
2. **Implementation**: Create new layer service implementation
3. **Resolution Logic**: Update layer resolution order if required
4. **Caching Strategy**: Implement appropriate caching mechanisms
5. **Testing**: Comprehensive layer interaction testing
6. **Integration**: Wire into existing layer service architecture
7. **Configuration**: Add any new configuration options

### Service Enhancement Workflow
1. **Interface Updates**: Modify service interfaces first
2. **Implementation**: Update service implementations
3. **Layer Integration**: Ensure proper layer system usage
4. **Error Handling**: Comprehensive error scenarios
5. **Performance Testing**: Validate sub-100ms response times
6. **Integration Testing**: Test with real MCP client scenarios
7. **Documentation**: Update service documentation

### Quality Assurance Patterns
- **TypeScript First**: Always define types before implementation
- **Test-Driven**: Write tests alongside implementation
- **Performance Monitoring**: Continuous response time validation
- **MCP Compliance**: Verify protocol compatibility at each change
- **Layer Isolation**: Maintain clean separation between layers

## Integration Points
- **Knowledge Source**: embedded-knowledge/ submodule from bc-code-intelligence
- **Client Integration**: MCP protocol for AI development tools
- **Layer Sources**: Local overrides, git repos, HTTP endpoints (extensible)
