/**
 * Specialist Session Manager
 * 
 * Manages persistent, contextual conversations with BC specialist personas.
 * Supports in-memory sessions by default with layer-configurable persistence.
 */

import { randomUUID } from 'crypto';
import {
  SpecialistSession,
  SessionSummary,
  SessionMessage,
  SessionContext,
  SessionManager,
  SessionStorage,
  SessionStorageConfig,
  SessionEvents
} from '../types/session-types.js';
import { InMemorySessionStorage } from './session-storage/in-memory-storage.js';
import { FileSessionStorage } from './session-storage/file-storage.js';
import { MultiContentLayerService } from './multi-content-layer-service.js';

export class SpecialistSessionManager implements SessionManager {
  private storage: SessionStorage;
  private layerService: MultiContentLayerService;
  private events: Partial<SessionEvents> = {};

  constructor(
    layerService: MultiContentLayerService,
    storageConfig?: SessionStorageConfig
  ) {
    this.layerService = layerService;
    
    // Initialize storage based on configuration
    this.storage = this.initializeStorage(storageConfig);
  }

  /**
   * Start a new specialist session
   */
  async startSession(
    specialistId: string, 
    userId: string, 
    initialMessage?: string
  ): Promise<SpecialistSession> {
    // Validate specialist exists
    const specialists = await this.layerService.getAllSpecialists();
    const specialist = specialists.find(s => s.specialist_id === specialistId);
    if (!specialist) {
      throw new Error(`Specialist '${specialistId}' not found`);
    }

    const sessionId = randomUUID();
    const now = new Date();

    const session: SpecialistSession = {
      sessionId,
      specialistId,
      userId,
      startTime: now,
      lastActivity: now,
      status: 'active',
      messages: [],
      messageCount: 0,
      context: {
        solutions: [],
        recommendations: [],
        nextSteps: [],
        userPreferences: {}
      }
    };

    // Add initial message if provided
    if (initialMessage) {
      const initialMsg: SessionMessage = {
        id: randomUUID(),
        timestamp: now,
        type: 'user',
        content: initialMessage
      };
      session.messages.push(initialMsg);
      session.messageCount = 1;
    }

    await this.storage.createSession(session);
    
    // Emit event
    this.events.sessionStarted?.(session);

    return session;
  }

  /**
   * Get existing session
   */
  async getSession(sessionId: string): Promise<SpecialistSession | null> {
    return await this.storage.getSession(sessionId);
  }

  /**
   * Continue existing session with new message
   */
  async continueSession(sessionId: string, message: string): Promise<SpecialistSession> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // Add user message
    const userMessage: SessionMessage = {
      id: randomUUID(),
      timestamp: new Date(),
      type: 'user',
      content: message
    };

    await this.addMessage(sessionId, userMessage);
    
