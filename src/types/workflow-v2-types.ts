/**
 * Workflow Engine v2 Types
 *
 * Stateful checklist management system that drives agents through systematic,
 * file-by-file processing of large codebases.
 *
 * Core Principle: The workflow drives the agent, not the other way around.
 */

// ============================================================================
// WORKFLOW SESSION TYPES
// ============================================================================

export type WorkflowStatus = 'initializing' | 'in_progress' | 'blocked' | 'completed' | 'failed';
export type FileStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
export type ChecklistItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
export type ChecklistItemType = 'analysis' | 'topic_application' | 'pattern_instance' | 'validation' | 'custom';
export type PhaseExecutionMode = 'autonomous' | 'guided' | 'agent_driven';
export type FindingSeverity = 'info' | 'warning' | 'error' | 'critical';
export type ChangeImpact = 'low' | 'medium' | 'high';

/**
 * Pattern match information for pattern-based workflows (e.g., error migration)
 */
export interface PatternMatch {
  pattern_id: string;              // e.g., "error-call", "missing-tooltip"
  line_number: number;
  column?: number;
  end_line?: number;               // For multi-line matches
  match_text: string;              // The actual code that matched
  match_context?: string;          // Surrounding lines for context
  instance_type?: string;          // Sub-classification (e.g., "literal", "text_constant", "strsubstno")
  suggested_replacement?: string;  // Pre-computed fix if deterministic
  requires_manual_review?: boolean; // True if conversion needs human judgment
}

/**
 * Checklist item - tracks individual tasks within a file
 */
export interface ChecklistItem {
  id: string;
  type: ChecklistItemType;
  description: string;
  status: ChecklistItemStatus;

  // For topic_application type
  topic_id?: string;
  topic_relevance_score?: number;

  // For pattern_instance type (individual occurrences within a file)
  pattern_match?: PatternMatch;

  // Results
  result?: any;
  error?: string;
}

/**
 * File entry in the workflow inventory
 */
export interface FileEntry {
  path: string;
  status: FileStatus;
  size?: number;
  priority?: number;
  object_type?: string;            // AL object type: Codeunit, Page, Table, etc.
  checklist: ChecklistItem[];
  findings: Finding[];
  proposed_changes: ProposedChange[];
}

/**
 * Finding - an issue or observation discovered during workflow execution
 */
export interface Finding {
  file: string;
  line?: number;
  severity: FindingSeverity;
  category: string;
  description: string;
  suggestion?: string;
  related_topic?: string;
}

/**
 * Proposed code change
 */
export interface ProposedChange {
  file: string;
  line_start: number;
  line_end: number;
  original_code: string;
  proposed_code: string;
  rationale: string;
  impact: ChangeImpact;
  auto_applicable: boolean;
}

/**
 * Workflow phase definition
 */
export interface WorkflowPhase {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  mode: PhaseExecutionMode;
  required: boolean;
  entry_conditions?: string[];
  available_actions?: string[];
}

/**
 * Workflow options
 */
export interface WorkflowOptions {
  bc_version?: string;
  include_patterns?: string[];
  exclude_patterns?: string[];
  max_files?: number;
  priority_patterns?: string[];

  // For bc-version-upgrade workflow
  source_version?: string;
  target_version?: string;
}

/**
 * Initial processing options (for autonomous analysis)
 */
export interface InitialProcessingOptions {
  run_autonomous_phases: boolean;  // default: true
  scan_all_patterns: boolean;      // default: true
  timeout_ms: number;              // default: 30000
  stream_progress: boolean;        // default: false
}

/**
 * Main workflow session
 */
export interface WorkflowSession {
  id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;

  // File inventory
  file_inventory: FileEntry[];
  file_glob_pattern: string;

  // Progress tracking
  phases: WorkflowPhase[];
  current_phase: string;
  current_file_index: number;
  files_completed: number;
  files_total: number;

