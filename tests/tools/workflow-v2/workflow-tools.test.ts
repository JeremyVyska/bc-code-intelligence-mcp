import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createWorkflowStartHandler } from '../../../src/tools/workflow_start/handler.js';
import { createWorkflowNextHandler } from '../../../src/tools/workflow_next/handler.js';
import { createWorkflowProgressHandler } from '../../../src/tools/workflow_progress/handler.js';
import { createWorkflowStatusHandler } from '../../../src/tools/workflow_status/handler.js';
import { createWorkflowCompleteHandler } from '../../../src/tools/workflow_complete/handler.js';
import { createWorkflowBatchHandler } from '../../../src/tools/workflow_batch/handler.js';
import { WorkflowSession } from '../../../src/types/workflow-v2-types.js';

// Mock WorkflowSessionManager
const mockSession: WorkflowSession = {
  id: 'wf-test-session',
  workflow_type: 'code-review',
  status: 'in_progress',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  file_inventory: [
    {
      path: '/test/file1.al',
      status: 'in_progress',
      checklist: [
        { id: 'analyze', type: 'analysis', description: 'Analyze file', status: 'pending' }
      ],
      findings: [],
      proposed_changes: []
    },
    {
      path: '/test/file2.al',
      status: 'pending',
      checklist: [
        { id: 'analyze', type: 'analysis', description: 'Analyze file', status: 'pending' }
      ],
      findings: [],
      proposed_changes: []
    }
  ],
  file_glob_pattern: '**/*.al',
  phases: [
    { id: 'analysis', name: 'Analysis', description: 'Analyze code', status: 'in_progress', mode: 'guided', required: true },
    { id: 'summary', name: 'Summary', description: 'Generate report', status: 'pending', mode: 'autonomous', required: true }
  ],
  current_phase: 'analysis',
  current_file_index: 0,
  files_completed: 0,
  files_total: 2,
  findings: [],
  proposed_changes: [],
  options: { bc_version: 'BC26' }
};

const mockWorkflowSessionManager = {
  setWorkspaceRoot: vi.fn(),
  getSession: vi.fn().mockResolvedValue(mockSession),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  startWorkflow: vi.fn().mockResolvedValue({
    session: mockSession,
    analysisSummary: undefined,
    duration_ms: 100
  }),
  getNextAction: vi.fn().mockReturnValue({
    type: 'analyze_file',
    action: 'analyze_file',
    file: '/test/file1.al',
    instruction: 'Analyze the file'
  }),
  expandChecklist: vi.fn(),
  reportProgress: vi.fn().mockResolvedValue({
    type: 'analyze_file',
    action: 'analyze_file',
    file: '/test/file2.al',
    instruction: 'Analyze next file'
  }),
  generateReport: vi.fn().mockResolvedValue('# Test Report\n\nTest content')
};

const mockServices = {
  workflowSessionManager: mockWorkflowSessionManager
};

