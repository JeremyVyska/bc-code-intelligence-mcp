# MCP Tools Directory

This directory contains **ALL** MCP tools exposed by the BC Code Intelligence server.

## Purpose

Before this consolidation, tools were scattered across multiple locations:
- `src/streamlined-tools.ts` - Core 8 tools
- `src/tools/specialist-tools.ts` - Specialist interaction
- `src/tools/specialist-discovery-tools.ts` - Discovery features
- `src/services/agent-onboarding-service.ts` - Onboarding (tools embedded in service)
- `src/services/specialist-handoff-service.ts` - Handoffs (tools embedded in service)

This made it difficult for developers and AI agents to discover and understand all available tools.

## Structure

### **index.ts** - Central Registry
- Single entry point for all tool definitions
- Exports all tool classes and definitions
- Provides `getAllToolDefinitions()` for MCP server registration
- Contains tool name constants for type safety

### Tool Categories

#### Core Tools (`core-tools.ts`)
The fundamental 8-tool interface:
1. `find_bc_knowledge` - Search BC knowledge, specialists, workflows
2. `ask_bc_expert` - Direct specialist consultation
3. `analyze_al_code` - Code analysis
4. `get_bc_topic` - Detailed topic content
5. `start_bc_workflow` - Structured workflows
6. `advance_workflow` - Progress workflows
7. `get_workflow_help` - Workflow guidance
8. `get_bc_help` - Meta-tool for suggestions

#### Specialist Tools (`specialist-tools.ts`)
Direct specialist interaction:
- `suggest_specialist` - Find appropriate specialist
- `get_specialist_advice` - Get specialist advice
- `list_specialists` - List available specialists

#### Discovery Tools (`specialist-discovery-tools.ts`)
Specialist discovery and browsing:
- `discover_specialists` - Find relevant specialists
- `browse_specialists` - Browse by category
- `get_specialist_info` - Detailed specialist information

#### Onboarding Tools (`onboarding-tools.ts`)
Natural specialist introduction for agents:
- `introduce_bc_specialists` - Agent-friendly specialist introduction
- `get_specialist_introduction` - Personalized introduction
- `suggest_next_specialist` - Proactive suggestions

#### Handoff Tools (`handoff-tools.ts`)
Seamless specialist transitions:
- `handoff_to_specialist` - Transfer or collaborate
- `bring_in_specialist` - Quick consultation
- `get_handoff_summary` - Context preservation

## Usage

### For AI Agents Working on This Codebase

**Finding All Tools**: Start at `src/tools/index.ts`

**Adding New Tools**:
1. Determine category (or create new file if needed)
2. Add tool definition to appropriate file
3. Export from `index.ts`
4. Add to `getAllToolDefinitions()` if it's a class-based tool
5. Update tool name constants

**Tool Implementation Pattern**:
```typescript
// Tool class with getToolDefinitions() and handleToolCall()
export class MyTools {
  getToolDefinitions(): Tool[] { ... }
  async handleToolCall(request: CallToolRequest): Promise<CallToolResult> { ... }
}

// Export from index.ts
export { MyTools } from './my-tools.js';

// Register in main index.ts
import { MyTools } from './tools/index.js';
this.myTools = new MyTools(dependencies);

// Add to getAllToolDefinitions
tools.push(...this.myTools.getToolDefinitions());
```

### For Developers

**Discovering Available Tools**: Check `src/tools/index.ts` for the complete list.

**Tool Documentation**: Each tool file contains detailed JSDoc comments explaining:
- What the tool does
- When to use it
- Input schema
- Return format
- Platform constraints (AL/BC limitations)

**Testing Tools**: Integration tests in `tests/integration/tools/`

## Design Principles

1. **Single Source of Truth**: All tool definitions in one discoverable location
2. **Category Organization**: Related tools grouped logically
3. **Type Safety**: TypeScript interfaces and constants throughout
4. **Clear Boundaries**: Tool definitions separate from service implementation
5. **Discoverability**: Easy for both humans and AI agents to find what they need

## Migration Notes

The old files are deprecated:
- ~~`src/streamlined-tools.ts`~~ → `src/tools/core-tools.ts`
- ~~`src/services/agent-onboarding-service.ts`~~ → `src/tools/onboarding-tools.ts` (tools extracted)
- ~~`src/services/specialist-handoff-service.ts`~~ → `src/tools/handoff-tools.ts` (tools extracted)

Services (`agent-onboarding-service.ts`, `specialist-handoff-service.ts`) will be refactored to contain only business logic, not tool definitions.
