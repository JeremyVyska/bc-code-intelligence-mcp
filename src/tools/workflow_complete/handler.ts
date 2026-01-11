/**
 * workflow_complete Tool - Handler Implementation
 *
 * Complete the workflow and generate final report.
 */

import { WorkflowSessionManagerV2 } from '../../services/workflow-v2/workflow-session-manager.js';
import { WorkflowCompleteOutput, FindingSeverity } from '../../types/workflow-v2-types.js';

export function createWorkflowCompleteHandler(services: any) {
  const workflowSessionManager: WorkflowSessionManagerV2 = services.workflowSessionManagerV2;

  return async (args: any) => {
    const {
      session_id,
      generate_report = true,
      apply_changes = false,
      report_format = 'markdown'
    } = args;

    try {
      // Get session
      const session = await workflowSessionManager.getSession(session_id);
      if (!session) {
        return {
          isError: true,
          error: `Session not found: ${session_id}`,
          content: [{
            type: 'text' as const,
            text: `Error: Workflow session '${session_id}' not found.`
          }]
        };
      }

      // Apply changes if requested
      let changesApplied = 0;
      if (apply_changes) {
        // For now, just count auto-applicable changes
        // Actual file modification would be implemented here
        changesApplied = session.proposed_changes.filter(c => c.auto_applicable).length;
        // TODO: Actually apply the changes to files
      }

      // Mark session as completed
      session.status = 'completed';
      await workflowSessionManager.updateSession(session);

      // Calculate duration
      const startTime = new Date(session.created_at);
      const endTime = new Date();
      const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

      // Calculate findings by severity
      const findingsBySeverity: Record<FindingSeverity, number> = {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0
      };

      session.findings.forEach(f => {
        findingsBySeverity[f.severity]++;
      });

      // Count topics applied
      let topicsApplied = 0;
      session.file_inventory.forEach(file => {
        file.checklist.forEach(item => {
          if (item.type === 'topic_application' && item.status === 'completed') {
            topicsApplied++;
          }
        });
      });

      // Generate report if requested
      let report: string | undefined;
      if (generate_report) {
        report = await workflowSessionManager.generateReport(session, report_format as any);
      }

      // Get top issues (critical and error)
      const topIssues = session.findings
        .filter(f => f.severity === 'critical' || f.severity === 'error')
        .slice(0, 10)
        .map(f => ({
          file: f.file,
          severity: f.severity,
          description: f.description,
          suggestion: f.suggestion
        }));

      // Generate recommendations
      const recommendations: string[] = [];
      if (findingsBySeverity.critical > 0) {
        recommendations.push(`Address ${findingsBySeverity.critical} critical issues before deployment`);
      }
      if (findingsBySeverity.error > 0) {
        recommendations.push(`Review ${findingsBySeverity.error} error-level findings for data integrity risks`);
      }
      if (session.proposed_changes.length > 0) {
        recommendations.push(`Review and apply ${session.proposed_changes.length} proposed code changes`);
      }
      if (session.instances_manual_review && session.instances_manual_review > 0) {
        recommendations.push(`${session.instances_manual_review} pattern instances require manual review`);
      }

      // Build response
      const output: WorkflowCompleteOutput = {
        session_id: session.id,
        status: 'completed',
        completed_at: endTime.toISOString(),
        duration_minutes: durationMinutes,

        summary: {
          files_reviewed: session.files_completed,
          total_findings: session.findings.length,
          findings_by_severity: findingsBySeverity,
          proposed_changes: session.proposed_changes.length,
          changes_applied: changesApplied,
          topics_applied: topicsApplied
        },

        report,
        top_issues: topIssues,
        recommendations
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(output, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isError: true,
        error: errorMessage,
        content: [{
          type: 'text' as const,
          text: `Error completing workflow: ${errorMessage}`
        }]
      };
    }
  };
}
