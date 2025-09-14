/**
 * Domain-Comprehensive Optimization Workflows
 * 
 * Pre-defined step-by-step workflows for all BC development domains
 * Used by get_optimization_workflow MCP tool
 */

export const domainWorkflows: Record<string, any> = {
  'slow report': {
    steps: [
      {
        step_number: 1,
        title: 'Analyze Current Data Access Patterns',
        description: 'Review report dataset access, joins, and aggregations to identify bottlenecks',
        related_topics: ['query-performance-patterns', 'sift-technology-fundamentals'],
        validation_criteria: ['Query execution times documented', 'Data volume assessed'],
        estimated_time: '30 minutes'
      },
      {
        step_number: 2,
        title: 'Implement SIFT Indexes',
        description: 'Add SIFT indexes for aggregation operations and enable MaintainSIFTIndex',
        related_topics: ['sift-index-fundamentals', 'maintainsiftindex-property-behavior'],
        validation_criteria: ['SIFT keys created', 'MaintainSIFTIndex enabled', 'Aggregations use CalcSums'],
        estimated_time: '45 minutes'
      },
      {
        step_number: 3,
        title: 'Optimize Field Loading',
        description: 'Use SetLoadFields to reduce memory usage and network traffic',
        related_topics: ['setloadfields-optimization', 'memory-optimization'],
        validation_criteria: ['SetLoadFields implemented', 'Only required fields loaded'],
        estimated_time: '20 minutes'
      },
      {
        step_number: 4,
        title: 'Performance Testing and Validation',
        description: 'Measure performance improvements and validate against targets',
        related_topics: ['performance-monitoring', 'performance-best-practices'],
        validation_criteria: ['Performance metrics collected', 'Target response time achieved'],
        estimated_time: '30 minutes'
      }
    ],
    learning_path: ['sift-technology-fundamentals', 'query-performance-patterns', 'performance-monitoring'],
    success_metrics: ['Report execution time reduced by 70%+', 'Memory usage optimized', 'User satisfaction improved'],
    common_pitfalls: ['Not enabling MaintainSIFTIndex', 'Loading unnecessary fields', 'Missing performance baselines']
  },
  
  'security audit': {
    steps: [
      {
        step_number: 1,
        title: 'Review Permission Architecture',
        description: 'Audit current user permissions, role assignments, and access controls',
        related_topics: ['user-permissions', 'security-fundamentals', 'role-based-access'],
        validation_criteria: ['Permission sets documented', 'User roles validated'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 2,
        title: 'Identify Security Vulnerabilities',
        description: 'Scan code for hardcoded credentials, SQL injection risks, and permission bypasses',
        related_topics: ['credential-management', 'sql-injection-prevention', 'security-scanning'],
        validation_criteria: ['Vulnerability scan completed', 'Critical issues identified'],
        estimated_time: '45 minutes'
      },
      {
        step_number: 3,
        title: 'Implement Security Controls',
        description: 'Add proper permission checks, secure credential storage, and input validation',
        related_topics: ['access-control', 'secure-coding', 'input-validation'],
        validation_criteria: ['Permission checks added', 'Credentials secured', 'Input validated'],
        estimated_time: '90 minutes'
      },
      {
        step_number: 4,
        title: 'Security Testing and Validation',
        description: 'Test security controls and validate against security requirements',
        related_topics: ['security-testing', 'penetration-testing', 'compliance-validation'],
        validation_criteria: ['Security tests passed', 'Compliance verified'],
        estimated_time: '60 minutes'
      }
    ],
    learning_path: ['security-fundamentals', 'access-control', 'secure-coding'],
    success_metrics: ['Zero critical vulnerabilities', 'Proper access controls', 'Security compliance achieved'],
    common_pitfalls: ['Overly permissive access', 'Hardcoded secrets', 'Missing input validation']
  },
  
  'error handling': {
    steps: [
      {
        step_number: 1,
        title: 'Identify Error-Prone Operations',
        description: 'Review code for database operations, external calls, and user inputs that may fail',
        related_topics: ['error-analysis', 'exception-identification', 'failure-points'],
        validation_criteria: ['Error points documented', 'Failure scenarios identified'],
        estimated_time: '30 minutes'
      },
      {
        step_number: 2,
        title: 'Implement Comprehensive Error Handling',
        description: 'Add try-catch blocks, validation checks, and proper error propagation',
        related_topics: ['error-handling-patterns', 'exception-management', 'validation-strategies'],
        validation_criteria: ['Error handling implemented', 'Validation added'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 3,
        title: 'Improve Error Messages and User Experience',
        description: 'Create clear, actionable error messages with proper context and guidance',
        related_topics: ['error-message-design', 'user-experience', 'localization-patterns'],
        validation_criteria: ['Error messages improved', 'User guidance added'],
        estimated_time: '40 minutes'
      },
      {
        step_number: 4,
        title: 'Test Error Scenarios',
        description: 'Test all error paths and validate error handling behavior',
        related_topics: ['error-testing', 'negative-testing', 'resilience-testing'],
        validation_criteria: ['Error scenarios tested', 'Error handling validated'],
        estimated_time: '45 minutes'
      }
    ],
    learning_path: ['error-handling-patterns', 'exception-management', 'user-experience'],
    success_metrics: ['Graceful error handling', 'Clear user feedback', 'System resilience'],
    common_pitfalls: ['Silent failures', 'Generic error messages', 'Missing validation']
  },
  
  'code quality': {
    steps: [
      {
        step_number: 1,
        title: 'Analyze Code Complexity and Structure',
        description: 'Review code for excessive nesting, long procedures, and complexity metrics',
        related_topics: ['code-complexity', 'cyclomatic-complexity', 'code-metrics'],
        validation_criteria: ['Complexity metrics calculated', 'Problem areas identified'],
        estimated_time: '40 minutes'
      },
      {
        step_number: 2,
        title: 'Refactor Complex Code',
        description: 'Break down large procedures, reduce nesting, and extract reusable functions',
        related_topics: ['refactoring-patterns', 'procedure-decomposition', 'code-organization'],
        validation_criteria: ['Procedures shortened', 'Nesting reduced', 'Functions extracted'],
        estimated_time: '90 minutes'
      },
      {
        step_number: 3,
        title: 'Improve Code Readability',
        description: 'Add meaningful names, constants for magic numbers, and clear documentation',
        related_topics: ['naming-conventions', 'code-documentation', 'readability-patterns'],
        validation_criteria: ['Names improved', 'Constants added', 'Documentation updated'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 4,
        title: 'Validate Code Quality Improvements',
        description: 'Review refactored code for maintainability, readability, and adherence to standards',
        related_topics: ['code-review', 'quality-metrics', 'maintainability-assessment'],
        validation_criteria: ['Code review completed', 'Quality standards met'],
        estimated_time: '30 minutes'
      }
    ],
    learning_path: ['code-complexity', 'refactoring-patterns', 'maintainability'],
    success_metrics: ['Reduced complexity', 'Improved readability', 'Better maintainability'],
    common_pitfalls: ['Over-refactoring', 'Breaking existing functionality', 'Inconsistent patterns']
  },
  
  'data safety': {
    steps: [
      {
        step_number: 1,
        title: 'Identify Data Risk Operations',
        description: 'Review code for bulk operations, deletions, and data modifications',
        related_topics: ['data-risk-assessment', 'destructive-operations', 'data-audit'],
        validation_criteria: ['Risk operations identified', 'Impact assessment completed'],
        estimated_time: '30 minutes'
      },
      {
        step_number: 2,
        title: 'Implement Data Protection Measures',
        description: 'Add user confirmations, filters, and validation for destructive operations',
        related_topics: ['data-protection', 'user-confirmation', 'operation-validation'],
        validation_criteria: ['Confirmations added', 'Filters implemented', 'Validation enhanced'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 3,
        title: 'Add Transaction and Backup Strategies',
        description: 'Implement proper transaction handling and backup validation',
        related_topics: ['transaction-patterns', 'backup-strategies', 'data-consistency'],
        validation_criteria: ['Transactions implemented', 'Backup validation added'],
        estimated_time: '45 minutes'
      },
      {
        step_number: 4,
        title: 'Test Data Safety Measures',
        description: 'Validate data protection controls and recovery procedures',
        related_topics: ['data-safety-testing', 'recovery-testing', 'backup-validation'],
        validation_criteria: ['Safety measures tested', 'Recovery validated'],
        estimated_time: '40 minutes'
      }
    ],
    learning_path: ['data-safety-patterns', 'transaction-patterns', 'data-protection'],
    success_metrics: ['Zero accidental data loss', 'Proper user confirmations', 'Data integrity maintained'],
    common_pitfalls: ['Unfiltered bulk operations', 'Missing confirmations', 'Poor transaction handling']
  },
  
  'user experience': {
    steps: [
      {
        step_number: 1,
        title: 'Analyze Current User Interface',
        description: 'Review pages, reports, and user interactions for usability issues',
        related_topics: ['ui-analysis', 'usability-assessment', 'user-journey'],
        validation_criteria: ['UI review completed', 'Usability issues identified'],
        estimated_time: '45 minutes'
      },
      {
        step_number: 2,
        title: 'Improve User Feedback and Messages',
        description: 'Enhance error messages, confirmations, and progress indicators',
        related_topics: ['user-feedback-patterns', 'message-design', 'progress-indication'],
        validation_criteria: ['Messages improved', 'Progress indicators added'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 3,
        title: 'Optimize User Workflows',
        description: 'Streamline common tasks, reduce clicks, and improve navigation',
        related_topics: ['workflow-optimization', 'navigation-patterns', 'task-efficiency'],
        validation_criteria: ['Workflows streamlined', 'Navigation improved'],
        estimated_time: '75 minutes'
      },
      {
        step_number: 4,
        title: 'Validate User Experience Improvements',
        description: 'Test with users and gather feedback on experience improvements',
        related_topics: ['user-testing', 'feedback-collection', 'ux-validation'],
        validation_criteria: ['User testing completed', 'Feedback positive'],
        estimated_time: '60 minutes'
      }
    ],
    learning_path: ['user-experience', 'interface-design', 'usability-patterns'],
    success_metrics: ['Improved user satisfaction', 'Reduced task completion time', 'Fewer support requests'],
    common_pitfalls: ['Over-engineering UI', 'Ignoring user feedback', 'Inconsistent patterns']
  },

  'architecture improvement': {
    steps: [
      {
        step_number: 1,
        title: 'Analyze Current Architecture',
        description: 'Review object dependencies, coupling levels, and architectural patterns',
        related_topics: ['architecture-analysis', 'coupling-assessment', 'dependency-mapping'],
        validation_criteria: ['Architecture documented', 'Coupling issues identified'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 2,
        title: 'Design Improved Architecture',
        description: 'Plan interface-based design, dependency injection, and separation of concerns',
        related_topics: ['interface-design', 'dependency-injection', 'separation-of-concerns'],
        validation_criteria: ['Architecture plan created', 'Interfaces designed'],
        estimated_time: '90 minutes'
      },
      {
        step_number: 3,
        title: 'Implement Architecture Changes',
        description: 'Refactor code to use interfaces, reduce coupling, and improve modularity',
        related_topics: ['refactoring-architecture', 'interface-implementation', 'modular-design'],
        validation_criteria: ['Interfaces implemented', 'Coupling reduced'],
        estimated_time: '120 minutes'
      },
      {
        step_number: 4,
        title: 'Validate Architecture Quality',
        description: 'Test architectural changes and validate against design principles',
        related_topics: ['architecture-testing', 'design-validation', 'quality-assessment'],
        validation_criteria: ['Architecture tested', 'Quality improved'],
        estimated_time: '45 minutes'
      }
    ],
    learning_path: ['clean-architecture', 'interface-design', 'dependency-management'],
    success_metrics: ['Reduced coupling', 'Better testability', 'Improved maintainability'],
    common_pitfalls: ['Over-engineering', 'Breaking existing functionality', 'Complex abstractions']
  },

  'validation improvement': {
    steps: [
      {
        step_number: 1,
        title: 'Review Current Validation Logic',
        description: 'Analyze existing validation patterns and identify gaps',
        related_topics: ['validation-analysis', 'business-rules', 'data-integrity'],
        validation_criteria: ['Validation audit completed', 'Gaps identified'],
        estimated_time: '45 minutes'
      },
      {
        step_number: 2,
        title: 'Design Comprehensive Validation',
        description: 'Plan field validation, business rules, and user experience improvements',
        related_topics: ['validation-design', 'business-rule-engine', 'user-experience'],
        validation_criteria: ['Validation plan created', 'Rules documented'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 3,
        title: 'Implement Enhanced Validation',
        description: 'Add TestField usage, range validation, and business rule checks',
        related_topics: ['testfield-patterns', 'range-validation', 'business-rules'],
        validation_criteria: ['Validation implemented', 'Rules enforced'],
        estimated_time: '75 minutes'
      },
      {
        step_number: 4,
        title: 'Test Validation Scenarios',
        description: 'Test all validation paths and edge cases',
        related_topics: ['validation-testing', 'boundary-testing', 'negative-testing'],
        validation_criteria: ['Validation tested', 'Edge cases covered'],
        estimated_time: '45 minutes'
      }
    ],
    learning_path: ['validation-patterns', 'business-rules', 'data-integrity'],
    success_metrics: ['Comprehensive validation', 'Better data quality', 'Improved user guidance'],
    common_pitfalls: ['Over-validation', 'Poor error messages', 'Performance impact']
  },

  'api design improvement': {
    steps: [
      {
        step_number: 1,
        title: 'Review Current API Design',
        description: 'Analyze procedure signatures, naming conventions, and consistency',
        related_topics: ['api-analysis', 'naming-conventions', 'interface-consistency'],
        validation_criteria: ['API inventory completed', 'Inconsistencies identified'],
        estimated_time: '50 minutes'
      },
      {
        step_number: 2,
        title: 'Design Consistent API Standards',
        description: 'Create standardized patterns for parameters, return types, and naming',
        related_topics: ['api-design-standards', 'parameter-patterns', 'return-type-consistency'],
        validation_criteria: ['Standards documented', 'Patterns defined'],
        estimated_time: '60 minutes'
      },
      {
        step_number: 3,
        title: 'Implement API Improvements',
        description: 'Refactor procedures to follow consistent patterns and improve usability',
        related_topics: ['api-refactoring', 'procedure-design', 'usability-patterns'],
        validation_criteria: ['APIs refactored', 'Consistency improved'],
        estimated_time: '90 minutes'
      },
      {
        step_number: 4,
        title: 'Document and Test APIs',
        description: 'Create comprehensive API documentation and test all interfaces',
        related_topics: ['api-documentation', 'interface-testing', 'usage-examples'],
        validation_criteria: ['APIs documented', 'Testing completed'],
        estimated_time: '60 minutes'
      }
    ],
    learning_path: ['api-design-best-practices', 'interface-design', 'documentation-patterns'],
    success_metrics: ['Consistent API design', 'Improved developer experience', 'Better documentation'],
    common_pitfalls: ['Breaking changes', 'Over-complicated interfaces', 'Poor documentation']
  }
};