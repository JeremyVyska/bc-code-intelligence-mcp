/**
 * Workflow Service - Persona-Driven Development Pipelines
 * Orchestrates complete BC development workflows with specialist coordination
 */

import { KnowledgeService } from './knowledge-service.js';
import { MethodologyService } from './methodology-service.js';
import { SpecialistDiscoveryService } from './specialist-discovery.js';
import { SpecialistDefinition } from './specialist-loader.js';

export type WorkflowType = 
  | 'new-bc-app'
  | 'enhance-bc-app'
  | 'upgrade-bc-version'
  | 'add-ecosystem-features'
  | 'debug-bc-issues'
  | 'document-bc-solution'
  | 'modernize-bc-code'
  | 'onboard-developer'
  | 'review-bc-code'
  | 'app_takeover';export interface WorkflowStartRequest {
  workflow_type: WorkflowType;
  project_context: string;
  bc_version?: string;
  additional_context?: Record<string, any>;
}

export interface BCWorkflowSession {
  id: string;                          // Unique workflow session ID
  type: WorkflowType;                  // Pipeline type being executed
  current_phase: number;               // Current phase index (0-based)
  specialist_pipeline: string[];       // Ordered list of specialist IDs
  project_context: string;             // Original project description
  bc_version?: string;                 // Target BC version
  phase_results: PhaseResult[];        // Results from completed phases
  methodology_state: MethodologyState; // Integration with existing methodology system
  created_at: Date;                    // Session start time
  last_updated: Date;                  // Last activity
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  constitutional_gates: BCConstitutionalGates; // BC development validation
}

export interface PhaseResult {
  phase_number: number;
  specialist_id: string;
  specialist_name: string;
  guidance_provided: string;
  decisions_made: string[];
  next_steps: string[];
  artifacts_created: string[];         // Documents, specs, plans created
  methodology_validation: MethodologyValidation; // Phase-level methodology results
  time_spent: number;                  // Minutes spent in phase
  confidence_level: 'high' | 'medium' | 'low';
  collaboration_needed: boolean;       // Whether next phase needs multi-specialist input
}

export interface MethodologyState {
  pipeline_methodology: string;        // Active pipeline methodology ID
  current_phase_methodology: string;   // Current tactical phase methodology
  completed_methodologies: string[];   // Completed tactical methodologies
  validation_results: MethodologyValidation[];
  constitutional_gates: BCConstitutionalGates;
}

export interface MethodologyValidation {
  methodology_id: string;              // e.g., "analysis-phase", "performance-quick"
  checklist_items: ChecklistValidation[];
  completion_percentage: number;
  quality_score: number;
  recommendations: string[];
  blocking_issues: string[];
}

export interface ChecklistValidation {
  item: string;
  status: 'completed' | 'partial' | 'not-started' | 'not-applicable';
  evidence: string;                    // Proof of completion
  quality_notes: string;
}

export interface BCConstitutionalGates {
  // Article I: Business Central Extensibility First
  extensibility_compliance: boolean;   // App extends rather than modifies base
  
  // Article II: Performance by Design
  performance_consideration: boolean;  // SIFT and optimization considered
  
  // Article III: Test-Driven AL Development  
  test_coverage_planned: boolean;      // Tests defined before implementation
  
  // Article IV: Security by Default
  permission_model_defined: boolean;   // Access controls specified
  
  // Article V: Documentation-Driven Development
  documentation_planned: boolean;      // Docs planned with implementation
  
  // Article VI: Version Compatibility
  bc_version_compliance: boolean;      // Compatible with target BC version
  
  // Article VII: Integration-First Design
  integration_patterns: boolean;       // APIs and events properly designed
}

export interface WorkflowAdvanceRequest {
  workflow_id: string;
  phase_results?: string;
  specialist_notes?: string;
}

export interface WorkflowStatusResponse {
  session: BCWorkflowSession;
  current_specialist: any;             // Current specialist from PersonaRegistry
  next_specialist?: any;               // Next specialist in pipeline
  progress_percentage: number;
  phase_summary: string;
  next_actions: string[];
}

