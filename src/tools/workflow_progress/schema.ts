/**
 * workflow_progress Tool - Schema Definition
 *
 * Report progress on current action and get next action.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const workflowProgressTool: Tool = {
  name: 'workflow_progress',
  description: `Report progress on current workflow action and get the next action.

Call this after completing each action (analyzing a file, applying a topic, converting an instance).
Include any findings, proposed changes, and topics to add to the checklist.

The engine updates session state and returns the next action to perform.`,
  inputSchema: {
    type: 'object',
    properties: {
      session_id: {
        type: 'string',
        description: 'Workflow session ID'
      },
      completed_action: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'The action that was completed (e.g., "analyze_file", "apply_topic")'
          },
          file: {
            type: 'string',
            description: 'File path that was processed'
          },
          checklist_item_id: {
            type: 'string',
            description: 'ID of the checklist item that was completed'
          },
          status: {
            type: 'string',
            enum: ['completed', 'skipped', 'failed'],
            description: 'Status of the action'
          },
          skip_reason: {
            type: 'string',
            description: 'Reason for skipping (if status is skipped)'
          },
          error: {
            type: 'string',
            description: 'Error message (if status is failed)'
          }
        },
        required: ['action', 'status'],
        description: 'Information about the completed action'
      },
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            line: { type: 'number' },
            severity: {
              type: 'string',
              enum: ['info', 'warning', 'error', 'critical']
            },
            category: { type: 'string' },
            description: { type: 'string' },
            suggestion: { type: 'string' },
            related_topic: { type: 'string' }
          },
          required: ['severity', 'category', 'description']
        },
        description: 'Issues or observations found during this action'
      },
      proposed_changes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            line_start: { type: 'number' },
            line_end: { type: 'number' },
            original_code: { type: 'string' },
            proposed_code: { type: 'string' },
            rationale: { type: 'string' },
            impact: {
              type: 'string',
              enum: ['low', 'medium', 'high']
            },
            auto_applicable: { type: 'boolean' }
          },
          required: ['file', 'line_start', 'line_end', 'original_code', 'proposed_code', 'rationale']
        },
        description: 'Code changes proposed during this action'
      },
      expand_checklist: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            topic_id: { type: 'string' },
            relevance_score: { type: 'number' },
            description: { type: 'string' }
          },
          required: ['topic_id', 'relevance_score', 'description']
        },
        description: 'Additional topics to add to current file\'s checklist (from analyze_al_code suggested_topics)'
      }
    },
    required: ['session_id', 'completed_action']
  }
};