  // For pattern-based workflows
  instances_total?: number;
  instances_completed?: number;
  instances_auto_fixed?: number;
  instances_manual_review?: number;

  // For version upgrade workflows
  version_upgrade?: {
    source_version: string;
    target_version: string;
    current_version_step?: string;
    guides_total: number;
    guides_completed: number;
  };

  // Results accumulator
  findings: Finding[];
  proposed_changes: ProposedChange[];

  // Configuration
  options: WorkflowOptions;

  // Blocking info
  blocked_reason?: string;
  blocked_resolution?: string[];
}

// ============================================================================
// WORKFLOW TYPES AND DEFINITIONS
// ============================================================================

/**
 * Built-in workflow types provided by the embedded layer.
 * Custom workflow types can be defined in company layers.
 */
export type BuiltInWorkflowType =
  | 'code-review'
  | 'proposal-review'
  | 'performance-audit'
  | 'security-audit'
  | 'onboarding'
  | 'error-to-errorinfo-migration'
  | 'bc-version-upgrade';

/**
 * WorkflowType is a string to support both built-in types and
 * custom workflow types defined in company/project layers.
 *
 * Built-in types are defined in embedded-knowledge/workflows/
 * Custom types can be defined in layer workflows/ directories
 */
export type WorkflowType = BuiltInWorkflowType | string;

/**
 * Pattern definition for pattern-based workflows
 */
export interface PatternDefinition {
  id: string;
  name: string;
  description: string;

  // Detection
  regex: string;
  regex_flags?: string;
  exclude_regex?: string;
  context_lines?: number;

  // Classification rules
  instance_classifier?: {
    rules: Array<{
      name: string;
      pattern: string;
      suggested_action: string;
      auto_fixable: boolean;
    }>;
  };

  // Transformation templates
  transformations?: Array<{
    instance_type: string;
    template: string;
    requires_review: boolean;
  }>;

  // Specialist guidance
  specialist?: string;
  topic_id?: string;
}

/**
 * Workflow definition (loaded from YAML or defined in code)
 */
export interface WorkflowDefinition {
  type: WorkflowType;
  name: string;
  description: string;
  specialist?: string;

  // File discovery
  file_patterns: string[];
  file_exclusions?: string[];

  // Phases
  phases: Array<{
    id: string;
    name: string;
    description: string;
    required: boolean;
    mode: PhaseExecutionMode;
    entry_conditions?: string[];
    available_actions?: string[];
  }>;

  // Per-file checklist template
  per_file_checklist: Array<{
    id: string;
    type: ChecklistItemType;
    description: string;
    required: boolean;
    conditions?: {
      file_pattern?: string;
      content_pattern?: string;
      phase?: string;
    };
  }>;

  // Topic integration
  topic_discovery: {
    enabled: boolean;
    tool: string;
    auto_expand_checklist: boolean;
    min_relevance_score: number;
  };

  // Pattern discovery (for migration/transformation workflows)
  pattern_discovery?: {
    enabled: boolean;
    patterns: PatternDefinition[];
    create_instance_items: boolean;
    group_identical: boolean;
    specialist?: string;
  };

  // Completion criteria
  completion_rules: {
    require_all_files: boolean;
    require_all_checklist_items: boolean;
    allow_skip_with_reason: boolean;
  };
}

// ============================================================================
// TOOL INPUT/OUTPUT TYPES
// ============================================================================

/**
 * workflow_start input
 */
export interface WorkflowStartInput {
  workflow_type: WorkflowType;
  scope?: 'workspace' | 'directory' | 'files';
  path?: string;
  options?: WorkflowOptions;
  initial_processing?: Partial<InitialProcessingOptions>;
}

/**
 * Next action instruction for the agent
 */
export interface NextAction {
  type: 'analyze_file' | 'apply_topic' | 'convert_instance' | 'user_decision' | 'batch_decision' | 'complete_workflow';
  action?: string;
  file?: string;
  topic_id?: string;
  instance?: PatternMatch;
  instruction: string;
  tool_call?: {
    tool: string;
    args: Record<string, any>;
  };
  options?: Array<{
    id: string;
    label: string;
    description: string;
  }>;
  recommended?: string;
}