/**
 * Core workflow orchestration service
 * Manages complete BC development pipelines with specialist coordination
 */
export class WorkflowService {
  private activeSessions: Map<string, BCWorkflowSession> = new Map();
  private pipelineDefinitions: Record<WorkflowType, PipelineDefinition>;

  constructor(
    private knowledgeService: KnowledgeService,
    private methodologyService: MethodologyService,
    private specialistDiscoveryService: SpecialistDiscoveryService
  ) {
    this.pipelineDefinitions = this.initializePipelineDefinitions();
  }

  /**
   * Start a new BC development workflow
   * Overloaded method to support both single object and two-parameter calling patterns
   */
  async startWorkflow(request: WorkflowStartRequest): Promise<BCWorkflowSession>;
  async startWorkflow(workflowType: WorkflowType, context: { context: string; bc_version?: string; additional_context?: Record<string, any> }): Promise<BCWorkflowSession>;
  async startWorkflow(
    requestOrWorkflowType: WorkflowStartRequest | WorkflowType, 
    contextObj?: { context: string; bc_version?: string; additional_context?: Record<string, any> }
  ): Promise<BCWorkflowSession> {
    // Handle two-parameter calling pattern
    if (typeof requestOrWorkflowType === 'string' && contextObj) {
      const request: WorkflowStartRequest = {
        workflow_type: requestOrWorkflowType,
        project_context: contextObj.context,
        bc_version: contextObj.bc_version,
        additional_context: contextObj.additional_context
      };
      return this.startWorkflowInternal(request);
    }
    
    // Handle single-parameter calling pattern (existing)
    if (typeof requestOrWorkflowType === 'object') {
      return this.startWorkflowInternal(requestOrWorkflowType);
    }
    
    throw new Error('Invalid parameters provided to startWorkflow');
  }

