// Streamlined 8-tool interface for BCKB MCP Server 1.0.1
export const streamlinedTools = [
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
• Always prioritize AL language capabilities and BC platform limitations over generic programming approaches`,
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
        }
      },
      required: ['question']
    }
  },
  {
    name: 'analyze_al_code',
    description: 'Analyze AL/BC code for issues, patterns, optimization opportunities, and improvements. Includes workspace analysis and workflow recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'AL/BC code to analyze (or "workspace" to analyze current workspace)'
        },
        analysis_type: {
          type: 'string',
          enum: ['performance', 'quality', 'security', 'patterns', 'optimization', 'general', 'comprehensive'],
          description: 'Type of analysis to perform',
          default: 'comprehensive'
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
        }
      },
      required: ['topic_id']
    }
  },
  {
    name: 'start_bc_workflow',
    description: 'STRUCTURED WORKFLOWS: Start systematic BC development workflows for complex, multi-phase processes. USE FOR STRUCTURED PROCESSES like "optimize my code systematically", "conduct architecture review", "security audit", "performance analysis". DO NOT USE FOR SIMPLE CONVERSATIONS - if user wants to "talk to" or "ask" a specialist, use ask_bc_expert instead.',
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
    description: 'Progress to the next phase of an active workflow with your results and feedback, or check workflow status.',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: {
          type: 'string',
          description: 'ID of the workflow session to advance'
        },
        phase_results: {
          type: 'string',
          description: 'Results from the current phase, decisions made, or feedback (optional for status checks)'
        },
        next_focus: {
          type: 'string',
          description: 'Optional: specific focus area for the next phase'
        },
        check_status_only: {
          type: 'boolean',
          description: 'Only check workflow status without advancing',
          default: false
        }
      },
      required: ['workflow_id']
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
    name: 'get_bc_help',
    description: 'Meta-tool that analyzes your current context and suggests what BC tools or workflows to use next. Use when unsure what to do.',
    inputSchema: {
      type: 'object',
      properties: {
        current_situation: {
          type: 'string',
          description: 'Description of your current situation, challenge, or what you\'re trying to accomplish'
        },
        workspace_context: {
          type: 'string',
          description: 'Optional: information about your current AL workspace or project'
        }
      },
      required: ['current_situation']
    }
  }
];