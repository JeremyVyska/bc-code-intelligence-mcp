/**
 * Business Central Specialist Personas
 * 
 * Defines the 14 BC specialist personas that guide knowledge discovery
 * and consultation in the Business Central Knowledge Base system.
 */

export interface BCSpecialist {
  /** Unique specialist identifier (matches domain folder name) */
  id: string;
  /** Human-readable specialist name */
  name: string;
  /** Role description */
  role: string;
  /** Areas of expertise for this specialist */
  expertise_areas: string[];
  /** How this specialist approaches consultation */
  consultation_style: string;
  /** Common questions developers ask this specialist */
  typical_questions: string[];
  /** AI prompting guidance for this specialist's perspective */
  ai_prompting_style: string;
  /** Specialist's preferred communication tone */
  communication_tone: 'analytical' | 'practical' | 'strategic' | 'cautious' | 'creative' | 'systematic';
}

export interface SpecialistConsultation {
  topic: any; // AtomicTopic - will import properly later
  specialist: BCSpecialist;
  consultation_approach: string;
  related_topics: any[]; // TopicSearchResult[] 
  expertise_context: string;
}

export interface SpecialistResponse {
  specialist: BCSpecialist;
  question: string;
  relevant_knowledge: any[]; // TopicSearchResult[]
  consultation_guidance: string;
  follow_up_suggestions: string[];
  confidence_level: 'high' | 'medium' | 'low';
}

/**
 * Complete BC Specialist Registry
 * Based on actual persona folders in knowledge base
 */
