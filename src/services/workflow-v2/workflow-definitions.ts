/**
 * Workflow Definitions v2
 *
 * Defines the available workflow types and their configurations.
 */

import {
  WorkflowType,
  WorkflowDefinition,
  PatternDefinition
} from '../../types/workflow-v2-types.js';

/**
 * Error() to ErrorInfo pattern definitions
 */
const errorPatterns: PatternDefinition[] = [
  {
    id: 'error-call',
    name: 'Error() Call',
    description: 'Legacy Error() function calls that should use ErrorInfo',
    regex: 'Error\\s*\\((?!\\s*ErrorInfo)[^)]+\\)',
    regex_flags: 'gi',
    exclude_regex: '//.*Error|ErrorInfo\\.Create',
    context_lines: 2,
    instance_classifier: {
      rules: [
        {
          name: 'literal',
          pattern: "Error\\s*\\(\\s*'[^']*'\\s*\\)",
          suggested_action: 'Wrap string in ErrorInfo.Create()',
          auto_fixable: true
        },
        {
          name: 'strsubstno',
          pattern: "Error\\s*\\(\\s*'[^']*%[0-9]+[^']*'",
          suggested_action: 'Convert to ErrorInfo.Create(StrSubstNo(...))',
          auto_fixable: true
        },
        {
          name: 'text_constant',
          pattern: 'Error\\s*\\(\\s*[A-Z][A-Za-z0-9_]+\\s*\\)',
          suggested_action: 'Review text constant, then wrap in ErrorInfo.Create()',
          auto_fixable: false
        },
        {
          name: 'strsubstno_with_constant',
          pattern: 'Error\\s*\\(\\s*StrSubstNo\\s*\\(\\s*[A-Z]',
          suggested_action: 'Review text constant usage in StrSubstNo',
          auto_fixable: false
        },
        {
          name: 'function_call',
          pattern: 'Error\\s*\\(\\s*[A-Z][A-Za-z0-9_]+\\s*\\(',
          suggested_action: 'Analyze function return, may need ErrorInfo integration',
          auto_fixable: false
        },
        {
          name: 'getlasterror',
          pattern: 'Error\\s*\\(\\s*GetLastErrorText',
          suggested_action: 'Consider using ErrorInfo from original error source',
          auto_fixable: false
        }
      ]
    },
    transformations: [
      {
        instance_type: 'literal',
        template: 'Error(ErrorInfo.Create({{original_string}}))',
        requires_review: false
      },
      {
        instance_type: 'strsubstno',
        template: 'Error(ErrorInfo.Create(StrSubstNo({{original_string}}, {{params}})))',
        requires_review: false
      },
      {
        instance_type: 'text_constant',
        template: 'Error(ErrorInfo.Create({{constant_name}}))',
        requires_review: true
      }
    ],
    specialist: 'eva-errors',
    topic_id: 'eva-errors/errorinfo-migration-guide'
  }
];

/**
 * Code Review Workflow Definition
 */
const codeReviewWorkflow: WorkflowDefinition = {
  type: 'code-review',
  name: 'Business Central Code Review',
  description: 'Systematic code review for AL extensions',

  file_patterns: ['**/*.al'],
  file_exclusions: ['**/test/**', '**/.altestrunner/**', '**/node_modules/**'],

  phases: [
    {
      id: 'inventory',
      name: 'File Inventory',
      description: 'Enumerate all AL files in scope',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'analysis',
      name: 'Code Analysis',
      description: 'Run analyze_al_code on each file, expand checklists',
      required: true,
      mode: 'guided',
      available_actions: ['analyze_file', 'expand_checklist']
    },
    {
      id: 'topic_application',
      name: 'Topic Application',
      description: 'Apply relevant topics to each file',
      required: true,
      mode: 'guided',
      available_actions: ['apply_topic', 'record_finding', 'propose_change']
    },
    {
      id: 'summary',
      name: 'Summary & Report',
      description: 'Generate final report',
      required: true,
      mode: 'autonomous'
    }
  ],

  per_file_checklist: [
    {
      id: 'analyze',
      type: 'analysis',
      description: 'Run analyze_al_code',
      required: true
    },
    {
      id: 'review_complete',
      type: 'validation',
      description: 'Mark review complete',
      required: true
    }
  ],

  topic_discovery: {
    enabled: true,
    tool: 'analyze_al_code',
    auto_expand_checklist: true,
    min_relevance_score: 0.6
  },

  completion_rules: {
    require_all_files: true,
    require_all_checklist_items: true,
    allow_skip_with_reason: true
  }
};

