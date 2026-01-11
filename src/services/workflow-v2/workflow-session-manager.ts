/**
 * Workflow Session Manager
 *
 * Manages stateful workflow sessions with file-based persistence.
 * Sessions are stored in .bc-workflows/ directory in the project root.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import fg from 'fast-glob';
import {
  WorkflowSession,
  WorkflowType,
  WorkflowStatus,
  FileEntry,
  FileStatus,
  ChecklistItem,
  ChecklistItemStatus,
  Finding,
  ProposedChange,
  WorkflowPhase,
  WorkflowOptions,
  PatternMatch,
  WorkflowSessionStorage,
  WorkflowDefinition,
  PatternDefinition,
  AnalysisSummary,
  NextAction
} from '../../types/workflow-v2-types.js';
import { getWorkflowDefinition } from './workflow-definitions.js';

/**
 * Generate a unique session ID
 */
function generateSessionId(workflowType: WorkflowType): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const random = Math.random().toString(36).substring(2, 8);
  return `wf-${workflowType}-${timestamp}-${random}`;
}

/**
 * Generate a unique checklist item ID
 */
function generateChecklistItemId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * In-memory workflow session storage with file backup
 */
export class WorkflowSessionManager implements WorkflowSessionStorage {
  private sessions = new Map<string, WorkflowSession>();
  private workspaceRoot: string | null = null;

  constructor() {
    // No external state sync needed
  }

