/**
 * Methodology Service - Knowledge-Driven Implementation
 * Dynamic methodology loading and guidance using the layered knowledge system
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parse as parseYaml } from 'yaml';
import { KnowledgeService } from './knowledge-service.js';
import { AtomicTopic } from '../types/bc-knowledge.js';

export interface MethodologyLoadRequest {
  user_request: string;
  domain?: string;
}

export interface PhaseGuidanceRequest {
  phase_name: string;
  step?: string;
}

export interface CompletenessValidationRequest {
  phase: string;
  completed_items: string[];
}

export interface MethodologyLoadResult {
  intent_detected: string;
  phases: PhaseContent[];
  execution_order: string[];
  validation_criteria: Record<string, any>;
  estimated_duration: string;
  session_id: string;
}

export interface PhaseContent {
  phase_name: string;
  methodology_content: string;
  domain_knowledge: DomainKnowledge;
  checklists: ChecklistItem[];
  success_criteria: string[];
}

export interface DomainKnowledge {
  patterns: string;
  anti_patterns: string;
  best_practices: string[];
}

export interface ChecklistItem {
  item: string;
  completed: boolean;
}

export interface ValidationResult {
  phase: string;
  completion_percentage: number;
  completed_items_count: number;
  total_requirements: number;
  missing_items: string[];
  quality_score: number;
  next_actions: string[];
  can_proceed_to_next_phase: boolean;
}

export class MethodologyService {
  private workflowsPath: string;
  private indexData: any;
  private loadedPhases: Record<string, PhaseContent> = {};
  private currentSession: {
    intent: string | null;
    phases: string[];
    domain: string;
    progress: Record<string, any>;
    validation_status: Record<string, any>;
  };

  constructor(
    private knowledgeService: KnowledgeService,
    workflowsPath?: string
  ) {
    // Keep workflow loading from files, but add knowledge service for BC content
    // ES module: __dirname equivalent
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    // Prefer workflows/, fall back to methodologies/ for backward compatibility
    const preferredPath = workflowsPath || join(__dirname, '../../embedded-knowledge', 'workflows');
    const legacyPath = join(__dirname, '../../embedded-knowledge', 'methodologies');

    if (existsSync(preferredPath)) {
      this.workflowsPath = preferredPath;
    } else if (existsSync(legacyPath)) {
      this.workflowsPath = legacyPath;
      console.error(`⚠️  Using deprecated 'methodologies/' directory. Please rename to 'workflows/'`);
    } else {
      this.workflowsPath = preferredPath; // Will fail in loadIndex() with helpful error
    }

    this.indexData = this.loadIndex();
    this.currentSession = {
      intent: null,
      phases: [],
      domain: 'business-central',
      progress: {},
      validation_status: {}
    };
  }

  /**
   * Get the workflow index data for tool access
   */
  public getIndexData(): any {
    return this.indexData;
  }

  private loadIndex(): any {
    const indexFile = join(this.workflowsPath, 'index.json');

    // V2: Try loading from YAML workflow files first
    if (!existsSync(indexFile)) {
      return this.loadIndexFromYamlWorkflows();
    }

    // Legacy: Load from index.json
    try {
      const content = readFileSync(indexFile, 'utf-8');
      const indexData = JSON.parse(content);

      // Log detailed information about loaded workflows
      console.error(`Loaded workflow index with ${Object.keys(indexData.intents || {}).length} intents`);

      const availablePhases = new Set<string>();
      Object.values(indexData.intents || {}).forEach((intent: any) => {
        (intent.phases || []).forEach((phase: string) => availablePhases.add(phase));
      });
      console.error(`Available phases: ${Array.from(availablePhases).join(', ')}`);

      return indexData;
    } catch (error) {
      throw new Error(`Failed to load workflow index: ${error}`);
    }
  }

  /**
   * V2: Build index dynamically from YAML workflow files
   */
  private loadIndexFromYamlWorkflows(): any {
    if (!existsSync(this.workflowsPath)) {
      throw new Error(`
🚨 BC Code Intelligence MCP Server Setup Issue

PROBLEM: Missing embedded knowledge content
DIRECTORY: ${this.workflowsPath}

LIKELY CAUSE: The git submodule 'embedded-knowledge' was not initialized when this package was built/installed.

SOLUTIONS:
📦 For NPM users: Update to the latest version with: npm update bc-code-intelligence-mcp
🔧 For developers: Run: git submodule init && git submodule update
🏢 For package maintainers: Ensure submodules are initialized before npm publish

This error indicates the embedded BC knowledge base is missing, which contains the methodology definitions, specialist knowledge, and domain expertise required for the MCP server to function.
      `.trim());
    }

    // Find all YAML workflow files
    const files = readdirSync(this.workflowsPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    if (files.length === 0) {
      throw new Error(`No workflow YAML files found in ${this.workflowsPath}`);
    }

    const workflows: Map<string, any> = new Map();
    const intents: Record<string, any> = {};
    const allPhases = new Set<string>();
    const phaseDependencies: Record<string, string[]> = {};

    for (const file of files) {
      try {
        const filePath = join(this.workflowsPath, file);
        const content = readFileSync(filePath, 'utf-8');
        const workflow = parseYaml(content);

        if (!workflow.type) continue;

        workflows.set(workflow.type, workflow);

        // Build intent from workflow
        const intentKeywords = this.extractKeywordsFromWorkflow(workflow);
        const phaseIds = (workflow.phases || []).map((p: any) => p.id);

        intents[workflow.type] = {
          keywords: intentKeywords,
          phases: phaseIds,
          description: workflow.description || workflow.name,
          specialist: workflow.specialist
        };

        // Collect phases and their dependencies
        for (const phase of workflow.phases || []) {
          allPhases.add(phase.id);

          // Extract dependencies from entry_conditions
          if (phase.entry_conditions) {
            const deps: string[] = [];
            for (const condition of phase.entry_conditions) {
              // Parse "X phase completed" pattern
              const match = condition.match(/^(\w+)\s+phase\s+completed$/i);
              if (match) {
                deps.push(match[1]);
              }
            }
            if (deps.length > 0) {
              phaseDependencies[phase.id] = deps;
            }
          }
        }
      } catch (error) {
        console.error(`Warning: Failed to parse workflow file ${file}:`, error);
      }
    }

    console.error(`Loaded ${workflows.size} workflow definitions from YAML files`);
    console.error(`Available phases: ${Array.from(allPhases).join(', ')}`);

    return {
      intents,
      phase_dependencies: phaseDependencies,
      workflow_mappings: Object.fromEntries(
        Array.from(workflows.entries()).map(([type, wf]) => [
          type,
          {
            description: wf.description,
            phases: (wf.phases || []).map((p: any) => p.id),
            methodology_type: wf.type,
            specialist: wf.specialist
          }
        ])
      ),
      validation_criteria: {},
      _workflows: workflows  // Store full workflow data for later use
    };
  }

  /**
   * Extract keywords from workflow definition for intent matching
   */
  private extractKeywordsFromWorkflow(workflow: any): string[] {
    const keywords: string[] = [];

    // Add type as keyword
    if (workflow.type) {
      keywords.push(...workflow.type.split('-'));
    }

    // Add name words
    if (workflow.name) {
      keywords.push(...workflow.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
    }

    // Add description words
    if (workflow.description) {
      const descWords = workflow.description.toLowerCase()
        .split(/\s+/)
        .filter((w: string) => w.length > 4 && !['using', 'focusing', 'based'].includes(w));
      keywords.push(...descWords.slice(0, 5));
    }

    // Add phase names
    for (const phase of workflow.phases || []) {
      if (phase.name) {
        keywords.push(...phase.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
      }
    }

    // Deduplicate
    return [...new Set(keywords)];
  }

  /**
   * Load methodology based on user request and intent analysis
   */
  public async loadMethodology(request: MethodologyLoadRequest): Promise<MethodologyLoadResult> {
    // Analyze user intent
    const intent = this.analyzeIntent(request.user_request);
    const domain = request.domain || 'business-central';

    // Get required phases
    const requiredPhases = this.indexData.intents[intent]?.phases || ['analysis', 'performance'];

    // Resolve dependencies
    const executionOrder = this.resolvePhaseDepedencies(requiredPhases);

    // Load methodology content with knowledge-driven domain knowledge
    const loadedPhases: PhaseContent[] = [];
    for (const phase of executionOrder) {
      const phaseContent = await this.loadPhaseContent(phase, domain);
      loadedPhases.push(phaseContent);
    }

    // Set up session
    this.currentSession = {
      intent,
      phases: executionOrder,
      domain,
      progress: Object.fromEntries(executionOrder.map(p => [p, { status: 'pending', completion: 0 }])),
      validation_status: {}
    };

    return {
      intent_detected: intent,
      phases: loadedPhases,
      execution_order: executionOrder,
      validation_criteria: this.getValidationCriteria(executionOrder),
      estimated_duration: this.estimateDuration(executionOrder),
      session_id: Date.now().toString()
    };
  }

  /**
   * Get specific phase guidance and instructions
   */
  public async getPhaseGuidance(request: PhaseGuidanceRequest): Promise<PhaseContent | { error: string }> {
    try {
      // Load phase content if not already loaded
      if (!this.loadedPhases[request.phase_name]) {
        this.loadedPhases[request.phase_name] = await this.loadPhaseContent(
          request.phase_name,
          this.currentSession.domain
        );
      }

      const phaseContent = this.loadedPhases[request.phase_name];

      if (!phaseContent) {
        return { error: `Phase '${request.phase_name}' content not loaded` };
      }

      // Extract specific step if requested
      if (request.step) {
        return this.extractStepContent(phaseContent, request.step);
      }

      return phaseContent;
    } catch (error) {
      return { error: `Failed to load phase guidance: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Validate methodology completion against systematic framework
   */
  public async validateCompleteness(request: CompletenessValidationRequest): Promise<ValidationResult> {
    try {
      // Load phase requirements
      const phaseRequirements = await this.extractPhaseRequirements(request.phase);

      // Calculate completion
    const totalRequirements = phaseRequirements.length;
    const completedCount = request.completed_items.filter(item => 
      phaseRequirements.some(req => req.toLowerCase().includes(item.toLowerCase()))
    ).length;
    const completionPercentage = totalRequirements > 0 ? (completedCount / totalRequirements * 100) : 0;

    // Identify missing items
    const missingItems = phaseRequirements.filter(req => 
      !request.completed_items.some(item => req.toLowerCase().includes(item.toLowerCase()))
    );

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(request.phase, request.completed_items);

    // Update session progress
    this.currentSession.progress[request.phase] = {
      status: completionPercentage >= 90 ? 'completed' : 'in_progress',
      completion: completionPercentage
    };

    // Determine next actions
    const nextActions = this.getNextActions(request.phase, missingItems, completionPercentage);

      return {
        phase: request.phase,
        completion_percentage: completionPercentage,
        completed_items_count: completedCount,
        total_requirements: totalRequirements,
        missing_items: missingItems,
        quality_score: qualityScore,
        next_actions: nextActions,
        can_proceed_to_next_phase: completionPercentage >= 80
      };
    } catch (error) {
      throw new Error(`Failed to validate completeness: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Find workflows by search query
   */
  public async findWorkflowsByQuery(query: string): Promise<any[]> {
    const queryLower = query.toLowerCase();
    
    // Search through methodology workflows and return matching ones
    const workflows = [];
    
    // Search through methodology index for workflow-related content
    if (this.indexData.workflow_mappings) {
      for (const [workflowName, workflowData] of Object.entries(this.indexData.workflow_mappings)) {
        const workflowDataTyped = workflowData as any;
        if (workflowName.toLowerCase().includes(queryLower) ||
            (workflowDataTyped.description && workflowDataTyped.description.toLowerCase().includes(queryLower)) ||
            (workflowDataTyped.phases && workflowDataTyped.phases.some((phase: string) => 
              phase.toLowerCase().includes(queryLower)))) {
          workflows.push({
            name: workflowName,
            description: workflowDataTyped.description || 'BC development workflow',
            phases: workflowDataTyped.phases || [],
            methodology_type: workflowDataTyped.methodology_type || 'general'
          });
        }
      }
    }
    
    // If no specific workflow matches, return generic BC workflow suggestions
    if (workflows.length === 0) {
      workflows.push({
        name: 'bc-development-workflow',
        description: 'General Business Central development workflow',
        phases: ['analysis', 'design', 'implementation', 'testing', 'deployment'],
        methodology_type: 'development'
      });
    }
    
    return workflows;
  }

  private analyzeIntent(userRequest: string): string {
    const userRequestLower = userRequest.toLowerCase();

    // Score each intent based on keyword matches
    const intentScores: Record<string, number> = {};
    for (const [intentName, intentData] of Object.entries(this.indexData.intents)) {
      let score = 0;
      for (const keyword of (intentData as any).keywords) {
        if (userRequestLower.includes(keyword.toLowerCase())) {
          score += 1;
        }
      }
      intentScores[intentName] = score;
    }

    // Return highest scoring intent, default to performance-optimization
    if (!Object.keys(intentScores).length || Math.max(...Object.values(intentScores)) === 0) {
      return 'performance-optimization';
    }

    return Object.entries(intentScores).reduce((a, b) => (intentScores[a[0]] || 0) > (intentScores[b[0]] || 0) ? a : b)[0];
  }

  private resolvePhaseDepedencies(requiredPhases: string[]): string[] {
    const dependencies = this.indexData.phase_dependencies;
    const resolved: string[] = [];
    const remaining = new Set(requiredPhases);

    while (remaining.size > 0) {
      // Find phases with no unresolved dependencies
      const ready: string[] = [];
      for (const phase of remaining) {
        const deps = dependencies[phase] || [];
        if (deps.every((dep: string) => resolved.includes(dep))) {
          ready.push(phase);
        }
      }

      if (ready.length === 0) {
        // Circular dependency - use original order
        return requiredPhases;
      }

      // Add ready phases to resolved list
      ready.sort(); // Consistent ordering
      resolved.push(...ready);
      ready.forEach(phase => remaining.delete(phase));
    }

    return resolved;
  }

  private async loadPhaseContent(phaseName: string, domain: string): Promise<PhaseContent> {
    // V2: Try to load from YAML workflow phases first
    const phaseFromYaml = this.loadPhaseFromYamlWorkflows(phaseName);
    if (phaseFromYaml) {
      const domainKnowledge = await this.loadDomainKnowledge(domain, phaseName);
      return {
        phase_name: phaseName,
        methodology_content: phaseFromYaml.content,
        domain_knowledge: domainKnowledge,
        checklists: phaseFromYaml.checklists,
        success_criteria: phaseFromYaml.successCriteria
      };
    }

    // Legacy: Try to load from phases/*.md files
    const phaseFile = join(this.workflowsPath, 'phases', `${phaseName}.md`);

    if (!existsSync(phaseFile)) {
      // Generate fallback content from available workflow data
      return this.generateFallbackPhaseContent(phaseName, domain);
    }

    const content = readFileSync(phaseFile, 'utf-8');

    // Load domain-specific knowledge dynamically
    const domainKnowledge = await this.loadDomainKnowledge(domain, phaseName);

    return {
      phase_name: phaseName,
      methodology_content: content,
      domain_knowledge: domainKnowledge,
      checklists: this.extractChecklists(content),
      success_criteria: this.extractSuccessCriteria(content)
    };
  }

  /**
   * V2: Load phase content from YAML workflow definitions
   */
  private loadPhaseFromYamlWorkflows(phaseId: string): { content: string; checklists: ChecklistItem[]; successCriteria: string[] } | null {
    const workflows = this.indexData._workflows as Map<string, any> | undefined;
    if (!workflows) return null;

    // Search for phase in all workflows
    for (const workflow of workflows.values()) {
      const phase = (workflow.phases || []).find((p: any) => p.id === phaseId);
      if (phase) {
        // Build content from phase definition
        const content = this.buildPhaseMarkdown(phase, workflow);
        const checklists = this.buildPhaseChecklists(phase, workflow);
        const successCriteria = this.buildPhaseSuccessCriteria(phase);

        return { content, checklists, successCriteria };
      }
    }

    return null;
  }

  /**
   * Build markdown content from YAML phase definition
   */
  private buildPhaseMarkdown(phase: any, workflow: any): string {
    const lines: string[] = [];

    lines.push(`# ${phase.name || phase.id}`);
    lines.push('');

    if (phase.description) {
      lines.push(phase.description);
      lines.push('');
    }

    if (phase.mode) {
      lines.push(`**Mode:** ${phase.mode}`);
      lines.push('');
    }

    if (phase.entry_conditions && phase.entry_conditions.length > 0) {
      lines.push('## Entry Conditions');
      for (const condition of phase.entry_conditions) {
        lines.push(`- ${condition}`);
      }
      lines.push('');
    }

    if (phase.available_actions && phase.available_actions.length > 0) {
      lines.push('## Available Actions');
      for (const action of phase.available_actions) {
        lines.push(`- [ ] **${action}**`);
      }
      lines.push('');
    }

    // Add per-file checklist items if this workflow has them
    if (workflow.per_file_checklist) {
      lines.push('## Checklist Items');
      for (const item of workflow.per_file_checklist) {
        lines.push(`- [ ] **${item.description}**`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Build checklist items from YAML phase definition
   */
  private buildPhaseChecklists(phase: any, workflow: any): ChecklistItem[] {
    const items: ChecklistItem[] = [];

    // Add available actions as checklist items
    if (phase.available_actions) {
      for (const action of phase.available_actions) {
        items.push({ item: action, completed: false });
      }
    }

    // Add per-file checklist items if applicable
    if (workflow.per_file_checklist) {
      for (const item of workflow.per_file_checklist) {
        items.push({ item: item.description, completed: false });
      }
    }

    return items;
  }

  /**
   * Build success criteria from YAML phase definition
   */
  private buildPhaseSuccessCriteria(phase: any): string[] {
    const criteria: string[] = [];

    if (phase.required) {
      criteria.push(`${phase.name || phase.id} phase completed`);
    }

    if (phase.entry_conditions) {
      // Entry conditions of next phase become success criteria for this one
      criteria.push(...phase.entry_conditions.map((c: string) => `✅ ${c}`));
    }

    return criteria;
  }

  /**
   * Generate fallback phase content when no specific definition exists
   */
  private async generateFallbackPhaseContent(phaseName: string, domain: string): Promise<PhaseContent> {
    const domainKnowledge = await this.loadDomainKnowledge(domain, phaseName);

    const content = `# ${phaseName.charAt(0).toUpperCase() + phaseName.slice(1)} Phase

This phase is part of the ${domain} workflow.

## Objectives

Complete the ${phaseName} phase by following best practices and using available tools.

## Available Tools

Use the BC Code Intelligence tools to assist with this phase:
- \`find_bc_knowledge\` - Search for relevant topics
- \`analyze_al_code\` - Analyze code for issues
- \`ask_bc_expert\` - Consult domain specialists
`;

    return {
      phase_name: phaseName,
      methodology_content: content,
      domain_knowledge: domainKnowledge,
      checklists: [{ item: `Complete ${phaseName} phase`, completed: false }],
      success_criteria: [`${phaseName} phase completed`]
    };
  }

  private async loadDomainKnowledge(domain: string, phase: string): Promise<DomainKnowledge> {
    try {
      // Load relevant knowledge dynamically from the knowledge service
      const domainTopics = await this.knowledgeService.searchTopics({
        domain: domain,
        limit: 10
      });

      // Get patterns and anti-patterns
      const codePatterns = await this.knowledgeService.findTopicsByType('code-pattern');
      const goodPatterns = codePatterns.filter(p => p.frontmatter.pattern_type === 'good');
      const badPatterns = codePatterns.filter(p => p.frontmatter.pattern_type === 'bad');

      // Extract best practices from domain topics
      const bestPractices = domainTopics
        .filter(topic => topic.tags?.includes('best-practice'))
        .map(topic => topic.title)
        .slice(0, 5);

      return {
        patterns: goodPatterns.map(p => p.title).join(', ') || 'No patterns found',
        anti_patterns: badPatterns.map(p => p.title).join(', ') || 'No anti-patterns found',
        best_practices: bestPractices.length > 0 ? bestPractices : ['Use knowledge base tools for best practices']
      };
    } catch (error) {
      console.error('Failed to load domain knowledge:', error);
      // Fallback to static content
      return {
        patterns: `Use find_bc_topics tool to access ${domain} patterns from knowledge base`,
        anti_patterns: `Use analyze_code_patterns tool to detect ${domain} anti-patterns`,
        best_practices: [`Reference ${domain} best practices via knowledge base tools`]
      };
    }
  }

  private extractChecklists(content: string): ChecklistItem[] {
    const checklistPattern = /- \[ \] \*\*(.*?)\*\*/g;
    const matches = Array.from(content.matchAll(checklistPattern));
    
    return matches.map(match => ({
      item: match[1] || '',
      completed: false
    }));
  }

  private extractSuccessCriteria(content: string): string[] {
    const criteriaPattern = /✅ \*\*(.*?)\*\*/g;
    const matches = Array.from(content.matchAll(criteriaPattern));
    return matches.map(match => match[1]).filter((item): item is string => Boolean(item));
  }

  private async extractPhaseRequirements(phase: string): Promise<string[]> {
    if (!this.loadedPhases[phase]) {
      this.loadedPhases[phase] = await this.loadPhaseContent(phase, this.currentSession.domain);
    }

    const content = this.loadedPhases[phase]?.methodology_content || '';

    // Extract checklist items as requirements
    const requirements: string[] = [];
    const checklistPattern = /- \[ \] (.*?)(?:\n|$)/gm;
    const matches = Array.from(content.matchAll(checklistPattern));

    for (const match of matches) {
      if (match[1]) {
        // Clean up the requirement text
        let cleaned = match[1].replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold markers
        cleaned = cleaned.replace(/[📊🟢🟡🔴🚨⚠️✅❌]/g, '').trim(); // Remove emojis
        if (cleaned) {
          requirements.push(cleaned);
        }
      }
    }

    return requirements;
  }

  private calculateQualityScore(phase: string, completedItems: string[]): number {
    // Basic quality score based on completion
    let baseScore = Math.min(completedItems.length / 10, 1.0) * 100;

    // Domain-specific quality adjustments for business-central
    if (this.currentSession.domain === 'business-central') {
      if (phase === 'analysis') {
        // Bonus for finding critical modules
        if (completedItems.some(item => item.includes('ReportGeneration') || item.includes('Reporting'))) {
          baseScore += 10; // Bonus for finding historically missed module
        }
        if (completedItems.filter(item => item.toLowerCase().includes('module')).length >= 9) {
          baseScore += 15; // Bonus for complete module coverage
        }
      } else if (phase === 'performance') {
        // Bonus for applying advanced BC patterns
        if (completedItems.some(item => item.includes('SIFT') || item.includes('FlowField'))) {
          baseScore += 20; // Bonus for advanced BC optimizations
        }
      }
    }

    return Math.min(baseScore, 100.0);
  }

  private getNextActions(phase: string, missingItems: string[], completion: number): string[] {
    const actions: string[] = [];

    if (completion < 50) {
      actions.push(`Continue ${phase} phase - less than 50% complete`);
      actions.push(`Focus on completing: ${missingItems.slice(0, 3).join(', ')}`); // Top 3 missing items
    } else if (completion < 80) {
      actions.push(`Near completion of ${phase} phase`);
      actions.push(`Complete remaining items: ${missingItems.join(', ')}`);
    } else if (completion >= 80) {
      actions.push(`${phase} phase ready for completion`);
      const currentPhaseIndex = this.currentSession.phases.indexOf(phase);
      if (currentPhaseIndex < this.currentSession.phases.length - 1) {
        const nextPhase = this.currentSession.phases[currentPhaseIndex + 1];
        actions.push(`Ready to proceed to ${nextPhase} phase`);
      }
    }

    return actions;
  }

  private getValidationCriteria(phases: string[]): Record<string, any> {
    const criteria: Record<string, any> = {};
    for (const phase of phases) {
      const phaseCriteria = this.indexData.validation_criteria?.[phase] || {};
      criteria[phase] = phaseCriteria;
    }
    return criteria;
  }

  private estimateDuration(phases: string[]): string {
    // Basic time estimates (in hours)
    const phaseTimes: Record<string, number> = {
      analysis: 2,
      performance: 4,
      architecture: 6,
      coding: 8,
      testability: 3,
      documentation: 2
    };

    const totalHours = phases.reduce((sum, phase) => sum + (phaseTimes[phase] || 2), 0);

    if (totalHours <= 4) {
      return '2-4 hours';
    } else if (totalHours <= 8) {
      return '4-8 hours (full day)';
    } else {
      return `${Math.floor(totalHours / 8)} days (${totalHours} hours)`;
    }
  }

  private extractStepContent(phaseContent: PhaseContent, step: string): any {
    const content = phaseContent.methodology_content;

    // Try multiple patterns to find step-specific content
    const patterns = [
      new RegExp(`### ${step}(.*?)(?=###|$)`, 'si'),                    // Exact match
      new RegExp(`### .*${step}.*?(.*?)(?=###|$)`, 'si'),              // Partial match
      new RegExp(`### Step \\d+:? ?${step}(.*?)(?=###|$)`, 'si'),      // Step N: format
      new RegExp(`### .*${step.replace(/\s+/g, '.*')}.*?(.*?)(?=###|$)`, 'si') // Flexible word matching
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return {
          step_name: step,
          content: match[1].trim(),
          checklists: this.extractChecklists(match[1]),
          success_criteria: this.extractSuccessCriteria(match[1])
        };
      }
    }

    // If no specific step found, return the full phase content
    return {
      step_name: step,
      content: `Step '${step}' not found as separate section. Here is the full phase content:`,
      full_phase_content: content,
      checklists: phaseContent.checklists,
      success_criteria: phaseContent.success_criteria
    };
  }
}