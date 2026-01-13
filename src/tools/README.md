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
├── get_workspace_info/         # Get current workspace context
├── list_specialists/           # List all available specialists
├── set_workspace_info/         # Set workspace root and MCP ecosystem
├── workflow_batch/             # Apply batch operations to workflow
├── workflow_cancel/            # Cancel an active workflow
├── workflow_complete/          # Complete a workflow and generate report
├── workflow_list/              # List available workflows
├── workflow_next/              # Get next workflow action
├── workflow_progress/          # Report progress on workflow action
├── workflow_start/             # Start a new workflow session
├── workflow_status/            # Get workflow session status
├── handlers.ts                 # Centralized handler registry
├── index.ts                    # Tool exports and arrays
└── README.md                   # This file
```

## Tool Categories

### Core Knowledge Tools (5 tools)
Primary interface for BC development assistance:

1. **find_bc_knowledge** - Search BC knowledge topics, specialists, or workflows
2. **get_bc_topic** - Get detailed content for a specific BC topic
3. **ask_bc_expert** - Consult a BC specialist with automatic routing
4. **analyze_al_code** - Analyze AL code for patterns, issues, optimizations
5. **list_specialists** - List all available BC specialist personas

### Workflow Tools (8 tools)
Stateful workflow management with file-by-file processing:

1. **workflow_list** - List available workflows
2. **workflow_start** - Start a new workflow session
3. **workflow_next** - Get the next action in a workflow
4. **workflow_progress** - Report progress on a workflow action
5. **workflow_status** - Get workflow session status
6. **workflow_complete** - Complete a workflow and generate report
7. **workflow_batch** - Apply batch operations to a workflow
8. **workflow_cancel** - Cancel an active workflow

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

### VSCode Extension Tools (5 tools)
Support tools for VSCode extension integration:

1. **get_codelens_mappings** - Get CodeLens provider mappings
2. **validate_layer_repo** - Validate a knowledge layer repository
3. **scaffold_layer_repo** - Create a new knowledge layer repository
4. **create_layer_content** - Create content in a layer
5. **list_prompts** - List available MCP prompts

## Usage

### For AI Agents Working on This Codebase

**Finding All Tools**:
- Browse `src/tools/` directory - each folder is a tool
- Check `src/tools/index.ts` for exported tool arrays

**Finding a Specific Tool**:
```bash
# Tool name maps directly to folder name
cd src/tools/find_bc_knowledge/  # For find_bc_knowledge tool
cd src/tools/workflow_start/     # For workflow_start tool
```

**Adding New Tools**:

1. Create a new folder with the tool name (e.g., `my_new_tool/`)
2. Create `schema.ts` with tool definition
3. Create `handler.ts` with handler factory
4. Export from `src/tools/index.ts`
5. Register handler in `src/tools/handlers.ts`

## Central Registry Files

### `index.ts`
Exports all tool schemas organized by category:
- `coreKnowledgeTools` - 5 primary knowledge tools
- `workflowTools` - 8 workflow management tools
- `workspaceTools` - 2 workspace management tools
- `vscodeExtensionTools` - 5 VSCode extension tools
- `debugTools` - 6 opt-in diagnostic tools
- `allTools` - Core + workspace + workflow + vscode (always available)
- `allToolsWithDebug` - All tools including debug

### `handlers.ts`
Centralized handler registry with two factory functions:

```typescript
// Create production tool handlers
const handlers = createToolHandlers(services, workspaceContext);

// Create debug tool handlers (opt-in)
const debugHandlers = createDebugToolHandlers(services);
```

## Design Principles

1. **Direct Mapping**: Tool name → folder name (no guessing)
2. **Self-Contained**: Each tool folder contains everything related to that tool
3. **Discoverability**: Easy for both humans and AI to find tools
4. **Type Safety**: TypeScript throughout with strict literal types
5. **Clear Separation**: Schema (contract) separate from handler (implementation)
6. **Unified Naming**: All workflow tools use `workflow_*` prefix