/**
 * Error to ErrorInfo Migration Workflow Definition
 */
const errorMigrationWorkflow: WorkflowDefinition = {
  type: 'error-to-errorinfo-migration',
  name: 'Error to ErrorInfo Migration',
  description: 'Convert legacy Error() calls to modern ErrorInfo pattern',
  specialist: 'eva-errors',

  file_patterns: ['**/*.al'],
  file_exclusions: ['**/test/**', '**/.altestrunner/**'],

  phases: [
    {
      id: 'inventory',
      name: 'File Inventory',
      description: 'Enumerate all AL files',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'pattern_scan',
      name: 'Pattern Scan',
      description: 'Scan all files for Error() patterns',
      required: true,
      mode: 'autonomous',
      available_actions: ['scan_file', 'expand_checklist_with_instances']
    },
    {
      id: 'batch_auto',
      name: 'Batch Auto-Fix',
      description: 'Apply automatic fixes to simple patterns',
      required: false,
      mode: 'autonomous',
      available_actions: ['batch_apply', 'skip_batch']
    },
    {
      id: 'manual_review',
      name: 'Manual Review',
      description: 'Review and convert complex patterns',
      required: true,
      mode: 'guided',
      available_actions: ['convert_instance', 'skip_instance', 'flag_for_later']
    },
    {
      id: 'verification',
      name: 'Verification',
      description: 'Verify all conversions compile and work',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'summary',
      name: 'Summary & Report',
      description: 'Generate final report',
      required: true,
      mode: 'autonomous'
    }
  ],

  per_file_checklist: [
    {
      id: 'scan',
      type: 'analysis',
      description: 'Scan for Error() patterns',
      required: true
    },
    {
      id: 'review_complete',
      type: 'validation',
      description: 'All Error() calls addressed',
      required: true
    }
  ],

  topic_discovery: {
    enabled: true,
    tool: 'retrieve_bc_knowledge',
    auto_expand_checklist: false,
    min_relevance_score: 0.8
  },

  pattern_discovery: {
    enabled: true,
    patterns: errorPatterns,
    create_instance_items: true,
    group_identical: true,
    specialist: 'eva-errors'
  },

  completion_rules: {
    require_all_files: true,
    require_all_checklist_items: true,
    allow_skip_with_reason: true
  }
};

/**
 * Proposal Review Workflow Definition
 */
const proposalReviewWorkflow: WorkflowDefinition = {
  type: 'proposal-review',
  name: 'Proposal Review Workflow',
  description: 'Review documentation and proposals',

  file_patterns: ['docs/**/*.md', 'proposals/**/*.md', '*.md'],
  file_exclusions: [],

  phases: [
    {
      id: 'inventory',
      name: 'Document Inventory',
      description: 'Find all relevant documents',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'analysis',
      name: 'Document Analysis',
      description: 'Analyze document structure and content',
      required: true,
      mode: 'guided'
    },
    {
      id: 'specialist_review',
      name: 'Specialist Review',
      description: 'Apply specialist guidance',
      required: true,
      mode: 'guided'
    },
    {
      id: 'summary',
      name: 'Summary',
      description: 'Generate review summary',
      required: true,
      mode: 'autonomous'
    }
  ],

  per_file_checklist: [
    {
      id: 'read_document',
      type: 'analysis',
      description: 'Read and understand document',
      required: true
    },
    {
      id: 'identify_specialists',
      type: 'analysis',
      description: 'Identify relevant specialists',
      required: true
    },
    {
      id: 'specialist_review',
      type: 'topic_application',
      description: 'Apply specialist guidance',
      required: true
    }
  ],

  topic_discovery: {
    enabled: true,
    tool: 'ask_bc_expert',
    auto_expand_checklist: true,
    min_relevance_score: 0.5
  },

  completion_rules: {
    require_all_files: true,
    require_all_checklist_items: true,
    allow_skip_with_reason: true
  }
};

