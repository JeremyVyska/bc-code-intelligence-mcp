# Workflow Engine v2 - Specification

## Executive Summary

The Workflow Engine v2 is a **stateful checklist management system** that drives agents through systematic, file-by-file processing of large codebases. Unlike v1 (which was essentially static markdown checklists), v2 actively manages workflow state, expands checklists dynamically based on analysis results, and provides explicit "next action" instructions to agents.

**Core Principle**: The workflow drives the agent, not the other way around.

---

## Problem Statement

### Current Issues (v1)

1. **No File Enumeration**: Workflows don't start by building an inventory of files to process
2. **No Per-File Tracking**: No checklist that tracks progress across dozens/hundreds of files
3. **No State Management**: Agent can't ask "what's next?" or report "I finished X"
4. **No Topic Application**: When `suggested_topics` are returned, agent doesn't know it MUST fetch and apply them
5. **No Dynamic Expansion**: Checklist items are static, not generated from analysis results
6. **Agent Drift**: Without explicit next-action instructions, agents read 10 random files instead of systematically processing all files

### Observed Failure Mode

```
User: "Run a code review on this workspace"

Agent (v1 behavior):
1. Calls analyze_al_code with code="workspace"
2. Gets back suggested_topics list
3. STOPS - doesn't retrieve any topic content
4. Manually reads ~10 files at random
5. Provides superficial review missing 90% of files

Agent (v2 expected behavior):
1. Calls workflow_start with type="code-review"
2. Engine returns file inventory (47 .al files) + first action
3. For each file: analyze → expand checklist with relevant topics → apply topics → report progress
4. Continues until engine reports "workflow complete"
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         WORKFLOW ENGINE v2                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   Session    │    │   Checklist  │    │    Action    │               │
│  │   Manager    │───▶│   Manager    │───▶│   Dispatcher │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   Session    │    │  Per-File    │    │    Next      │               │
│  │    State     │    │  Checklists  │    │   Action     │               │
│  │   Storage    │    │   + Topics   │    │  Generator   │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │         MCP TOOLS             │
                    ├───────────────────────────────┤
                    │ • workflow_start              │
                    │ • workflow_next               │
                    │ • workflow_progress           │
                    │ • workflow_status             │
                    │ • workflow_complete           │
                    │ • workflow_batch              │
                    └───────────────────────────────┘
```

---

## Core Concepts

### 1. Workflow Session

A workflow session is a stateful execution context that persists across multiple agent turns.

```typescript
interface WorkflowSession {
  id: string;                          // Unique session identifier
  workflow_type: string;               // "code-review", "proposal-review", etc.
  status: "initializing" | "in_progress" | "blocked" | "completed" | "failed";
  created_at: string;
  updated_at: string;

  // File inventory
  file_inventory: FileEntry[];
  file_glob_pattern: string;           // e.g., "**/*.al" for code-review

  // Progress tracking
  current_phase: string;
  current_file_index: number;
  files_completed: number;
  files_total: number;

  // Results accumulator
  findings: Finding[];
  proposed_changes: ProposedChange[];

  // Configuration
  options: WorkflowOptions;
}

interface FileEntry {
  path: string;
  status: "pending" | "in_progress" | "completed" | "skipped" | "blocked";
  checklist: ChecklistItem[];
  findings: Finding[];
  proposed_changes: ProposedChange[];
}

interface ChecklistItem {
  id: string;
  type: "analysis" | "topic_application" | "pattern_instance" | "validation" | "custom";
  description: string;
  status: "pending" | "in_progress" | "completed" | "skipped" | "failed";

  // For topic_application type
  topic_id?: string;
  topic_relevance_score?: number;

  // For pattern_instance type (individual occurrences within a file)
  pattern_match?: {
    pattern_id: string;              // e.g., "error-call", "missing-tooltip"
    line_number: number;
    column?: number;
    end_line?: number;               // For multi-line matches
    match_text: string;              // The actual code that matched
    match_context?: string;          // Surrounding lines for context
    instance_type?: string;          // Sub-classification (e.g., "literal", "text_constant", "strsubstno")
    suggested_replacement?: string;  // Pre-computed fix if deterministic
    requires_manual_review?: boolean; // True if conversion needs human judgment
  };

  // Results
  result?: any;
  error?: string;
}
```

### 2. Workflow Definition

Each workflow type defines its behavior:

```typescript
interface WorkflowDefinition {
  type: string;                        // "code-review", "proposal-review"
  name: string;
  description: string;

  // File discovery
  file_patterns: string[];             // ["**/*.al"] or ["docs/**/*.md"]
  file_exclusions?: string[];          // ["**/test/**", "**/node_modules/**"]

  // Phases
  phases: WorkflowPhase[];

  // Per-file checklist template
  per_file_checklist: ChecklistTemplate[];

  // Topic integration
  topic_discovery: {
    enabled: boolean;
    tool: string;                      // "analyze_al_code" or "retrieve_bc_knowledge"
    auto_expand_checklist: boolean;    // Add discovered topics as checklist items
    min_relevance_score: number;       // 0.0-1.0, topics below this are skipped
  };

  // Pattern discovery (for migration/transformation workflows)
  pattern_discovery?: {
    enabled: boolean;
    patterns: PatternDefinition[];
    create_instance_items: boolean;    // Each match becomes a checklist item
    group_identical: boolean;          // Group identical matches for batch operations
    specialist?: string;               // Specialist to consult for this pattern type
  };

  // Completion criteria
  completion_rules: {
    require_all_files: boolean;
    require_all_checklist_items: boolean;
    allow_skip_with_reason: boolean;
  };
}

interface WorkflowPhase {
  id: string;
  name: string;
  description: string;
  required: boolean;

  // Gate conditions to enter this phase
  entry_conditions?: string[];

  // Actions available in this phase
  available_actions: string[];
}

interface ChecklistTemplate {
  id: string;
  type: "analysis" | "topic_application" | "pattern_instance" | "validation" | "custom";
  description: string;
  required: boolean;

  // Conditions for when this item applies
  conditions?: {
    file_pattern?: string;             // Only for files matching this pattern
    content_pattern?: string;          // Only if file contains this regex
    phase?: string;                    // Only in this phase
  };
}

interface PatternDefinition {
  id: string;                          // e.g., "error-call", "missing-tooltip"
  name: string;                        // Human-readable name
  description: string;                 // What this pattern detects

  // Detection
  regex: string;                       // Pattern to find matches
  regex_flags?: string;                // e.g., "gi" for global, case-insensitive
  exclude_regex?: string;              // Don't match if this also matches (e.g., exclude ErrorInfo)
  context_lines?: number;              // Lines of context to capture (default: 2)

  // Classification
  instance_classifier?: {
    // Sub-classify matches based on content
    rules: Array<{
      name: string;                    // e.g., "literal", "text_constant", "strsubstno"
      pattern: string;                 // Regex to identify this subtype
      suggested_action: string;        // What to do for this subtype
      auto_fixable: boolean;           // Can this be fixed automatically?
    }>;
  };

  // Transformation
  transformations?: Array<{
    instance_type: string;             // Which instance_type this applies to
    template: string;                  // Replacement template with {{placeholders}}
    requires_review: boolean;          // Does this need human verification?
  }>;

  // Specialist guidance
  specialist?: string;                 // Which specialist to consult
  topic_id?: string;                   // Related knowledge topic
}
```

### 3. Dynamic Checklist Expansion

There are two types of checklist expansion:

#### Topic-Based Expansion

When analysis tools return `suggested_topics`, the engine automatically expands the checklist:

```
BEFORE ANALYSIS:
┌─────────────────────────────────────────────┐
│ CustomerMgt.Codeunit.al                     │
│ ├── [ ] Run analyze_al_code                 │
│ └── [ ] Review complete                     │
└─────────────────────────────────────────────┘

AFTER analyze_al_code returns suggested_topics:
┌─────────────────────────────────────────────┐
│ CustomerMgt.Codeunit.al                     │
│ ├── [x] Run analyze_al_code                 │
│ ├── [ ] Apply topic: setloadfields-optimization (relevance: 0.95) │
│ ├── [ ] Apply topic: sift-patterns (relevance: 0.87)              │
│ ├── [ ] Apply topic: error-handling-patterns (relevance: 0.72)    │
│ └── [ ] Review complete                     │
└─────────────────────────────────────────────┘
```

#### Pattern-Based Expansion (Instance-Level Tracking)

For migration/transformation workflows, the engine scans files for pattern matches and creates **instance-level checklist items** for each occurrence:

```
AFTER pattern scan for Error() calls:
┌─────────────────────────────────────────────────────────────────────────────┐
│ CustomerMgt.Codeunit.al (7 instances)                                       │
│ ├── [x] Scan for Error() patterns                                           │
│ ├── [ ] Line 45: Error('Customer %1 not found', CustomerNo)                 │
│ │       Type: strsubstno │ Auto-fixable: Yes                                │
│ ├── [ ] Line 89: Error('Invalid date range')                                │
│ │       Type: literal │ Auto-fixable: Yes                                   │
│ ├── [ ] Line 134: Error(Text001)                                            │
│ │       Type: text_constant │ Auto-fixable: Needs review                    │
│ ├── [ ] Line 201: Error('Amount must be positive')                          │
│ │       Type: literal │ Auto-fixable: Yes                                   │
│ ├── [ ] Line 267: Error(StrSubstNo(Text002, Customer.Name, Amount))         │
│ │       Type: strsubstno_with_constant │ Auto-fixable: Needs review         │
│ ├── [ ] Line 312: Error(GetErrorMessage())                                  │
│ │       Type: function_call │ Auto-fixable: No - manual conversion          │
│ ├── [ ] Line 389: Error(GetLastErrorText())                                 │
│ │       Type: system_function │ Auto-fixable: No - requires analysis        │
│ └── [ ] Review complete                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Differences from Topic Expansion:**

| Aspect | Topic Expansion | Pattern Expansion |
|--------|-----------------|-------------------|
| Granularity | File-level | Instance-level (line-specific) |
| Source | Analysis tool suggestions | Regex pattern matching |
| Count | Usually 2-5 topics per file | Could be 0-100+ instances per file |
| Action | Apply knowledge guidance | Transform specific code |
| Auto-fix | Rarely | Often (for simple patterns) |

### 4. Batch Operations

When dealing with thousands of pattern instances, the engine supports batch operations:

```
WORKFLOW SUMMARY - Error to ErrorInfo Migration
┌─────────────────────────────────────────────────────────────────────────────┐
│ Total Files: 847                                                            │
│ Total Instances: 2,341                                                      │
│                                                                             │
│ By Instance Type:                                                           │
│ ├── literal (1,245) ─────────────── 53% │ Auto-fixable                     │
│ ├── strsubstno (634) ────────────── 27% │ Auto-fixable                     │
│ ├── text_constant (312) ─────────── 13% │ Needs review                     │
│ ├── function_call (98) ──────────── 4%  │ Manual conversion                │
│ └── other (52) ──────────────────── 2%  │ Manual conversion                │
│                                                                             │
│ Batch Actions Available:                                                    │
│ ├── [Apply all auto-fixable] ──── 1,879 instances                          │
│ ├── [Review text_constants] ───── 312 instances                            │
│ └── [Flag for manual review] ──── 150 instances                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Batch Operation Commands:**

