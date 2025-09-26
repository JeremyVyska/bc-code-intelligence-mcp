/**
 * BC Specialist Roleplay Engine
 * 
 * Brings specialist personas to life through personality-driven responses,
 * consistent character adoption, and context-aware knowledge integration.
 */

import {
  RoleplayEngine,
  RoleplayContext,
  SpecialistResponse,
  PersonalityTraits,
  RoleplayConfig,
  KnowledgeRetriever,
  ResponseTemplate
} from '../types/roleplay-types.js';
import { SpecialistDefinition } from './specialist-loader.js';
import { SessionContext } from '../types/session-types.js';
import { AtomicTopic, TopicSearchParams } from '../types/bc-knowledge.js';
import { MultiContentLayerService } from './multi-content-layer-service.js';
import { KnowledgeService } from './knowledge-service.js';

export class BCSpecialistRoleplayEngine implements RoleplayEngine {
  private config: RoleplayConfig;
  private responseTemplates: Map<string, ResponseTemplate[]> = new Map();
  private knowledgeRetriever: KnowledgeRetriever;

  constructor(
    private readonly layerService: MultiContentLayerService,
    private readonly knowledgeService: KnowledgeService,
    config?: Partial<RoleplayConfig>
  ) {
    this.config = {
      personality_strength: 'moderate',
      response_length: 'adaptive',
      knowledge_integration: 'balanced',
      suggest_handoffs: true,
      suggest_collaborations: true,
      learn_user_preferences: true,
      adapt_communication_style: true,
      ...config
    };

    this.knowledgeRetriever = new BCKnowledgeRetriever(layerService, knowledgeService);
    this.initializeResponseTemplates();
  }

  /**
   * Generate a methodology-contextual response from a specialist
   */
  async generateResponse(context: RoleplayContext): Promise<SpecialistResponse> {
    const { specialist, userMessage, session } = context;
    
    // Check if methodology context is established
    if (!session.methodology_context?.confirmed_by_user) {
      return await this.establishMethodologyContext(specialist, userMessage, session);
    }
    
    // Apply knowledge within established methodology context
    return await this.applyKnowledgeInMethodology(specialist, userMessage, session);
  }

  /**
   * Establish methodology context before applying domain knowledge
   */
  private async establishMethodologyContext(
    specialist: SpecialistDefinition,
    userMessage: string,
    session: any
  ): Promise<SpecialistResponse> {
    const personality = this.analyzePersonality(specialist);
    
    // Check if user is asking a direct question or wants immediate help
    const isDirectQuestion = this.isDirectQuestion(userMessage);
    
    if (isDirectQuestion) {
      // Provide immediate specialist response without methodology onboarding
      return await this.provideDirectSpecialistResponse(specialist, userMessage, session);
    }
    
    // Suggest appropriate methodologies based on user request and specialist expertise
    const suggestedMethodologies = await this.suggestMethodologies(userMessage, specialist);
    
    // Build methodology onboarding response
    const response = await this.buildMethodologyOnboardingResponse(
      specialist,
      personality,
      userMessage,
      suggestedMethodologies
    );

    return {
      content: response.content,
      specialist_id: specialist.specialist_id,
      personality_elements: response.personality_elements,
      topics_referenced: [],
      knowledge_applied: [],
      suggested_handoffs: [],
      context_updates: { methodology_suggested: true },
      recommendations_added: response.recommendations || [],
      response_type: 'methodology_onboarding',
      confidence_level: 'high'
    };
  }