    return await this.storage.getSession(sessionId) as SpecialistSession;
  }

  /**
   * Transfer session to different specialist
   */
  async transferSession(sessionId: string, toSpecialistId: string): Promise<SpecialistSession> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // Validate target specialist exists
    const specialists = await this.layerService.getAllSpecialists();
    const targetSpecialist = specialists.find(s => s.specialist_id === toSpecialistId);
    if (!targetSpecialist) {
      throw new Error(`Target specialist '${toSpecialistId}' not found`);
    }

    const fromSpecialistId = session.specialistId;
    
    // Update session
    session.transferredFrom = session.specialistId;
    session.specialistId = toSpecialistId;
    session.transferredTo = toSpecialistId;
    session.lastActivity = new Date();

    // Add transfer message
    const transferMessage: SessionMessage = {
      id: randomUUID(),
      timestamp: new Date(),
      type: 'specialist',
      specialistId: 'system',
      content: `Session transferred from ${fromSpecialistId} to ${toSpecialistId}`
    };

    session.messages.push(transferMessage);
    session.messageCount++;

    await this.storage.updateSession(session);

    // Emit event
    this.events.sessionTransferred?.(sessionId, fromSpecialistId, toSpecialistId);

    return session;
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    session.status = 'completed';
    session.lastActivity = new Date();

    await this.storage.updateSession(session);

    // Emit event
    this.events.sessionEnded?.(sessionId);
  }

  /**
   * List user's sessions
   */
  async listUserSessions(userId: string): Promise<SessionSummary[]> {
    return await this.storage.getUserSessions(userId);
  }

  /**
   * List user's active sessions
   */
  async listActiveSessions(userId: string): Promise<SessionSummary[]> {
    return await this.storage.getActiveSessions(userId);
  }

  /**
   * Add message to session
   */
  async addMessage(sessionId: string, message: SessionMessage): Promise<void> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    session.messages.push(message);
    session.messageCount++;
    session.lastActivity = new Date();

    // Update session status to active if it was paused
    if (session.status === 'paused') {
      session.status = 'active';
    }

    await this.storage.updateSession(session);

    // Emit event
    this.events.messageAdded?.(sessionId, message);
  }

  /**
   * Update session context
   */
  async updateContext(sessionId: string, context: Partial<SessionContext>): Promise<void> {
    const session = await this.storage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found`);
    }

    // Merge context updates
    session.context = {
      ...session.context,
      ...context,
      // Handle array merging properly
      solutions: [...(session.context.solutions || []), ...(context.solutions || [])],
      recommendations: [...(session.context.recommendations || []), ...(context.recommendations || [])],
      nextSteps: [...(session.context.nextSteps || []), ...(context.nextSteps || [])],
      userPreferences: {
        ...session.context.userPreferences,
        ...context.userPreferences
      }
    };

    session.lastActivity = new Date();
    await this.storage.updateSession(session);
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupSessions(): Promise<number> {
    return await this.storage.cleanupExpiredSessions();
  }

  /**
   * Subscribe to session events
   */
  on<K extends keyof SessionEvents>(event: K, handler: SessionEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Get session statistics
   */
  async getSessionStats(userId?: string): Promise<{
    totalSessions: number;
    activeSessions: number;
    totalMessages: number;
    averageSessionLength: number;
  }> {
    const sessions = userId 
      ? await this.storage.getUserSessions(userId)
      : await this.getAllSessionSummaries();

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'paused').length;
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);
    const averageSessionLength = totalSessions > 0 ? totalMessages / totalSessions : 0;

    return {
      totalSessions,
      activeSessions,
      totalMessages,
      averageSessionLength: Math.round(averageSessionLength * 100) / 100
    };
  }

  /**
   * Initialize storage based on configuration
   */
  private initializeStorage(config?: SessionStorageConfig): SessionStorage {
    console.error(`🗄️ Initializing session storage: ${config?.type || 'memory'}`);
    
    switch (config?.type || 'memory') {
      case 'memory':
        return new InMemorySessionStorage(config);
      
      case 'file':
        return new FileSessionStorage(config);
        
      case 'database':
        // TODO: Implement DatabaseSessionStorage  
        throw new Error('Database storage not yet implemented. Use memory or file storage for now.');
        
      case 'mcp':
        // TODO: Implement MCPSessionStorage
        throw new Error('MCP storage not yet implemented. Use memory or file storage for now.');
        
      default:
        console.warn(`Unknown storage type '${config?.type}', falling back to memory storage`);
        return new InMemorySessionStorage(config);
    }
  }

  /**
   * Get all session summaries (for stats)
   */
  private async getAllSessionSummaries(): Promise<SessionSummary[]> {
    // This is a bit of a hack since we don't have a "get all sessions" method
    // In practice, this would be implemented differently for each storage backend
    if (this.storage instanceof InMemorySessionStorage) {
      // For in-memory storage, we can access the internal data
      return [];  // Simplified for now
    }
    
    return [];
  }
}