```typescript
interface BatchOperation {
  operation: "apply_all" | "skip_all" | "flag_for_review";
  filter: {
    instance_type?: string[];          // Only these types
    file_pattern?: string;             // Only files matching pattern
    auto_fixable?: boolean;            // Only auto-fixable instances
  };
  confirmation_required: boolean;       // Prompt user before applying
}
```

### 5. Server-Side Autonomous Processing

**Critical Design Principle**: The workflow engine MUST perform bulk analysis work internally, not through agent round-trips.

#### The Token-Burning Problem

If the agent had to orchestrate file-by-file analysis:

```
BAD: Agent-Driven Analysis (burns context tokens)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Turn 1:  Agent calls workflow_start() → Engine returns "analyze file 1"    │
│ Turn 2:  Agent reads file 1, calls analyze_al_code → returns to agent      │
│ Turn 3:  Agent reports progress, gets "analyze file 2"                      │
│ Turn 4:  Agent reads file 2, calls analyze_al_code → returns to agent      │
│ ...                                                                         │
│ Turn 200: Finally done with 100 files                                       │
│                                                                             │
│ PROBLEM: Each file's content flows through the context window              │
│ - 100 files × ~500 lines avg = 50,000 lines of code in context             │
│ - Massive token consumption                                                 │
│ - Context window exhausted before completion                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### The Solution: Engine-Internal Processing

```
GOOD: Server-Side Analysis (minimal token usage)
┌─────────────────────────────────────────────────────────────────────────────┐
│ Turn 1:  Agent calls workflow_start()                                       │
│          → Engine INTERNALLY scans all 100 files                            │
│          → Engine INTERNALLY runs pattern matching                          │
│          → Engine INTERNALLY categorizes findings                           │
│          → Returns: Summary + first decision point                          │
│                                                                             │
│ Turn 2:  Agent presents batch options to user                               │
│          User: "Apply auto-fixes"                                           │
│                                                                             │
│ Turn 3:  Agent calls workflow_batch(apply_fixes, auto_fixable=true)         │
│          → Engine INTERNALLY applies 1,879 fixes                            │
│          → Returns: Summary + remaining manual items                        │
│                                                                             │
│ Turns 4-20: Agent handles only the 150 complex cases requiring judgment    │
│                                                                             │
│ BENEFIT: Only ~150 code snippets flow through context, not 100 full files  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Execution Modes

The workflow engine supports three execution modes per phase:

```typescript
interface PhaseExecutionMode {
  mode: "autonomous" | "guided" | "agent_driven";

  // autonomous: Engine does all work internally, returns summary
  // guided: Engine provides next action, agent executes, reports back
  // agent_driven: Agent controls execution flow (legacy behavior)
}
```

**Phase Mode Recommendations:**

| Phase Type | Mode | Rationale |
|------------|------|-----------|
| File inventory | `autonomous` | Simple glob, no agent input needed |
| Pattern scanning | `autonomous` | Regex matching, engine handles internally |
| Impact analysis | `autonomous` | Aggregation of scan results |
| Batch auto-fix | `autonomous` | Deterministic transformations |
| Manual review | `guided` | Agent needs to see code, make judgments |
| Specialist consultation | `guided` | Agent may need to call specialists |
| Verification | `autonomous` | Compile checks, test runs |

#### workflow_start with Autonomous Analysis

When `workflow_start` is called, the engine can perform initial analysis before returning:

```typescript
interface WorkflowStartOptions {
  // ... existing options ...

  // NEW: Control how much work the engine does before returning
  initial_processing: {
    // Run autonomous phases before first response?
    run_autonomous_phases: boolean;    // default: true

    // For pattern-based workflows: scan all files for patterns?
    scan_all_patterns: boolean;        // default: true

    // Time limit for initial processing (ms)
    timeout_ms: number;                // default: 30000 (30 seconds)

    // For very large codebases: stream progress updates?
    stream_progress: boolean;          // default: false
  };
}
```

**Example: Error Migration with Autonomous Scanning**

```
Agent: workflow_start(
  workflow_type="error-to-errorinfo-migration",
  initial_processing={ run_autonomous_phases: true, scan_all_patterns: true }
)

Engine (internally, takes ~10 seconds):
  1. Enumerates 847 .al files
  2. Scans each file for Error() patterns (regex, not LLM)
  3. Classifies each instance (literal, strsubstno, text_constant, etc.)
  4. Computes batch operation options
  5. Prepares summary

Engine Returns (single response, not 847 turns):
{
  "session_id": "wf-error-migration-abc123",
  "status": "analysis_complete",

  "analysis_summary": {
    "files_scanned": 847,
    "files_with_matches": 623,
    "total_instances": 2341,
    "by_type": {
      "literal": { "count": 1245, "auto_fixable": true },
      "strsubstno": { "count": 634, "auto_fixable": true },
      "text_constant": { "count": 312, "auto_fixable": false, "needs": "review" },
      "function_call": { "count": 98, "auto_fixable": false, "needs": "manual" },
      "other": { "count": 52, "auto_fixable": false, "needs": "manual" }
    },
    "batch_options": [
      { "action": "apply_all_auto", "instances": 1879, "files": 623 },
      { "action": "review_text_constants", "instances": 312, "files": 156 },
      { "action": "flag_manual", "instances": 150, "files": 89 }
    ]
  },

  "next_action": {
    "type": "user_decision",
    "instruction": "Present the analysis summary to the user. Ask which approach they prefer: (1) Apply all 1,879 auto-fixes first, then review remaining, or (2) Review file-by-file.",
    "recommended": "apply_all_auto"
  }
}
```

**Key Point**: The agent never sees the 847 files during scanning. It only receives a summary and decision points.

#### Streaming Progress for Long Operations

For very large codebases (1000+ files), the engine can stream progress:

```typescript
// If stream_progress: true in initial_processing

// Engine sends progress updates during processing:
{
  "type": "progress_update",
  "phase": "pattern_scanning",
  "files_processed": 234,
  "files_total": 1247,
  "instances_found": 891,
  "estimated_remaining_seconds": 45
}

// Final response still contains full summary
```

#### What the Agent DOES Handle

Even with autonomous processing, the agent is still critical for:

1. **User Interaction**: Presenting options, getting decisions
2. **Complex Judgments**: Instances that can't be auto-fixed
3. **Specialist Routing**: Deciding when to consult specialists
4. **Context-Dependent Fixes**: Transformations that need surrounding code understanding
5. **Verification Review**: Reviewing compilation errors, test failures
6. **Final Report Presentation**: Summarizing results for the user

#### Implementation: Engine-Side Analysis

The engine performs these operations internally (not through agent):

```typescript
class WorkflowEngine {
  // Called during workflow_start or phase transitions
  private async runAutonomousPhase(session: WorkflowSession): Promise<void> {
    switch (session.current_phase) {
      case "inventory":
        // Engine directly uses glob to find files
        session.file_inventory = await this.enumerateFiles(session.file_glob_pattern);
        break;

      case "pattern_scan":
        // Engine directly reads and scans files
        for (const file of session.file_inventory) {
          const content = await fs.readFile(file.path, 'utf-8');
          const matches = this.scanPatterns(content, session.patterns);
          file.pattern_instances = matches;
          // Update aggregates
          session.total_instances += matches.length;
        }
        break;

      case "batch_auto":
        // Engine directly applies transformations
        const autoFixable = this.getAutoFixableInstances(session);
        for (const instance of autoFixable) {
          await this.applyTransformation(instance);
        }
        break;

      case "verification":
        // Engine runs compiler/tests
        const result = await this.runCompilation(session);
        session.verification_result = result;
        break;
    }
  }

  // Pattern scanning is pure regex - no LLM needed
  private scanPatterns(content: string, patterns: PatternDefinition[]): PatternInstance[] {
    const instances: PatternInstance[] = [];
    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex, pattern.regex_flags);
      let match;
      while ((match = regex.exec(content)) !== null) {
        instances.push({
          pattern_id: pattern.id,
          line_number: this.getLineNumber(content, match.index),
          match_text: match[0],
          instance_type: this.classifyInstance(match[0], pattern),
          auto_fixable: this.isAutoFixable(match[0], pattern)
        });
      }
    }
    return instances;
  }
}
```

#### Cost/Benefit Analysis

| Approach | 100 Files | 500 Files | 1000 Files |
|----------|-----------|-----------|------------|
| **Agent-Driven** | ~200 turns, 50K tokens | ~1000 turns, 250K tokens | ~2000 turns, 500K tokens |
| **Server-Side** | ~5 turns, 2K tokens | ~8 turns, 3K tokens | ~12 turns, 5K tokens |

The server-side approach reduces token usage by **~99%** for the analysis phase.

---

## MCP Tool Specifications

### Tool 1: `workflow_start`