/**
 * Performance Audit Workflow Definition
 */
const performanceAuditWorkflow: WorkflowDefinition = {
  type: 'performance-audit',
  name: 'Performance Audit',
  description: 'Systematic performance review of AL code',

  file_patterns: ['**/*.al'],
  file_exclusions: ['**/test/**', '**/.altestrunner/**', '**/node_modules/**'],

  phases: [
    {
      id: 'inventory',
      name: 'File Inventory',
      description: 'Enumerate all AL files',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'pattern_scan',
      name: 'Performance Pattern Scan',
      description: 'Scan for common performance issues',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'analysis',
      name: 'Deep Analysis',
      description: 'Analyze performance-critical code paths',
      required: true,
      mode: 'guided'
    },
    {
      id: 'recommendations',
      name: 'Recommendations',
      description: 'Generate optimization recommendations',
      required: true,
      mode: 'guided'
    },
    {
      id: 'summary',
      name: 'Summary & Report',
      description: 'Generate performance audit report',
      required: true,
      mode: 'autonomous'
    }
  ],

  per_file_checklist: [
    {
      id: 'scan_perf',
      type: 'analysis',
      description: 'Scan for performance patterns',
      required: true
    },
    {
      id: 'review_complete',
      type: 'validation',
      description: 'Performance review complete',
      required: true
    }
  ],

  topic_discovery: {
    enabled: true,
    tool: 'analyze_al_code',
    auto_expand_checklist: true,
    min_relevance_score: 0.7
  },

  completion_rules: {
    require_all_files: true,
    require_all_checklist_items: true,
    allow_skip_with_reason: true
  }
};

/**
 * Security Audit Workflow Definition
 */
const securityAuditWorkflow: WorkflowDefinition = {
  type: 'security-audit',
  name: 'Security Audit',
  description: 'Security review of AL code and configurations',

  file_patterns: ['**/*.al', '**/app.json', '**/launch.json'],
  file_exclusions: ['**/test/**', '**/node_modules/**'],

  phases: [
    {
      id: 'inventory',
      name: 'File Inventory',
      description: 'Enumerate files for security review',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'pattern_scan',
      name: 'Security Pattern Scan',
      description: 'Scan for security vulnerabilities',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'permission_review',
      name: 'Permission Review',
      description: 'Review permission sets and access controls',
      required: true,
      mode: 'guided'
    },
    {
      id: 'data_handling',
      name: 'Data Handling Review',
      description: 'Review sensitive data handling',
      required: true,
      mode: 'guided'
    },
    {
      id: 'summary',
      name: 'Security Report',
      description: 'Generate security audit report',
      required: true,
      mode: 'autonomous'
    }
  ],

  per_file_checklist: [
    {
      id: 'scan_security',
      type: 'analysis',
      description: 'Scan for security patterns',
      required: true
    },
    {
      id: 'review_complete',
      type: 'validation',
      description: 'Security review complete',
      required: true
    }
  ],

  topic_discovery: {
    enabled: true,
    tool: 'analyze_al_code',
    auto_expand_checklist: true,
    min_relevance_score: 0.6
  },

  completion_rules: {
    require_all_files: true,
    require_all_checklist_items: true,
    allow_skip_with_reason: true
  }
};

/**
 * Developer Onboarding Workflow Definition
 */
