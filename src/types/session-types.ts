/**
 * Session Management Types for BC Code Intelligence Specialists
 * 
 * Provides interfaces for persistent, contextual conversations with specialist personas.
 * Supports in-memory sessions by default with configurable persistence through layer system.
 */

export interface SessionMessage {
  id: string;
  timestamp: Date;
  type: 'user' | 'specialist';
  specialistId?: string;
  content: string;
  metadata?: {
    files?: string[];           // Files referenced in this message
    codeSnippets?: string[];    // Code discussed
    topics?: string[];          // Knowledge topics referenced
  };
}

export interface SessionContext {
  // Current problem/conversation context
  problem?: string;
  codebaseContext?: {
    files: string[];
    objects: string[];          // BC objects being worked on
    project?: string;
  };
  
  // Methodology context - NEW for workflow-driven conversations
  methodology_context?: {
    methodology_id: string;
    methodology_title: string;
    current_phase: string;
    phase_progress: Record<string, any>;
    confirmed_by_user: boolean;
    suggested_at: Date;
  };
  
  // Solutions and recommendations discussed
  solutions: string[];
  recommendations: string[];
  nextSteps: string[];
  
  // User preferences learned during session
  userPreferences: {
    communicationStyle?: 'detailed' | 'concise' | 'conversational';
    expertiseLevel?: 'beginner' | 'intermediate' | 'expert';
    preferredTopics?: string[];
    workingStyle?: string;
  };
}

export interface SpecialistSession {
  // Session identification
  sessionId: string;
  specialistId: string;
  userId: string;
  
  // Session lifecycle
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'completed' | 'transferred';
  
  // Conversation history
  messages: SessionMessage[];
  messageCount: number;
  
  // Context and state
  context: SessionContext;
  
  // Methodology context - quick access for methodology state
  methodology_context?: {
    methodology_id: string;
    methodology_title: string;
    current_phase: string;
    phase_progress: Record<string, any>;
    confirmed_by_user: boolean;
    suggested_at: Date;
  };
  
  // Session metadata
  transferredFrom?: string;    // If transferred from another specialist
  transferredTo?: string;      // If transferred to another specialist
  tags?: string[];            // User-defined tags for session organization
}

export interface SessionSummary {
  sessionId: string;
  specialistId: string;
  startTime: Date;
  lastActivity: Date;
  status: SpecialistSession['status'];
  messageCount: number;
  primaryTopics: string[];
  keyInsights: string[];
}

// Storage configuration through layer system
export interface SessionStorageConfig {
  // Storage backend type
  type: 'memory' | 'file' | 'database' | 'mcp';
  
  // Storage-specific configuration
  config?: {
    // File storage
    directory?: string;
    filename?: string;
    
    // Database storage
    connectionString?: string;
    tableName?: string;
    
    // MCP storage
    mcpServer?: string;
    mcpTools?: string[];
  };
  
  // Retention and privacy settings
  retention?: {
    maxAge?: number;           // Days to keep sessions
    maxSessions?: number;      // Max sessions per user
    autoCleanup?: boolean;     // Auto-delete old sessions
  };
  
  privacy?: {
    includeMessages?: boolean;      // Store full conversation history
    includeCode?: boolean;          // Store code snippets
    includeFiles?: boolean;         // Store file references
    anonymizeContent?: boolean;     // Remove sensitive data
  };
}

// Session storage interface - implementations handle different backends
export interface SessionStorage {
  // Session lifecycle
  createSession(session: SpecialistSession): Promise<void>;
  getSession(sessionId: string): Promise<SpecialistSession | null>;
  updateSession(session: SpecialistSession): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  
  // Session queries
  getUserSessions(userId: string): Promise<SessionSummary[]>;
  getActiveSessions(userId: string): Promise<SessionSummary[]>;
  getSpecialistSessions(specialistId: string): Promise<SessionSummary[]>;
  
  // Cleanup operations
  cleanupExpiredSessions(): Promise<number>;
  getUserSessionCount(userId: string): Promise<number>;
}

// Session manager interface
export interface SessionManager {
  // Session operations
  startSession(specialistId: string, userId: string, initialMessage?: string): Promise<SpecialistSession>;
  getSession(sessionId: string): Promise<SpecialistSession | null>;
  continueSession(sessionId: string, message: string): Promise<SpecialistSession>;
  transferSession(sessionId: string, toSpecialistId: string): Promise<SpecialistSession>;
  endSession(sessionId: string): Promise<void>;
  
  // Session queries
  listUserSessions(userId: string): Promise<SessionSummary[]>;
  listActiveSessions(userId: string): Promise<SessionSummary[]>;
  
  // Session management
  addMessage(sessionId: string, message: SessionMessage): Promise<void>;
  updateContext(sessionId: string, context: Partial<SessionContext>): Promise<void>;
  
  // Cleanup
  cleanupSessions(): Promise<number>;
}

// Events emitted by session manager
export interface SessionEvents {
  sessionStarted: (session: SpecialistSession) => void;
  sessionEnded: (sessionId: string) => void;
  sessionTransferred: (sessionId: string, fromSpecialist: string, toSpecialist: string) => void;
  messageAdded: (sessionId: string, message: SessionMessage) => void;
}