Initialize a new workflow session.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "workflow_type": {
      "type": "string",
      "enum": ["code-review", "proposal-review", "performance-audit", "security-audit", "onboarding", "error-to-errorinfo-migration", "bc-version-upgrade"],
      "description": "Type of workflow to start"
    },
    "scope": {
      "type": "string",
      "enum": ["workspace", "directory", "files"],
      "description": "Scope of files to include",
      "default": "workspace"
    },
    "path": {
      "type": "string",
      "description": "Directory path (if scope=directory) or comma-separated file paths (if scope=files)"
    },
    "options": {
      "type": "object",
      "properties": {
        "bc_version": { "type": "string" },
        "include_patterns": { "type": "array", "items": { "type": "string" } },
        "exclude_patterns": { "type": "array", "items": { "type": "string" } },
        "max_files": { "type": "number", "description": "Limit number of files (for large workspaces)" },
        "priority_patterns": { "type": "array", "items": { "type": "string" }, "description": "Process files matching these patterns first" },

        "source_version": { "type": "string", "description": "For bc-version-upgrade: Starting BC version (e.g., 'BC21')" },
        "target_version": { "type": "string", "description": "For bc-version-upgrade: Target BC version (e.g., 'BC27')" }
      }
    },
    "initial_processing": {
      "type": "object",
      "description": "Control server-side autonomous processing before returning",
      "properties": {
        "run_autonomous_phases": {
          "type": "boolean",
          "description": "Run autonomous phases (inventory, scanning) before returning",
          "default": true
        },
        "scan_all_patterns": {
          "type": "boolean",
          "description": "For pattern-based workflows: scan all files for patterns server-side",
          "default": true
        },
        "timeout_ms": {
          "type": "number",
          "description": "Time limit for initial processing in milliseconds",
          "default": 30000
        },
        "stream_progress": {
          "type": "boolean",
          "description": "For large codebases: stream progress updates during processing",
          "default": false
        }
      }
    }
  },
  "required": ["workflow_type"]
}
```

**Output (with autonomous processing - pattern-based workflow):**

When `initial_processing.run_autonomous_phases` is true (default), the engine performs all scanning internally before returning:

```json
{
  "session_id": "wf-error-migration-2024-01-11-abc123",
  "workflow_type": "error-to-errorinfo-migration",
  "status": "analysis_complete",

  "autonomous_processing": {
    "completed": true,
    "phases_run": ["inventory", "pattern_scan", "classification"],
    "duration_ms": 8423
  },

  "file_inventory": {
    "total": 847,
    "with_matches": 623,
    "by_type": {
      "Codeunit": 312,
      "Page": 245,
      "Table": 89,
      "Report": 112,
      "Query": 89
    }
  },

  "analysis_summary": {
    "total_instances": 2341,
    "by_type": {
      "literal": { "count": 1245, "auto_fixable": true },
      "strsubstno": { "count": 634, "auto_fixable": true },
      "text_constant": { "count": 312, "auto_fixable": false, "needs": "review" },
      "function_call": { "count": 98, "auto_fixable": false, "needs": "manual" },
      "other": { "count": 52, "auto_fixable": false, "needs": "manual" }
    },
    "batch_options": [
      { "action": "apply_all_auto", "description": "Apply auto-fixes to literal and strsubstno patterns", "instances": 1879, "files": 623 },
      { "action": "review_text_constants", "description": "Review text constants requiring judgment", "instances": 312, "files": 156 },
      { "action": "flag_manual", "description": "Flag complex patterns for manual conversion", "instances": 150, "files": 89 }
    ]
  },

  "phases": [
    { "id": "inventory", "name": "File Inventory", "status": "completed", "mode": "autonomous" },
    { "id": "pattern_scan", "name": "Pattern Scan", "status": "completed", "mode": "autonomous" },
    { "id": "batch_auto", "name": "Batch Auto-Fix", "status": "pending", "mode": "autonomous" },
    { "id": "manual_review", "name": "Manual Review", "status": "pending", "mode": "guided" },
    { "id": "verification", "name": "Verification", "status": "pending", "mode": "autonomous" },
    { "id": "summary", "name": "Summary & Report", "status": "pending", "mode": "autonomous" }
  ],

  "next_action": {
    "type": "user_decision",
    "instruction": "Present the analysis summary to the user. 2,341 Error() calls found across 847 files. 1,879 are auto-fixable. Ask which approach they prefer.",
    "options": [
      { "id": "apply_auto_first", "label": "Apply 1,879 auto-fixes first (recommended)", "description": "Quickly fix simple patterns, then review complex ones" },
      { "id": "review_by_file", "label": "Review file-by-file", "description": "More control, but takes longer" },
      { "id": "review_by_type", "label": "Review by pattern type", "description": "Group similar patterns together" }
    ],
    "recommended": "apply_auto_first"
  },

  "agent_instructions": "Autonomous analysis complete. Present the summary to the user and ask for their preferred approach. Do NOT start processing files until user confirms approach."
}
```

**Output (code-review workflow - less autonomous):**

For code review, analysis requires LLM judgment, so less is done autonomously:

```json
{
  "session_id": "wf-code-review-2024-01-11-abc123",
  "workflow_type": "code-review",
  "status": "in_progress",

  "autonomous_processing": {
    "completed": true,
    "phases_run": ["inventory"],
    "duration_ms": 234
  },

  "file_inventory": {
    "total": 47,
    "by_type": {
      "Codeunit": 12,
      "Page": 18,
      "Table": 8,
      "Report": 5,
      "Query": 4
    },
    "files": [
      { "path": "src/CustomerMgt.Codeunit.al", "size": 4523, "priority": 1 },
      { "path": "src/SalesOrder.Page.al", "size": 8721, "priority": 2 }
    ]
  },

  "phases": [
    { "id": "inventory", "name": "File Inventory", "status": "completed", "mode": "autonomous" },
    { "id": "analysis", "name": "Code Analysis", "status": "in_progress", "mode": "guided" },
    { "id": "review", "name": "Detailed Review", "status": "pending", "mode": "guided" },
    { "id": "summary", "name": "Summary & Report", "status": "pending", "mode": "autonomous" }
  ],

  "next_action": {
    "action": "analyze_file",
    "file": "src/CustomerMgt.Codeunit.al",
    "instruction": "REQUIRED: Call analyze_al_code with the content of this file. The result will expand this file's checklist with relevant topics that MUST be applied.",
    "tool_call": {
      "tool": "analyze_al_code",
      "args": {
        "code": "{{file_content}}",
        "analysis_type": "comprehensive",
        "bc_version": "BC26",
        "suggest_workflows": true
      }
    }
  },

  "agent_instructions": "You have started a code-review workflow. You MUST follow the next_action instructions exactly. After each action, call workflow_progress to report results and get the next action. Do NOT skip files or actions. Do NOT proceed without calling workflow_progress."
}
```

---

### Tool 2: `workflow_next`

Get the next action to perform. Agent calls this when ready for next task.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "Workflow session ID"
    }
  },
  "required": ["session_id"]
}
```

**Output:**
```json
{
  "session_id": "wf-code-review-2024-01-11-abc123",
  "status": "in_progress",

  "progress": {
    "phase": "analysis",
    "files_completed": 3,
    "files_total": 47,
    "percent_complete": 6.4,
    "current_file": "src/SalesOrder.Page.al"
  },

  "current_file": {
    "path": "src/SalesOrder.Page.al",
    "status": "in_progress",
    "checklist": [
      { "id": "analyze", "description": "Run analyze_al_code", "status": "completed" },
      { "id": "topic-setloadfields", "description": "Apply topic: setloadfields-optimization", "status": "pending", "topic_id": "dean-debug/setloadfields-optimization" },
      { "id": "topic-page-performance", "description": "Apply topic: page-performance-patterns", "status": "pending", "topic_id": "dean-debug/page-performance-patterns" },
      { "id": "review-complete", "description": "Mark review complete", "status": "pending" }
    ]
  },

  "next_action": {
    "action": "apply_topic",
    "file": "src/SalesOrder.Page.al",
    "topic_id": "dean-debug/setloadfields-optimization",
    "instruction": "REQUIRED: Call retrieve_bc_knowledge to get the full content of this topic. Apply the guidance to the current file. Document any findings or proposed changes.",
    "tool_call": {
      "tool": "retrieve_bc_knowledge",
      "args": {
        "topic_id": "dean-debug/setloadfields-optimization",
        "include_related": false
      }
    }
  },

  "agent_instructions": "Apply the topic guidance to src/SalesOrder.Page.al. After reviewing, call workflow_progress with your findings. If you identify issues, include them in the findings array. If you want to propose code changes, include them in proposed_changes."
}
```

**When workflow is complete:**
```json
{
  "session_id": "wf-code-review-2024-01-11-abc123",
  "status": "ready_for_completion",

  "progress": {
    "phase": "summary",
    "files_completed": 47,
    "files_total": 47,
    "percent_complete": 100
  },

  "next_action": {
    "action": "complete_workflow",
    "instruction": "All files have been processed. Call workflow_complete to generate the final report.",
    "tool_call": {
      "tool": "workflow_complete",
      "args": {
        "session_id": "wf-code-review-2024-01-11-abc123",
        "generate_report": true
      }
    }
  }
}
```

---

### Tool 3: `workflow_progress`

Report progress on current action and get next action.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "Workflow session ID"
    },
    "completed_action": {
      "type": "object",
      "properties": {
        "action": { "type": "string" },
        "file": { "type": "string" },
        "checklist_item_id": { "type": "string" },
        "status": { "type": "string", "enum": ["completed", "skipped", "failed"] },
        "skip_reason": { "type": "string" },
        "error": { "type": "string" }
      },
      "required": ["action", "status"]
    },
    "findings": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "line": { "type": "number" },
          "severity": { "type": "string", "enum": ["info", "warning", "error", "critical"] },
          "category": { "type": "string" },
          "description": { "type": "string" },
          "suggestion": { "type": "string" },
          "related_topic": { "type": "string" }
        }
      },
      "description": "Issues or observations found during this action"
    },
    "proposed_changes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "file": { "type": "string" },
          "line_start": { "type": "number" },
          "line_end": { "type": "number" },
          "original_code": { "type": "string" },
          "proposed_code": { "type": "string" },
          "rationale": { "type": "string" },
          "impact": { "type": "string", "enum": ["low", "medium", "high"] },
          "auto_applicable": { "type": "boolean" }
        }
      },
      "description": "Code changes proposed during this action"
    },
    "expand_checklist": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "topic_id": { "type": "string" },
          "relevance_score": { "type": "number" },
          "description": { "type": "string" }
        }
      },
      "description": "Additional topics to add to current file's checklist (from analyze_al_code suggested_topics)"
    }
  },
  "required": ["session_id", "completed_action"]
}
```

**Output:**
Same as `workflow_next` - returns the next action to perform.

---

### Tool 4: `workflow_status`

Get current workflow status without advancing.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "Workflow session ID"
    },
    "include_all_files": {
      "type": "boolean",
      "description": "Include status of all files (can be large)",
      "default": false
    }
  },
  "required": ["session_id"]
}
```

