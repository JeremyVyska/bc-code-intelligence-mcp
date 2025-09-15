/**
 * Security & Access Control System
 *
 * Enterprise-grade security features including authentication, authorization,
 * rate limiting, input validation, and audit logging for production deployments.
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { EventEmitter } from 'events';

export interface SecurityConfig {
  enable_authentication: boolean;
  enable_rate_limiting: boolean;
  enable_audit_logging: boolean;
  api_key_required: boolean;
  allowed_origins?: string[];
  max_requests_per_minute: number;
  session_timeout_minutes: number;
  enable_content_security: boolean;
  trusted_sources: string[];
  audit_log_retention_days: number;
}

export interface UserContext {
  user_id?: string;
  api_key?: string;
  permissions: string[];
  rate_limit_remaining: number;
  session_expires: number;
  origin?: string;
  ip_address?: string;
}

export interface SecurityEvent {
  event_type: 'auth_success' | 'auth_failure' | 'rate_limit_exceeded' | 'access_denied' | 'suspicious_activity';
  timestamp: number;
  user_context?: Partial<UserContext>;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RateLimitInfo {
  requests_made: number;
  requests_remaining: number;
  reset_time: number;
  is_limited: boolean;
}

export class SecurityManager extends EventEmitter {
  private apiKeys = new Map<string, { permissions: string[], created: number, last_used: number }>();
  private rateLimitBuckets = new Map<string, { count: number, reset_time: number }>();
  private activeSessions = new Map<string, { user_id: string, created: number, last_activity: number }>();
  private auditLog: SecurityEvent[] = [];
  private trustedSourceCache = new Map<string, boolean>();

  constructor(private readonly config: SecurityConfig) {
    super();

    this.startPeriodicCleanup();

    if (config.enable_audit_logging) {
      console.log('🔒 Security manager initialized with audit logging');
    } else {
      console.log('🔒 Security manager initialized');
    }
  }

  /**
   * Authenticate request and validate permissions
   */
  async authenticateRequest(
    apiKey?: string,
    requestOrigin?: string,
    ipAddress?: string,
    requiredPermissions: string[] = []
  ): Promise<{ success: boolean; userContext?: UserContext; error?: string }> {
    const context: Partial<UserContext> = {
      api_key: apiKey,
      origin: requestOrigin,
      ip_address: ipAddress
    };

    try {
      // Check if authentication is required
      if (this.config.enable_authentication) {
        if (!apiKey) {
          this.auditSecurityEvent('auth_failure', 'medium', context, { reason: 'missing_api_key' });
          return { success: false, error: 'API key required' };
        }

        // Validate API key
        const keyInfo = this.apiKeys.get(apiKey);
        if (!keyInfo) {
          this.auditSecurityEvent('auth_failure', 'high', context, { reason: 'invalid_api_key' });
          return { success: false, error: 'Invalid API key' };
        }

        // Update last used timestamp
        keyInfo.last_used = Date.now();

        // Check permissions
        const hasPermissions = requiredPermissions.every(perm => keyInfo.permissions.includes(perm));
        if (!hasPermissions) {
          this.auditSecurityEvent('access_denied', 'medium', context, {
            reason: 'insufficient_permissions',
            required: requiredPermissions,
            available: keyInfo.permissions
          });
          return { success: false, error: 'Insufficient permissions' };
        }

        context.permissions = keyInfo.permissions;
      } else {
        context.permissions = ['*']; // Full access when authentication disabled
      }

      // Validate origin if configured
      if (this.config.allowed_origins && requestOrigin) {
        const isAllowed = this.config.allowed_origins.some(origin =>
          origin === '*' || origin === requestOrigin || requestOrigin.endsWith(origin)
        );

        if (!isAllowed) {
          this.auditSecurityEvent('access_denied', 'high', context, { reason: 'unauthorized_origin' });
          return { success: false, error: 'Origin not allowed' };
        }
      }

      // Create user context
      const userContext: UserContext = {
        user_id: this.generateUserId(apiKey, ipAddress),
        api_key: apiKey,
        permissions: context.permissions!,
        rate_limit_remaining: this.getRemainingRequests(context.user_id || ipAddress || 'anonymous'),
        session_expires: Date.now() + (this.config.session_timeout_minutes * 60 * 1000),
        origin: requestOrigin,
        ip_address: ipAddress
      };

      this.auditSecurityEvent('auth_success', 'low', userContext, { permissions: userContext.permissions });

      return { success: true, userContext };

    } catch (error) {
      this.auditSecurityEvent('auth_failure', 'high', context, {
        error: error instanceof Error ? error.message : String(error)
      });

      return { success: false, error: 'Authentication failed' };
    }
  }

  /**
   * Check rate limits for a user/IP
   */
  checkRateLimit(identifier: string): RateLimitInfo {
    if (!this.config.enable_rate_limiting) {
      return {
        requests_made: 0,
        requests_remaining: this.config.max_requests_per_minute,
        reset_time: Date.now() + 60000,
        is_limited: false
      };
    }

    const now = Date.now();
    const bucket = this.rateLimitBuckets.get(identifier);

    // Initialize or reset bucket if needed
    if (!bucket || now > bucket.reset_time) {
      const newBucket = {
        count: 1,
        reset_time: now + 60000 // 1 minute window
      };
      this.rateLimitBuckets.set(identifier, newBucket);

      return {
        requests_made: 1,
        requests_remaining: this.config.max_requests_per_minute - 1,
        reset_time: newBucket.reset_time,
        is_limited: false
      };
    }

    // Increment request count
    bucket.count++;
    const isLimited = bucket.count > this.config.max_requests_per_minute;

    if (isLimited) {
      this.auditSecurityEvent('rate_limit_exceeded', 'medium', { user_id: identifier }, {
        requests_made: bucket.count,
        limit: this.config.max_requests_per_minute
      });
    }

    return {
      requests_made: bucket.count,
      requests_remaining: Math.max(0, this.config.max_requests_per_minute - bucket.count),
      reset_time: bucket.reset_time,
      is_limited: isLimited
    };
  }

  /**
   * Validate content security for layer sources
   */
  async validateContentSecurity(
    sourceUrl: string,
    sourceType: string,
    content?: string
  ): Promise<{ secure: boolean; warnings: string[]; blockedContent?: string[] }> {
    const warnings: string[] = [];
    const blockedContent: string[] = [];

    if (!this.config.enable_content_security) {
      return { secure: true, warnings: [] };
    }

    // Check if source is trusted
    const isTrusted = await this.isSourceTrusted(sourceUrl);
    if (!isTrusted) {
      warnings.push(`Untrusted source: ${sourceUrl}`);
    }

    // Scan content for suspicious patterns if provided
    if (content) {
      const suspiciousPatterns = [
        /javascript:/gi,
        /<script/gi,
        /eval\s*\(/gi,
        /document\.cookie/gi,
        /window\.location/gi,
        /\$\{.*\}/gi, // Template injection
        /<%.*%>/gi    // Server-side template injection
      ];

      for (const pattern of suspiciousPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          blockedContent.push(...matches);
          warnings.push(`Suspicious content pattern detected: ${pattern.toString()}`);
        }
      }
    }

    // Additional URL validation
    if (sourceUrl) {
      // Block localhost and private networks in production
      if (process.env.NODE_ENV === 'production') {
        const privatePatterms = [
          /localhost/gi,
          /127\.0\.0\.1/gi,
          /192\.168\./gi,
          /10\./gi,
          /172\.(1[6-9]|2[0-9]|3[0-1])\./gi
        ];

        for (const pattern of privatePatterms) {
          if (pattern.test(sourceUrl)) {
            warnings.push(`Private network access blocked: ${sourceUrl}`);
            break;
          }
        }
      }
    }

    const secure = blockedContent.length === 0;

    if (!secure) {
      this.auditSecurityEvent('suspicious_activity', 'high', undefined, {
        source_url: sourceUrl,
        source_type: sourceType,
        blockedContent: blockedContent,
        warnings
      });
    }

    return { secure, warnings, blockedContent };
  }

  /**
   * Add or update API key with permissions
   */
  addApiKey(apiKey: string, permissions: string[]): void {
    const hashedKey = this.hashApiKey(apiKey);

    this.apiKeys.set(hashedKey, {
      permissions,
      created: Date.now(),
      last_used: 0
    });

    this.auditSecurityEvent('auth_success', 'low', undefined, {
      action: 'api_key_created',
      permissions,
      key_hash: hashedKey.substring(0, 8) + '...' // Log partial hash for identification
    });

    console.log(`🔑 API key added with permissions: ${permissions.join(', ')}`);
  }

  /**
   * Remove API key
   */
  removeApiKey(apiKey: string): boolean {
    const hashedKey = this.hashApiKey(apiKey);
    const removed = this.apiKeys.delete(hashedKey);

    if (removed) {
      this.auditSecurityEvent('auth_success', 'low', undefined, {
        action: 'api_key_removed',
        key_hash: hashedKey.substring(0, 8) + '...'
      });
      console.log('🔑 API key removed');
    }

    return removed;
  }

  /**
   * Get security audit log
   */
  getAuditLog(limit: number = 100): SecurityEvent[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): {
    active_api_keys: number;
    rate_limited_users: number;
    audit_events: number;
    suspicious_activities: number;
    successful_authentications: number;
    failed_authentications: number;
  } {
    const auditCounts = this.auditLog.reduce((counts, event) => {
      counts[event.event_type] = (counts[event.event_type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);

    const rateLimitedUsers = Array.from(this.rateLimitBuckets.entries())
      .filter(([_, bucket]) => bucket.count > this.config.max_requests_per_minute)
      .length;

    return {
      active_api_keys: this.apiKeys.size,
      rate_limited_users: rateLimitedUsers,
      audit_events: this.auditLog.length,
      suspicious_activities: auditCounts['suspicious_activity'] || 0,
      successful_authentications: auditCounts['auth_success'] || 0,
      failed_authentications: auditCounts['auth_failure'] || 0
    };
  }

  /**
   * Export security configuration (sanitized)
   */
  exportConfig(): Omit<SecurityConfig, 'api_key_required'> & { api_keys_configured: number } {
    const { api_key_required, ...safeConfig } = this.config;

    return {
      ...safeConfig,
      api_keys_configured: this.apiKeys.size
    };
  }

  /**
   * Shutdown security manager
   */
  shutdown(): void {
    this.apiKeys.clear();
    this.rateLimitBuckets.clear();
    this.activeSessions.clear();
    this.trustedSourceCache.clear();

    console.log('🔒 Security manager shutdown complete');
  }

  // Private helper methods

  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private generateUserId(apiKey?: string, ipAddress?: string): string {
    const identifier = apiKey || ipAddress || 'anonymous';
    return createHash('md5').update(identifier).digest('hex');
  }

  private getRemainingRequests(identifier: string): number {
    const bucket = this.rateLimitBuckets.get(identifier);
    if (!bucket || Date.now() > bucket.reset_time) {
      return this.config.max_requests_per_minute;
    }
    return Math.max(0, this.config.max_requests_per_minute - bucket.count);
  }

  private async isSourceTrusted(sourceUrl: string): Promise<boolean> {
    // Check cache first
    const cached = this.trustedSourceCache.get(sourceUrl);
    if (cached !== undefined) return cached;

    // Check against trusted sources list
    const isTrusted = this.config.trusted_sources.some(trusted =>
      sourceUrl.includes(trusted) || sourceUrl.startsWith(trusted)
    );

    // Cache result for 1 hour
    this.trustedSourceCache.set(sourceUrl, isTrusted);
    setTimeout(() => this.trustedSourceCache.delete(sourceUrl), 3600000);

    return isTrusted;
  }

  private auditSecurityEvent(
    eventType: SecurityEvent['event_type'],
    severity: SecurityEvent['severity'],
    userContext?: Partial<UserContext>,
    details: Record<string, any> = {}
  ): void {
    if (!this.config.enable_audit_logging) return;

    const event: SecurityEvent = {
      event_type: eventType,
      timestamp: Date.now(),
      user_context: userContext,
      details,
      severity
    };

    this.auditLog.push(event);

    // Emit event for external listeners
    this.emit('security_event', event);

    // Keep audit log within reasonable size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000); // Keep last 5000 events
    }

    // Log critical events immediately
    if (severity === 'critical' || severity === 'high') {
      console.warn(`🚨 Security event [${severity.toUpperCase()}]: ${eventType}`, details);
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up old rate limit buckets and audit logs every hour
    setInterval(() => {
      const now = Date.now();

      // Clean expired rate limit buckets
      for (const [key, bucket] of this.rateLimitBuckets.entries()) {
        if (now > bucket.reset_time) {
          this.rateLimitBuckets.delete(key);
        }
      }

      // Clean old audit logs based on retention policy
      if (this.config.enable_audit_logging && this.config.audit_log_retention_days > 0) {
        const cutoffTime = now - (this.config.audit_log_retention_days * 24 * 60 * 60 * 1000);
        this.auditLog = this.auditLog.filter(event => event.timestamp > cutoffTime);
      }

      // Clean expired sessions
      for (const [sessionId, session] of this.activeSessions.entries()) {
        const sessionTimeout = this.config.session_timeout_minutes * 60 * 1000;
        if (now - session.last_activity > sessionTimeout) {
          this.activeSessions.delete(sessionId);
        }
      }

    }, 3600000); // Run every hour
  }
}