/**
 * Analysis summary (returned by pattern-based workflows after scanning)
 */
export interface AnalysisSummary {
  files_scanned: number;
  files_with_matches: number;
  total_instances: number;
  by_type: Record<string, {
    count: number;
    auto_fixable: boolean;
    needs?: string;
  }>;
  batch_options: Array<{
    action: string;
    description: string;
    instances: number;
    files: number;
  }>;
}

/**
 * workflow_start output
 */
export interface WorkflowStartOutput {
  session_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;

  // Autonomous processing info
  autonomous_processing?: {
    completed: boolean;
    phases_run: string[];
    duration_ms: number;
  };

  // File inventory summary
  file_inventory: {
    total: number;
    with_matches?: number;
    by_type?: Record<string, number>;
    files?: Array<{ path: string; size?: number; priority?: number }>;
  };

  // For pattern-based workflows
  analysis_summary?: AnalysisSummary;

  // Phase info
  phases: Array<{
    id: string;
    name: string;
    status: string;
    mode: PhaseExecutionMode;
  }>;

  // Next action
  next_action: NextAction;

  // Agent instructions
  agent_instructions: string;
}

/**
 * workflow_next input
 */
export interface WorkflowNextInput {
  session_id: string;
}

/**
 * Progress info for workflow_next output
 */
export interface ProgressInfo {
  phase: string;
  files_completed: number;
  files_total: number;
  percent_complete: number;
  current_file?: string;
}

/**
 * workflow_next output
 */
export interface WorkflowNextOutput {
  session_id: string;
  status: WorkflowStatus;
  progress: ProgressInfo;
  current_file?: {
    path: string;
    status: FileStatus;
    checklist: ChecklistItem[];
  };
  next_action: NextAction;
  agent_instructions: string;
}

/**
 * Completed action report for workflow_progress
 */
export interface CompletedAction {
  action: string;
  file?: string;
  checklist_item_id?: string;
  status: 'completed' | 'skipped' | 'failed';
  skip_reason?: string;
  error?: string;
}

/**
 * Checklist expansion item
 */
export interface ChecklistExpansionItem {
  topic_id: string;
  relevance_score: number;
  description: string;
}

/**
 * workflow_progress input
 */
export interface WorkflowProgressInput {
  session_id: string;
  completed_action: CompletedAction;
  findings?: Finding[];
  proposed_changes?: ProposedChange[];
  expand_checklist?: ChecklistExpansionItem[];
}

/**
 * workflow_status input
 */
export interface WorkflowStatusInput {
  session_id: string;
  include_all_files?: boolean;
}

/**
 * workflow_status output
 */
export interface WorkflowStatusOutput {
  session_id: string;
  workflow_type: WorkflowType;
  status: WorkflowStatus;
  created_at: string;
  updated_at: string;

  progress: {
    phase: string;
    files_completed: number;
    files_total: number;
    files_in_progress: number;
    files_pending: number;
    percent_complete: number;
  };

  summary: {
    total_findings: number;
    findings_by_severity: Record<FindingSeverity, number>;
    total_proposed_changes: number;
    topics_applied: number;
    topics_pending: number;
  };

  files?: Array<{
    path: string;
    status: FileStatus;
    findings_count: number;
    proposed_changes_count: number;
    checklist_complete: boolean;
  }>;
}

/**
 * workflow_complete input
 */
export interface WorkflowCompleteInput {
  session_id: string;
  generate_report?: boolean;
  apply_changes?: boolean;
  report_format?: 'markdown' | 'json' | 'html';
}

/**
 * workflow_complete output
 */
export interface WorkflowCompleteOutput {
  session_id: string;
  status: 'completed';
  completed_at: string;
  duration_minutes: number;