**Output:**
```json
{
  "session_id": "wf-code-review-2024-01-11-abc123",
  "workflow_type": "code-review",
  "status": "in_progress",
  "created_at": "2024-01-11T10:30:00Z",
  "updated_at": "2024-01-11T11:15:00Z",

  "progress": {
    "phase": "analysis",
    "files_completed": 12,
    "files_total": 47,
    "files_in_progress": 1,
    "files_pending": 34,
    "percent_complete": 25.5
  },

  "summary": {
    "total_findings": 23,
    "findings_by_severity": {
      "critical": 2,
      "error": 5,
      "warning": 12,
      "info": 4
    },
    "total_proposed_changes": 8,
    "topics_applied": 31,
    "topics_pending": 45
  },

  "files": [
    {
      "path": "src/CustomerMgt.Codeunit.al",
      "status": "completed",
      "findings_count": 3,
      "proposed_changes_count": 2,
      "checklist_complete": true
    }
  ]
}
```

---

### Tool 5: `workflow_complete`

Complete the workflow and generate final report.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "Workflow session ID"
    },
    "generate_report": {
      "type": "boolean",
      "description": "Generate markdown summary report",
      "default": true
    },
    "apply_changes": {
      "type": "boolean",
      "description": "Apply all auto-applicable proposed changes",
      "default": false
    },
    "report_format": {
      "type": "string",
      "enum": ["markdown", "json", "html"],
      "default": "markdown"
    }
  },
  "required": ["session_id"]
}
```

**Output:**
```json
{
  "session_id": "wf-code-review-2024-01-11-abc123",
  "status": "completed",
  "completed_at": "2024-01-11T12:45:00Z",
  "duration_minutes": 135,

  "summary": {
    "files_reviewed": 47,
    "total_findings": 67,
    "findings_by_severity": {
      "critical": 2,
      "error": 12,
      "warning": 38,
      "info": 15
    },
    "proposed_changes": 24,
    "changes_applied": 0,
    "topics_applied": 89
  },

  "report": "# Code Review Report\n\n## Summary\n...",

  "top_issues": [
    {
      "file": "src/LegacyImport.Codeunit.al",
      "severity": "critical",
      "description": "Manual summation loop processing 50,000+ records without SIFT",
      "suggestion": "Replace with CalcSums using SIFT index"
    }
  ],

  "recommendations": [
    "Address 2 critical performance issues before deployment",
    "Review 12 error-level findings for data integrity risks",
    "Consider implementing SetLoadFields in 8 high-traffic codeunits"
  ]
}
```

---

### Tool 6: `workflow_batch`

Apply batch operations to multiple instances at once.

**Input Schema:**
```json
{
  "type": "object",
  "properties": {
    "session_id": {
      "type": "string",
      "description": "Workflow session ID"
    },
    "operation": {
      "type": "string",
      "enum": ["apply_fixes", "skip_instances", "flag_for_review", "group_by_type"],
      "description": "Batch operation to perform"
    },
    "filter": {
      "type": "object",
      "properties": {
        "instance_types": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Only instances of these types"
        },
        "file_patterns": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Only files matching these patterns"
        },
        "auto_fixable_only": {
          "type": "boolean",
          "description": "Only auto-fixable instances"
        },
        "status": {
          "type": "string",
          "enum": ["pending", "in_progress", "failed"],
          "description": "Only instances with this status"
        },
        "guide": {
          "type": "string",
          "description": "For bc-version-upgrade: Only instances from this conversion guide (e.g., 'bc24-no-series-conversion-guide')"
        },
        "version_step": {
          "type": "string",
          "description": "For bc-version-upgrade: Only instances from this version step (e.g., 'BC23-BC24')"
        }
      }
    },
    "dry_run": {
      "type": "boolean",
      "description": "Preview changes without applying",
      "default": true
    },
    "confirmation_token": {
      "type": "string",
      "description": "Token from dry_run to confirm actual execution"
    }
  },
  "required": ["session_id", "operation"]
}
```

**Output (dry_run=true):**
```json
{
  "session_id": "wf-error-migration-abc123",
  "operation": "apply_fixes",
  "dry_run": true,

  "preview": {
    "instances_affected": 1879,
    "files_affected": 623,
    "by_instance_type": {
      "literal": 1245,
      "strsubstno": 634
    }
  },

  "sample_changes": [
    {
      "file": "src/CustomerMgt.Codeunit.al",
      "line": 89,
      "before": "Error('Invalid date range');",
      "after": "Error(ErrorInfo.Create('Invalid date range'));"
    },
    {
      "file": "src/CustomerMgt.Codeunit.al",
      "line": 45,
      "before": "Error('Customer %1 not found', CustomerNo);",
      "after": "Error(ErrorInfo.Create(StrSubstNo('Customer %1 not found', CustomerNo)));"
    }
  ],

  "confirmation_required": true,
  "confirmation_token": "batch-abc123-1879-confirm",
  "confirmation_prompt": "This will modify 1,879 Error() calls across 623 files. Type 'confirm batch-abc123-1879-confirm' to proceed."
}
```

**Output (with confirmation_token):**
```json
{
  "session_id": "wf-error-migration-abc123",
  "operation": "apply_fixes",
  "dry_run": false,

  "result": {
    "instances_modified": 1876,
    "instances_failed": 3,
    "files_modified": 621,
    "files_failed": 2
  },

  "failures": [
    {
      "file": "src/Legacy.Codeunit.al",
      "line": 234,
      "error": "File is read-only"
    }
  ],

  "next_action": {
    "action": "review_remaining",
    "instruction": "1,876 instances converted. 462 instances remain (312 text_constants + 150 manual). Call workflow_next to process remaining items."
  }
}
```

---

## Workflow Definitions

### Code Review Workflow

```yaml
type: code-review
name: "Business Central Code Review"
description: "Systematic code review for AL extensions"

file_patterns:
  - "**/*.al"

file_exclusions:
  - "**/test/**"
  - "**/.altestrunner/**"
  - "**/node_modules/**"

phases:
  - id: inventory
    name: "File Inventory"
    description: "Enumerate all AL files in scope"
    required: true

  - id: analysis
    name: "Code Analysis"
    description: "Run analyze_al_code on each file, expand checklists"
    required: true
    available_actions:
      - analyze_file
      - expand_checklist

  - id: topic_application
    name: "Topic Application"
    description: "Apply relevant topics to each file"
    required: true
    available_actions:
      - apply_topic
      - record_finding
      - propose_change

  - id: summary
    name: "Summary & Report"
    description: "Generate final report"
    required: true

per_file_checklist:
  - id: analyze
    type: analysis
    description: "Run analyze_al_code"
    required: true

  - id: review_complete
    type: validation
    description: "Mark review complete"
    required: true

topic_discovery:
  enabled: true
  tool: "analyze_al_code"
  auto_expand_checklist: true
  min_relevance_score: 0.6

completion_rules:
  require_all_files: true
  require_all_checklist_items: true
  allow_skip_with_reason: true
```

### Error to ErrorInfo Migration Workflow

```yaml
type: error-to-errorinfo-migration
name: "Error to ErrorInfo Migration"
description: "Convert legacy Error() calls to modern ErrorInfo pattern"
specialist: eva-errors

file_patterns:
  - "**/*.al"

file_exclusions:
  - "**/test/**"
  - "**/.altestrunner/**"

phases:
  - id: inventory
    name: "File Inventory"
    description: "Enumerate all AL files"
    required: true

  - id: scan
    name: "Pattern Scan"
    description: "Scan all files for Error() patterns"
    required: true
    available_actions:
      - scan_file
      - expand_checklist_with_instances

  - id: batch_auto
    name: "Batch Auto-Fix"
    description: "Apply automatic fixes to simple patterns"
    required: false
    available_actions:
      - batch_apply
      - skip_batch

  - id: manual_review
    name: "Manual Review"
    description: "Review and convert complex patterns"
    required: true
    available_actions:
      - convert_instance
      - skip_instance
      - flag_for_later

  - id: verification
    name: "Verification"
    description: "Verify all conversions compile and work"
    required: true

  - id: summary
    name: "Summary & Report"
    required: true

per_file_checklist:
  - id: scan
    type: analysis
    description: "Scan for Error() patterns"
    required: true
    # After this, pattern_instance items are auto-added based on matches

  - id: review_complete
    type: validation
    description: "All Error() calls addressed"
    required: true

# Pattern discovery configuration
pattern_discovery:
  enabled: true
  patterns:
    - id: error-call
      name: "Error() Call"
      description: "Legacy Error() function calls that should use ErrorInfo"
      regex: "Error\\s*\\((?!\\s*ErrorInfo)[^)]+\\)"
      regex_flags: "gi"
      exclude_regex: "//.*Error|ErrorInfo\\.Create"  # Ignore comments and already-converted
      context_lines: 2

      instance_classifier:
        rules:
          - name: literal
            pattern: "Error\\s*\\(\\s*'[^']*'\\s*\\)"
            suggested_action: "Wrap string in ErrorInfo.Create()"
            auto_fixable: true

          - name: strsubstno
            pattern: "Error\\s*\\(\\s*'[^']*%[0-9]+[^']*'"
            suggested_action: "Convert to ErrorInfo.Create(StrSubstNo(...))"
            auto_fixable: true

          - name: text_constant
            pattern: "Error\\s*\\(\\s*[A-Z][A-Za-z0-9_]+\\s*\\)"
            suggested_action: "Review text constant, then wrap in ErrorInfo.Create()"
            auto_fixable: false

          - name: strsubstno_with_constant
            pattern: "Error\\s*\\(\\s*StrSubstNo\\s*\\(\\s*[A-Z]"
            suggested_action: "Review text constant usage in StrSubstNo"
            auto_fixable: false

          - name: function_call
            pattern: "Error\\s*\\(\\s*[A-Z][A-Za-z0-9_]+\\s*\\("
            suggested_action: "Analyze function return, may need ErrorInfo integration"
            auto_fixable: false

          - name: getlasterror
            pattern: "Error\\s*\\(\\s*GetLastErrorText"
            suggested_action: "Consider using ErrorInfo from original error source"
            auto_fixable: false

      transformations:
        - instance_type: literal
          template: "Error(ErrorInfo.Create({{original_string}}))"
          requires_review: false

        - instance_type: strsubstno
          template: "Error(ErrorInfo.Create(StrSubstNo({{original_string}}, {{params}})))"
          requires_review: false

        - instance_type: text_constant
          template: "Error(ErrorInfo.Create({{constant_name}}))"
          requires_review: true

      specialist: eva-errors
      topic_id: "eva-errors/errorinfo-migration-guide"

  create_instance_items: true
  group_identical: true  # Group identical error messages for batch review