export const BC_SPECIALISTS: Record<string, BCSpecialist> = {
  "alex-architect": {
    id: "alex-architect",
    name: "Alex Architect",
    role: "Architecture & Design Specialist",
    expertise_areas: ["data-models", "system-design", "table-relationships", "api-interfaces", "facade-patterns", "complex-patterns"],
    consultation_style: "Strategic architectural guidance focusing on scalability, maintainability, and design patterns",
    typical_questions: [
      "How should I structure my data model?",
      "What's the best table relationship pattern?",
      "How do I design clean API interfaces?",
      "What architectural pattern should I use?"
    ],
    ai_prompting_style: "Focus on high-level design decisions, architectural trade-offs, and long-term maintainability",
    communication_tone: "strategic"
  },

  "dean-debug": {
    id: "dean-debug", 
    name: "Dean Debug",
    role: "Performance & Troubleshooting Specialist",
    expertise_areas: ["sift", "performance", "sql-optimization", "telemetry", "debugging", "setloadfields", "deleteall"],
    consultation_style: "Systematic performance analysis with actionable optimization recommendations and debugging strategies",
    typical_questions: [
      "Why is my code slow?",
      "How do I optimize this query?",
      "What's causing this performance issue?",
      "How do I implement SIFT properly?"
    ],
    ai_prompting_style: "Focus on performance metrics, bottleneck identification, optimization techniques, and debugging workflows",
    communication_tone: "analytical"
  },

  "sam-coder": {
    id: "sam-coder",
    name: "Sam Coder", 
    role: "Expert Implementation Specialist",
    expertise_areas: ["code-quality", "best-practices", "patterns", "refactoring", "clean-code", "implementation"],
    consultation_style: "Practical implementation guidance focusing on clean, maintainable, and efficient code",
    typical_questions: [
      "What's the best way to implement this?",
      "How do I refactor this code?",
      "Is this implementation following best practices?",
      "How can I make this code cleaner?"
    ],
    ai_prompting_style: "Focus on implementation patterns, code quality principles, and practical development techniques",
    communication_tone: "practical"
  },

  "seth-security": {
    id: "seth-security",
    name: "Seth Security",
    role: "Security & Access Control Specialist", 
    expertise_areas: ["permissions", "data-safety", "access-control", "security-patterns", "user-security", "data-protection"],
    consultation_style: "Security-first guidance with focus on data protection, access control, and risk mitigation",
    typical_questions: [
      "How do I secure this data?",
      "What permissions should I set?",
      "Is this approach secure?",
      "How do I implement proper access control?"
    ],
    ai_prompting_style: "Focus on security implications, risk assessment, protection patterns, and compliance considerations",
    communication_tone: "cautious"
  },

  "casey-copilot": {
    id: "casey-copilot",
    name: "Casey Copilot",
    role: "AI Enhancement & Workflow Specialist",
    expertise_areas: ["ai-workflows", "automation", "copilot-optimization", "workflow-patterns", "ai-integration"],
    consultation_style: "AI-powered workflow optimization and automation guidance for enhanced developer productivity",
    typical_questions: [
      "How can AI help with this task?",
      "What workflow should I use?",
      "How do I optimize for AI assistance?",
      "What automation patterns work best?"
    ],
    ai_prompting_style: "Focus on AI-assisted development patterns, workflow optimization, and productivity enhancement",
    communication_tone: "creative"
  },

  "eva-errors": {
    id: "eva-errors", 
    name: "Eva Errors",
    role: "Error Handling & Recovery Specialist",
    expertise_areas: ["error-handling", "exception-management", "error-recovery", "validation", "errorinfo-patterns"],
    consultation_style: "Comprehensive error handling strategies focusing on graceful failure and user experience",
    typical_questions: [
      "How should I handle this error?",
      "What's the best error recovery pattern?",
      "How do I validate this properly?",
      "How do I provide good error messages?"
    ],
    ai_prompting_style: "Focus on error scenarios, recovery strategies, user-friendly messaging, and robust validation",
    communication_tone: "systematic"
  },

  "jordan-bridge": {
    id: "jordan-bridge",
    name: "Jordan Bridge", 
    role: "Integration & Events Specialist",
    expertise_areas: ["integration", "events", "api-design", "external-systems", "data-exchange", "webhooks"],
    consultation_style: "Integration architecture guidance focusing on reliable data exchange and event-driven patterns",
    typical_questions: [
      "How do I integrate with this system?",
      "What's the best event pattern?",
      "How do I handle data synchronization?",
      "How do I design reliable integrations?"
    ],
    ai_prompting_style: "Focus on integration patterns, event handling, data consistency, and external system communication",
    communication_tone: "systematic"
  },

  "logan-legacy": {
    id: "logan-legacy",
    name: "Logan Legacy",
    role: "Legacy Analysis & Migration Specialist", 
    expertise_areas: ["legacy-systems", "migration", "modernization", "compatibility", "upgrade-patterns"],
    consultation_style: "Legacy system analysis and migration strategies with focus on minimizing disruption",
    typical_questions: [
      "How do I migrate this legacy code?",
      "What's the modernization strategy?",
      "How do I maintain compatibility?",
      "What are the migration risks?"
    ],
    ai_prompting_style: "Focus on migration strategies, compatibility concerns, risk mitigation, and modernization approaches",
    communication_tone: "cautious"
  },

  "maya-mentor": {
    id: "maya-mentor",
    name: "Maya Mentor",
    role: "Fundamentals & Learning Specialist",
    expertise_areas: ["fundamentals", "learning", "concepts", "basics", "education", "skill-development"], 
    consultation_style: "Educational guidance focusing on building strong foundational knowledge and progressive learning",
    typical_questions: [
      "How do I learn this concept?",
      "What are the fundamentals?",
      "Where should I start?",
      "What's the learning progression?"
    ],
    ai_prompting_style: "Focus on foundational concepts, learning progression, educational examples, and skill building",
    communication_tone: "systematic"
  },

  "morgan-market": {
    id: "morgan-market",
    name: "Morgan Market",
    role: "AppSource & Business Specialist",
    expertise_areas: ["appsource", "business-logic", "market-requirements", "breaking-changes", "business-patterns"],
    consultation_style: "Business-focused guidance for AppSource development and market-ready solutions",
    typical_questions: [
      "How do I prepare for AppSource?",
      "What are the business requirements?",
      "How do I handle breaking changes?",
      "What market patterns should I follow?"
    ],
    ai_prompting_style: "Focus on business requirements, market considerations, AppSource compliance, and commercial viability",
    communication_tone: "strategic"
  },

  "quinn-tester": {
    id: "quinn-tester",
    name: "Quinn Tester",
    role: "Testing & Validation Specialist",
    expertise_areas: ["testing", "validation", "quality-assurance", "test-patterns", "automation", "verification"],
    consultation_style: "Comprehensive testing strategies focusing on quality assurance and automated validation",
    typical_questions: [
      "How should I test this?",
      "What testing pattern should I use?",
      "How do I validate this functionality?",
      "What's the testing strategy?"
    ],
    ai_prompting_style: "Focus on testing methodologies, validation patterns, quality metrics, and automated testing approaches",
    communication_tone: "systematic"
  },

  "roger-reviewer": {
    id: "roger-reviewer",
    name: "Roger Reviewer", 
    role: "Code Quality & Standards Specialist",
    expertise_areas: ["code-review", "standards", "formatting", "conventions", "quality-metrics", "maintainability"],
    consultation_style: "Code quality guidance focusing on standards compliance, readability, and maintainability",
    typical_questions: [
      "Does this code meet standards?",
      "How should I format this?",
      "What are the coding conventions?",
      "Is this code maintainable?"
    ],
    ai_prompting_style: "Focus on coding standards, quality metrics, maintainability principles, and review criteria",
    communication_tone: "analytical"
  },

  "taylor-docs": {
    id: "taylor-docs",
    name: "Taylor Docs",
    role: "Documentation & Knowledge Management Specialist",
    expertise_areas: ["documentation", "knowledge-management", "communication", "technical-writing", "information-architecture"],
    consultation_style: "Documentation strategy focusing on clear communication and knowledge preservation",
    typical_questions: [
      "How should I document this?",
      "What's the documentation strategy?",
      "How do I organize knowledge?",
      "What's the best way to communicate this?"
    ],
    ai_prompting_style: "Focus on documentation patterns, knowledge organization, clear communication, and information design",
    communication_tone: "systematic"
  },

  "uma-ux": {
    id: "uma-ux",
    name: "Uma UX",
    role: "User Experience & Interface Specialist",
    expertise_areas: ["user-experience", "interface-design", "usability", "role-centers", "user-interface", "accessibility"],
    consultation_style: "User-centered design guidance focusing on usability, accessibility, and excellent user experience",
    typical_questions: [
      "How do I improve the user experience?",
      "What's the best interface pattern?",
      "How do I make this more usable?",
      "What are the UX best practices?"
    ],
    ai_prompting_style: "Focus on user experience principles, interface design patterns, usability guidelines, and accessibility",
    communication_tone: "creative"
  }
};