  summary: {
    files_reviewed: number;
    total_findings: number;
    findings_by_severity: Record<FindingSeverity, number>;
    proposed_changes: number;
    changes_applied: number;
    topics_applied: number;
  };

  report?: string;

  top_issues: Array<{
    file: string;
    severity: FindingSeverity;
    description: string;
    suggestion?: string;
  }>;

  recommendations: string[];
}

/**
 * Batch operation types
 */
export type BatchOperation = 'apply_fixes' | 'skip_instances' | 'flag_for_review' | 'group_by_type';

/**
 * Batch filter
 */
export interface BatchFilter {
  instance_types?: string[];
  file_patterns?: string[];
  auto_fixable_only?: boolean;
  status?: 'pending' | 'in_progress' | 'failed';
  guide?: string;
  version_step?: string;
}

/**
 * workflow_batch input
 */
export interface WorkflowBatchInput {
  session_id: string;
  operation: BatchOperation;
  filter?: BatchFilter;
  dry_run?: boolean;
  confirmation_token?: string;
}

/**
 * workflow_batch output (dry run)
 */
export interface WorkflowBatchDryRunOutput {
  session_id: string;
  operation: BatchOperation;
  dry_run: true;

  preview: {
    instances_affected: number;
    files_affected: number;
    by_instance_type?: Record<string, number>;
  };

  sample_changes: Array<{
    file: string;
    line: number;
    before: string;
    after: string;
  }>;

  confirmation_required: boolean;
  confirmation_token: string;
  confirmation_prompt: string;
}

/**
 * workflow_batch output (execution)
 */
export interface WorkflowBatchExecuteOutput {
  session_id: string;
  operation: BatchOperation;
  dry_run: false;

  result: {
    instances_modified: number;
    instances_failed: number;
    files_modified: number;
    files_failed: number;
  };

  failures?: Array<{
    file: string;
    line?: number;
    error: string;
  }>;

  next_action: NextAction;
}

// ============================================================================
// STATE FILE TYPES (for VS Code status bar sync)
// ============================================================================

/**
 * Shared workflow session state (written to file for consumer integration)
 */
export interface SharedWorkflowSession {
  // Basic identification
  id: string;
  type: WorkflowType;
  name: string;
  status: 'active' | 'paused' | 'blocked' | 'completed' | 'cancelled';

  // Phase progress
  currentPhase: string;
  currentPhaseName: string;
  totalPhases: number;
  phaseIndex: number;

  // File progress
  filesTotal: number;
  filesCompleted: number;
  filesInProgress: number;
  currentFile?: string;

  // Instance progress (for pattern-based workflows)
  instancesTotal?: number;
  instancesCompleted?: number;
  instancesAutoFixed?: number;
  instancesManualReview?: number;

  // For version upgrade workflows
  versionUpgrade?: {
    sourceVersion: string;
    targetVersion: string;
    currentVersionStep?: string;
    guidesTotal: number;
    guidesCompleted: number;
  };

  // Specialist info
  currentSpecialist?: string;
  nextSpecialist?: string;

  // Overall progress
  progressPercentage: number;
  progressMessage: string;

  // Timing
  startedAt: string;
  lastUpdated: string;
  estimatedTimeRemaining?: string;

  // Context
  projectContext: string;

  // Blocking info
  blockedReason?: string;
  blockedResolution?: string[];
}

/**
 * Shared workflow state file format
 */
export interface SharedWorkflowState {
  version: '2.0';
  activeWorkflows: SharedWorkflowSession[];
  lastUpdated: string;
}

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

/**
 * Workflow session storage interface
 */
export interface WorkflowSessionStorage {
  createSession(session: WorkflowSession): Promise<void>;
  getSession(sessionId: string): Promise<WorkflowSession | null>;
  updateSession(session: WorkflowSession): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listActiveSessions(): Promise<WorkflowSession[]>;
  cleanupExpiredSessions(): Promise<number>;
}