  private async startWorkflowInternal(request: WorkflowStartRequest): Promise<BCWorkflowSession> {
    const sessionId = this.generateSessionId();
    const pipeline = this.pipelineDefinitions[request.workflow_type];
    
    if (!pipeline) {
      throw new Error(`Unknown workflow type: ${request.workflow_type}`);
    }
    
    if (!pipeline.phases || pipeline.phases.length === 0) {
      throw new Error(`No phases defined for workflow type: ${request.workflow_type}`);
    }

    // Discover specialists dynamically based on workflow type
    const workflowSpecialists = await this.discoverWorkflowSpecialists(request.workflow_type);

    const session: BCWorkflowSession = {
      id: sessionId,
      type: request.workflow_type,
      current_phase: 0,
      specialist_pipeline: workflowSpecialists,
      project_context: request.project_context,
      bc_version: request.bc_version,
      phase_results: [],
      methodology_state: {
        pipeline_methodology: `${request.workflow_type}-pipeline`,
        current_phase_methodology: pipeline.phases[0].methodology_id,
        completed_methodologies: [],
        validation_results: [],
        constitutional_gates: this.initializeConstitutionalGates()
      },
      created_at: new Date(),
      last_updated: new Date(),
      status: 'active',
      constitutional_gates: this.initializeConstitutionalGates()
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Advance workflow to the next phase
   */
  async advancePhase(request: WorkflowAdvanceRequest): Promise<WorkflowStatusResponse> {
    const session = this.activeSessions.get(request.workflow_id);
    if (!session) {
      throw new Error(`Workflow session not found: ${request.workflow_id}`);
    }

    // Record current phase results if provided
    if (request.phase_results) {
      const currentSpecialistId = session.specialist_pipeline[session.current_phase];
      const specialist = await this.specialistDiscoveryService.getSpecialistById(currentSpecialistId);
      
      const phaseResult: PhaseResult = {
        phase_number: session.current_phase,
        specialist_id: currentSpecialistId,
        specialist_name: specialist?.title || 'Unknown',
        guidance_provided: request.phase_results,
        decisions_made: [], // Could be extracted from phase_results
        next_steps: [],
        artifacts_created: [],
        methodology_validation: await this.validatePhaseMethodology(session, request.phase_results),
        time_spent: 0, // TODO: Track actual time
        confidence_level: 'medium', // TODO: Assess based on validation
        collaboration_needed: false
      };

      session.phase_results.push(phaseResult);
    }

    // Advance to next phase
    session.current_phase++;
    session.last_updated = new Date();

    // Check if workflow is complete
    if (session.current_phase >= session.specialist_pipeline.length) {
      session.status = 'completed';
    }

    return this.getWorkflowStatus(request.workflow_id);
  }

  /**
   * Get current workflow status and guidance
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    const session = this.activeSessions.get(workflowId);
    if (!session) {
      throw new Error(`Workflow session not found: ${workflowId}`);
    }

    const currentSpecialistId = session.specialist_pipeline[session.current_phase];
    const currentSpecialist = await this.specialistDiscoveryService.getSpecialistById(currentSpecialistId);
    
    const nextSpecialistId = session.current_phase + 1 < session.specialist_pipeline.length 
      ? session.specialist_pipeline[session.current_phase + 1] 
      : undefined;
    const nextSpecialist = nextSpecialistId ? await this.specialistDiscoveryService.getSpecialistById(nextSpecialistId) : undefined;

    const progressPercentage = (session.current_phase / session.specialist_pipeline.length) * 100;

    return {
      session,
      current_specialist: currentSpecialist,
      next_specialist: nextSpecialist,
      progress_percentage: progressPercentage,
      phase_summary: this.generatePhaseSummary(session),
      next_actions: this.generateNextActions(session)
    };
  }

  /**
   * Get workflow guidance for current phase
   */
  async getPhaseGuidance(workflowId: string, detailed_context?: string): Promise<string> {
    const status = await this.getWorkflowStatus(workflowId);
    const pipeline = this.pipelineDefinitions[status.session.type];
    const currentPhase = pipeline.phases[status.session.current_phase];

    // Get specialist-specific guidance
    const specialist = status.current_specialist;
    const specialistGuidance = specialist ? await this.getSpecialistPhaseGuidance(specialist, currentPhase, status.session.project_context) : '';

    // Get methodology guidance for this phase
    const methodologyGuidance = await this.getPhaseMethodologyGuidance(currentPhase.methodology_id, detailed_context);

    return `# ${currentPhase.title} - ${specialist?.name}

${currentPhase.description}

## Specialist Guidance
${specialistGuidance}

## Methodology Framework
${methodologyGuidance}

## Context
Project: ${status.session.project_context}
${status.session.bc_version ? `BC Version: ${status.session.bc_version}` : ''}

## Progress
Phase ${status.session.current_phase + 1} of ${status.session.specialist_pipeline.length} (${Math.round(status.progress_percentage)}% complete)
`;
  }

  /**
   * Get all active workflows
   */
  async getActiveWorkflows(): Promise<any[]> {
    // Return current in-memory active sessions
    const activeSessions = Array.from(this.activeSessions.values()).filter(session => session.status === 'active');
    
    return activeSessions.map(session => ({
      workflow_id: session.id,
      workflow_type: session.type,
      current_phase: session.current_phase,
      total_phases: session.specialist_pipeline.length,
      progress_percentage: (session.current_phase / session.specialist_pipeline.length) * 100,
      created_at: session.created_at,
      last_updated: session.last_updated,
      project_context: session.project_context
    }));
  }

  /**
   * Get workflow methodology for a specific workflow
   */
  async getWorkflowMethodology(workflowId: string): Promise<any> {
    const status = await this.getWorkflowStatus(workflowId);
    const pipeline = this.pipelineDefinitions[status.session.type];
    
    return {
      workflow_id: workflowId,
      workflow_type: status.session.type,
      total_phases: pipeline.phases.length,
      phases: pipeline.phases,
      specialists: pipeline.specialists,
      methodology_overview: `This workflow follows a ${pipeline.phases.length}-phase methodology for ${status.session.type}.`
    };
  }

  /**
   * Dynamically discover specialists relevant to a workflow type
   * This replaces hard-coded specialist lists with dynamic discovery based on specialist metadata
   */
  private async discoverWorkflowSpecialists(workflowType: WorkflowType): Promise<string[]> {
    try {
      // Get all available specialists from the knowledge service
      const allSpecialists = await this.knowledgeService.getAllSpecialists();
      const relevantSpecialists: string[] = [];

      // Define workflow expertise mappings for the current BCSpecialist structure
      const workflowExpertiseMap: Record<WorkflowType, string[]> = {
        'new-bc-app': ['architecture', 'implementation', 'security', 'testing', 'ui-ux', 'documentation'],
        'enhance-bc-app': ['architecture', 'performance', 'implementation', 'error-handling', 'testing'],
        'review-bc-code': ['code-review', 'performance', 'security', 'error-handling', 'testing', 'ui-ux', 'architecture'],
        'debug-bc-issues': ['performance', 'troubleshooting', 'error-handling'],
        'modernize-bc-code': ['architecture', 'performance', 'security', 'best-practices'],
        'onboard-developer': ['mentoring', 'best-practices', 'education'],
        'upgrade-bc-version': ['architecture', 'performance', 'error-handling', 'testing'],
        'add-ecosystem-features': ['integration', 'api-design', 'security'],
        'document-bc-solution': ['documentation', 'architecture'],
        'app_takeover': ['architecture', 'legacy-migration', 'implementation', 'security', 'testing', 'documentation']
      };

      const targetExpertise = workflowExpertiseMap[workflowType] || [];

      // Score each specialist based on expertise area overlap
      const specialistScores = allSpecialists.map(specialist => {
        let score = 0;
        
        // Score based on expertise overlap
        if (specialist.expertise?.primary || specialist.expertise?.secondary) {
          const allExpertise = [...(specialist.expertise.primary || []), ...(specialist.expertise.secondary || [])];
          const expertiseMatches = allExpertise.filter(area => 
            targetExpertise.some(targetExp => 
              area.toLowerCase().includes(targetExp.toLowerCase()) || 
              targetExp.toLowerCase().includes(area.toLowerCase())
            )
          ).length;
          score += expertiseMatches * 2; // Each expertise match is worth 2 points
        }

        // Score based on domains
        if (specialist.domains) {
          const domainMatches = specialist.domains.filter(domain => 
            targetExpertise.some(targetExp => 
              domain.toLowerCase().includes(targetExp.toLowerCase()) ||
              targetExp.toLowerCase().includes(domain.toLowerCase())
            )
          ).length;
          score += domainMatches;
        }

        // Boost score for certain specialists based on role
        if (specialist.role) {
          const roleBoosts: Record<string, string[]> = {
            'architecture': ['Planning & Design', 'Solution Design'],
            'performance': ['Troubleshooting', 'Performance'],
            'security': ['Security'],
            'testing': ['Quality & Testing', 'Testing'],
            'documentation': ['Documentation'],
            'mentoring': ['Teaching', 'Learning'],
            'error-handling': ['Error Handling', 'Exception Management']
          };

          targetExpertise.forEach(expertise => {
            const relevantRoles = roleBoosts[expertise] || [];
            if (relevantRoles.some(role => specialist.role.includes(role))) {
              score += 1; // Role match bonus
            }
          });
        }

        return { specialist_id: specialist.specialist_id, score };
      });

      // Sort by score and take top specialists
      const sortedSpecialists = specialistScores
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8) // Take top 8 specialists max
        .map(item => item.specialist_id);

      // Ensure we have some specialists even if scoring fails
      if (sortedSpecialists.length === 0) {
        // Fallback to core specialists - but check they exist first
        const coreSpecialists = allSpecialists
          .slice(0, 6)
          .map(s => s.specialist_id);
        return coreSpecialists;
      }

      return sortedSpecialists;
    } catch (error) {
      console.error('Error discovering workflow specialists:', error);
      // Fallback to basic set that should exist
      return ['alex-architect', 'sam-coder', 'dean-debug', 'eva-errors', 'roger-reviewer', 'quinn-tester'];
    }
  }

  /**
   * Initialize pipeline definitions for all workflow types
   * Now uses dynamic specialist discovery instead of hard-coded lists
   */
  private initializePipelineDefinitions(): Record<WorkflowType, PipelineDefinition> {
    return {
      'new-bc-app': {
        specialists: [], // Will be populated dynamically
        phases: [
          { methodology_id: 'analysis-architecture', title: 'Architecture Specification', description: 'Business requirements to BC data model design' },
          { methodology_id: 'coding-implementation', title: 'Implementation Planning', description: 'AL code structure and development approach' },
          { methodology_id: 'error-handling', title: 'Error Handling Strategy', description: 'Exception management and defensive programming' },
          { methodology_id: 'ux-design', title: 'User Experience Design', description: 'Interface design and usability optimization' },
          { methodology_id: 'verification-review', title: 'Design Review', description: 'Code quality gates and maintainability assessment' },
          { methodology_id: 'testing-strategy', title: 'Testing Strategy', description: 'Test coverage planning and quality assurance' },
          { methodology_id: 'security-implementation', title: 'Security Implementation', description: 'Permission model and data access controls' },
          { methodology_id: 'documentation-creation', title: 'Documentation Creation', description: 'User and technical documentation' }
        ]
      },
      'enhance-bc-app': {
        specialists: [], // Will be populated dynamically
        phases: [
          { methodology_id: 'analysis-impact', title: 'Impact Analysis', description: 'Architectural impact and integration considerations' },
          { methodology_id: 'performance-assessment', title: 'Performance Assessment', description: 'Performance impact and optimization opportunities' },
          { methodology_id: 'coding-feature', title: 'Feature Implementation', description: 'Implementation strategy and code integration' },
          { methodology_id: 'error-handling', title: 'Error Handling', description: 'Error handling for new features' },
          { methodology_id: 'verification-change', title: 'Change Review', description: 'Change impact and regression prevention' },
          { methodology_id: 'testing-feature', title: 'Feature Validation', description: 'Feature testing and integration validation' }
        ]
      },
      'review-bc-code': {
        specialists: [], // Will be populated dynamically
        phases: [
          { methodology_id: 'analysis-legacy', title: 'Legacy Pattern Assessment', description: 'Outdated pattern identification and technical debt analysis' },
          { methodology_id: 'verification-quality', title: 'Code Quality Audit', description: 'Quality metrics and maintainability assessment' },
          { methodology_id: 'performance-analysis', title: 'Performance Analysis', description: 'Bottleneck identification and optimization opportunities' },
          { methodology_id: 'security-assessment', title: 'Security Assessment', description: 'Vulnerability identification and compliance review' },
          { methodology_id: 'error-review', title: 'Error Handling Review', description: 'Exception handling and defensive programming analysis' },
          { methodology_id: 'testing-analysis', title: 'Testability Analysis', description: 'Test coverage gaps and improvement suggestions' },
          { methodology_id: 'ux-evaluation', title: 'User Experience Evaluation', description: 'Interface design and usability assessment' },
          { methodology_id: 'architecture-review', title: 'Architectural Review', description: 'Architectural coherence and design pattern consistency' }
        ]
      },
      // TODO: Add remaining pipeline definitions
      'debug-bc-issues': { specialists: [], phases: [] },
      'modernize-bc-code': { specialists: [], phases: [] },
      'onboard-developer': {
        specialists: [], // Will be populated dynamically
        phases: [
          { methodology_id: 'developer-introduction', title: 'BC Development Fundamentals', description: 'Introduction to Business Central development fundamentals and environment setup' },
          { methodology_id: 'coding-basics', title: 'AL Language Fundamentals', description: 'Core AL language concepts, syntax, and coding standards' },
          { methodology_id: 'architecture-intro', title: 'BC Architecture Overview', description: 'Understanding BC architecture patterns and best practices' },
          { methodology_id: 'debugging-intro', title: 'Debugging and Diagnostics', description: 'Debugging techniques and diagnostic tools for BC development' },
          { methodology_id: 'testing-intro', title: 'Testing Fundamentals', description: 'Testing strategies and quality assurance practices' },
          { methodology_id: 'code-review-intro', title: 'Code Review Process', description: 'Code review standards and collaborative development practices' }
        ]
      },
      'upgrade-bc-version': { specialists: [], phases: [] },
      'add-ecosystem-features': { specialists: [], phases: [] },
      'document-bc-solution': { specialists: [], phases: [] },
      'app_takeover': {
        specialists: [], // Will be populated dynamically
        phases: [
          { methodology_id: 'analysis-legacy', title: 'Legacy App Analysis', description: 'Understanding existing application structure and technical debt' },
          { methodology_id: 'architecture-migration', title: 'Migration Architecture', description: 'Planning the migration strategy and new architecture' },
          { methodology_id: 'coding-refactor', title: 'Code Refactoring', description: 'Modernizing existing code and implementing new patterns' },
          { methodology_id: 'error-migration', title: 'Error Handling Upgrade', description: 'Improving error handling and defensive programming' },
          { methodology_id: 'verification-takeover', title: 'Takeover Review', description: 'Code quality assessment for the taken over application' },
          { methodology_id: 'testing-migration', title: 'Migration Testing', description: 'Testing the migration and ensuring functionality preservation' },
          { methodology_id: 'documentation-takeover', title: 'Documentation Update', description: 'Updating documentation for the migrated application' }
        ]
      }
    };
  }

  private async validatePhaseMethodology(session: BCWorkflowSession, phaseResults: string): Promise<MethodologyValidation> {
    // TODO: Integrate with MethodologyService to validate phase completion
    return {
      methodology_id: session.methodology_state.current_phase_methodology,
      checklist_items: [],
      completion_percentage: 85, // TODO: Calculate based on actual validation
      quality_score: 78,
      recommendations: [],
      blocking_issues: []
    };
  }

  private async getSpecialistPhaseGuidance(specialist: any, phase: PhaseDefinition, projectContext: string): Promise<string> {
    // TODO: Use KnowledgeService to get specialist-specific guidance
    return `${specialist.consultation_style}\n\nFor this ${phase.title} phase, focus on: ${phase.description}`;
  }

  private async getPhaseMethodologyGuidance(methodologyId: string, context?: string): Promise<string> {
    // TODO: Integrate with MethodologyService to get detailed methodology guidance
    return `Methodology guidance for ${methodologyId}`;
  }

  private generatePhaseSummary(session: BCWorkflowSession): string {
    const pipeline = this.pipelineDefinitions[session.type];
    const currentPhase = pipeline.phases[session.current_phase];
    return `Currently in ${currentPhase?.title || 'Unknown Phase'} phase of ${session.type} workflow`;
  }

  private generateNextActions(session: BCWorkflowSession): string[] {
    const pipeline = this.pipelineDefinitions[session.type];
    const currentPhase = pipeline.phases[session.current_phase];
    return [
      `Complete ${currentPhase?.title || 'current phase'} with specialist guidance`,
      'Document decisions and outcomes',
      'Validate methodology requirements',
      'Advance to next phase when ready'
    ];
  }

  private initializeConstitutionalGates(): BCConstitutionalGates {
    return {
      extensibility_compliance: false,
      performance_consideration: false,
      test_coverage_planned: false,
      permission_model_defined: false,
      documentation_planned: false,
      bc_version_compliance: false,
      integration_patterns: false
    };
  }

  private generateSessionId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface PipelineDefinition {
  specialists: string[];
  phases: PhaseDefinition[];
}

interface PhaseDefinition {
  methodology_id: string;
  title: string;
  description: string;
}