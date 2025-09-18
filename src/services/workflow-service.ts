/**
 * Workflow Service - Persona-Driven Development Pipelines
 * Orchestrates complete BC development workflows with specialist coordination
 */

import { KnowledgeService } from './knowledge-service.js';
import { MethodologyService } from './methodology-service.js';
import { PersonaRegistry } from '../types/persona-types.js';

export type WorkflowType = 
  | 'new-bc-app'
  | 'enhance-bc-app' 
  | 'upgrade-bc-version'
  | 'add-ecosystem-features'
  | 'debug-bc-issues'
  | 'document-bc-solution'
  | 'modernize-bc-code'
  | 'onboard-developer'
  | 'review-bc-code';

export interface WorkflowStartRequest {
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
    private personaRegistry: PersonaRegistry
  ) {
    this.pipelineDefinitions = this.initializePipelineDefinitions();
  }

  /**
   * Start a new BC development workflow
   */
  async startWorkflow(request: WorkflowStartRequest): Promise<BCWorkflowSession> {
    const sessionId = this.generateSessionId();
    const pipeline = this.pipelineDefinitions[request.workflow_type];
    
    if (!pipeline) {
      throw new Error(`Unknown workflow type: ${request.workflow_type}`);
    }

    const session: BCWorkflowSession = {
      id: sessionId,
      type: request.workflow_type,
      current_phase: 0,
      specialist_pipeline: pipeline.specialists,
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
      const specialist = this.personaRegistry.getSpecialist(currentSpecialistId);
      
      const phaseResult: PhaseResult = {
        phase_number: session.current_phase,
        specialist_id: currentSpecialistId,
        specialist_name: specialist?.name || 'Unknown',
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
    const currentSpecialist = this.personaRegistry.getSpecialist(currentSpecialistId);
    
    const nextSpecialistId = session.current_phase + 1 < session.specialist_pipeline.length 
      ? session.specialist_pipeline[session.current_phase + 1] 
      : undefined;
    const nextSpecialist = nextSpecialistId ? this.personaRegistry.getSpecialist(nextSpecialistId) : undefined;

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
   * Initialize pipeline definitions for all workflow types
   */
  private initializePipelineDefinitions(): Record<WorkflowType, PipelineDefinition> {
    return {
      'new-bc-app': {
        specialists: ['alex-architect', 'sam-coder', 'eva-errors', 'uma-ux', 'roger-reviewer', 'quinn-tester', 'seth-security', 'taylor-docs'],
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
        specialists: ['alex-architect', 'dean-debug', 'sam-coder', 'eva-errors', 'roger-reviewer', 'quinn-tester'],
        phases: [
          { methodology_id: 'analysis-impact', title: 'Impact Analysis', description: 'Architectural impact and integration considerations' },
          { methodology_id: 'performance-assessment', title: 'Performance Assessment', description: 'Performance impact and optimization opportunities' },
          { methodology_id: 'coding-feature', title: 'Feature Implementation', description: 'Implementation strategy and code integration' },
          { methodology_id: 'error-handling', title: 'Error Handling', description: 'Error handling for new features' },
          { methodology_id: 'verification-change', title: 'Change Review', description: 'Change impact and regression prevention' },
          { methodology_id: 'testing-feature', title: 'Feature Validation', description: 'Feature testing and integration validation' }
        ]
      },
      // Additional pipeline definitions...
      'review-bc-code': {
        specialists: ['logan-legacy', 'roger-reviewer', 'dean-debug', 'seth-security', 'eva-errors', 'quinn-tester', 'uma-ux', 'alex-architect'],
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
      'onboard-developer': { specialists: [], phases: [] },
      'upgrade-bc-version': { specialists: [], phases: [] },
      'add-ecosystem-features': { specialists: [], phases: [] },
      'document-bc-solution': { specialists: [], phases: [] }
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