  /**
   * Set the workspace root for file discovery and session storage
   */
  setWorkspaceRoot(workspaceRoot: string): void {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Get the sessions directory path
   */
  private getSessionsDir(): string {
    if (!this.workspaceRoot) {
      throw new Error('Workspace root not set. Call setWorkspaceRoot first.');
    }
    return path.join(this.workspaceRoot, '.bc-workflows', 'sessions');
  }

  /**
   * Get the reports directory path
   */
  private getReportsDir(): string {
    if (!this.workspaceRoot) {
      throw new Error('Workspace root not set. Call setWorkspaceRoot first.');
    }
    return path.join(this.workspaceRoot, '.bc-workflows', 'reports');
  }

  /**
   * Ensure the workflow directories exist
   */
  private async ensureDirectories(): Promise<void> {
    const sessionsDir = this.getSessionsDir();
    const reportsDir = this.getReportsDir();
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.mkdir(reportsDir, { recursive: true });
  }

  /**
   * Create a new workflow session
   */
  async createSession(session: WorkflowSession): Promise<void> {
    this.sessions.set(session.id, session);
    await this.persistSession(session);
  }

  /**
   * Get a session by ID
   */
  async getSession(sessionId: string): Promise<WorkflowSession | null> {
    // Check in-memory first
    let session = this.sessions.get(sessionId);
    if (session) {
      return session;
    }

    // Try loading from file
    try {
      session = await this.loadSession(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
        return session;
      }
    } catch (error) {
      // Session file doesn't exist or is invalid
    }

    return null;
  }

  /**
   * Update an existing session
   */
  async updateSession(session: WorkflowSession): Promise<void> {
    session.updated_at = new Date().toISOString();
    this.sessions.set(session.id, session);
    await this.persistSession(session);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);

    try {
      const sessionsDir = this.getSessionsDir();
      const filePath = path.join(sessionsDir, `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // File might not exist
    }
  }

  /**
   * List all active sessions
   */
  async listActiveSessions(): Promise<WorkflowSession[]> {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'in_progress' || s.status === 'initializing');
  }

  /**
   * Cleanup expired sessions (older than 7 days)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.updated_at) < cutoff) {
        await this.deleteSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Persist session to file
   */
  private async persistSession(session: WorkflowSession): Promise<void> {
    if (!this.workspaceRoot) return;

    try {
      await this.ensureDirectories();
      const sessionsDir = this.getSessionsDir();
      const filePath = path.join(sessionsDir, `${session.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(session, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to persist workflow session:', error);
    }
  }

  /**
   * Load session from file
   */
  private async loadSession(sessionId: string): Promise<WorkflowSession | null> {
    if (!this.workspaceRoot) return null;

    try {
      const sessionsDir = this.getSessionsDir();
      const filePath = path.join(sessionsDir, `${sessionId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as WorkflowSession;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get display name for workflow type
   */
  private getWorkflowDisplayName(type: WorkflowType): string {
    const names: Record<WorkflowType, string> = {
      'code-review': 'Code Review',
      'proposal-review': 'Proposal Review',
      'performance-audit': 'Performance Audit',
      'security-audit': 'Security Audit',
      'onboarding': 'Developer Onboarding',
      'error-to-errorinfo-migration': 'Error to ErrorInfo Migration',
      'bc-version-upgrade': 'BC Version Upgrade'
    };
    return names[type] || type;
  }

  // ==========================================================================
  // WORKFLOW OPERATIONS
  // ==========================================================================

  /**
   * Start a new workflow session
   */
  async startWorkflow(
    workflowType: WorkflowType,
    scope: 'workspace' | 'directory' | 'files',
    scopePath: string | undefined,
    options: WorkflowOptions,
    initialProcessing: { run_autonomous_phases: boolean; scan_all_patterns: boolean; timeout_ms: number }
  ): Promise<{ session: WorkflowSession; analysisSummary?: AnalysisSummary; duration_ms: number }> {
    const startTime = Date.now();

    if (!this.workspaceRoot) {
      throw new Error('Workspace root not set');
    }

    // Get workflow definition
    const definition = getWorkflowDefinition(workflowType);

    // Create session
    const session: WorkflowSession = {
      id: generateSessionId(workflowType),
      workflow_type: workflowType,
      status: 'initializing',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      file_inventory: [],
      file_glob_pattern: definition.file_patterns[0] || '**/*.al',
      phases: definition.phases.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        status: 'pending' as const,
        mode: p.mode,
        required: p.required,
        entry_conditions: p.entry_conditions,
        available_actions: p.available_actions
      })),
      current_phase: definition.phases[0]?.id || 'inventory',
      current_file_index: 0,
      files_completed: 0,
      files_total: 0,
      findings: [],
      proposed_changes: [],
      options
    };

    // Set version upgrade info if applicable
    if (workflowType === 'bc-version-upgrade' && options.source_version && options.target_version) {
      session.version_upgrade = {
        source_version: options.source_version,
        target_version: options.target_version,
        guides_total: 0,
        guides_completed: 0
      };
    }

    // Discover files
    const basePath = scope === 'directory' && scopePath ? scopePath : this.workspaceRoot;
    const files = await this.discoverFiles(basePath, definition, options);

    session.file_inventory = files;
    session.files_total = files.length;

    // Mark inventory phase as complete
    const inventoryPhase = session.phases.find(p => p.id === 'inventory');
    if (inventoryPhase) {
      inventoryPhase.status = 'completed';
    }

    // Run autonomous phases if requested
    let analysisSummary: AnalysisSummary | undefined;
    if (initialProcessing.run_autonomous_phases && definition.pattern_discovery?.enabled) {
      analysisSummary = await this.runPatternScan(session, definition, initialProcessing.timeout_ms);

      // Mark scan phase as complete
      const scanPhase = session.phases.find(p => p.id === 'pattern_scan' || p.id === 'scan');
      if (scanPhase) {
        scanPhase.status = 'completed';
      }
    }

    // Move to next phase
    const nextPhase = session.phases.find(p => p.status === 'pending');
    if (nextPhase) {
      session.current_phase = nextPhase.id;
      nextPhase.status = 'in_progress';
    }

    session.status = 'in_progress';

    // Save session
    await this.createSession(session);

    return {
      session,
      analysisSummary,
      duration_ms: Date.now() - startTime
    };
  }

  /**
   * Discover files matching the workflow pattern
   */
  private async discoverFiles(
    basePath: string,
    definition: WorkflowDefinition,
    options: WorkflowOptions
  ): Promise<FileEntry[]> {
    const includePatterns = options.include_patterns || definition.file_patterns;
    const excludePatterns = options.exclude_patterns || definition.file_exclusions || [];

    const files: FileEntry[] = [];

    for (const pattern of includePatterns) {
      const matches = await fg(pattern, {
        cwd: basePath,
        ignore: excludePatterns,
        absolute: true,
        onlyFiles: true
      });

      for (const filePath of matches) {
        // Skip if already in inventory
        if (files.some(f => f.path === filePath)) continue;

        // Apply max_files limit
        if (options.max_files && files.length >= options.max_files) break;

        const stat = await fs.stat(filePath);
        const objectType = this.detectAlObjectType(filePath);

        files.push({
          path: filePath,
          status: 'pending',
          size: stat.size,
          object_type: objectType,
          checklist: this.createInitialChecklist(definition),
          findings: [],
          proposed_changes: []
        });
      }
    }

    // Sort by priority patterns if specified
    if (options.priority_patterns && options.priority_patterns.length > 0) {
      files.sort((a, b) => {
        const aPriority = options.priority_patterns!.findIndex(p =>
          a.path.toLowerCase().includes(p.toLowerCase())
        );
        const bPriority = options.priority_patterns!.findIndex(p =>
          b.path.toLowerCase().includes(p.toLowerCase())
        );

        // -1 means no match, put those at the end
        const aScore = aPriority === -1 ? 999 : aPriority;
        const bScore = bPriority === -1 ? 999 : bPriority;

        return aScore - bScore;
      });
    }

    return files;
  }

  /**
   * Detect AL object type from filename
   */
  private detectAlObjectType(filePath: string): string | undefined {
    const filename = path.basename(filePath).toLowerCase();

    if (filename.includes('.codeunit.')) return 'Codeunit';
    if (filename.includes('.page.')) return 'Page';
    if (filename.includes('.table.')) return 'Table';
    if (filename.includes('.report.')) return 'Report';
    if (filename.includes('.query.')) return 'Query';
    if (filename.includes('.xmlport.')) return 'XMLport';
    if (filename.includes('.enum.')) return 'Enum';
    if (filename.includes('.interface.')) return 'Interface';
    if (filename.includes('.controladdin.')) return 'ControlAddIn';
    if (filename.includes('.permissionset.')) return 'PermissionSet';
    if (filename.includes('.profile.')) return 'Profile';
    if (filename.includes('.pageextension.')) return 'PageExtension';
    if (filename.includes('.tableextension.')) return 'TableExtension';

    return undefined;
  }

  /**
   * Create initial checklist from workflow definition
   */
  private createInitialChecklist(definition: WorkflowDefinition): ChecklistItem[] {
    return definition.per_file_checklist.map(template => ({
      id: generateChecklistItemId(template.id),
      type: template.type,
      description: template.description,
      status: 'pending' as ChecklistItemStatus
    }));
  }

  /**
   * Run pattern scan on all files (autonomous phase)
   */
  private async runPatternScan(
    session: WorkflowSession,
    definition: WorkflowDefinition,
    timeoutMs: number
  ): Promise<AnalysisSummary> {
    const patterns = definition.pattern_discovery?.patterns || [];
    const byType: Record<string, { count: number; auto_fixable: boolean; needs?: string }> = {};

    let filesWithMatches = 0;
    let totalInstances = 0;

    for (const file of session.file_inventory) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        const fileInstances: ChecklistItem[] = [];

        for (const pattern of patterns) {
          const matches = this.findPatternMatches(content, pattern);

          for (const match of matches) {
            const instanceType = match.instance_type || 'other';
            const rule = pattern.instance_classifier?.rules.find(r => r.name === instanceType);
            const autoFixable = rule?.auto_fixable ?? false;

            // Track by type
            if (!byType[instanceType]) {
              byType[instanceType] = {
                count: 0,
                auto_fixable: autoFixable,
                needs: autoFixable ? undefined : 'review'
              };
            }
            byType[instanceType].count++;
            totalInstances++;

            // Create checklist item for this instance
            fileInstances.push({
              id: generateChecklistItemId(`instance-${pattern.id}`),
              type: 'pattern_instance',
              description: `Line ${match.line_number}: ${match.match_text.substring(0, 50)}...`,
              status: 'pending',
              pattern_match: match
            });
          }
        }

        if (fileInstances.length > 0) {
          filesWithMatches++;
          // Add instance items to file's checklist
          file.checklist.push(...fileInstances);
        }
      } catch (error) {
        console.error(`Error scanning file ${file.path}:`, error);
      }
    }

    // Update session with instance counts
    session.instances_total = totalInstances;
    session.instances_completed = 0;
    session.instances_auto_fixed = 0;
    session.instances_manual_review = Object.entries(byType)
      .filter(([_, info]) => !info.auto_fixable)
      .reduce((sum, [_, info]) => sum + info.count, 0);

    // Calculate batch options
    const autoFixableCount = Object.entries(byType)
      .filter(([_, info]) => info.auto_fixable)
      .reduce((sum, [_, info]) => sum + info.count, 0);

    const reviewCount = session.instances_manual_review || 0;

    return {
      files_scanned: session.file_inventory.length,
      files_with_matches: filesWithMatches,
      total_instances: totalInstances,
      by_type: byType,
      batch_options: [
        {
          action: 'apply_all_auto',
          description: 'Apply auto-fixes to simple patterns',
          instances: autoFixableCount,
          files: filesWithMatches
        },
        {
          action: 'review_complex',
          description: 'Review patterns requiring judgment',
          instances: reviewCount,
          files: session.file_inventory.filter(f =>
            f.checklist.some(c =>
              c.pattern_match && !byType[c.pattern_match.instance_type || 'other']?.auto_fixable
            )
          ).length
        },
        {
          action: 'flag_manual',
          description: 'Flag complex patterns for manual conversion',
          instances: reviewCount,
          files: session.file_inventory.filter(f =>
            f.checklist.some(c => c.pattern_match?.requires_manual_review)
          ).length
        }
      ]
    };
  }

  /**
   * Find pattern matches in file content
   */
  private findPatternMatches(content: string, pattern: PatternDefinition): PatternMatch[] {
    const matches: PatternMatch[] = [];
    const lines = content.split('\n');

    try {
      const regex = new RegExp(pattern.regex, pattern.regex_flags || 'g');
      const excludeRegex = pattern.exclude_regex ? new RegExp(pattern.exclude_regex, 'g') : null;

      let match;
      while ((match = regex.exec(content)) !== null) {
        // Check exclusion pattern
        if (excludeRegex && excludeRegex.test(match[0])) {
          continue;
        }

        // Calculate line number
        const lineNumber = content.substring(0, match.index).split('\n').length;

        // Get context lines
        const contextStart = Math.max(0, lineNumber - (pattern.context_lines || 2) - 1);
        const contextEnd = Math.min(lines.length, lineNumber + (pattern.context_lines || 2));
        const context = lines.slice(contextStart, contextEnd).join('\n');

        // Classify instance type
        let instanceType: string | undefined;
        let autoFixable = false;
        let suggestedReplacement: string | undefined;

        if (pattern.instance_classifier) {
          for (const rule of pattern.instance_classifier.rules) {
            const ruleRegex = new RegExp(rule.pattern, 'i');
            if (ruleRegex.test(match[0])) {
              instanceType = rule.name;
              autoFixable = rule.auto_fixable;
              break;
            }
          }
        }

        // Get suggested replacement if auto-fixable
        if (autoFixable && pattern.transformations) {
          const transformation = pattern.transformations.find(t => t.instance_type === instanceType);
          if (transformation) {
            // Simple template substitution (could be enhanced)
            suggestedReplacement = transformation.template;
          }
        }

        matches.push({
          pattern_id: pattern.id,
          line_number: lineNumber,
          match_text: match[0],
          match_context: context,
          instance_type: instanceType,
          suggested_replacement: suggestedReplacement,
          requires_manual_review: !autoFixable
        });
      }
    } catch (error) {
      console.error(`Error matching pattern ${pattern.id}:`, error);
    }

    return matches;
  }

  /**
   * Get next action for the workflow
   */
  getNextAction(session: WorkflowSession): NextAction {
    const currentPhase = session.phases.find(p => p.id === session.current_phase);

    // Check if workflow is complete
    if (session.files_completed >= session.files_total && !this.hasRemainingChecklist(session)) {
      return {
        type: 'complete_workflow',
        instruction: 'All files have been processed. Call workflow_complete to generate the final report.',
        tool_call: {
          tool: 'workflow_complete',
          args: {
            session_id: session.id,
            generate_report: true
          }
        }
      };
    }

    // Get current file
    const currentFile = session.file_inventory[session.current_file_index];
    if (!currentFile) {
      return {
        type: 'complete_workflow',
        instruction: 'No more files to process. Call workflow_complete to finish.',
        tool_call: {
          tool: 'workflow_complete',
          args: {
            session_id: session.id,
            generate_report: true
          }
        }
      };
    }

    // Find next pending checklist item
    const pendingItem = currentFile.checklist.find(c => c.status === 'pending');

    if (!pendingItem) {
      // Move to next file
      return this.getNextFileAction(session);
    }

    // Generate action based on checklist item type
    switch (pendingItem.type) {
      case 'analysis':
        return {
          type: 'analyze_file',
          action: 'analyze_file',
          file: currentFile.path,
          instruction: `REQUIRED: Call analyze_al_code with the content of ${path.basename(currentFile.path)}. The result will expand this file's checklist with relevant topics that MUST be applied.`,
          tool_call: {
            tool: 'analyze_al_code',
            args: {
              code: '{{file_content}}',
              analysis_type: 'comprehensive',
              bc_version: session.options.bc_version || 'BC26',
              suggest_workflows: true
            }
          }
        };

      case 'topic_application':
        return {
          type: 'apply_topic',
          action: 'apply_topic',
          file: currentFile.path,
          topic_id: pendingItem.topic_id,
          instruction: `REQUIRED: Call retrieve_bc_knowledge to get the full content of topic '${pendingItem.topic_id}'. Apply the guidance to ${path.basename(currentFile.path)}. Document any findings or proposed changes.`,
          tool_call: {
            tool: 'retrieve_bc_knowledge',
            args: {
              topic_id: pendingItem.topic_id,
              include_related: false
            }
          }
        };

      case 'pattern_instance':
        return {
          type: 'convert_instance',
          action: 'convert_instance',
          file: currentFile.path,
          instance: pendingItem.pattern_match,
          instruction: `Review and convert the pattern instance at line ${pendingItem.pattern_match?.line_number}. ${pendingItem.pattern_match?.requires_manual_review ? 'This requires manual review.' : 'This can be auto-fixed.'}`,
          tool_call: pendingItem.pattern_match?.requires_manual_review ? undefined : {
            tool: 'workflow_batch',
            args: {
              session_id: session.id,
              operation: 'apply_fixes',
              filter: { instance_types: [pendingItem.pattern_match?.instance_type] },
              dry_run: true
            }
          }
        };

      case 'validation':
        return {
          type: 'complete_workflow',
          action: 'mark_complete',
          file: currentFile.path,
          instruction: `Mark the review of ${path.basename(currentFile.path)} as complete. Call workflow_progress to report completion and get the next file.`
        };

      default:
        return {
          type: 'complete_workflow',
          action: 'unknown',
          instruction: `Unknown checklist item type: ${pendingItem.type}. Call workflow_progress to skip and continue.`
        };
    }
  }

  /**
   * Get action for moving to next file
   */
  private getNextFileAction(session: WorkflowSession): NextAction {
    // Find next pending file
    const nextIndex = session.file_inventory.findIndex(
      (f, i) => i > session.current_file_index && f.status === 'pending'
    );

    if (nextIndex === -1) {
      return {
        type: 'complete_workflow',
        instruction: 'All files have been processed. Call workflow_complete to generate the final report.',
        tool_call: {
          tool: 'workflow_complete',
          args: {
            session_id: session.id,
            generate_report: true
          }
        }
      };
    }

    const nextFile = session.file_inventory[nextIndex];
    return {
      type: 'analyze_file',
      action: 'analyze_file',
      file: nextFile.path,
      instruction: `Move to next file: ${path.basename(nextFile.path)}. Call workflow_progress to start processing.`
    };
  }

  /**
   * Check if there are remaining checklist items
   */
  private hasRemainingChecklist(session: WorkflowSession): boolean {
    return session.file_inventory.some(f =>
      f.checklist.some(c => c.status === 'pending' || c.status === 'in_progress')
    );
  }

  /**
   * Expand a file's checklist with new topic items
   */
  expandChecklist(
    session: WorkflowSession,
    filePath: string,
    topics: Array<{ topic_id: string; relevance_score: number; description: string }>
  ): void {
    const file = session.file_inventory.find(f => f.path === filePath);
    if (!file) return;

    // Get workflow definition to check minimum relevance score
    const definition = getWorkflowDefinition(session.workflow_type);
    const minScore = definition.topic_discovery.min_relevance_score;

    // Find the validation item (should be last)
    const validationIndex = file.checklist.findIndex(c => c.type === 'validation');

    // Add topic items before validation
    const newItems: ChecklistItem[] = topics
      .filter(t => t.relevance_score >= minScore)
      .map(t => ({
        id: generateChecklistItemId(`topic-${t.topic_id.replace(/\//g, '-')}`),
        type: 'topic_application' as const,
        description: `Apply topic: ${t.description}`,
        status: 'pending' as ChecklistItemStatus,
        topic_id: t.topic_id,
        topic_relevance_score: t.relevance_score
      }));

    if (validationIndex >= 0) {
      file.checklist.splice(validationIndex, 0, ...newItems);
    } else {
      file.checklist.push(...newItems);
    }
  }

  /**
   * Report progress on an action and get next action
   */
  async reportProgress(
    session: WorkflowSession,
    completedAction: {
      action: string;
      file?: string;
      checklist_item_id?: string;
      status: 'completed' | 'skipped' | 'failed';
      skip_reason?: string;
      error?: string;
    },
    findings?: Finding[],
    proposedChanges?: ProposedChange[],
    expandChecklist?: Array<{ topic_id: string; relevance_score: number; description: string }>
  ): Promise<NextAction> {
    // Find the file
    const file = completedAction.file
      ? session.file_inventory.find(f => f.path === completedAction.file)
      : session.file_inventory[session.current_file_index];

    if (file) {
      // Update checklist item status
      if (completedAction.checklist_item_id) {
        const item = file.checklist.find(c => c.id === completedAction.checklist_item_id);
        if (item) {
          item.status = completedAction.status;
          if (completedAction.error) {
            item.error = completedAction.error;
          }
        }
      } else {
        // Find the first in-progress or pending item and mark it
        const item = file.checklist.find(c =>
          c.status === 'in_progress' || c.status === 'pending'
        );
        if (item) {
          item.status = completedAction.status;
          if (completedAction.error) {
            item.error = completedAction.error;
          }
        }
      }

      // Add findings
      if (findings && findings.length > 0) {
        file.findings.push(...findings);
        session.findings.push(...findings);
      }

      // Add proposed changes
      if (proposedChanges && proposedChanges.length > 0) {
        file.proposed_changes.push(...proposedChanges);
        session.proposed_changes.push(...proposedChanges);
      }

      // Expand checklist with new topics
      if (expandChecklist && expandChecklist.length > 0) {
        this.expandChecklist(session, file.path, expandChecklist);
      }

      // Check if file is complete
      const allComplete = file.checklist.every(c =>
        c.status === 'completed' || c.status === 'skipped' || c.status === 'failed'
      );

      if (allComplete) {
        file.status = 'completed';
        session.files_completed++;

        // Move to next file
        const nextIndex = session.file_inventory.findIndex(
          (f, i) => i > session.current_file_index && f.status === 'pending'
        );
        if (nextIndex >= 0) {
          session.current_file_index = nextIndex;
          session.file_inventory[nextIndex].status = 'in_progress';
        }
      }
    }

    // Update session
    await this.updateSession(session);

    // Return next action
    return this.getNextAction(session);
  }

  /**
   * Generate completion report
   */
  async generateReport(session: WorkflowSession, format: 'markdown' | 'json' | 'html'): Promise<string> {
    const durationMinutes = Math.round(
      (new Date(session.updated_at).getTime() - new Date(session.created_at).getTime()) / 60000
    );

    const findingsBySeverity: Record<string, number> = {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0
    };

    session.findings.forEach(f => {
      findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] || 0) + 1;
    });

    if (format === 'json') {
      return JSON.stringify({
        session_id: session.id,
        workflow_type: session.workflow_type,
        completed_at: session.updated_at,
        duration_minutes: durationMinutes,
        files_reviewed: session.files_completed,
        total_findings: session.findings.length,
        findings_by_severity: findingsBySeverity,
        proposed_changes: session.proposed_changes.length,
        findings: session.findings,
        proposed_changes_detail: session.proposed_changes
      }, null, 2);
    }

    // Markdown report
    let report = `# ${this.getWorkflowDisplayName(session.workflow_type)} Report\n\n`;
    report += `## Summary\n\n`;
    report += `- **Session ID**: ${session.id}\n`;
    report += `- **Duration**: ${durationMinutes} minutes\n`;
    report += `- **Files Reviewed**: ${session.files_completed}/${session.files_total}\n`;
    report += `- **Total Findings**: ${session.findings.length}\n`;
    report += `  - Critical: ${findingsBySeverity.critical}\n`;
    report += `  - Error: ${findingsBySeverity.error}\n`;
    report += `  - Warning: ${findingsBySeverity.warning}\n`;
    report += `  - Info: ${findingsBySeverity.info}\n`;
    report += `- **Proposed Changes**: ${session.proposed_changes.length}\n\n`;

    if (session.instances_total) {
      report += `### Instance Processing\n\n`;
      report += `- Total Instances: ${session.instances_total}\n`;
      report += `- Auto-Fixed: ${session.instances_auto_fixed || 0}\n`;
      report += `- Manual Review: ${session.instances_manual_review || 0}\n\n`;
    }

    // Top issues
    const criticalIssues = session.findings.filter(f => f.severity === 'critical' || f.severity === 'error');
    if (criticalIssues.length > 0) {
      report += `## Critical/Error Issues\n\n`;
      for (const issue of criticalIssues.slice(0, 10)) {
        report += `### ${path.basename(issue.file)}${issue.line ? `:${issue.line}` : ''}\n\n`;
        report += `**${issue.severity.toUpperCase()}**: ${issue.description}\n\n`;
        if (issue.suggestion) {
          report += `**Suggestion**: ${issue.suggestion}\n\n`;
        }
      }
    }

    // Recommendations
    report += `## Recommendations\n\n`;
    if (findingsBySeverity.critical > 0) {
      report += `1. Address ${findingsBySeverity.critical} critical issues before deployment\n`;
    }
    if (findingsBySeverity.error > 0) {
      report += `2. Review ${findingsBySeverity.error} error-level findings for data integrity risks\n`;
    }
    if (session.proposed_changes.length > 0) {
      report += `3. Review ${session.proposed_changes.length} proposed code changes\n`;
    }

    // Save report
    try {
      const reportsDir = this.getReportsDir();
      const reportPath = path.join(reportsDir, `${session.id}-report.md`);
      await fs.writeFile(reportPath, report, 'utf-8');
    } catch (error) {
      console.error('Failed to save report:', error);
    }

    return report;
  }
}

// Export singleton instance
export const workflowSessionManager = new WorkflowSessionManager();