const onboardingWorkflow: WorkflowDefinition = {
  type: 'onboarding',
  name: 'Developer Onboarding',
  description: 'Guide new developers through codebase understanding',

  file_patterns: ['**/*.al', '**/README.md', '**/app.json'],
  file_exclusions: ['**/test/**', '**/node_modules/**'],

  phases: [
    {
      id: 'inventory',
      name: 'Codebase Inventory',
      description: 'Map the codebase structure',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'architecture',
      name: 'Architecture Overview',
      description: 'Understand the overall architecture',
      required: true,
      mode: 'guided'
    },
    {
      id: 'key_objects',
      name: 'Key Objects Review',
      description: 'Review main tables, codeunits, and pages',
      required: true,
      mode: 'guided'
    },
    {
      id: 'patterns',
      name: 'Code Patterns',
      description: 'Identify coding patterns used',
      required: true,
      mode: 'guided'
    },
    {
      id: 'summary',
      name: 'Onboarding Summary',
      description: 'Generate onboarding documentation',
      required: true,
      mode: 'autonomous'
    }
  ],

  per_file_checklist: [
    {
      id: 'understand',
      type: 'analysis',
      description: 'Understand file purpose',
      required: true
    },
    {
      id: 'document',
      type: 'validation',
      description: 'Document key learnings',
      required: true
    }
  ],

  topic_discovery: {
    enabled: true,
    tool: 'analyze_al_code',
    auto_expand_checklist: true,
    min_relevance_score: 0.5
  },

  completion_rules: {
    require_all_files: false,
    require_all_checklist_items: true,
    allow_skip_with_reason: true
  }
};

/**
 * BC Version Upgrade Workflow Definition
 */
const bcVersionUpgradeWorkflow: WorkflowDefinition = {
  type: 'bc-version-upgrade',
  name: 'Business Central Version Upgrade',
  description: 'Upgrade codebase from one BC version to another',
  specialist: 'logan-legacy',

  file_patterns: ['**/*.al'],
  file_exclusions: ['**/test/**', '**/.altestrunner/**'],

  phases: [
    {
      id: 'inventory',
      name: 'File Inventory',
      description: 'Enumerate all AL files',
      required: true,
      mode: 'autonomous'
    },
    {
      id: 'guide_discovery',
      name: 'Conversion Guide Discovery',
      description: 'Find all applicable conversion guides for version range',
      required: true,
      mode: 'autonomous',
      available_actions: ['search_knowledge_base', 'load_conversion_guides', 'extract_patterns']
    },
    {
      id: 'analysis',
      name: 'Impact Analysis',
      description: 'Scan all files against all patterns from all guides',
      required: true,
      mode: 'autonomous',
      available_actions: ['scan_file_multi_pattern', 'categorize_by_guide', 'prioritize_changes']
    },
    {
      id: 'guided_conversion',
      name: 'Guided Conversion',
      description: 'Apply conversions guide-by-guide, pattern-by-pattern',
      required: true,
      mode: 'guided',
      available_actions: ['apply_guide', 'convert_instance', 'skip_with_reason', 'request_specialist_help']
    },
    {
      id: 'verification',
      name: 'Compilation & Verification',
      description: 'Verify all conversions compile',
      required: true,
      mode: 'autonomous',
      available_actions: ['compile_check', 'run_tests']
    },
    {
      id: 'summary',
      name: 'Migration Report',
      description: 'Generate upgrade report',
      required: true,
      mode: 'autonomous'
    }
  ],

  per_file_checklist: [
    {
      id: 'multi_pattern_scan',
      type: 'analysis',
      description: 'Scan against all version upgrade patterns',
      required: true
    },
    {
      id: 'all_conversions_applied',
      type: 'validation',
      description: 'All applicable conversions addressed',
      required: true
    }
  ],

  topic_discovery: {
    enabled: true,
    tool: 'retrieve_bc_knowledge',
    auto_expand_checklist: true,
    min_relevance_score: 0.7
  },

  pattern_discovery: {
    enabled: true,
    patterns: [], // Patterns are extracted from knowledge topics
    create_instance_items: true,
    group_identical: true,
    specialist: 'logan-legacy'
  },

  completion_rules: {
    require_all_files: true,
    require_all_checklist_items: true,
    allow_skip_with_reason: true
  }
};