topic_discovery:
  enabled: true
  tool: "retrieve_bc_knowledge"
  auto_expand_checklist: false  # Don't add topics, this is a focused migration
  min_relevance_score: 0.8

completion_rules:
  require_all_files: true
  require_all_checklist_items: true
  allow_skip_with_reason: true
```

### BC Version Upgrade Workflow

This workflow handles upgrading a codebase from one BC version to another, applying multiple conversion guides that may each have multiple patterns.

```yaml
type: bc-version-upgrade
name: "Business Central Version Upgrade"
description: "Upgrade codebase from one BC version to another, applying all relevant obsoletions and conversions"
specialist: logan-legacy

file_patterns:
  - "**/*.al"

file_exclusions:
  - "**/test/**"
  - "**/.altestrunner/**"

# Version upgrade specific configuration
version_upgrade:
  source_version: null           # Set at runtime, e.g., "BC21"
  target_version: null           # Set at runtime, e.g., "BC27"

  # Knowledge-driven conversion guides
  # Engine will search for all conversion guides between source and target
  conversion_guide_pattern: "bc{version}-*-conversion-guide"
  conversion_guide_tags: ["bc-migration", "breaking-changes", "conversion-guide"]

  # Ordering matters - apply in version sequence
  apply_in_sequence: true        # BC21→22, then BC22→23, etc.

  # Extract patterns from knowledge files
  extract_patterns_from_guides: true

phases:
  - id: inventory
    name: "File Inventory"
    description: "Enumerate all AL files"
    required: true

  - id: guide_discovery
    name: "Conversion Guide Discovery"
    description: "Find all applicable conversion guides for version range"
    required: true
    available_actions:
      - search_knowledge_base
      - load_conversion_guides
      - extract_patterns

  - id: analysis
    name: "Impact Analysis"
    description: "Scan all files against all patterns from all guides"
    required: true
    available_actions:
      - scan_file_multi_pattern
      - categorize_by_guide
      - prioritize_changes

  - id: guided_conversion
    name: "Guided Conversion"
    description: "Apply conversions guide-by-guide, pattern-by-pattern"
    required: true
    available_actions:
      - apply_guide
      - convert_instance
      - skip_with_reason
      - request_specialist_help

  - id: verification
    name: "Compilation & Verification"
    description: "Verify all conversions compile"
    required: true
    available_actions:
      - compile_check
      - run_tests

  - id: summary
    name: "Migration Report"
    required: true

per_file_checklist:
  - id: multi_pattern_scan
    type: analysis
    description: "Scan against all version upgrade patterns"
    required: true
    # Dynamically expands based on which patterns match

  - id: all_conversions_applied
    type: validation
    description: "All applicable conversions addressed"
    required: true

# Pattern discovery - KNOWLEDGE-DRIVEN
# Patterns are extracted from conversion guide topics, not hardcoded
pattern_discovery:
  enabled: true
  source: "knowledge_topics"           # Patterns come from knowledge files
  topic_pattern: "bc*-conversion-guide"

  # How to extract patterns from knowledge topics
  pattern_extraction:
    # Look for code blocks labeled as "search patterns" or "before" examples
    search_pattern_markers:
      - "Search Patterns"
      - "Code Discovery"
      - "Before (BC"

    # Extract transformation rules from before/after code blocks
    transformation_markers:
      - "Before"
      - "After"
      - "Legacy Method"
      - "New Method"

  create_instance_items: true
  group_by_guide: true                 # Group instances by which guide they came from

topic_discovery:
  enabled: true
  tool: "retrieve_bc_knowledge"
  auto_expand_checklist: true          # Load full guide content when needed
  min_relevance_score: 0.7

completion_rules:
  require_all_files: true
  require_all_checklist_items: true
  allow_skip_with_reason: true
```

### Version Upgrade - Guide Discovery Phase

The engine searches the knowledge base for applicable conversion guides:

```typescript
interface ConversionGuide {
  id: string;                          // e.g., "dean-debug/bc24-no-series-conversion-guide"
  title: string;
  source_version: string;              // "BC23"
  target_version: string;              // "BC24"

  // Patterns extracted from guide content
  patterns: ExtractedPattern[];

  // Method mappings from guide
  method_mappings: MethodMapping[];

  // Related topics for deeper guidance
  related_topics: string[];

  // Priority order for application
  priority: number;
}

interface ExtractedPattern {
  id: string;
  description: string;

  // Extracted from guide's "Search Patterns" section
  search_patterns: string[];           // ["NoSeriesMgt", "NoSeriesManagement", "InitSeries"]

  // Extracted from guide's before/after code blocks
  transformations: {
    before_pattern: string;            // Regex from "Before" code block
    after_template: string;            // Template from "After" code block
    requires_review: boolean;          // Complex transformations need review
  }[];

  // From guide metadata
  specialist: string;
  topic_id: string;                    // Full guide for detailed help
}

interface MethodMapping {
  legacy_method: string;               // "InitSeries()"
  new_method: string;                  // "GetNextNo()"
  conversion_notes: string;            // "Simplified parameters"
  auto_convertible: boolean;
}
```

### Version Upgrade - Analysis Output

After scanning, the engine produces a multi-dimensional view:

```
VERSION UPGRADE ANALYSIS: BC21 → BC27
┌─────────────────────────────────────────────────────────────────────────────┐
│ Files Scanned: 1,247                                                        │
│ Files with Required Changes: 423                                            │
│ Total Instances: 3,891                                                      │
│                                                                             │
│ BY VERSION STEP:                                                            │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ BC21 → BC22: 234 instances across 89 files                              │ │
│ │   ├── Page action property changes (156)                                │ │
│ │   └── Report layout changes (78)                                        │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ BC22 → BC23: 445 instances across 134 files                             │ │
│ │   ├── Permission set changes (312)                                      │ │
│ │   └── API version updates (133)                                         │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ BC23 → BC24: 1,567 instances across 287 files                           │ │
│ │   ├── No. Series conversion (892) ← HIGHEST IMPACT                      │ │
│ │   ├── Error handling updates (421)                                      │ │
│ │   └── Table relation changes (254)                                      │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ BC24 → BC25: 312 instances across 67 files                              │ │
│ │   └── Telemetry method changes (312)                                    │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ BC25 → BC26: 567 instances across 145 files                             │ │
│ │   ├── HttpClient changes (234)                                          │ │
│ │   └── JSON handling updates (333)                                       │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ BC26 → BC27: 766 instances across 198 files                             │ │
│ │   ├── Copilot integration points (445)                                  │ │
│ │   └── New page types (321)                                              │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ RECOMMENDED APPROACH:                                                       │
│ 1. Start with BC23→BC24 (highest impact, blocking for later versions)      │
│ 2. Apply auto-fixable patterns first (2,134 instances)                     │
│ 3. Review complex conversions with specialist help (1,757 instances)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Version Upgrade - Per-File Checklist

