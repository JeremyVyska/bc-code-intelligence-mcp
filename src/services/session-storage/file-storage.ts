/**
 * File-Based Session Storage
 * 
 * Provides persistent session storage using JSON files in a configurable directory.
 * Supports both local user directories and shared team/company directories.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { randomUUID } from 'crypto';
import {
  SessionStorage,
  SessionStorageConfig,
  SpecialistSession,
  SessionSummary,
  SessionMessage
} from '../../types/session-types.js';

export class FileSessionStorage implements SessionStorage {
  private config: SessionStorageConfig;
  private sessionDirectory: string;
  private initialized = false;

  constructor(config?: SessionStorageConfig) {
    this.config = config || { type: 'file' };
    
    // Determine storage directory
    this.sessionDirectory = this.getSessionDirectory();
  }

  private getSessionDirectory(): string {
    const baseDir = this.config.config?.directory;
    
    if (baseDir) {
      // Use configured directory (could be shared team/company location)
      return baseDir;
    }
    
    // Default to user-local directory
    const userHome = process.env.HOME || process.env.USERPROFILE || '.';
    return join(userHome, '.bc-code-intel', 'sessions');
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create sessions directory if it doesn't exist
      await fs.mkdir(this.sessionDirectory, { recursive: true });
      
      // Create .gitignore to exclude sessions from version control
      const gitignorePath = join(this.sessionDirectory, '.gitignore');
      try {
        await fs.access(gitignorePath);
      } catch {
        await fs.writeFile(gitignorePath, '# Session files - exclude from version control\n*.json\n');
      }
      
      this.initialized = true;
      console.error(`📁 Session storage initialized: ${this.sessionDirectory}`);
    } catch (error) {
      throw new Error(`Failed to initialize file session storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return join(this.sessionDirectory, `${sessionId}.json`);
  }

  private async writeSessionFile(session: SpecialistSession): Promise<void> {
    const filePath = this.getSessionFilePath(session.sessionId);
    
    // Create safe serializable version of session
    const serializable = {
      ...session,
      startTime: session.startTime.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      messages: session.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }))
    };
    
    await fs.writeFile(filePath, JSON.stringify(serializable, null, 2), 'utf8');
  }

  private async readSessionFile(sessionId: string): Promise<SpecialistSession | null> {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // Convert ISO strings back to Date objects
      return {
        ...data,
        startTime: new Date(data.startTime),
        lastActivity: new Date(data.lastActivity),
        messages: data.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      };
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  // SessionStorage interface implementation
  async createSession(session: SpecialistSession): Promise<void> {
    await this.ensureInitialized();
    await this.writeSessionFile(session);
    
    // Auto-cleanup if enabled
    if (this.config.retention?.autoCleanup) {
      // Run cleanup in background to avoid blocking session creation
      this.cleanupExpiredSessions().catch(error => {
        console.warn('Background session cleanup failed:', error);
      });
    }
  }

  async getSession(sessionId: string): Promise<SpecialistSession | null> {
    await this.ensureInitialized();
    return await this.readSessionFile(sessionId);
  }

  async updateSession(session: SpecialistSession): Promise<void> {
    await this.ensureInitialized();
    await this.writeSessionFile(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ensureInitialized();
    try {
      const filePath = this.getSessionFilePath(sessionId);
      await fs.unlink(filePath);
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error; // Only throw if not "file not found"
      }
    }
  }

  async getUserSessions(userId: string): Promise<SessionSummary[]> {
    await this.ensureInitialized();
    return await this.getSessions(session => session.userId === userId);
  }

  async getActiveSessions(userId: string): Promise<SessionSummary[]> {
    await this.ensureInitialized();
    return await this.getSessions(session => 
      session.userId === userId && session.status === 'active'
    );
  }

  async getSpecialistSessions(specialistId: string): Promise<SessionSummary[]> {
    await this.ensureInitialized();
    return await this.getSessions(session => session.specialistId === specialistId);
  }

  private async getSessions(filter: (session: SpecialistSession) => boolean): Promise<SessionSummary[]> {
    try {
      const files = await fs.readdir(this.sessionDirectory);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      const summaries: SessionSummary[] = [];
      
      for (const file of sessionFiles) {
        try {
          const sessionId = file.replace('.json', '');
          const session = await this.readSessionFile(sessionId);
          
          if (session && filter(session)) {
            summaries.push(this.sessionToSummary(session));
          }
        } catch (error) {
          // Skip corrupted session files
          console.warn(`Warning: Could not read session file ${file}:`, error);
        }
      }
      
      return summaries.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (error) {
      console.error('Error reading session directory:', error);
      return [];
    }
  }

  private sessionToSummary(session: SpecialistSession): SessionSummary {
    return {
      sessionId: session.sessionId,
      specialistId: session.specialistId,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      status: session.status,
      messageCount: session.messageCount,
      primaryTopics: session.context.solutions.slice(0, 3), // Use first few solutions as topics
      keyInsights: session.context.recommendations.slice(0, 3) // Use first few recommendations as insights
    };
  }

  async cleanupExpiredSessions(): Promise<number> {
    await this.ensureInitialized();
    
    const maxAgeMs = (this.config.retention?.maxAge || 30) * 24 * 60 * 60 * 1000; // Default 30 days
    const maxSessions = this.config.retention?.maxSessions || 1000; // Default 1000 sessions
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    
    try {
      const files = await fs.readdir(this.sessionDirectory);
      const sessionFiles = files.filter(file => file.endsWith('.json'));
      
      let deletedCount = 0;
      
      // Step 1: Clean up by age
      const remainingSessions: Array<{ sessionId: string; lastActivity: Date }> = [];
      
      for (const file of sessionFiles) {
        try {
          const sessionId = file.replace('.json', '');
          const session = await this.readSessionFile(sessionId);
          
          if (session) {
            if (session.lastActivity < cutoffTime) {
              await this.deleteSession(sessionId);
              deletedCount++;
            } else {
              remainingSessions.push({
                sessionId: session.sessionId,
                lastActivity: session.lastActivity
              });
            }
          }
        } catch (error) {
          // Skip files that can't be read
          console.warn(`Warning: Could not process session file ${file} during cleanup:`, error);
        }
      }
      
      // Step 2: Clean up by session count limit (keep most recent)
      if (remainingSessions.length > maxSessions) {
        // Sort by last activity (most recent first)
        remainingSessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
        
        // Delete sessions beyond the limit
        const sessionsToDelete = remainingSessions.slice(maxSessions);
        for (const session of sessionsToDelete) {
          await this.deleteSession(session.sessionId);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.error(`🧹 Cleaned up ${deletedCount} expired sessions`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('Error during session cleanup:', error);
      return 0;
    }
  }

  async getUserSessionCount(userId: string): Promise<number> {
    const sessions = await this.getUserSessions(userId);
    return sessions.length;
  }
}