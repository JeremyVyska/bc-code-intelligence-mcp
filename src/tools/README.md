# MCP Tools Directory

This directory contains **ALL** MCP tools exposed by the BC Code Intelligence server.

## Architecture: One Folder Per Tool

Each MCP tool has its own dedicated folder containing:
- `schema.ts` - Tool definition (name, description, input schema)
- `handler.ts` - Implementation logic (handler factory function)

## Directory Structure

```
src/tools/
├── _shared/                    # Shared constants and utilities
│   └── workspace-constants.ts  # Known MCP servers and tool signatures
├── advance_workflow/           # Advance workflow to next phase
├── analyze_al_code/            # Analyze AL code for patterns and issues
├── ask_bc_expert/              # Consult BC specialist personas
├── debug/                      # Debug/diagnostic tools (opt-in)
│   ├── diagnose_git_layer/     # Test Git-based layer connectivity
│   ├── diagnose_local_layer/   # Validate local layer structure
│   ├── get_layer_diagnostics/  # Get layer loading diagnostics
│   ├── reload_layers/          # Reload layer configuration
│   ├── test_azure_devops_pat/  # Test Azure DevOps PAT tokens
│   └── validate_layer_config/  # Validate layer configuration
├── find_bc_knowledge/          # Search topics, specialists, workflows
├── get_bc_topic/               # Get detailed topic content
├── get_workflow_help/          # Get workflow phase guidance
├── get_workspace_info/         # Get current workspace context
├── list_specialists/           # List all available specialists
├── set_workspace_info/         # Set workspace root and MCP ecosystem
├── start_bc_workflow/          # Start structured development workflow
├── handlers.ts                 # Centralized handler registry
├── index.ts                    # Tool exports and arrays
└── README.md                   # This file
```

## Tool Categories

### Core Knowledge Tools (8 tools)
Primary interface for BC development assistance:

1. **find_bc_knowledge** - Search BC knowledge topics, specialists, or workflows
2. **get_bc_topic** - Get detailed content for a specific BC topic
3. **ask_bc_expert** - Consult a BC specialist with automatic routing
4. **analyze_al_code** - Analyze AL code for patterns, issues, optimizations
5. **start_bc_workflow** - Start a structured development workflow
6. **advance_workflow** - Progress workflow to next phase
7. **get_workflow_help** - Get guidance for current workflow phase
8. **list_specialists** - List all available BC specialist personas

### Workspace Tools (2 tools)
Always available for workspace context management:

1. **set_workspace_info** - Set workspace root and available MCP servers
2. **get_workspace_info** - Get current workspace context

### Debug Tools (6 tools)
Opt-in diagnostic tools (enabled via `developer.enable_diagnostic_tools` config):

1. **diagnose_git_layer** - Test Git-based layer connectivity
2. **validate_layer_config** - Validate layer configuration
3. **test_azure_devops_pat** - Test Azure DevOps PAT token
4. **get_layer_diagnostics** - Get layer loading diagnostics
5. **diagnose_local_layer** - Validate local layer directory structure
6. **reload_layers** - Reload layer configuration and cache

## Removed Tools

The following tools were removed as they were never selected by agents:

### Discovery Tools (3 removed)
- ~~`discover_specialists`~~ → Use `list_specialists` instead
- ~~`browse_specialists`~~ → Use `list_specialists` instead
- ~~`get_specialist_info`~~ → Use `ask_bc_expert` instead

### Onboarding Tools (3 removed)
- ~~`introduce_bc_specialists`~~ → Never used
- ~~`get_specialist_introduction`~~ → Never used
- ~~`suggest_next_specialist`~~ → Never used

### Handoff Tools (3 removed)
- ~~`handoff_to_specialist`~~ → Never used
- ~~`bring_in_specialist`~~ → Never used
- ~~`get_handoff_summary`~~ → Never used

## Usage

### For AI Agents Working on This Codebase

**Finding All Tools**:
- Browse `src/tools/` directory - each folder is a tool
- Check `src/tools/index.ts` for exported tool arrays