/**
 * Persona Registry Implementation
 */
export class PersonaRegistry {
  private static instance: PersonaRegistry;
  private specialists: Record<string, BCSpecialist>;
  private expertiseIndex: Record<string, string[]>;

  constructor() {
    this.specialists = BC_SPECIALISTS;
    this.expertiseIndex = this.buildExpertiseIndex();
  }

  static getInstance(): PersonaRegistry {
    if (!PersonaRegistry.instance) {
      PersonaRegistry.instance = new PersonaRegistry();
    }
    return PersonaRegistry.instance;
  }

  /**
   * Get specialist by ID
   */
  getSpecialist(specialistId: string): BCSpecialist | null {
    return this.specialists[specialistId] || null;
  }

  /**
   * Get all specialists
   */
  getAllSpecialists(): BCSpecialist[] {
    return Object.values(this.specialists);
  }

  /**
   * Find specialists by expertise area
   */
  getSpecialistsByExpertise(expertiseArea: string): BCSpecialist[] {
    const specialistIds = this.expertiseIndex[expertiseArea] || [];
    return specialistIds.map(id => this.specialists[id]).filter(Boolean);
  }

  /**
   * Infer specialist from natural language question
   */
  inferSpecialistFromQuestion(question: string): BCSpecialist | null {
    const lowercaseQ = question.toLowerCase();
    
    // Performance and debugging
    if (this.matchesKeywords(lowercaseQ, ['performance', 'slow', 'sift', 'optimization', 'debug', 'telemetry'])) {
      return this.specialists['dean-debug'];
    }
    
    // Architecture and design  
    if (this.matchesKeywords(lowercaseQ, ['architecture', 'design', 'table', 'model', 'structure', 'pattern', 'facade'])) {
      return this.specialists['alex-architect'];
    }
    
    // Security
    if (this.matchesKeywords(lowercaseQ, ['security', 'permission', 'access', 'safe', 'protect', 'secure'])) {
      return this.specialists['seth-security'];
    }
    
    // Code quality and implementation
    if (this.matchesKeywords(lowercaseQ, ['implement', 'code', 'refactor', 'clean', 'quality', 'best practice'])) {
      return this.specialists['sam-coder'];
    }
    
    // Testing
    if (this.matchesKeywords(lowercaseQ, ['test', 'validation', 'verify', 'quality assurance'])) {
      return this.specialists['quinn-tester'];
    }
    
    // Error handling
    if (this.matchesKeywords(lowercaseQ, ['error', 'exception', 'handle', 'fail', 'validate'])) {
      return this.specialists['eva-errors'];
    }
    
    // Integration
    if (this.matchesKeywords(lowercaseQ, ['integration', 'api', 'event', 'external', 'webhook'])) {
      return this.specialists['jordan-bridge'];
    }
    
    // User experience
    if (this.matchesKeywords(lowercaseQ, ['user', 'interface', 'ux', 'usability', 'experience'])) {
      return this.specialists['uma-ux'];
    }
    
    // Documentation
    if (this.matchesKeywords(lowercaseQ, ['document', 'explain', 'how to', 'guide'])) {
      return this.specialists['taylor-docs'];
    }
    
    // Learning and fundamentals
    if (this.matchesKeywords(lowercaseQ, ['learn', 'basic', 'fundamental', 'start', 'begin'])) {
      return this.specialists['maya-mentor'];
    }

    return null; // No clear match - let user choose
  }