Each file gets checklist items organized by conversion guide:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ SalesPost.Codeunit.al                                                       │
│ Applicable Guides: BC23→24, BC24→25, BC26→27                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [BC23 → BC24] No. Series Conversion Guide                                   │
│ ├── [x] Scanned for patterns                                               │
│ ├── [ ] Line 45: NoSeriesMgt.InitSeries(...)                               │
│ │       → Convert to: NoSeries.GetNextNo(...)                              │
│ │       Guide: bc24-no-series-conversion-guide#initseries-conversion       │
│ ├── [ ] Line 89: NoSeriesMgt.GetNextNo(..., false)                         │
│ │       → Convert to: NoSeries.PeekNextNo(...)                             │
│ ├── [ ] Line 134: NoSeriesMgt.GetNextNo(..., true)                         │
│ │       → Convert to: NoSeries.GetNextNo(...)                              │
│ └── [ ] Line 201: EventSubscriber on NoSeriesManagement                    │
│         → MANUAL: Redesign using direct method calls (see guide)           │
│                                                                             │
│ [BC24 → BC25] Telemetry Conversion Guide                                    │
│ ├── [x] Scanned for patterns                                               │
│ └── [ ] Line 312: Session.LogMessage(...)                                  │
│         → Convert to: Telemetry.LogMessage(...)                            │
│                                                                             │
│ [BC26 → BC27] Copilot Integration Guide                                     │
│ ├── [x] Scanned for patterns                                               │
│ └── [ ] Line 445: No matches (file doesn't use affected patterns)          │
│                                                                             │
│ [ ] All conversions complete                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Version Upgrade - Workflow Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TURN 1: User Request                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ User: "Upgrade this codebase from BC21 to BC27"                             │
│                                                                              │
│ Agent: Calls workflow_start(                                                │
│   workflow_type="bc-version-upgrade",                                       │
│   options={ source_version: "BC21", target_version: "BC27" }                │
│ )                                                                           │
│                                                                              │
│ Engine: Searches knowledge base for conversion guides                        │
│   Found: 6 guides (BC21→22, BC22→23, BC23→24, BC24→25, BC25→26, BC26→27)   │
│   Extracting patterns from each guide...                                    │
│                                                                              │
│ Engine Returns:                                                              │
│   - session_id: "wf-upgrade-bc21-bc27-xyz"                                  │
│   - conversion_guides: [6 guides with extracted patterns]                   │
│   - file_inventory: 1,247 files                                             │
│   - next_action: "Begin impact analysis scan"                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TURNS 2-30: Impact Analysis                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Engine scans ALL files against ALL patterns from ALL guides                 │
│                                                                              │
│ For each file:                                                              │
│   - Apply patterns from BC21→22 guide                                       │
│   - Apply patterns from BC22→23 guide                                       │
│   - Apply patterns from BC23→24 guide (most matches expected)               │
│   - Apply patterns from BC24→25 guide                                       │
│   - Apply patterns from BC25→26 guide                                       │
│   - Apply patterns from BC26→27 guide                                       │
│                                                                              │
│ Engine builds comprehensive checklist per file                              │
│                                                                              │
│ After scan complete, Engine Returns:                                        │
│   - Impact analysis summary (shown above)                                   │
│   - Recommended conversion order                                            │
│   - Batch operation options                                                 │
│   - next_action: "Choose conversion approach"                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ TURNS 31+: Guided Conversion (by version step)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ User: "Start with BC23→24 as recommended"                                   │
│                                                                              │
│ Agent: Calls workflow_batch(                                                │
│   filter={ guide: "bc24-no-series-conversion-guide", auto_fixable: true }  │
│ )                                                                           │
│                                                                              │
│ Engine: Applies 634 auto-fixable No. Series conversions                     │
│                                                                              │
│ For remaining complex conversions:                                          │
│   - Engine provides specific guidance from the conversion guide             │
│   - Loads relevant sections (e.g., "Event Migration Strategy")              │
│   - Suggests specialist consultation when needed                            │
│                                                                              │
│ Example next_action for complex instance:                                   │
│   - file: "src/SalesPost.Codeunit.al"                                       │
│   - line: 201                                                               │
│   - pattern: "EventSubscriber on NoSeriesManagement"                        │
│   - guide_section: "Step 4: Event Migration Strategy"                       │
│   - guide_content: [Loaded from bc24-no-series-conversion-guide]            │
│   - specialist: "logan-legacy"                                              │
│   - instruction: "This event subscription has no direct replacement.        │
│       Read the guide section for alternative approaches. Consider           │
│       consulting Logan for complex event-driven logic redesign."            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FINAL: Migration Report                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Engine generates comprehensive report:                                       │
│                                                                              │
│ # BC21 → BC27 Migration Report                                              │
│                                                                              │
│ ## Summary                                                                  │
│ - Files processed: 1,247                                                    │
│ - Total conversions: 3,891                                                  │
│ - Auto-applied: 2,134                                                       │
│ - Manually reviewed: 1,714                                                  │
│ - Skipped (with reasons): 43                                                │
│                                                                              │
│ ## By Version Step                                                          │
│ | Step | Instances | Auto | Manual | Skipped |                              │
│ |------|-----------|------|--------|---------|                              │
│ | BC21→22 | 234 | 198 | 36 | 0 |                                            │
│ | BC22→23 | 445 | 312 | 133 | 0 |                                           │
│ | BC23→24 | 1,567 | 892 | 632 | 43 |                                        │
│ | ... | ... | ... | ... | ... |                                              │
│                                                                              │
│ ## Action Items                                                             │
│ - Compile and run tests                                                     │
│ - Review 43 skipped items (reasons documented)                              │
│ - Monitor telemetry after deployment                                        │
│                                                                              │
│ ## Files Changed                                                            │
│ [List of all modified files with change summaries]                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Proposal Review Workflow

```yaml
type: proposal-review
name: "Proposal Review Workflow"
description: "Review documentation and proposals"

file_patterns:
  - "docs/**/*.md"
  - "proposals/**/*.md"
  - "*.md"

phases:
  - id: inventory
    name: "Document Inventory"
    required: true

  - id: analysis
    name: "Document Analysis"
    required: true

  - id: specialist_review
    name: "Specialist Review"
    required: true

  - id: summary
    name: "Summary"
    required: true

per_file_checklist:
  - id: read_document
    type: analysis
    description: "Read and understand document"
    required: true

  - id: identify_specialists
    type: analysis
    description: "Identify relevant specialists"
    required: true

  - id: specialist_review
    type: topic_application
    description: "Apply specialist guidance"
    required: true

topic_discovery:
  enabled: true
  tool: "ask_bc_expert"
  auto_expand_checklist: true
  min_relevance_score: 0.5
```

---

## Agent Interaction Flow

### Example: Error to ErrorInfo Migration (Pattern-Based Workflow)

This example shows how the workflow engine handles a large-scale migration with 1000+ files.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN 1: User Request                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ User: "Help me convert all Error() calls to use ErrorInfo"              │
│                                                                          │
│ Agent: Calls workflow_start(workflow_type="error-to-errorinfo-migration")│
│                                                                          │
│ Engine Returns:                                                          │
│   - session_id: "wf-error-migration-abc123"                             │
│   - file_inventory: 847 files                                           │
│   - next_action: scan_file on first file                                │
│   - agent_instructions: "Pattern-based migration workflow started.      │
│     Phase 1 will scan ALL files for Error() patterns. This may take    │
│     several turns. After scanning, you'll see instance counts and can  │
│     use batch operations for auto-fixable patterns."                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURNS 2-50: Pattern Scanning (runs efficiently, ~20 files per turn)     │
├─────────────────────────────────────────────────────────────────────────┤
│ Agent: Reads batch of files, engine scans for Error() patterns          │
│                                                                          │
│ Engine tracks internally:                                                │
│   - Files scanned: 847/847                                              │
│   - Total instances found: 2,341                                         │
│   - By type: literal(1245), strsubstno(634), text_constant(312),        │
│              function_call(98), other(52)                               │
│                                                                          │
│ After all files scanned, Engine Returns:                                 │
│   - status: "scan_complete"                                             │
│   - summary: { total_instances: 2341, auto_fixable: 1879, ... }         │
│   - next_action: {                                                      │
│       action: "batch_decision",                                         │
│       instruction: "Scanning complete. 2,341 Error() calls found.      │
│         1,879 are auto-fixable (literal + strsubstno patterns).        │
│         Would you like to:                                              │
│         1. Apply all auto-fixes with workflow_batch (recommended)       │
│         2. Review each file individually with workflow_next             │
│         3. See detailed breakdown with workflow_status"                 │
│     }                                                                   │
│                                                                          │
│ Agent: Presents options to user                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN 51: Batch Auto-Fix (dry run)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ User: "Apply the auto-fixes"                                            │
│                                                                          │
│ Agent: Calls workflow_batch(                                            │
│   session_id="wf-error-migration-abc123",                               │
│   operation="apply_fixes",                                              │
│   filter={ auto_fixable_only: true },                                   │
│   dry_run=true                                                          │
│ )                                                                       │
│                                                                          │
│ Engine Returns:                                                          │
│   - preview: 1,879 instances across 623 files                           │
│   - sample_changes: [5 example transformations]                         │
│   - confirmation_token: "batch-abc123-1879-confirm"                     │
│   - confirmation_prompt: "Review samples above. Reply 'confirm' to     │
│     apply 1,879 changes across 623 files."                              │
│                                                                          │
│ Agent: Shows samples to user, asks for confirmation                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN 52: Batch Auto-Fix (execute)                                        │
├─────────────────────────────────────────────────────────────────────────┤
│ User: "confirm"                                                         │
│                                                                          │
│ Agent: Calls workflow_batch(                                            │
│   session_id="wf-error-migration-abc123",                               │
│   operation="apply_fixes",                                              │
│   filter={ auto_fixable_only: true },                                   │
│   confirmation_token="batch-abc123-1879-confirm"                        │
│ )                                                                       │
│                                                                          │
│ Engine: Applies transformations to all 1,879 instances                  │
│                                                                          │
│ Engine Returns:                                                          │
│   - result: { modified: 1876, failed: 3 }                               │
│   - failures: [3 read-only file errors]                                 │
│   - next_action: "462 instances remain requiring manual review.         │
│     Call workflow_next to process text_constant instances first."       │
│                                                                          │
│ Agent: Reports success, explains remaining work                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURNS 53-70: Manual Review (complex patterns)                            │
├─────────────────────────────────────────────────────────────────────────┤
│ Agent: Calls workflow_next(session_id="wf-error-migration-abc123")      │
│                                                                          │
│ Engine Returns next instance requiring review:                          │
│   - file: "src/SalesPost.Codeunit.al"                                   │
│   - line: 1247                                                          │
│   - instance: {                                                         │
│       match_text: "Error(SalesPostErr)",                                │
│       instance_type: "text_constant",                                   │
│       context: "if not TempSalesLine.Find('-') then\n  Error(SalesPostErr);"│
│     }                                                                   │
│   - specialist_guidance: "Eva says: Text constants need review to      │
│     ensure the ErrorInfo pattern preserves the constant's purpose.      │
│     Check if SalesPostErr is used elsewhere for error handling."        │
│   - suggested_fix: "Error(ErrorInfo.Create(SalesPostErr))"              │
│   - instruction: "Review this text constant usage. If the constant is  │
│     only used for this error, the suggested fix is appropriate. If     │
│     it's referenced elsewhere, consider creating an ErrorInfo record." │
│                                                                          │
│ Agent: Reads file context, applies fix or skips with reason             │
│ Agent: Calls workflow_progress with result                              │
│                                                                          │
│ [Continues for remaining 462 instances...]                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN 71: Workflow Complete                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Agent: Calls workflow_complete(session_id="wf-error-migration-abc123")  │
│                                                                          │
│ Engine Returns:                                                          │
│   - summary:                                                            │
│       files_processed: 847                                              │
│       instances_converted: 2,298                                        │
│       instances_skipped: 43 (with documented reasons)                   │
│       auto_fixed: 1,876                                                 │
│       manually_reviewed: 422                                            │
│   - report: Full markdown report with all changes                       │
│   - recommendations:                                                    │
│       - "Run AL compiler to verify all conversions"                     │
│       - "43 instances skipped - review skip reasons in report"          │
│       - "Consider adding ErrorInfo.AddAction() for user-recoverable    │
│         errors in 12 flagged locations"                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key Features Demonstrated:**

1. **Efficient scanning** - Engine scans 847 files internally, not consuming context
2. **Batch operations** - 1,879 auto-fixes applied in one operation with confirmation
3. **Instance-level tracking** - Each Error() call tracked individually
4. **Specialist guidance** - Eva's expertise embedded in review prompts
5. **Persistence** - Workflow state survives context window limits
6. **Skip tracking** - Reasons documented for skipped instances

---

### Example: Code Review Session

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN 1: User Request                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ User: "Run a comprehensive code review on this workspace"               │
│                                                                          │
│ Agent: Calls workflow_start(workflow_type="code-review")                │
│                                                                          │
│ Engine Returns:                                                          │
│   - session_id: "wf-abc123"                                             │
│   - file_inventory: 47 files                                            │
│   - next_action: analyze_file on CustomerMgt.Codeunit.al                │
│   - agent_instructions: "MUST follow next_action exactly..."            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN 2: First File Analysis                                              │
├─────────────────────────────────────────────────────────────────────────┤
│ Agent: Reads CustomerMgt.Codeunit.al                                    │
│ Agent: Calls analyze_al_code(code=<file_content>)                       │
│                                                                          │
│ analyze_al_code Returns:                                                │
│   - issues: [manual_summation, missing_setloadfields]                   │
│   - suggested_topics: [sift-patterns, setloadfields-optimization]       │
│                                                                          │
│ Agent: Calls workflow_progress(                                         │
│   session_id="wf-abc123",                                               │
│   completed_action={action: "analyze_file", status: "completed"},       │
│   findings=[...],                                                       │
│   expand_checklist=[                                                    │
│     {topic_id: "sift-patterns", relevance: 0.95},                       │
│     {topic_id: "setloadfields-optimization", relevance: 0.87}           │
│   ]                                                                     │
│ )                                                                       │
│                                                                          │
│ Engine Returns:                                                          │
│   - Updated checklist for CustomerMgt.Codeunit.al (now has 4 items)    │
│   - next_action: apply_topic "sift-patterns"                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN 3: Apply First Topic                                                │
├─────────────────────────────────────────────────────────────────────────┤
│ Agent: Calls retrieve_bc_knowledge(topic_id="sift-patterns")            │
│ Agent: Applies guidance to CustomerMgt.Codeunit.al                      │
│ Agent: Identifies specific optimization opportunity at line 45          │
│                                                                          │
│ Agent: Calls workflow_progress(                                         │
│   session_id="wf-abc123",                                               │
│   completed_action={action: "apply_topic", checklist_item_id: "topic-sift", status: "completed"}, │
│   findings=[{line: 45, severity: "warning", description: "..."}],       │
│   proposed_changes=[{line_start: 45, line_end: 52, ...}]                │
│ )                                                                       │
│                                                                          │
│ Engine Returns:                                                          │
│   - next_action: apply_topic "setloadfields-optimization"               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                              ... continues ...
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ TURN N: Workflow Complete                                                │
├─────────────────────────────────────────────────────────────────────────┤
│ Engine Returns:                                                          │
│   - status: "ready_for_completion"                                      │
│   - next_action: complete_workflow                                      │
│                                                                          │
│ Agent: Calls workflow_complete(session_id="wf-abc123")                  │
│                                                                          │
│ Engine Returns:                                                          │
│   - Final report with all findings                                      │
│   - Summary statistics                                                  │
│   - Prioritized recommendations                                         │
│                                                                          │
│ Agent: Presents report to user                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Consumer Integration (Status Bar Sync)

The workflow engine exposes state to external consumers (like VS Code status bar) via a shared state file. This enables real-time progress visibility even when the agent is processing.

### Environment Variable

The consumer passes the state file path to the MCP server:

```
BC_INTEL_WORKFLOW_STATE_PATH=/path/to/globalStorage/workflow-state.json
```

### Enhanced State File Format (v2)

The v2 engine provides richer state information for consumers:

```typescript
interface SharedWorkflowState {
  version: "2.0";                       // State format version
  activeWorkflows: SharedWorkflowSession[];
  lastUpdated: string;                  // ISO timestamp
}

interface SharedWorkflowSession {
  // Basic identification
  id: string;                           // Workflow session ID
  type: string;                         // e.g., "code-review", "bc-version-upgrade"
  name: string;                         // Human-readable name
  status: "active" | "paused" | "blocked" | "completed" | "cancelled";

  // Phase progress
  currentPhase: string;                 // Phase ID
  currentPhaseName: string;             // Human-readable phase name
  totalPhases: number;
  phaseIndex: number;                   // 0-indexed

  // File progress (NEW in v2)
  filesTotal: number;
  filesCompleted: number;
  filesInProgress: number;
  currentFile?: string;                 // Currently processing file path

  // Instance progress (NEW in v2 - for pattern-based workflows)
  instancesTotal?: number;              // Total pattern instances found
  instancesCompleted?: number;          // Instances processed
  instancesAutoFixed?: number;          // Auto-fixed instances
  instancesManualReview?: number;       // Instances needing manual review

  // For version upgrade workflows (NEW in v2)
  versionUpgrade?: {
    sourceVersion: string;              // e.g., "BC21"
    targetVersion: string;              // e.g., "BC27"
    currentVersionStep?: string;        // e.g., "BC23→BC24"
    guidesTotal: number;
    guidesCompleted: number;
  };

  // Specialist info
  currentSpecialist?: string;           // Specialist ID currently active
  nextSpecialist?: string;              // Next specialist (if known)

  // Overall progress
  progressPercentage: number;           // 0-100
  progressMessage: string;              // Human-readable status message

  // Timing
  startedAt: string;                    // ISO timestamp
  lastUpdated: string;                  // ISO timestamp
  estimatedTimeRemaining?: string;      // e.g., "~5 minutes" (optional)

  // Context
  projectContext: string;               // Truncated context (max 100 chars)

  // Blocking info (if status is "blocked")
  blockedReason?: string;
  blockedResolution?: string[];
}
```

### Example State Files

#### Code Review Workflow

```json
{
  "version": "2.0",
  "activeWorkflows": [
    {
      "id": "wf-code-review-2024-01-11-abc123",
      "type": "code-review",
      "name": "Code Review",
      "status": "active",
      "currentPhase": "analysis",
      "currentPhaseName": "Code Analysis",
      "totalPhases": 4,
      "phaseIndex": 1,
      "filesTotal": 47,
      "filesCompleted": 12,
      "filesInProgress": 1,
      "currentFile": "src/SalesPost.Codeunit.al",
      "currentSpecialist": "roger-reviewer",
      "nextSpecialist": "dean-debug",
      "progressPercentage": 28,
      "progressMessage": "Analyzing SalesPost.Codeunit.al (13/47)",
      "startedAt": "2024-01-11T10:00:00.000Z",
      "lastUpdated": "2024-01-11T10:15:32.000Z",
      "projectContext": "Comprehensive code review of Sales module..."
    }
  ],
  "lastUpdated": "2024-01-11T10:15:32.000Z"
}
```

#### Error→ErrorInfo Migration Workflow

```json
{
  "version": "2.0",
  "activeWorkflows": [
    {
      "id": "wf-error-migration-abc123",
      "type": "error-to-errorinfo-migration",
      "name": "Error to ErrorInfo Migration",
      "status": "active",
      "currentPhase": "batch_auto",
      "currentPhaseName": "Batch Auto-Fix",
      "totalPhases": 6,
      "phaseIndex": 2,
      "filesTotal": 847,
      "filesCompleted": 623,
      "filesInProgress": 0,
      "instancesTotal": 2341,
      "instancesCompleted": 1879,
      "instancesAutoFixed": 1876,
      "instancesManualReview": 462,
      "currentSpecialist": "eva-errors",
      "progressPercentage": 80,
      "progressMessage": "Auto-fixed 1,876 instances. 462 remaining for manual review.",
      "startedAt": "2024-01-11T09:00:00.000Z",
      "lastUpdated": "2024-01-11T10:45:00.000Z",
      "projectContext": "Convert all Error() calls to ErrorInfo pattern..."
    }
  ],
  "lastUpdated": "2024-01-11T10:45:00.000Z"
}
```

#### BC Version Upgrade Workflow

```json
{
  "version": "2.0",
  "activeWorkflows": [
    {
      "id": "wf-upgrade-bc21-bc27-xyz",
      "type": "bc-version-upgrade",
      "name": "BC Version Upgrade",
      "status": "active",
      "currentPhase": "guided_conversion",
      "currentPhaseName": "Guided Conversion",
      "totalPhases": 6,
      "phaseIndex": 3,
      "filesTotal": 1247,
      "filesCompleted": 287,
      "filesInProgress": 1,
      "currentFile": "src/SalesPost.Codeunit.al",
      "instancesTotal": 3891,
      "instancesCompleted": 1567,
      "instancesAutoFixed": 892,
      "instancesManualReview": 675,
      "versionUpgrade": {
        "sourceVersion": "BC21",
        "targetVersion": "BC27",
        "currentVersionStep": "BC23→BC24",
        "guidesTotal": 6,
        "guidesCompleted": 2
      },
      "currentSpecialist": "logan-legacy",
      "progressPercentage": 40,
      "progressMessage": "BC23→BC24: Converting No. Series patterns (287/1247 files)",
      "startedAt": "2024-01-11T08:00:00.000Z",
      "lastUpdated": "2024-01-11T11:30:00.000Z",
      "estimatedTimeRemaining": "~45 minutes",
      "projectContext": "Upgrade from BC21 to BC27 with 6 conversion guides..."
    }
  ],
  "lastUpdated": "2024-01-11T11:30:00.000Z"
}
```

#### Blocked Workflow

```json
{
  "version": "2.0",
  "activeWorkflows": [
    {
      "id": "wf-code-review-blocked",
      "type": "code-review",
      "name": "Code Review",
      "status": "blocked",
      "currentPhase": "analysis",
      "currentPhaseName": "Code Analysis",
      "totalPhases": 4,
      "phaseIndex": 1,
      "filesTotal": 47,
      "filesCompleted": 8,
      "filesInProgress": 0,
      "progressPercentage": 17,
      "progressMessage": "Blocked: 3 files have syntax errors",
      "blockedReason": "3 files failed analysis with syntax errors",
      "blockedResolution": [
        "Fix syntax errors in src/Broken.Codeunit.al",
        "Fix syntax errors in src/Legacy.Table.al",
        "Fix syntax errors in src/Old.Page.al",
        "Then call workflow_retry to continue"
      ],
      "startedAt": "2024-01-11T10:00:00.000Z",
      "lastUpdated": "2024-01-11T10:20:00.000Z",
      "projectContext": "Code review blocked due to syntax errors..."
    }
  ],
  "lastUpdated": "2024-01-11T10:20:00.000Z"
}
```

### Status Bar Display Updates

The VS Code status bar should display v2 workflow state with enhanced information:

| Workflow Type | Status Bar Text | Tooltip |
|--------------|-----------------|---------|
| Code Review | `$(sync~spin) Review 12/47 files` | Full progress details |
| Error Migration | `$(sync~spin) Migration 80% (1876 auto-fixed)` | Instance counts |
| Version Upgrade | `$(sync~spin) BC21→27: BC23→24 (40%)` | Version step details |
| Blocked | `$(warning) Review Blocked` | Resolution steps |

#### Enhanced Tooltip Example (Version Upgrade)

```
**BC Version Upgrade** (via Chat)

BC21 → BC27

Phase 4/6: **Guided Conversion**
Current Step: BC23→BC24 (2/6 guides)

Files: 287/1,247 (23%)
Instances: 1,567/3,891 (40%)
  • Auto-fixed: 892
  • Manual review: 675

Specialist: @logan-legacy
ETA: ~45 minutes

_Agent is running this workflow_
```

### State Sync Triggers

The engine should sync state to file on these events:

1. **workflow_start** - New workflow initialized
2. **workflow_next** - Next action retrieved (file/instance change)
3. **workflow_progress** - Progress reported
4. **workflow_batch** - Batch operation started/completed
5. **workflow_status** - Status checked (optional, for consistency)
6. **workflow_complete** - Workflow finished
7. **Phase transitions** - Moving between phases
8. **Blocking events** - Workflow blocked or unblocked

### Progress Calculation

```typescript
function calculateProgress(session: WorkflowSession): number {
  // For pattern-based workflows, weight by instances
  if (session.instancesTotal && session.instancesTotal > 0) {
    const instanceProgress = (session.instancesCompleted || 0) / session.instancesTotal;
    return Math.round(instanceProgress * 100);
  }

  // For file-based workflows, weight by files
  if (session.filesTotal && session.filesTotal > 0) {
    const fileProgress = session.filesCompleted / session.filesTotal;
    // Also factor in phase progress
    const phaseWeight = session.phaseIndex / session.totalPhases;
    return Math.round((fileProgress * 0.7 + phaseWeight * 0.3) * 100);
  }

  // Fallback to phase-only progress
  return Math.round((session.phaseIndex / session.totalPhases) * 100);
}
```

### Progress Message Generation

```typescript
function generateProgressMessage(session: WorkflowSession): string {
  if (session.status === "blocked") {
    return `Blocked: ${session.blockedReason}`;
  }

  if (session.type === "bc-version-upgrade" && session.versionUpgrade) {
    const { currentVersionStep, guidesCompleted, guidesTotal } = session.versionUpgrade;
    return `${currentVersionStep}: Processing (${guidesCompleted}/${guidesTotal} guides)`;
  }

  if (session.instancesTotal) {
    const remaining = session.instancesTotal - (session.instancesCompleted || 0);
    if (session.currentPhase === "batch_auto") {
      return `Auto-fixed ${session.instancesAutoFixed}. ${remaining} remaining.`;
    }
    return `${session.instancesCompleted}/${session.instancesTotal} instances processed`;
  }

  if (session.currentFile) {
    return `Analyzing ${path.basename(session.currentFile)} (${session.filesCompleted + 1}/${session.filesTotal})`;
  }

  return `${session.currentPhaseName} in progress...`;
}
```

---

## State Persistence

### Session Storage

Sessions must persist across:
- Multiple agent turns
- Context window limits (conversation may be summarized)
- Potential interruptions

**Storage Options:**

1. **File-based** (recommended for simplicity)
   ```
   .bc-workflows/
   ├── sessions/
   │   ├── wf-abc123.json
   │   └── wf-def456.json
   └── reports/
       ├── wf-abc123-report.md
       └── wf-def456-report.md
   ```

2. **In-memory with file backup**
   - Fast access during active session
   - Persisted to disk on each progress update
   - Recoverable if agent restarts

### Session Recovery

If agent loses context or restarts:

```
Agent: Calls workflow_status(session_id="wf-abc123")

Engine Returns:
  - Full current state
  - What was last completed
  - What is next action

Agent: Resumes from where it left off
```

---

## Error Handling

### File Processing Errors

```json
{
  "completed_action": {
    "action": "analyze_file",
    "file": "src/Broken.Codeunit.al",
    "status": "failed",
    "error": "File contains syntax errors that prevent analysis"
  }
}
```

Engine response:
- Marks file as "failed"
- Records error in findings
- Moves to next file
- Does NOT block workflow completion

### Blocked Workflow

If a required phase cannot complete:

```json
{
  "status": "blocked",
  "blocked_reason": "3 files failed analysis with critical errors",
  "blocked_files": ["src/A.al", "src/B.al", "src/C.al"],
  "resolution_options": [
    "Fix syntax errors and call workflow_retry",
    "Skip blocked files with workflow_progress(skip_reason=...)",
    "Abort workflow with workflow_abort"
  ]
}
```

---

## Integration with Existing Tools

### analyze_al_code Enhancement

Current output includes `suggested_topics` but agent doesn't know what to do with them.

**Enhanced output:**
```json
{
  "issues": [...],
  "suggested_topics": [...],

  "workflow_integration": {
    "instruction": "If running within a workflow session, pass suggested_topics to workflow_progress(expand_checklist=...) to add them to the current file's checklist.",
    "expand_checklist_payload": [
      {"topic_id": "sift-patterns", "relevance_score": 0.95, "description": "SIFT optimization patterns"},
      {"topic_id": "setloadfields-optimization", "relevance_score": 0.87, "description": "SetLoadFields usage"}
    ]
  }
}
```

### retrieve_bc_knowledge Enhancement

When called within a workflow context, include application guidance:

```json
{
  "topic_content": "...",

  "workflow_integration": {
    "instruction": "Apply this topic's guidance to the current file. After review, call workflow_progress with any findings or proposed_changes.",
    "finding_template": {
      "severity": "warning|error|info",
      "category": "{{topic_category}}",
      "description": "Describe the specific issue found",
      "suggestion": "Describe the recommended fix",
      "related_topic": "{{topic_id}}"
    }
  }
}
```

---

## Success Metrics

### Workflow Quality Metrics

1. **Coverage**: % of files actually processed vs. total files
2. **Topic Application Rate**: % of suggested topics actually applied
3. **Finding Density**: Findings per file (should be consistent, not front-loaded)
4. **Completion Rate**: % of workflows that reach "completed" status

### Agent Behavior Metrics

1. **Instruction Compliance**: Does agent follow next_action exactly?
2. **Progress Reporting**: Does agent call workflow_progress after each action?
3. **Checklist Expansion**: Does agent pass suggested_topics to expand_checklist?
4. **No Drift**: Does agent stay within workflow or wander off?

---

## Migration from v1

### Phase 1: New Tools
- Implement workflow_start, workflow_next, workflow_progress, workflow_status, workflow_complete
- Keep existing tools unchanged

### Phase 2: Tool Enhancement
- Add workflow_integration sections to analyze_al_code and retrieve_bc_knowledge outputs
- Existing non-workflow usage unaffected

### Phase 3: Workflow Definitions
- Convert static markdown workflows to YAML definitions
- code-review-workflow.md → code-review.workflow.yaml

### Phase 4: Deprecation
- Mark old workflow tools as deprecated
- Update documentation
- Remove after transition period

---

## Open Questions

1. **Concurrency**: Should workflows support parallel file processing? (Agent could process multiple files if context allows)

2. **Checkpoints**: Should we support checkpoint/resume for very large workflows? (100+ files)

3. **User Interaction**: When should the workflow pause for user input vs. proceed autonomously?

4. **Partial Reports**: Should we generate interim reports during long workflows?

5. **Workflow Composition**: Can workflows call sub-workflows? (e.g., code-review includes security-audit sub-workflow)

---

## Appendix: Full Session State Example

```json
{
  "id": "wf-code-review-2024-01-11-abc123",
  "workflow_type": "code-review",
  "status": "in_progress",
  "created_at": "2024-01-11T10:30:00Z",
  "updated_at": "2024-01-11T11:45:23Z",

  "file_glob_pattern": "**/*.al",
  "file_inventory": [
    {
      "path": "src/CustomerMgt.Codeunit.al",
      "status": "completed",
      "checklist": [
        {"id": "analyze", "type": "analysis", "description": "Run analyze_al_code", "status": "completed"},
        {"id": "topic-sift", "type": "topic_application", "description": "Apply topic: sift-patterns", "status": "completed", "topic_id": "dean-debug/sift-patterns", "topic_relevance_score": 0.95},
        {"id": "topic-setloadfields", "type": "topic_application", "description": "Apply topic: setloadfields-optimization", "status": "completed", "topic_id": "dean-debug/setloadfields-optimization", "topic_relevance_score": 0.87},
        {"id": "review_complete", "type": "validation", "description": "Mark review complete", "status": "completed"}
      ],
      "findings": [
        {"line": 45, "severity": "warning", "category": "performance", "description": "Manual summation in loop", "suggestion": "Use CalcSums with SIFT", "related_topic": "dean-debug/sift-patterns"},
        {"line": 78, "severity": "info", "category": "performance", "description": "Missing SetLoadFields", "suggestion": "Add SetLoadFields before FindSet", "related_topic": "dean-debug/setloadfields-optimization"}
      ],
      "proposed_changes": [
        {"line_start": 45, "line_end": 52, "original_code": "repeat\n  Total += Rec.Amount;\nuntil Rec.Next() = 0;", "proposed_code": "Rec.CalcSums(Amount);\nTotal := Rec.Amount;", "rationale": "SIFT-based aggregation is 10-100x faster", "impact": "high", "auto_applicable": true}
      ]
    },
    {
      "path": "src/SalesOrder.Page.al",
      "status": "in_progress",
      "checklist": [
        {"id": "analyze", "type": "analysis", "description": "Run analyze_al_code", "status": "completed"},
        {"id": "topic-page-perf", "type": "topic_application", "description": "Apply topic: page-performance-patterns", "status": "in_progress", "topic_id": "dean-debug/page-performance-patterns", "topic_relevance_score": 0.82},
        {"id": "review_complete", "type": "validation", "description": "Mark review complete", "status": "pending"}
      ],
      "findings": [],
      "proposed_changes": []
    },
    {
      "path": "src/ItemLedger.Table.al",
      "status": "pending",
      "checklist": [
        {"id": "analyze", "type": "analysis", "description": "Run analyze_al_code", "status": "pending"},
        {"id": "review_complete", "type": "validation", "description": "Mark review complete", "status": "pending"}
      ],
      "findings": [],
      "proposed_changes": []
    }
  ],

  "current_phase": "analysis",
  "current_file_index": 1,
  "files_completed": 1,
  "files_total": 47,

  "findings": [
    {"file": "src/CustomerMgt.Codeunit.al", "line": 45, "severity": "warning", "category": "performance", "description": "Manual summation in loop"}
  ],
  "proposed_changes": [
    {"file": "src/CustomerMgt.Codeunit.al", "line_start": 45, "line_end": 52, "impact": "high"}
  ],

  "options": {
    "bc_version": "BC26",
    "include_patterns": [],
    "exclude_patterns": ["**/test/**"],
    "max_files": null,
    "priority_patterns": ["**/Codeunit/**"]
  }
}
```