**Finding a Specific Tool**:
```bash
# Tool name maps directly to folder name
cd src/tools/find_bc_knowledge/  # For find_bc_knowledge tool
cd src/tools/ask_bc_expert/      # For ask_bc_expert tool
```

**Adding New Tools**:

1. Create a new folder with the tool name (e.g., `my_new_tool/`)
2. Create `schema.ts` with tool definition:
```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const myNewTool: Tool = {
  name: 'my_new_tool',
  description: 'What this tool does...',
  inputSchema: {
    type: 'object',
    properties: {
      // Define parameters
    },
    required: ['param1']
  }
};
```

3. Create `handler.ts` with handler factory:
```typescript
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function createMyNewToolHandler(services: any) {
  return async function myNewTool(args: any): Promise<CallToolResult> {
    // Implementation
    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(result, null, 2)
      }]
    };
  };
}
```

4. Export from `src/tools/index.ts`:
```typescript
export { myNewTool } from './my_new_tool/schema.js';
import { myNewTool } from './my_new_tool/schema.js';
import { createMyNewToolHandler } from './my_new_tool/handler.js';

// Add to appropriate category array
export const coreKnowledgeTools: Tool[] = [
  // ...existing tools,
  myNewTool
];
```

5. Register handler in `src/tools/handlers.ts`:
```typescript
import { createMyNewToolHandler } from './my_new_tool/handler.js';

export function createToolHandlers(services: HandlerServices, workspaceContext: WorkspaceContext) {
  const handlers = new Map<string, ToolHandler>();

  // ...existing handlers
  handlers.set('my_new_tool', createMyNewToolHandler(services));

  return handlers;
}
```

### For Developers

**Discovering Available Tools**:
- List folders in `src/tools/` (excluding `_shared/` and `debug/`)
- Check `src/tools/index.ts` for categorized tool arrays

**Tool Documentation**:
- Each `schema.ts` contains the tool's description and input schema
- Each `handler.ts` contains implementation logic with comments

**Testing Tools**:
- Integration tests in `tests/integration/tools/`
- Contract validation: `npm run validate:contracts`

## Central Registry Files

### `index.ts`
Exports all tool schemas organized by category:
- `coreKnowledgeTools` - 8 primary tools
- `workspaceTools` - 2 workspace management tools
- `debugTools` - 6 opt-in diagnostic tools
- `allTools` - Core + workspace (always available)
- `allToolsWithDebug` - All tools including debug

Also exports tool name constants for type safety:
```typescript
import { TOOL_NAMES } from './tools/index.js';
const toolName = TOOL_NAMES.FIND_BC_KNOWLEDGE; // Type-safe
```

### `handlers.ts`
Centralized handler registry with two factory functions:

```typescript
// Create production tool handlers (10 tools)
const handlers = createToolHandlers(services, workspaceContext);

// Create debug tool handlers (6 tools - opt-in)
const debugHandlers = createDebugToolHandlers(services);
```

Uses dependency injection pattern - services are passed to handler factories:
```typescript
export interface HandlerServices {
  knowledgeService: any;
  codeAnalysisService: any;
  methodologyService: any;
  workflowService: any;
  layerService: any;
  sessionManager?: any;
  discoveryService?: any;
  configLoader?: any;
}
```

## Design Principles

1. **Direct Mapping**: Tool name → folder name (no guessing)
2. **Self-Contained**: Each tool folder contains everything related to that tool
3. **Discoverability**: Easy for both humans and AI to find tools
4. **Type Safety**: TypeScript throughout with strict literal types
5. **Clear Separation**: Schema (contract) separate from handler (implementation)
6. **Scalability**: Adding new tools is trivial - just create a new folder
7. **Clean History**: Changes to one tool don't pollute Git history of others

## Migration from Previous Architecture

This architecture replaces:
- ~~Class-based tool organization~~ → Individual handler factories
- ~~Grouped tool files~~ → One folder per tool
- ~~`streamlined-handlers.ts`~~ → `handlers.ts` with Map-based registry
- ~~Mixed tool/service code~~ → Clean separation

All tools migrated and verified:
- ✅ Build passes: `npm run build`
- ✅ Contracts validated: `npm run validate:contracts`