/**
 * Built-in workflow definitions (embedded layer)
 */
const builtInWorkflowDefinitions: Map<string, WorkflowDefinition> = new Map([
  ['code-review', codeReviewWorkflow],
  ['proposal-review', proposalReviewWorkflow],
  ['performance-audit', performanceAuditWorkflow],
  ['security-audit', securityAuditWorkflow],
  ['onboarding', onboardingWorkflow],
  ['error-to-errorinfo-migration', errorMigrationWorkflow],
  ['bc-version-upgrade', bcVersionUpgradeWorkflow]
]);

/**
 * Custom workflow definitions from company/project layers
 * Registered at runtime when layers are loaded
 */
const customWorkflowDefinitions: Map<string, WorkflowDefinition> = new Map();

/**
 * Register a custom workflow definition from a company or project layer.
 * Custom definitions can override built-in types if needed.
 *
 * @param definition The workflow definition to register
 * @param override If true, allows overriding built-in workflows (default: false)
 */
export function registerWorkflowDefinition(
  definition: WorkflowDefinition,
  override: boolean = false
): void {
  const type = definition.type;

  if (builtInWorkflowDefinitions.has(type) && !override) {
    console.warn(
      `Workflow type '${type}' is a built-in type. ` +
      `Use override=true to replace it with a custom definition.`
    );
    return;
  }

  customWorkflowDefinitions.set(type, definition);
}

/**
 * Unregister a custom workflow definition.
 * Cannot unregister built-in workflows.
 */
export function unregisterWorkflowDefinition(type: WorkflowType): boolean {
  return customWorkflowDefinitions.delete(type);
}

/**
 * Clear all custom workflow definitions.
 * Useful for testing or when reloading layers.
 */
export function clearCustomWorkflowDefinitions(): void {
  customWorkflowDefinitions.clear();
}

/**
 * Get workflow definition by type.
 * Custom definitions take precedence over built-in ones.
 */
export function getWorkflowDefinition(type: WorkflowType): WorkflowDefinition {
  // Check custom definitions first (allows overrides)
  const customDefinition = customWorkflowDefinitions.get(type);
  if (customDefinition) {
    return customDefinition;
  }

  // Then check built-in definitions
  const builtInDefinition = builtInWorkflowDefinitions.get(type);
  if (builtInDefinition) {
    return builtInDefinition;
  }

  throw new Error(
    `Unknown workflow type: '${type}'. ` +
    `Available types: ${getAvailableWorkflowTypes().join(', ')}`
  );
}

/**
 * Check if a workflow type is available (built-in or custom)
 */
export function isWorkflowTypeAvailable(type: WorkflowType): boolean {
  return customWorkflowDefinitions.has(type) || builtInWorkflowDefinitions.has(type);
}

/**
 * Get all available workflow types (both built-in and custom)
 */
export function getAvailableWorkflowTypes(): WorkflowType[] {
  const types = new Set<string>();

  // Add built-in types
  for (const type of builtInWorkflowDefinitions.keys()) {
    types.add(type);
  }

  // Add custom types (may include overrides)
  for (const type of customWorkflowDefinitions.keys()) {
    types.add(type);
  }

  return Array.from(types);
}

/**
 * Get built-in workflow types only
 */
export function getBuiltInWorkflowTypes(): WorkflowType[] {
  return Array.from(builtInWorkflowDefinitions.keys());
}

/**
 * Get custom workflow types only
 */
export function getCustomWorkflowTypes(): WorkflowType[] {
  return Array.from(customWorkflowDefinitions.keys());
}

/**
 * Get workflow description
 */
export function getWorkflowDescription(type: WorkflowType): { name: string; description: string } {
  const definition = getWorkflowDefinition(type);
  return {
    name: definition.name,
    description: definition.description
  };
}