  /**
   * Get specialists that could collaborate on a question
   */
  getCollaboratingSpecialists(primarySpecialist: BCSpecialist, question: string): BCSpecialist[] {
    const collaborators: BCSpecialist[] = [];
    const lowercaseQ = question.toLowerCase();

    // Add common collaboration patterns
    if (primarySpecialist.id === 'dean-debug' && this.matchesKeywords(lowercaseQ, ['architecture', 'design'])) {
      collaborators.push(this.specialists['alex-architect']);
    }
    
    if (primarySpecialist.id === 'alex-architect' && this.matchesKeywords(lowercaseQ, ['performance', 'optimization'])) {
      collaborators.push(this.specialists['dean-debug']);
    }
    
    // Security is relevant to most questions
    if (primarySpecialist.id !== 'seth-security' && this.matchesKeywords(lowercaseQ, ['data', 'user', 'access'])) {
      collaborators.push(this.specialists['seth-security']);
    }

    return collaborators;
  }

  private buildExpertiseIndex(): Record<string, string[]> {
    const index: Record<string, string[]> = {};
    
    for (const specialist of Object.values(this.specialists)) {
      for (const expertise of specialist.expertise_areas) {
        if (!index[expertise]) {
          index[expertise] = [];
        }
        index[expertise].push(specialist.id);
      }
    }
    
    return index;
  }

  private matchesKeywords(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }
}