  /**
   * Check if user message is a direct question that should get immediate response
   */
  private isDirectQuestion(userMessage: string): boolean {
    const message = userMessage.toLowerCase().trim();
    
    // Patterns that indicate broader learning/guidance requests (should get methodology)
    const methodologyPatterns = [
      /^(i want to learn|i'd like to learn|teach me|i'm new to|can you guide me|guide me through|walk me through)/i,
      /^(i need help with my.*project|i need guidance|i need training)/i,
      /learn about.*in general/i,
      /get started with/i,
      /introduction to/i
    ];
    
    // If it matches methodology patterns, it's not a direct question
    if (methodologyPatterns.some(pattern => pattern.test(message))) {
      return false;
    }
    
    // Patterns that indicate direct questions (should get immediate response)
    const directPatterns = [
      /^(how|what|when|where|why|which|can|could|should|would|is|are|do|does|did)/i,
      /\?/,
      /tell me about.*specific/i,
      /explain.*this/i,
      /help me with.*\b(debug|fix|solve|resolve|optimize|review|analyze|check)\b/i,
      /I need to (fix|debug|solve|resolve|optimize|review|analyze|check)/i,
      /show me/i,
      /review/i,
      /analyze/i,
      /check/i,
      /look at/i,
      /fix/i,
      /debug/i
    ];

    return directPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Provide immediate specialist response without methodology onboarding
   */
  private async provideDirectSpecialistResponse(
    specialist: SpecialistDefinition,
    userMessage: string,
    session: any
  ): Promise<SpecialistResponse> {
    const personality = this.analyzePersonality(specialist);

    // NO pre-selection of knowledge - specialist must search themselves
    const relevantTopics: any[] = [];

    // Create a minimal methodology context for the direct response
    const directMethodologyContext = {
      confirmed_by_user: true,
      methodology_id: 'direct_consultation',
      title: 'Direct Specialist Consultation',
      current_phase: 'analysis',
      next_steps: []
    };

    // Update session with direct context
    session.methodology_context = directMethodologyContext;

    // Generate direct response using existing machinery
    const response = await this.buildMethodologyResponse(
      specialist,
      personality,
      userMessage,
      directMethodologyContext,
      relevantTopics
    );

    // Apply session context updates
    const contextUpdates = this.generateContextUpdates(
      { specialist, userMessage, session, conversationHistory: [] }, 
      relevantTopics
    );
    
    // Check for collaboration opportunities
    const suggestedHandoffs = await this.suggestCollaborations(
      { specialist, userMessage, session, conversationHistory: [] }, 
      relevantTopics
    );

    return {
      content: response.content,
      specialist_id: specialist.specialist_id,
      personality_elements: response.personality_elements,
      topics_referenced: relevantTopics.map(t => t.id),
      knowledge_applied: relevantTopics.map(topic => ({
        topic_id: topic.id,
        application_context: this.getApplicationContext(topic, userMessage)
      })),
      suggested_handoffs: suggestedHandoffs,
      context_updates: contextUpdates,
      recommendations_added: response.recommendations,
      response_type: 'direct_specialist_response',
      confidence_level: response.confidence_level
    };
  }

  /**
   * Apply knowledge within established methodology context
   */
  private async applyKnowledgeInMethodology(
    specialist: SpecialistDefinition,
    userMessage: string,
    session: any
  ): Promise<SpecialistResponse> {
    const personality = this.analyzePersonality(specialist);

    // NO pre-selection of knowledge - specialist must search themselves
    const relevantTopics: any[] = [];

    // Generate methodology-contextual response
    const response = await this.buildMethodologyResponse(
      specialist,
      personality,
      userMessage,
      session.methodology_context,
      relevantTopics
    );

    // Apply session context updates
    const contextUpdates = this.generateContextUpdates(
      { specialist, userMessage, session, conversationHistory: [] }, 
      relevantTopics
    );
    
    // Check for collaboration opportunities
    const suggestedHandoffs = await this.suggestCollaborations(
      { specialist, userMessage, session, conversationHistory: [] }, 
      relevantTopics
    );

    return {
      content: response.content,
      specialist_id: specialist.specialist_id,
      personality_elements: response.personality_elements,
      topics_referenced: relevantTopics.map(t => t.id),
      knowledge_applied: relevantTopics.map(topic => ({
        topic_id: topic.id,
        application_context: this.getApplicationContext(topic, userMessage)
      })),
      suggested_handoffs: suggestedHandoffs,
      context_updates: contextUpdates,
      recommendations_added: response.recommendations,
      response_type: response.response_type,
      confidence_level: response.confidence_level
    };
  }

  /**
   * Suggest appropriate methodologies based on user request and specialist expertise
   */
  private async suggestMethodologies(
    userMessage: string,
    specialist: SpecialistDefinition
  ): Promise<any[]> {
    // Analyze user message for methodology keywords and patterns
    const methodologyKeywords = this.extractMethodologyKeywords(userMessage);
    const specialistMethodologies = await this.getSpecialistMethodologies(specialist);
    
    // Return suggested methodologies with confidence scores
    return specialistMethodologies.filter(methodology => 
      methodologyKeywords.some(keyword => 
        methodology.title.toLowerCase().includes(keyword) ||
        methodology.description.toLowerCase().includes(keyword)
      )
    ).slice(0, 3); // Top 3 suggestions
  }

  /**
   * Build methodology onboarding response
   */
  private async buildMethodologyOnboardingResponse(
    specialist: SpecialistDefinition,
    personality: any,
    userMessage: string,
    suggestedMethodologies: any[]
  ): Promise<any> {
    const greeting = specialist.persona.greeting;
    
    if (suggestedMethodologies.length === 0) {
      return {
        content: `${greeting} I'd love to help! Before we dive in, could you tell me more about what you're trying to accomplish? This will help me suggest the best approach for our work together.`,
        personality_elements: {},
        recommendations: [],
        response_type: 'clarification_needed',
        confidence_level: 'medium'
      };
    }

    const primaryMethodology = suggestedMethodologies[0];
    const content = `${greeting} I can see you're interested in ${this.extractUserIntent(userMessage)}. 

**Suggested Approach: "${primaryMethodology.title}"**
${primaryMethodology.description}

This methodology will help us work through this systematically. Does this approach sound right for your goals? Once we confirm this framework, I can provide targeted guidance with relevant knowledge applied in context.

What's your current experience level so I can tailor the approach accordingly?`;

    return {
      content,
      personality_elements: { methodology_suggested: primaryMethodology.methodology_id },
      recommendations: [`Follow ${primaryMethodology.title} methodology`],
      response_type: 'methodology_suggestion',
      confidence_level: 'high'
    };
  }

  /**
   * Build response within established methodology context
   */
  private async buildMethodologyResponse(
    specialist: SpecialistDefinition,
    personality: any,
    userMessage: string,
    methodologyContext: any,
    relevantTopics: any[]
  ): Promise<any> {
    // Create a proper session context for the existing method
    const sessionWithContext = {
      sessionId: 'temp',
      specialistId: specialist.specialist_id,
      userId: 'temp',
      startTime: new Date(),
      lastActivity: new Date(),
      messageCount: 1,
      status: 'active' as const,
      messages: [],
      context: { 
        methodology_context: methodologyContext,
        solutions: [],
        recommendations: [],
        nextSteps: [],
        userPreferences: {}
      }
    };

    // Use existing buildPersonalityResponse with methodology context
    return await this.buildPersonalityResponse(
      specialist, 
      personality, 
      { specialist, userMessage, session: sessionWithContext, conversationHistory: [] }, 
      relevantTopics
    );
  }

  /**
   * Extract methodology keywords from user message
   */
  private extractMethodologyKeywords(userMessage: string): string[] {
    const keywords: string[] = [];
    const message = userMessage.toLowerCase();
    
    const patterns = {
      'fundamentals': ['fundamental', 'basics', 'introduction', 'getting started', 'onboarding'],
      'development': ['development', 'coding', 'programming', 'building'],
      'architecture': ['architecture', 'design', 'structure', 'pattern'],
      'performance': ['performance', 'optimization', 'speed', 'efficiency'],
      'testing': ['testing', 'quality', 'validation', 'debugging'],
      'workflow': ['workflow', 'methodology', 'process', 'approach']
    };

    for (const [category, terms] of Object.entries(patterns)) {
      if (terms.some(term => message.includes(term))) {
        keywords.push(category);
      }
    }
    
    return keywords;
  }

  /**
   * Get methodologies relevant to specialist
   */
  private async getSpecialistMethodologies(specialist: SpecialistDefinition): Promise<any[]> {
    // Map specialists to their preferred methodologies
    const specialistMethodologies: Record<string, any[]> = {
      'maya-mentor': [
        { methodology_id: 'developer-introduction', title: 'BC Development Fundamentals', description: 'Introduction to Business Central development fundamentals and environment setup' },
        { methodology_id: 'skill-building', title: 'Skill Development Methodology', description: 'Structured approach to building BC development skills' }
      ],
      'sam-coder': [
        { methodology_id: 'implementation', title: 'Implementation Methodology', description: 'Efficient code implementation and development practices' }
      ],
      'alex-architect': [
        { methodology_id: 'architecture-design', title: 'Architecture Design Methodology', description: 'Systematic approach to BC solution architecture' }
      ],
      'dean-debug': [
        { methodology_id: 'troubleshooting', title: 'Diagnostic Methodology', description: 'Systematic problem diagnosis and performance analysis' }
      ]
    };

    return specialistMethodologies[specialist.specialist_id] || [];
  }

  /**
   * Extract user intent from message
   */
  private extractUserIntent(userMessage: string): string {
    // Simple intent extraction - could be made more sophisticated
    const message = userMessage.toLowerCase();
    if (message.includes('fundamental') || message.includes('getting started')) {
      return 'learning fundamentals';
    }
    if (message.includes('workflow') || message.includes('methodology')) {
      return 'following a structured approach';
    }
    return 'getting help with BC development';
  }

  /**
   * Analyze user message to suggest appropriate specialist
   */
  async suggestSpecialist(
    userMessage: string,
    currentContext?: SessionContext
  ): Promise<{ specialist_id: string; confidence: number; reasoning: string; }[]> {
    const specialists = await this.layerService.getAllSpecialists();
    const suggestions: { specialist_id: string; confidence: number; reasoning: string; }[] = [];

    for (const specialist of specialists) {
      const confidence = await this.calculateSpecialistConfidence(
        userMessage,
        specialist,
        currentContext
      );

      if (confidence > 0.3) { // Threshold for relevant suggestions
        suggestions.push({
          specialist_id: specialist.specialist_id,
          confidence,
          reasoning: this.generateSuggestionReasoning(userMessage, specialist, confidence)
        });
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  }

  /**
   * Generate a specialist greeting for session start
   */
  async generateGreeting(
    specialist: SpecialistDefinition,
    context?: Partial<SessionContext>
  ): Promise<SpecialistResponse> {
    const personality = this.analyzePersonality(specialist);
    const greeting = this.buildGreeting(specialist, personality, context);

    return {
      content: greeting,
      specialist_id: specialist.specialist_id,
      personality_elements: {
        greeting_used: true,
        characteristic_phrases: [specialist.persona.greeting],
        expertise_demonstrated: specialist.expertise.primary.slice(0, 2),
        communication_style_applied: specialist.persona.communication_style
      },
      topics_referenced: [],
      knowledge_applied: [],
      response_type: 'greeting' as any,
      confidence_level: 'high'
    };
  }

  /**
   * Generate handoff message when transferring between specialists
   */
  async generateHandoff(
    fromSpecialist: SpecialistDefinition,
    toSpecialist: SpecialistDefinition,
    context: RoleplayContext
  ): Promise<{ farewell: SpecialistResponse; introduction: SpecialistResponse; }> {
    const fromPersonality = this.analyzePersonality(fromSpecialist);
    const toPersonality = this.analyzePersonality(toSpecialist);

    const farewell = this.buildHandoffFarewell(fromSpecialist, toSpecialist, context);
    const introduction = this.buildHandoffIntroduction(toSpecialist, fromSpecialist, context);

    return {
      farewell: {
        content: farewell,
        specialist_id: fromSpecialist.specialist_id,
        personality_elements: {
          greeting_used: false,
          characteristic_phrases: [],
          expertise_demonstrated: [],
          communication_style_applied: fromSpecialist.persona.communication_style
        },
        topics_referenced: [],
        knowledge_applied: [],
        response_type: 'handoff' as any,
        confidence_level: 'high'
      },
      introduction: {
        content: introduction,
        specialist_id: toSpecialist.specialist_id,
        personality_elements: {
          greeting_used: true,
          characteristic_phrases: [toSpecialist.persona.greeting],
          expertise_demonstrated: toSpecialist.expertise.primary.slice(0, 2),
          communication_style_applied: toSpecialist.persona.communication_style
        },
        topics_referenced: [],
        knowledge_applied: [],
        response_type: 'handoff' as any,
        confidence_level: 'high'
      }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RoleplayConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get personality analysis for a specialist
   */
  analyzePersonality(specialist: SpecialistDefinition): PersonalityTraits {
    return {
      communication_style: specialist.persona.communication_style,
      expertise_focus: specialist.expertise.primary,
      problem_approach: this.extractProblemApproach(specialist),
      collaboration_style: this.extractCollaborationStyle(specialist),
      characteristic_phrases: [
        specialist.persona.greeting,
        ...this.extractCharacteristicPhrases(specialist)
      ]
    };
  }

  /**
   * Build personality-driven response
   */
  private async buildPersonalityResponse(
    specialist: SpecialistDefinition,
    personality: PersonalityTraits,
    context: RoleplayContext,
    relevantTopics: AtomicTopic[]
  ): Promise<{
    content: string;
    personality_elements: any;
    recommendations: string[];
    response_type: any;
    confidence_level: any;
  }> {
    const { userMessage, session } = context;
    
    // Start with specialist greeting if it's a new conversation
    let response = session.messageCount <= 1 ? `${specialist.persona.greeting} ` : '';
    
    // Apply personality-driven response patterns
    response += await this.generatePersonalityContent(
      specialist,
      personality,
      userMessage,
      relevantTopics,
      context
    );

    // Add recommendations based on knowledge
    const recommendations = this.generateRecommendations(relevantTopics, userMessage);
    
    // Determine response type and confidence
    const responseType = this.determineResponseType(userMessage, relevantTopics);
    const confidenceLevel = this.calculateConfidenceLevel(specialist, userMessage, relevantTopics);

    return {
      content: response,
      personality_elements: {
        greeting_used: session.messageCount <= 1,
        characteristic_phrases: personality.characteristic_phrases.slice(0, 2),
        expertise_demonstrated: personality.expertise_focus.slice(0, 3),
        communication_style_applied: personality.communication_style
      },
      recommendations,
      response_type: responseType,
      confidence_level: confidenceLevel
    };
  }

  /**
   * Generate personality-driven content
   */
  private async generatePersonalityContent(
    specialist: SpecialistDefinition,
    personality: PersonalityTraits,
    userMessage: string,
    relevantTopics: AtomicTopic[],
    context: RoleplayContext
  ): Promise<string> {
    // This is where we'd integrate with the actual BC knowledge to generate responses
    // For now, let's create template-based responses that demonstrate personality
    
    const templates = this.getResponseTemplates(specialist.specialist_id);
    const selectedTemplate = this.selectBestTemplate(templates, userMessage, relevantTopics);
    
    if (selectedTemplate) {
      return this.fillTemplate(selectedTemplate, specialist, userMessage, relevantTopics, context);
    }

    // Fallback to basic personality-driven response
    return this.generateBasicPersonalityResponse(specialist, userMessage, relevantTopics, context);
  }

  /**
   * Generate agent roleplay instructions (NOT direct user response)
   */
  private generateBasicPersonalityResponse(
    specialist: SpecialistDefinition,
    userMessage: string,
    relevantTopics: AtomicTopic[],
    context: RoleplayContext
  ): string {
    // Generate AGENT INSTRUCTIONS using the FULL specialist instruction content
    let instructions = `You are ${specialist.title} (${specialist.specialist_id}). Below are your complete instructions:\n\n`;

    // **CRITICAL FIX**: Include the full specialist instruction content
    instructions += `# SPECIALIST INSTRUCTIONS:\n${specialist.content}\n\n`;

    instructions += `---\n\n# CURRENT REQUEST CONTEXT:\n`;
    instructions += `**User Message**: "${userMessage}"\n\n`;

    // **NO PRE-SELECTED KNOWLEDGE** - provide YAML-based hints instead
    instructions += `**Knowledge Search Hints** (based on your YAML configuration):\n`;
    instructions += `- Your Primary Expertise: ${specialist.expertise.primary.join(', ')}\n`;
    instructions += `- Your Domains: ${specialist.domains.join(', ')}\n`;
    instructions += `- Suggested find_bc_knowledge searches: "${specialist.expertise.primary.join('", "')}", "${specialist.domains.join('", "')}"\n\n`;

    // Add introduction instructions if this is a new session or handoff
    if (context.requiresIntroduction) {
      instructions += `**Session Info**: This is a new session - introduce yourself using your greeting and explain your expertise.\n\n`;
    }

    instructions += `**CRITICAL REMINDER**: NO knowledge has been pre-selected for you. Follow your "Implementation Requirements" section exactly - you MUST use find_bc_knowledge to search for relevant information yourself.\n\n`;

    instructions += `Now respond as ${specialist.title} following your complete instruction set above.`;

    return instructions;
  }

  /**
   * Generate style-appropriate opening
   */
  private getStyleApproach(specialist: SpecialistDefinition): string {
    const communication = specialist.persona.communication_style.toLowerCase();
    
    if (communication.includes('technical')) {
      return "Let's dive into the technical details.";
    } else if (communication.includes('business')) {
      return "Let's think about this from a business perspective.";
    } else if (communication.includes('practical')) {
      return "Here's a practical approach to your question.";
    } else if (communication.includes('teaching')) {
      return "Let me walk you through this step by step.";
    }
    
    return "I'd be happy to help with this!";
  }

  /**
   * Generate knowledge-based guidance
   */
  private generateKnowledgeBasedGuidance(
    specialist: SpecialistDefinition,
    topic: AtomicTopic,
    userMessage: string
  ): string {
    // Create specialist-specific framing of the knowledge
    const specialistLens = this.getSpecialistPerspective(specialist, topic);
    
    // Extract key points from the topic content
    const keyPoints = this.extractKeyGuidancePoints(topic);
    
    return `${specialistLens} Looking at **${topic.title}**, ${keyPoints}. This ${topic.frontmatter.difficulty === 'advanced' ? 'advanced' : topic.frontmatter.difficulty} pattern applies directly to your situation.`;
  }

  /**
   * Get specialist-specific perspective on a topic
   */
  private getSpecialistPerspective(specialist: SpecialistDefinition, topic: AtomicTopic): string {
    const specialistId = specialist.specialist_id;
    
    if (specialistId.includes('performance') || specialistId.includes('debug')) {
      return `From a performance optimization standpoint,`;
    } else if (specialistId.includes('security')) {
      return `From a security perspective,`;
    } else if (specialistId.includes('architect')) {
      return `From an architectural design perspective,`;
    } else if (specialistId.includes('test')) {
      return `From a testing and quality standpoint,`;
    } else if (specialistId.includes('mentor') || specialistId.includes('docs')) {
      return `Let me explain this step by step:`;
    }
    
    return `Based on my expertise in ${specialist.expertise.primary[0]},`;
  }

  /**
   * Extract key guidance points from topic content
   */
  private extractKeyGuidancePoints(topic: AtomicTopic): string {
    const content = topic.content;
    
    // Look for key implementation patterns
    if (content.includes('## Implementation') || content.includes('## How to')) {
      return `the key implementation approach focuses on ${this.extractImplementationFocus(content)}`;
    }
    
    // Look for best practices
    if (content.includes('## Best Practices') || content.includes('### Best Practices')) {
      return `the best practices emphasize ${this.extractBestPractices(content)}`;
    }
    
    // Look for common pitfalls
    if (content.includes('## Common Pitfalls') || content.includes('### Pitfalls')) {
      return `it's important to avoid ${this.extractPitfalls(content)}`;
    }
    
    // Default to title-based guidance
    return `this pattern provides essential guidance for ${topic.title.toLowerCase()}`;
  }

  /**
   * Extract implementation focus from content
   */
  private extractImplementationFocus(content: string): string {
    // Find implementation section and extract first few points
    const lines = content.split('\n');
    const implIndex = lines.findIndex(line => 
      line.includes('## Implementation') || line.includes('## How to')
    );
    
    if (implIndex >= 0 && implIndex < lines.length - 1) {
      const nextFewLines = lines.slice(implIndex + 1, implIndex + 4)
        .filter(line => line.trim() && !line.startsWith('#'))
        .join(' ');
      
      return this.summarizeIntoPhrase(nextFewLines);
    }
    
    return 'proper implementation patterns';
  }

  /**
   * Extract best practices from content
   */
  private extractBestPractices(content: string): string {
    const lines = content.split('\n');
    const practicesIndex = lines.findIndex(line => 
      line.includes('Best Practices')
    );
    
    if (practicesIndex >= 0 && practicesIndex < lines.length - 1) {
      const nextFewLines = lines.slice(practicesIndex + 1, practicesIndex + 3)
        .filter(line => line.trim() && !line.startsWith('#'))
        .join(' ');
      
      return this.summarizeIntoPhrase(nextFewLines);
    }
    
    return 'following established patterns and maintaining code quality';
  }

  /**
   * Extract pitfalls from content
   */
  private extractPitfalls(content: string): string {
    const lines = content.split('\n');
    const pitfallsIndex = lines.findIndex(line => 
      line.includes('Pitfalls') || line.includes('Common Issues')
    );
    
    if (pitfallsIndex >= 0 && pitfallsIndex < lines.length - 1) {
      const nextFewLines = lines.slice(pitfallsIndex + 1, pitfallsIndex + 3)
        .filter(line => line.trim() && !line.startsWith('#'))
        .join(' ');
      
      return this.summarizeIntoPhrase(nextFewLines);
    }
    
    return 'common implementation mistakes';
  }

  /**
   * Summarize content into a concise phrase
   */
  private summarizeIntoPhrase(text: string): string {
    // Clean up the text and create a concise summary
    const cleaned = text
      .replace(/[*#-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Take first sentence or first 60 characters
    const firstSentence = cleaned.split('.')[0];
    const truncated = firstSentence.length > 60 
      ? firstSentence.substring(0, 60) + '...'
      : firstSentence;
    
    return truncated.toLowerCase();
  }

  /**
   * Generate general guidance when no specific topics match
   */
  private generateGeneralGuidance(specialist: SpecialistDefinition, userMessage: string): string {
    return `I'd suggest we start by understanding the specific requirements and then I can point you toward the right specialist or resources that would be most helpful.`;
  }

  // Additional helper methods...
  private initializeResponseTemplates(): void {
    // Initialize with basic templates - these could be loaded from configuration
    this.responseTemplates.set('performance', [
      {
        trigger_keywords: ['slow', 'performance', 'optimize', 'speed'],
        specialist_types: ['dean-debug'],
        template_pattern: "🔧 Dean here! Performance issues are my specialty. {problem_analysis} {solution_approach} {next_steps}",
        personality_emphasis: ['technical', 'systematic', 'thorough'],
        knowledge_domains: ['performance', 'optimization']
      }
    ]);
  }

  private getResponseTemplates(specialistId: string): ResponseTemplate[] {
    // Return templates relevant to this specialist
    return Array.from(this.responseTemplates.values()).flat()
      .filter(template => template.specialist_types.includes(specialistId));
  }

  private selectBestTemplate(
    templates: ResponseTemplate[],
    userMessage: string,
    relevantTopics: AtomicTopic[]
  ): ResponseTemplate | null {
    // Simple keyword matching for now
    const messageLower = userMessage.toLowerCase();
    
    for (const template of templates) {
      if (template.trigger_keywords.some(keyword => messageLower.includes(keyword))) {
        return template;
      }
    }
    
    return null;
  }

  private fillTemplate(
    template: ResponseTemplate,
    specialist: SpecialistDefinition,
    userMessage: string,
    relevantTopics: AtomicTopic[],
    context: RoleplayContext
  ): string {
    // Basic template filling - would be more sophisticated in practice
    let content = template.template_pattern;
    
    content = content.replace('{problem_analysis}', 'Let me analyze this issue systematically.');
    content = content.replace('{solution_approach}', 'Here\'s how I\'d approach solving this:');
    content = content.replace('{next_steps}', 'Next steps would be to examine the specific implementation details.');
    
    return content;
  }

  private extractProblemApproach(specialist: SpecialistDefinition): string {
    // Extract problem-solving approach from specialist definition
    return specialist.persona.communication_style;
  }

  private extractCollaborationStyle(specialist: SpecialistDefinition): string {
    // Extract collaboration preferences
    return specialist.collaboration?.natural_handoffs?.length > 0 ? 'collaborative' : 'independent';
  }

  private extractCharacteristicPhrases(specialist: SpecialistDefinition): string[] {
    // Extract characteristic phrases from the content
    return []; // Would parse from the specialist's content
  }

  private buildGreeting(
    specialist: SpecialistDefinition,
    personality: PersonalityTraits,
    context?: Partial<SessionContext>
  ): string {
    let greeting = specialist.persona.greeting;
    
    if (context?.problem) {
      greeting += ` I understand you're working on ${context.problem}. `;
    }
    
    greeting += ` I'm here to help with ${specialist.expertise.primary.join(', ')}. What specific challenge are you facing?`;
    
    return greeting;
  }

  private buildHandoffFarewell(
    fromSpecialist: SpecialistDefinition,
    toSpecialist: SpecialistDefinition,
    context: RoleplayContext
  ): string {
    return `I think ${toSpecialist.persona.greeting.replace('!', '')} would be perfect for this! They're our expert in ${toSpecialist.expertise.primary.join(' and ')}. Let me hand you over to them.`;
  }

  private buildHandoffIntroduction(
    toSpecialist: SpecialistDefinition,
    fromSpecialist: SpecialistDefinition,
    context: RoleplayContext
  ): string {
    return `${toSpecialist.persona.greeting} ${fromSpecialist.specialist_id.split('-')[0]} filled me in on what you're working on. I'm excited to help with ${toSpecialist.expertise.primary[0]}! Let's dive in.`;
  }

  private async calculateSpecialistConfidence(
    userMessage: string,
    specialist: SpecialistDefinition,
    context?: SessionContext
  ): Promise<number> {
    const messageLower = userMessage.toLowerCase();
    let confidence = 0;

    // Check against primary expertise
    for (const expertise of specialist.expertise.primary) {
      if (messageLower.includes(expertise.toLowerCase().replace('-', ' '))) {
        confidence += 0.3;
      }
    }

    // Check against secondary expertise  
    for (const expertise of specialist.expertise.secondary) {
      if (messageLower.includes(expertise.toLowerCase().replace('-', ' '))) {
        confidence += 0.2;
      }
    }

    // Check against domains
    for (const domain of specialist.domains) {
      if (messageLower.includes(domain.toLowerCase().replace('-', ' '))) {
        confidence += 0.1;
      }
    }

    return Math.min(confidence, 1.0);
  }

  private generateSuggestionReasoning(
    userMessage: string,
    specialist: SpecialistDefinition,
    confidence: number
  ): string {
    return `${specialist.specialist_id} specializes in ${specialist.expertise.primary.join(', ')} which aligns with your question about ${userMessage.substring(0, 50)}...`;
  }

  private generateContextUpdates(
    context: RoleplayContext,
    relevantTopics: AtomicTopic[]
  ): Partial<SessionContext> {
    return {
      // Add discovered topics to context
      // Update problem understanding
      // Track user preferences
    };
  }

  private async suggestCollaborations(
    context: RoleplayContext,
    relevantTopics: AtomicTopic[]
  ): Promise<{ specialist_id: string; reason: string; }[]> {
    const suggestions: { specialist_id: string; reason: string; }[] = [];
    
    // Check if other specialists might be helpful
    const { specialist } = context;
    
    if (specialist.collaboration?.natural_handoffs) {
      for (const handoffId of specialist.collaboration.natural_handoffs) {
        suggestions.push({
          specialist_id: handoffId,
          reason: `Natural collaboration partner for ${specialist.expertise.primary[0]}`
        });
      }
    }

    return suggestions.slice(0, 2); // Limit suggestions
  }

  private getApplicationContext(topic: AtomicTopic, userMessage: string): string {
    const messageWords = userMessage.toLowerCase().split(' ');
    const topicTags = topic.frontmatter.tags || [];
    
    // Identify context based on user message and topic
    let context = `Applied ${topic.title} to address`;
    
    if (messageWords.some(word => ['performance', 'slow', 'optimize', 'speed'].includes(word))) {
      context += ` performance concerns in ${this.extractEntityFromMessage(userMessage)}`;
    } else if (messageWords.some(word => ['security', 'permission', 'access'].includes(word))) {
      context += ` security requirements for ${this.extractEntityFromMessage(userMessage)}`;
    } else if (messageWords.some(word => ['integration', 'api', 'connect'].includes(word))) {
      context += ` integration challenges with ${this.extractEntityFromMessage(userMessage)}`;
    } else if (messageWords.some(word => ['test', 'testing', 'validation'].includes(word))) {
      context += ` testing strategy for ${this.extractEntityFromMessage(userMessage)}`;
    } else {
      context += ` the development challenge in ${userMessage.substring(0, 50)}...`;
    }
    
    // Add BC version context if available
    if (topic.frontmatter.bc_versions) {
      context += ` (BC ${topic.frontmatter.bc_versions} compatible)`;
    }
    
    return context;
  }

  /**
   * Extract business entity or object from user message
   */
  private extractEntityFromMessage(message: string): string {
    const commonEntities = [
      'table', 'page', 'report', 'codeunit', 'api', 'service',
      'customer', 'vendor', 'item', 'purchase', 'sales', 'inventory'
    ];
    
    const messageLower = message.toLowerCase();
    for (const entity of commonEntities) {
      if (messageLower.includes(entity)) {
        return entity;
      }
    }
    
    return 'your BC implementation';
  }

  private generateRecommendations(topics: AtomicTopic[], userMessage: string): string[] {
    const recommendations: string[] = [];
    
    for (const topic of topics.slice(0, 3)) {
      // Create actionable recommendations based on the topic
      if (topic.frontmatter.bc_versions) {
        recommendations.push(`Apply **${topic.title}** patterns (compatible with ${topic.frontmatter.bc_versions})`);
      } else {
        recommendations.push(`Consider implementing **${topic.title}** best practices`);
      }
      
      // Add specific action based on topic type
      if (topic.frontmatter.tags?.includes('performance')) {
        recommendations.push(`Measure performance impact of ${topic.title.toLowerCase()} implementation`);
      } else if (topic.frontmatter.tags?.includes('security')) {
        recommendations.push(`Review security implications when applying ${topic.title.toLowerCase()}`);
      } else if (topic.frontmatter.tags?.includes('testing')) {
        recommendations.push(`Create test cases to validate ${topic.title.toLowerCase()} implementation`);
      }
    }
    
    return recommendations.slice(0, 4); // Limit to 4 recommendations
  }

  private determineResponseType(userMessage: string, topics: AtomicTopic[]): any {
    const messageLower = userMessage.toLowerCase();
    
    if (messageLower.includes('how') || messageLower.includes('help')) {
      return 'guidance';
    } else if (messageLower.includes('fix') || messageLower.includes('solve')) {
      return 'solution';
    } else if (messageLower.includes('?')) {
      return 'question';
    }
    
    return 'guidance';
  }

  private calculateConfidenceLevel(
    specialist: SpecialistDefinition,
    userMessage: string,
    topics: AtomicTopic[]
  ): any {
    if (topics.length >= 2) return 'high';
    if (topics.length === 1) return 'medium';
    return 'low';
  }
}

/**
 * Knowledge retriever implementation for BC topics
 */
class BCKnowledgeRetriever implements KnowledgeRetriever {
  constructor(
    private readonly layerService: MultiContentLayerService,
    private readonly knowledgeService: KnowledgeService
  ) {}

  async findRelevantTopics(
    userMessage: string,
    specialistExpertise: string[],
    limit: number = 5
  ): Promise<AtomicTopic[]> {
    try {
      // Convert specialist expertise to broader search terms that match topic content
      const broadSearchTerms = specialistExpertise.map(exp => {
        // Map specific expertise terms to broader, more searchable terms
        const mappings: { [key: string]: string } = {
          'performance-analysis': 'performance',
          'error-diagnosis': 'error',
          'system-monitoring': 'monitoring',
          'optimization-implementation': 'optimization',
          'query-optimization': 'query performance',
          'memory-management': 'memory',
          'integration-performance': 'integration',
          'user-experience-optimization': 'user experience'
        };
        return mappings[exp] || exp.replace('-', ' ');
      });

      // Search for topics using the user's message in code_context field
      const searchParams: TopicSearchParams = {
        code_context: `${userMessage} ${broadSearchTerms.join(' ')}`, // Combine user message with expertise terms
        limit,
        bc_version: 'BC22' // Default - could be made configurable
      };

      // Use the existing knowledge service to find relevant topics
      const searchResults = await this.knowledgeService.searchTopics(searchParams);
      
      // Get full topic details for each search result
      if (searchResults && Array.isArray(searchResults)) {
        const topics: AtomicTopic[] = [];
        
        for (const result of searchResults.slice(0, limit)) {
          const topic = await this.knowledgeService.getTopic(result.id);
          if (topic) {
            topics.push(topic);
          }
        }
        
        return topics;
      }

      return [];
    } catch (error) {
      console.error('Error finding relevant topics:', error);
      return [];
    }
  }

  /**
   * Find relevant topics within methodology context
   */
  async findRelevantTopicsInMethodology(
    userMessage: string,
    methodologyContext: any,
    specialistExpertise: string[],
    limit: number = 5
  ): Promise<AtomicTopic[]> {
    try {
      // Focus search on methodology-specific topics and current phase context
      const methodologyTerms = [
        methodologyContext.methodology_id,
        methodologyContext.current_phase,
        ...specialistExpertise
      ];

      const searchParams: TopicSearchParams = {
        code_context: `${userMessage} ${methodologyTerms.join(' ')}`,
        limit,
        bc_version: 'BC22'
      };

      const searchResults = await this.knowledgeService.searchTopics(searchParams);
      
      if (searchResults && Array.isArray(searchResults)) {
        const topics: AtomicTopic[] = [];
        
        for (const result of searchResults.slice(0, limit)) {
          const topic = await this.knowledgeService.getTopic(result.id);
          if (topic) {
            topics.push(topic);
          }
        }
        
        return topics;
      }

      return [];
    } catch (error) {
      console.error('Error finding methodology-relevant topics:', error);
      return [];
    }
  }

  async getRelatedTopics(topicId: string, limit: number = 3): Promise<AtomicTopic[]> {
    try {
      // Get the main topic first
      const mainTopic = await this.knowledgeService.getTopic(topicId);
      if (!mainTopic) {
        return [];
      }

      // Use domain-based search to find related topics
      const searchParams = {
        query: mainTopic.frontmatter.domain,
        search_type: 'fuzzy' as const,
        limit: limit + 1, // Get one extra to exclude the main topic
        bc_version: 'BC22',
        domains: [mainTopic.frontmatter.domain]
      };

      const searchResults = await this.knowledgeService.searchTopics(searchParams);
      const relatedTopics: AtomicTopic[] = [];
      
      for (const result of searchResults) {
        if (result.id !== topicId && relatedTopics.length < limit) {
          const topic = await this.knowledgeService.getTopic(result.id);
          if (topic) {
            relatedTopics.push(topic);
          }
        }
      }

      return relatedTopics;
    } catch (error) {
      console.error('Error getting related topics:', error);
      return [];
    }
  }

  async searchSolutions(
    problemDescription: string,
    domains: string[],
    limit: number = 5
  ): Promise<AtomicTopic[]> {
    try {
      // Search for solution-oriented topics in the specified domains
      const searchParams = {
        query: `${problemDescription} solution implementation fix pattern`,
        search_type: 'hybrid' as const,
        limit: limit * 2, // Get more results to filter
        bc_version: 'BC22',
        domains
      };

      const searchResults = await this.knowledgeService.searchTopics(searchParams);
      const solutionTopics: AtomicTopic[] = [];
      
      for (const result of searchResults) {
        if (solutionTopics.length >= limit) break;
        
        const topic = await this.knowledgeService.getTopic(result.id);
        if (topic) {
          // Filter for topics that are more solution-oriented
          const content = topic.content.toLowerCase();
          const title = topic.title.toLowerCase();
          
          if (
            content.includes('solution') ||
            content.includes('implementation') ||
            content.includes('fix') ||
            content.includes('pattern') ||
            title.includes('pattern') ||
            title.includes('optimization') ||
            title.includes('best practice')
          ) {
            solutionTopics.push(topic);
          }
        }
      }

      return solutionTopics;
    } catch (error) {
      console.error('Error searching solutions:', error);
      return [];
    }
  }
}