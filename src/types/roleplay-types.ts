/**
 * Roleplay Engine Types
 * 
 * Defines interfaces for personality-driven specialist interactions,
 * ensuring consistent character adoption and contextual responses.
 */

import { SpecialistDefinition } from '../services/specialist-loader.js';
import { SpecialistSession, SessionContext } from './session-types.js';
import { AtomicTopic } from './bc-knowledge.js';

/**
 * Context for generating specialist responses
 */
export interface RoleplayContext {
  // Session information
  session: SpecialistSession;
  specialist: SpecialistDefinition;
  
  // Current conversation context
  userMessage: string;
  conversationHistory: string[];
  requiresIntroduction?: boolean;

  // Knowledge context
  relevantTopics?: AtomicTopic[];
  codeContext?: {
    files: string[];
    codeSnippets: string[];
    bcObjects: string[];
  };
  
  // Problem context
  problemType?: string;
  urgency?: 'low' | 'medium' | 'high';
  complexity?: 'simple' | 'moderate' | 'complex';
}

/**
 * Personality traits that drive response generation
 */
export interface PersonalityTraits {
  communication_style: string;
  expertise_focus: string[];
  problem_approach: string;
  collaboration_style: string;
  characteristic_phrases: string[];
}

/**
 * Generated specialist response with metadata
 */
export interface SpecialistResponse {
  // Core response
  content: string;
  specialist_id: string;
  
  // Response metadata
  personality_elements: {
    greeting_used: boolean;
    characteristic_phrases: string[];
    expertise_demonstrated: string[];
    communication_style_applied: string;
  };
  
  // Knowledge integration
  topics_referenced: string[];
  knowledge_applied: {
    topic_id: string;
    application_context: string;
  }[];
  
  // Collaboration hints
  suggested_handoffs?: {
    specialist_id: string;
    reason: string;
  }[];
  
  // Session updates
  context_updates?: Partial<SessionContext> & {
    methodology_suggested?: boolean;
  };
  recommendations_added?: string[];
  
  // Response type and intent
  response_type: 'guidance' | 'solution' | 'question' | 'handoff' | 'encouragement' | 'methodology_onboarding' | 'methodology_suggestion' | 'direct_specialist_response';
  confidence_level: 'high' | 'medium' | 'low';
}

/**
 * Template for specialist response patterns
 */
export interface ResponseTemplate {
  trigger_keywords: string[];
  specialist_types: string[];
  template_pattern: string;
  personality_emphasis: string[];
  knowledge_domains: string[];
}

/**
 * Configuration for roleplay behavior
 */
export interface RoleplayConfig {
  // Personality strength (how much personality vs pure technical info)
  personality_strength: 'subtle' | 'moderate' | 'strong';
  
  // Response length preference
  response_length: 'concise' | 'detailed' | 'adaptive';
  
  // Knowledge integration level
  knowledge_integration: 'minimal' | 'balanced' | 'comprehensive';
  
  // Collaboration encouragement
  suggest_handoffs: boolean;
  suggest_collaborations: boolean;
  
  // Learning and adaptation
  learn_user_preferences: boolean;
  adapt_communication_style: boolean;
}

/**
 * Main roleplay engine interface
 */
export interface RoleplayEngine {
  /**
   * Generate a personality-driven response from a specialist
   */
  generateResponse(context: RoleplayContext): Promise<SpecialistResponse>;
  
  /**
   * Analyze user message to suggest appropriate specialist
   */
  suggestSpecialist(
    userMessage: string, 
    currentContext?: SessionContext
  ): Promise<{
    specialist_id: string;
    confidence: number;
    reasoning: string;
  }[]>;
  
  /**
   * Generate a specialist greeting for session start
   */
  generateGreeting(
    specialist: SpecialistDefinition,
    context?: Partial<SessionContext>
  ): Promise<SpecialistResponse>;
  
  /**
   * Generate handoff message when transferring between specialists
   */
  generateHandoff(
    fromSpecialist: SpecialistDefinition,
    toSpecialist: SpecialistDefinition,
    context: RoleplayContext
  ): Promise<{
    farewell: SpecialistResponse;
    introduction: SpecialistResponse;
  }>;
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<RoleplayConfig>): void;
  
  /**
   * Get personality analysis for a specialist
   */
  analyzePersonality(specialist: SpecialistDefinition): PersonalityTraits;
}

/**
 * Knowledge retrieval interface for context-aware responses
 */
export interface KnowledgeRetriever {
  /**
   * Find relevant topics based on user message and specialist expertise
   */
  findRelevantTopics(
    userMessage: string,
    specialistExpertise: string[],
    limit?: number
  ): Promise<AtomicTopic[]>;
  
  /**
   * Find relevant topics within methodology context
   */
  findRelevantTopicsInMethodology(
    userMessage: string,
    methodologyContext: any,
    specialistExpertise: string[],
    limit?: number
  ): Promise<AtomicTopic[]>;
  
  /**
   * Get related topics for deeper context
   */
  getRelatedTopics(topicId: string, limit?: number): Promise<AtomicTopic[]>;
  
  /**
   * Search for solutions in specialist's domain
   */
  searchSolutions(
    problemDescription: string,
    domains: string[],
    limit?: number
  ): Promise<AtomicTopic[]>;
}

/**
 * Response quality metrics for evaluation and improvement
 */
export interface ResponseMetrics {
  personality_score: number;      // How well did it capture the specialist's personality?
  relevance_score: number;        // How relevant was the response to the user's question?
  knowledge_score: number;        // How well did it integrate BC knowledge?
  helpfulness_score: number;      // How helpful was the response?
  consistency_score: number;      // How consistent with previous responses?
}