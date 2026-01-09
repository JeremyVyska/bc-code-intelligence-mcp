/**
 * Core BC Knowledge MCP Tools
 * 
 * The fundamental 8-tool interface for Business Central development assistance.
 * These tools provide the primary interface for accessing BC knowledge, specialists,
 * and workflows.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool name constants for type safety
 */
export const STREAMLINED_TOOL_NAMES = {
  FIND_BC_KNOWLEDGE: 'find_bc_knowledge',
  ASK_BC_EXPERT: 'ask_bc_expert',
  ANALYZE_AL_CODE: 'analyze_al_code',
  GET_BC_TOPIC: 'get_bc_topic',
  START_BC_WORKFLOW: 'start_bc_workflow',
  ADVANCE_WORKFLOW: 'advance_workflow',
  GET_WORKFLOW_HELP: 'get_workflow_help',
  LIST_SPECIALISTS: 'list_specialists'
} as const;

/**
 * Core 8-tool interface for BC Code Intelligence MCP Server
 */
export const streamlinedTools: Tool[] = [
  {
    name: 'find_bc_knowledge',
    description: 'Search BC knowledge topics, find specialists, or discover workflows. Use this when users want to find information about BC development.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or question about BC development'
        },
        search_type: {
          type: 'string',
          enum: ['topics', 'specialists', 'workflows', 'all'],
          description: 'Type of search to perform',
          default: 'all'
        },
        bc_version: {
          type: 'string',
          description: 'Business Central version (e.g., "BC22", "BC20")'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return',
          default: 10
        }
      },
      required: ['query']
    }
  },
  {
    name: 'ask_bc_expert',
    description: `DIRECT SPECIALIST CONSULTATION: Connect with BC specialists who respond immediately as themselves, not as AI assistants describing roleplay. When user says "Talk to Sam" or "Ask Dean about debugging", you get authentic specialist expertise directly. CRITICAL: Do not explain roleplay or offer menus - respond AS the specialist would respond. USE FOR: "Talk to Sam", "Ask Dean about debugging", "I took over this BC app", "Help with performance issues". DO NOT USE FOR WORKFLOWS.

🔧 **AL/BC Platform Constraints**: All specialist responses MUST respect Business Central and AL language limitations:
• Security: AL permission objects, user groups, BC security framework - NOT external auth systems
• UX: AL page/report constraints - BC controls rendering, NOT custom CSS/HTML  
• Performance: AL optimization, table design, BC server constraints - NOT generic frameworks
• API: BC API pages, web services, AL integration - NOT generic REST frameworks
• Always prioritize AL language capabilities and BC platform limitations over generic programming approaches

🤖 **AUTONOMOUS AGENT MODE**: Set autonomous_mode=true for GitHub Coding Agents and autonomous workflows. Returns structured, actionable JSON with: action_plan (executable steps), confidence scores, blocking_issues, and alternatives. Use for Issue → PR automation.`,
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Your specific question or challenge about BC development'
        },
        context: {
          type: 'string',
          description: 'Optional context about your situation, code, or project'
        },
        preferred_specialist: {
          type: 'string',
          description: 'Optional: specific specialist to consult (will auto-detect if not provided)'
        },
        autonomous_mode: {
          type: 'boolean',
          description: 'Enable autonomous agent mode: returns structured action plan instead of conversational response. For GitHub Coding Agents and automated workflows.',
          default: false
        }
      },
      required: ['question']
    }
  },
  {
    name: 'analyze_al_code',
    description: 'Analyze AL code for issues, patterns, and improvements. Includes workspace analysis and workflow recommendations. BEST PRACTICE: When generating new AL code, use operation="validate" on your draft BEFORE presenting to user - this catches company standards, naming conventions, and best practices early. AUTONOMOUS AGENT MODE: Use operation="validate" for automated code validation with compliance checks and auto-fix suggestions. Use operation="suggest_fixes" for code transformations recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'AL code to analyze (or "workspace" to analyze current workspace)'
        },
        analysis_type: {
          type: 'string',
          enum: ['performance', 'quality', 'security', 'patterns', 'comprehensive'],
          description: 'Type of analysis to perform',
          default: 'comprehensive'
        },
        operation: {
          type: 'string',
          enum: ['analyze', 'validate', 'suggest_fixes'],
          description: 'Analysis operation mode: "analyze" (conversational), "validate" (compliance check + auto-fixes), "suggest_fixes" (code transformations)',
          default: 'analyze'
        },
        bc_version: {
          type: 'string',
          description: 'Business Central version for version-specific analysis'
        },
        suggest_workflows: {
          type: 'boolean',
          description: 'Include workflow recommendations based on analysis',
          default: true
        }
      },
      required: ['code']
    }
  },
  {
    name: 'get_bc_topic',
    description: 'Get detailed content for a specific BC knowledge topic with examples and best practices.',
    inputSchema: {
      type: 'object',
      properties: {
        topic_id: {
          type: 'string',
          description: 'Unique topic identifier (e.g., "sift-technology-fundamentals")'
        },
        include_samples: {
          type: 'boolean',
          description: 'Include companion AL code samples if available',
          default: true
        },
        specialist_context: {
          type: 'string',
          description: 'Optional: Current specialist ID (e.g., "sam-coder", "chris-config") to provide domain-specific suggestions if topic is not found'
        }
      },
      required: ['topic_id']
    }
  },
  {
    name: 'start_bc_workflow',
    description: `LONG-RUNNING ANALYTICAL WORKFLOWS: Use for large-scale, multi-phase work that spans multiple files/sessions and requires systematic progress tracking with checkpoint/resume support.

USE WORKFLOWS FOR:
✅ Large-scale analysis: "Analyze my 1000-file BC app for performance issues"
✅ Complete audits: "Security audit of entire extension" or "Review all code for BC23 compatibility"
✅ Multi-session work: Tasks that take hours/days and need resume capability
✅ Systematic reviews: Full codebase analysis requiring structured methodology
✅ GitHub Coding Agents: Autonomous execution with checkpoints across multiple invocations

DO NOT USE FOR CONVERSATIONS:
❌ "Help me add caching to this API" → Use ask_bc_expert instead
❌ "Talk to Sam about performance" → Use ask_bc_expert instead
❌ "Review this one function" → Use ask_bc_expert instead
❌ "I need guidance on X" → Use ask_bc_expert instead

KEY FEATURES: State persistence, progress tracking, multi-phase coordination, checkpoint resume, constitutional gate validation, artifact accumulation across phases.

🤖 AUTONOMOUS MODE: Set execution_mode="autonomous" for GitHub Coding Agents - returns structured action plans with checkpoint IDs for resumption.`,
    inputSchema: {
      type: 'object',
      properties: {
        workflow_type: {
          type: 'string',
          enum: ['new-bc-app', 'enhance-bc-app', 'review-bc-code', 'debug-bc-issues', 'modernize-bc-code', 'onboard-developer', 'upgrade-bc-version', 'add-ecosystem-features', 'document-bc-solution'],
          description: 'Type of workflow to start'
        },
        context: {
          type: 'string',
          description: 'Project context, code location, or description of what needs to be worked on'
        },
        bc_version: {
          type: 'string',
          description: 'Business Central version'
        },
        execution_mode: {
          type: 'string',
          enum: ['interactive', 'autonomous'],
          description: 'Execution mode: "interactive" (human-in-loop with prompts) or "autonomous" (returns structured next action for automated workflows)',
          default: 'interactive'
        },
        checkpoint_id: {
          type: 'string',
          description: 'Resume from saved workflow checkpoint (for multi-session execution). Enables stateful workflow progression across multiple invocations.'
        },
        additional_info: {
          type: 'object',
          description: 'Additional context specific to the workflow type'
        }
      },
      required: ['workflow_type', 'context']
    }
  },
  {
    name: 'advance_workflow',
    description: 'Progress to the next phase of an active workflow with your results and feedback.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: 'ID of the workflow session to advance'
        },
        phase_results: {
          type: 'string',
          description: 'Results from the current phase, decisions made, or feedback'
        },
        next_focus: {
          type: 'string',
          description: 'Optional: specific focus area for the next phase'
        }
      },
      required: ['workflow_id', 'phase_results']
    }
  },
  {
    name: 'get_workflow_help',
    description: 'Get guidance for current workflow phase, check status, or understand next steps.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: 'ID of the workflow session (optional - will list active workflows if not provided)'
        },
        help_type: {
          type: 'string',
          enum: ['status', 'guidance', 'next-steps', 'methodology'],
          description: 'Type of help to provide',
          default: 'guidance'
        }
      }
    }
  },
  {
    name: 'list_specialists',
    description: 'Browse available BC specialists and their expertise areas. Useful for discovering the specialist team and understanding who helps with what. After browsing, use ask_bc_expert with preferred_specialist parameter to connect with a specific specialist.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Filter by domain (e.g., performance, security, api-design) - optional'
        },
        expertise: {
          type: 'string',
          description: 'Filter by expertise area (e.g., caching, authentication) - optional'
        }
      },
      required: []
    }
  }
];
