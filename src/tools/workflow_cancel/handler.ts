/**
 * workflow_cancel Tool - Handler Implementation
 *
 * Cancel or reset workflow sessions.
 */

import { WorkflowSessionManager } from '../../services/workflow-v2/workflow-session-manager.js';

export function createWorkflowCancelHandler(services: any) {
  const workflowSessionManager: WorkflowSessionManager = services.workflowSessionManager;
  const workflowService = services.workflowService;

  return async (args: any) => {
    const { session_id, cancel_all = false } = args;

    try {
      // Get all active sessions (v2 workflow engine)
      const allSessions = workflowSessionManager ? await workflowSessionManager.listActiveSessions() : [];

      // Also check v1 workflow service for active sessions
      const v1Sessions: any[] = [];
      if (workflowService && typeof workflowService.listActiveSessions === 'function') {
        const v1List = await workflowService.listActiveSessions();
        v1Sessions.push(...v1List);
      }

      // If cancel_all, delete all sessions
      if (cancel_all) {
        const cancelledV2: string[] = [];
        const cancelledV1: string[] = [];

        // Cancel v2 sessions
        if (workflowSessionManager) {
          for (const session of allSessions) {
            await workflowSessionManager.deleteSession(session.id);
            cancelledV2.push(session.id);
          }
        }

        // Cancel v1 sessions
        if (workflowService && typeof workflowService.cancelAllWorkflows === 'function') {
          await workflowService.cancelAllWorkflows();
          cancelledV1.push(...v1Sessions.map((s: any) => s.id));
        } else if (workflowService && typeof workflowService.cancelWorkflow === 'function') {
          for (const session of v1Sessions) {
            await workflowService.cancelWorkflow(session.id);
            cancelledV1.push(session.id);
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              action: 'cancel_all',
              success: true,
              cancelled_v2_sessions: cancelledV2,
              cancelled_v1_sessions: cancelledV1,
              total_cancelled: cancelledV2.length + cancelledV1.length,
              message: `Cancelled ${cancelledV2.length + cancelledV1.length} workflow session(s). Ready to start fresh.`
            }, null, 2)
          }]
        };
      }

      // If session_id provided, cancel that specific session
      if (session_id) {
        // Try v2 first
        const v2Session = allSessions.find(s => s.id === session_id);
        if (v2Session && workflowSessionManager) {
          await workflowSessionManager.deleteSession(session_id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                action: 'cancel',
                success: true,
                session_id,
                workflow_type: v2Session.workflow_type,
                message: `Cancelled workflow session '${session_id}' (${v2Session.workflow_type})`
              }, null, 2)
            }]
          };
        }

        // Try v1
        const v1Session = v1Sessions.find((s: any) => s.id === session_id);
        if (v1Session && workflowService && typeof workflowService.cancelWorkflow === 'function') {
          await workflowService.cancelWorkflow(session_id);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                action: 'cancel',
                success: true,
                session_id,
                workflow_type: v1Session.type || 'v1-workflow',
                message: `Cancelled workflow session '${session_id}'`
              }, null, 2)
            }]
          };
        }

        return {
          isError: true,
          error: `Session not found: ${session_id}`,
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              action: 'cancel',
              success: false,
              session_id,
              error: `Session '${session_id}' not found`,
              available_sessions: [
                ...allSessions.map(s => ({ id: s.id, type: s.workflow_type, engine: 'v2' })),
                ...v1Sessions.map((s: any) => ({ id: s.id, type: s.type, engine: 'v1' }))
              ]
            }, null, 2)
          }]
        };
      }

      // No session_id and no cancel_all - list active sessions
      const sessionList = [
        ...allSessions.map(s => ({
          id: s.id,
          workflow_type: s.workflow_type,
          status: s.status,
          created_at: s.created_at,
          files_completed: s.files_completed,
          files_total: s.files_total,
          engine: 'v2'
        })),
        ...v1Sessions.map((s: any) => ({
          id: s.id,
          workflow_type: s.type,
          status: s.status,
          created_at: s.created_at,
          current_phase: s.current_phase,
          engine: 'v1'
        }))
      ];

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            action: 'list',
            active_sessions: sessionList,
            total_count: sessionList.length,
            message: sessionList.length === 0
              ? 'No active workflow sessions'
              : `Found ${sessionList.length} active session(s). Use session_id to cancel specific session, or cancel_all=true to clear all.`
          }, null, 2)
        }]
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        isError: true,
        error: errorMessage,
        content: [{
          type: 'text' as const,
          text: `Error: ${errorMessage}`
        }]
      };
    }
  };
}
