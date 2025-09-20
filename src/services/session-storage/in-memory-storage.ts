/**
 * In-Memory Session Storage Implementation
 * 
 * Default session storage that keeps all sessions in memory.
 * Sessions are lost when the MCP server restarts.
 * Zero configuration required - works out of the box.
 */

import {
  SpecialistSession,
  SessionSummary,
  SessionStorage,
  SessionStorageConfig
} from '../../types/session-types.js';

export class InMemorySessionStorage implements SessionStorage {
  private sessions = new Map<string, SpecialistSession>();
  private config: SessionStorageConfig;

  constructor(config?: SessionStorageConfig) {
    this.config = {
      type: 'memory',
      retention: {
        maxSessions: 50,       // Reasonable memory limit
        autoCleanup: true,
        ...config?.retention
      },
      privacy: {
        includeMessages: true,
        includeCode: true,
        includeFiles: true,
        anonymizeContent: false,
        ...config?.privacy
      }
    };
  }

  async createSession(session: SpecialistSession): Promise<void> {
    // Auto-cleanup if needed
    if (this.config.retention?.autoCleanup) {
      await this.cleanupIfNeeded(session.userId);
    }

    this.sessions.set(session.sessionId, { ...session });
  }

  async getSession(sessionId: string): Promise<SpecialistSession | null> {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : null;
  }

  async updateSession(session: SpecialistSession): Promise<void> {
    if (!this.sessions.has(session.sessionId)) {
      throw new Error(`Session ${session.sessionId} not found`);
    }
    
    // Update last activity
    session.lastActivity = new Date();
    this.sessions.set(session.sessionId, { ...session });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async getUserSessions(userId: string): Promise<SessionSummary[]> {
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    return userSessions.map(session => this.toSessionSummary(session));
  }

  async getActiveSessions(userId: string): Promise<SessionSummary[]> {
    const userSessions = await this.getUserSessions(userId);
    return userSessions.filter(session => session.status === 'active' || session.status === 'paused');
  }

  async getSpecialistSessions(specialistId: string): Promise<SessionSummary[]> {
    const specialistSessions = Array.from(this.sessions.values())
      .filter(session => session.specialistId === specialistId)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    return specialistSessions.map(session => this.toSessionSummary(session));
  }

  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    const maxAge = this.config.retention?.maxAge || 7; // Default 7 days
    const cutoffTime = new Date(now.getTime() - (maxAge * 24 * 60 * 60 * 1000));

    let cleaned = 0;
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoffTime) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }

  async getUserSessionCount(userId: string): Promise<number> {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .length;
  }

  private async cleanupIfNeeded(userId: string): Promise<void> {
    const maxSessions = this.config.retention?.maxSessions || 50;
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => a.lastActivity.getTime() - b.lastActivity.getTime()); // Oldest first

    // Remove oldest sessions if over limit
    while (userSessions.length >= maxSessions) {
      const oldestSession = userSessions.shift();
      if (oldestSession) {
        this.sessions.delete(oldestSession.sessionId);
      }
    }
  }

  private toSessionSummary(session: SpecialistSession): SessionSummary {
    return {
      sessionId: session.sessionId,
      specialistId: session.specialistId,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      status: session.status,
      messageCount: session.messageCount,
      primaryTopics: this.extractPrimaryTopics(session),
      keyInsights: session.context.recommendations.slice(0, 3) // Top 3 recommendations
    };
  }

  private extractPrimaryTopics(session: SpecialistSession): string[] {
    // Extract topics from message metadata
    const topics = new Set<string>();
    
    session.messages.forEach(message => {
      if (message.metadata?.topics) {
        message.metadata.topics.forEach(topic => topics.add(topic));
      }
    });

    // Also include context-based topics
    if (session.context.problem) {
      topics.add('problem-solving');
    }
    if (session.context.codebaseContext?.files.length) {
      topics.add('code-review');
    }

    return Array.from(topics).slice(0, 5); // Top 5 topics
  }

  // Memory usage diagnostics
  getMemoryStats(): { sessionCount: number; totalMessages: number; memoryUsageKB: number } {
    const sessionCount = this.sessions.size;
    const totalMessages = Array.from(this.sessions.values())
      .reduce((sum, session) => sum + session.messageCount, 0);
    
    // Rough memory estimation
    const avgSessionSize = 10; // KB per session (rough estimate)
    const avgMessageSize = 1;  // KB per message (rough estimate)
    const memoryUsageKB = (sessionCount * avgSessionSize) + (totalMessages * avgMessageSize);

    return {
      sessionCount,
      totalMessages,
      memoryUsageKB
    };
  }
}