describe('Workflow Engine v2 Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkflowSessionManager.getSession.mockResolvedValue({ ...mockSession });
  });

  describe('workflow_start', () => {
    it('should start a new workflow session', async () => {
      const handler = createWorkflowStartHandler(mockServices);

      const result = await handler({
        workflow_type: 'code-review',
        scope: 'workspace'
      });

      expect(result.content[0].type).toBe('text');
      const output = JSON.parse(result.content[0].text);
      expect(output.session_id).toBe('wf-test-session');
      expect(output.workflow_type).toBe('code-review');
      expect(output.next_action).toBeDefined();
    });

    it('should reject invalid workflow types', async () => {
      const handler = createWorkflowStartHandler(mockServices);

      const result = await handler({
        workflow_type: 'invalid-type',
        scope: 'workspace'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Invalid workflow type');
    });

    it('should require source and target versions for bc-version-upgrade', async () => {
      const handler = createWorkflowStartHandler(mockServices);

      const result = await handler({
        workflow_type: 'bc-version-upgrade',
        scope: 'workspace'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('source_version');
    });

    it('should accept bc-version-upgrade with required options', async () => {
      const handler = createWorkflowStartHandler(mockServices);

      const result = await handler({
        workflow_type: 'bc-version-upgrade',
        scope: 'workspace',
        options: {
          source_version: 'BC21',
          target_version: 'BC27'
        }
      });

      expect(result.isError).toBeUndefined();
    });
  });

  describe('workflow_next', () => {
    it('should return next action for valid session', async () => {
      const handler = createWorkflowNextHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session'
      });

      expect(result.content[0].type).toBe('text');
      const output = JSON.parse(result.content[0].text);
      expect(output.session_id).toBe('wf-test-session');
      expect(output.next_action).toBeDefined();
      expect(output.progress).toBeDefined();
    });

    it('should return error for non-existent session', async () => {
      mockWorkflowSessionManager.getSession.mockResolvedValue(null);
      const handler = createWorkflowNextHandler(mockServices);

      const result = await handler({
        session_id: 'non-existent'
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });
  });

  describe('workflow_progress', () => {
    it('should report progress and return next action', async () => {
      const handler = createWorkflowProgressHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session',
        completed_action: {
          action: 'analyze_file',
          status: 'completed'
        },
        findings: [{
          severity: 'warning',
          category: 'performance',
          description: 'Manual summation detected'
        }]
      });

      expect(result.content[0].type).toBe('text');
      const output = JSON.parse(result.content[0].text);
      expect(output.next_action).toBeDefined();
      expect(mockWorkflowSessionManager.reportProgress).toHaveBeenCalled();
    });

    it('should reject invalid completed_action', async () => {
      const handler = createWorkflowProgressHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session',
        completed_action: {
          // Missing required fields
        }
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('workflow_status', () => {
    it('should return workflow status', async () => {
      const handler = createWorkflowStatusHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session'
      });

      expect(result.content[0].type).toBe('text');
      const output = JSON.parse(result.content[0].text);
      expect(output.session_id).toBe('wf-test-session');
      expect(output.status).toBe('in_progress');
      expect(output.progress).toBeDefined();
      expect(output.summary).toBeDefined();
    });

    it('should include file list when requested', async () => {
      const handler = createWorkflowStatusHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session',
        include_all_files: true
      });

      const output = JSON.parse(result.content[0].text);
      expect(output.files).toBeDefined();
      expect(output.files.length).toBe(2);
    });
  });

  describe('workflow_complete', () => {
    it('should complete workflow and generate report', async () => {
      const handler = createWorkflowCompleteHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session',
        generate_report: true
      });

      expect(result.content[0].type).toBe('text');
      const output = JSON.parse(result.content[0].text);
      expect(output.status).toBe('completed');
      expect(output.summary).toBeDefined();
      expect(output.report).toBeDefined();
    });
  });

  describe('workflow_batch', () => {
    it('should preview batch operation with dry_run', async () => {
      // Add pattern instances to mock session
      const sessionWithPatterns = {
        ...mockSession,
        file_inventory: [{
          path: '/test/file1.al',
          status: 'in_progress',
          checklist: [
            {
              id: 'instance-1',
              type: 'pattern_instance',
              description: 'Error() call',
              status: 'pending',
              pattern_match: {
                pattern_id: 'error-call',
                line_number: 10,
                match_text: 'Error(\'Test error\')',
                instance_type: 'literal',
                requires_manual_review: false
              }
            }
          ],
          findings: [],
          proposed_changes: []
        }]
      };
      mockWorkflowSessionManager.getSession.mockResolvedValue(sessionWithPatterns);

      const handler = createWorkflowBatchHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session',
        operation: 'apply_fixes',
        dry_run: true
      });

      expect(result.content[0].type).toBe('text');
      const output = JSON.parse(result.content[0].text);
      expect(output.dry_run).toBe(true);
      expect(output.preview).toBeDefined();
      expect(output.confirmation_token).toBeDefined();
    });

    it('should reject invalid operation', async () => {
      const handler = createWorkflowBatchHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session',
        operation: 'invalid_operation'
      });

      expect(result.isError).toBe(true);
    });

    it('should group instances by type', async () => {
      const sessionWithPatterns = {
        ...mockSession,
        file_inventory: [{
          path: '/test/file1.al',
          status: 'in_progress',
          checklist: [
            {
              id: 'instance-1',
              type: 'pattern_instance',
              description: 'Error() call',
              status: 'pending',
              pattern_match: {
                pattern_id: 'error-call',
                line_number: 10,
                match_text: 'Error(\'Test\')',
                instance_type: 'literal'
              }
            },
            {
              id: 'instance-2',
              type: 'pattern_instance',
              description: 'Error() call',
              status: 'pending',
              pattern_match: {
                pattern_id: 'error-call',
                line_number: 20,
                match_text: 'Error(MyLabel)',
                instance_type: 'text_constant'
              }
            }
          ],
          findings: [],
          proposed_changes: []
        }]
      };
      mockWorkflowSessionManager.getSession.mockResolvedValue(sessionWithPatterns);

      const handler = createWorkflowBatchHandler(mockServices);

      const result = await handler({
        session_id: 'wf-test-session',
        operation: 'group_by_type'
      });

      const output = JSON.parse(result.content[0].text);
      expect(output.grouped_instances).toBeDefined();
      expect(output.grouped_instances.literal).toBeDefined();
      expect(output.grouped_instances.text_constant).toBeDefined();
    });
  });

  describe('Tool Schemas Match Implementation', () => {
    it('workflow_start accepts all defined workflow types', async () => {
      const handler = createWorkflowStartHandler(mockServices);
      const workflowTypes = [
        'code-review',
        'proposal-review',
        'performance-audit',
        'security-audit',
        'onboarding',
        'error-to-errorinfo-migration'
      ];

      for (const type of workflowTypes) {
        vi.clearAllMocks();
        mockWorkflowSessionManager.startWorkflow.mockResolvedValue({
          session: { ...mockSession, workflow_type: type },
          duration_ms: 100
        });

        const result = await handler({
          workflow_type: type,
          scope: 'workspace'
        });

        expect(result.isError).toBeUndefined();
      }
    });
  });
});

