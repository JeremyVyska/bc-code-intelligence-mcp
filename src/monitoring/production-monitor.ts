/**
 * Production Monitoring & Health Management System
 *
 * Comprehensive monitoring, health checks, metrics collection, and alerting
 * for production deployments with Docker, Kubernetes, and cloud integration.
 */

import { EventEmitter } from 'events';
import { readFile, writeFile } from 'fs/promises';
import { PerformanceMonitor, SystemHealthMetrics } from '../performance/performance-monitor.js';
import { SecurityManager } from '../security/access-control.js';
import { AdvancedCacheManager, CacheStats } from '../cache/cache-manager.js';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: Record<string, any>;
  response_time_ms: number;
  timestamp: number;
}

export interface SystemMetrics {
  timestamp: number;
  system: {
    uptime_seconds: number;
    memory_usage_mb: number;
    memory_usage_percentage: number;
    cpu_usage_percentage: number;
    process_id: number;
    node_version: string;
  };
  application: {
    active_layers: number;
    total_topics: number;
    cache_hit_rate: number;
    average_response_time_ms: number;
    requests_per_minute: number;
    error_rate_percentage: number;
  };
  performance: {
    slowest_operations: Array<{ operation: string; duration_ms: number }>;
    operations_per_second: number;
    p95_response_time_ms: number;
    p99_response_time_ms: number;
  };
  security: {
    active_sessions: number;
    failed_authentications_last_hour: number;
    rate_limited_requests: number;
    suspicious_activities: number;
  };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string; // Simple condition like "memory_usage_percentage > 80"
  severity: 'info' | 'warning' | 'critical';
  cooldown_minutes: number;
  enabled: boolean;
}

export interface Alert {
  id: string;
  rule_id: string;
  message: string;
  severity: AlertRule['severity'];
  timestamp: number;
  resolved: boolean;
  resolved_at?: number;
  metadata: Record<string, any>;
}

export class ProductionMonitor extends EventEmitter {
  private healthChecks = new Map<string, () => Promise<HealthCheckResult>>();
  private activeAlerts = new Map<string, Alert>();
  private alertHistory: Alert[] = [];
  private alertCooldowns = new Map<string, number>();
  private metricsHistory: SystemMetrics[] = [];
  private startTime = Date.now();
  private healthCheckInterval?: NodeJS.Timeout;
  private metricsCollectionInterval?: NodeJS.Timeout;

  private readonly defaultAlertRules: AlertRule[] = [
    {
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      condition: 'memory_usage_percentage > 85',
      severity: 'warning',
      cooldown_minutes: 15,
      enabled: true
    },
    {
      id: 'critical_memory_usage',
      name: 'Critical Memory Usage',
      condition: 'memory_usage_percentage > 95',
      severity: 'critical',
      cooldown_minutes: 5,
      enabled: true
    },
    {
      id: 'high_error_rate',
      name: 'High Error Rate',
      condition: 'error_rate_percentage > 5',
      severity: 'warning',
      cooldown_minutes: 10,
      enabled: true
    },
    {
      id: 'slow_response_time',
      name: 'Slow Response Times',
      condition: 'p95_response_time_ms > 2000',
      severity: 'warning',
      cooldown_minutes: 20,
      enabled: true
    },
    {
      id: 'cache_performance',
      name: 'Poor Cache Performance',
      condition: 'cache_hit_rate < 50',
      severity: 'info',
      cooldown_minutes: 30,
      enabled: true
    },
    {
      id: 'security_incidents',
      name: 'Security Incidents',
      condition: 'failed_authentications_last_hour > 10',
      severity: 'critical',
      cooldown_minutes: 5,
      enabled: true
    }
  ];

  private alertRules: AlertRule[] = [...this.defaultAlertRules];

  constructor(
    private readonly performanceMonitor: PerformanceMonitor,
    private readonly securityManager?: SecurityManager,
    private readonly cacheManager?: AdvancedCacheManager,
    private readonly enableFileLogging: boolean = true,
    private readonly metricsRetentionHours: number = 24
  ) {
    super();

    this.setupDefaultHealthChecks();
    this.startMonitoring();

    console.log('📊 Production monitor initialized');
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, checkFn: () => Promise<HealthCheckResult>): void {
    this.healthChecks.set(name, checkFn);
    console.log(`✅ Health check registered: ${name}`);
  }

  /**
   * Run all health checks and return results
   */
  async runHealthChecks(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; checks: HealthCheckResult[] }> {
    const results: HealthCheckResult[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [name, checkFn] of this.healthChecks.entries()) {
      try {
        const result = await checkFn();
        results.push(result);

        // Update overall status
        if (result.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        results.push({
          service: name,
          status: 'unhealthy',
          message: `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
          response_time_ms: 0,
          timestamp: Date.now()
        });
        overallStatus = 'unhealthy';
      }
    }

    return { status: overallStatus, checks: results };
  }

  /**
   * Collect current system metrics
   */
  async collectMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const totalMemoryMB = process.platform === 'linux'
      ? (await this.getSystemMemory()) / 1024 / 1024
      : 1024; // Fallback estimate

    const performanceStats = this.performanceMonitor.getOverallSummary();
    const healthStats = this.performanceMonitor.getSystemHealth();
    const cacheStats = this.cacheManager?.getStats() || { hit_rate: 0 } as CacheStats;
    const securityStats = this.securityManager?.getSecurityStats() || {
      successful_authentications: 0,
      failed_authentications: 0,
      suspicious_activities: 0,
      rate_limited_users: 0
    };

    const metrics: SystemMetrics = {
      timestamp: Date.now(),
      system: {
        uptime_seconds: (Date.now() - this.startTime) / 1000,
        memory_usage_mb: memoryUsage.heapUsed / 1024 / 1024,
        memory_usage_percentage: (memoryUsage.heapUsed / (totalMemoryMB * 1024 * 1024)) * 100,
        cpu_usage_percentage: await this.getCPUUsage(),
        process_id: process.pid,
        node_version: process.version
      },
      application: {
        active_layers: healthStats.active_layers,
        total_topics: healthStats.total_topics,
        cache_hit_rate: cacheStats.hit_rate || 0,
        average_response_time_ms: healthStats.average_response_time_ms,
        requests_per_minute: performanceStats.operations_per_second * 60,
        error_rate_percentage: healthStats.error_rate
      },
      performance: {
        slowest_operations: performanceStats.slowest_operations.map(op => ({
          operation: op.operation,
          duration_ms: op.duration_ms
        })).slice(0, 5),
        operations_per_second: performanceStats.operations_per_second,
        p95_response_time_ms: performanceStats.p95_duration_ms,
        p99_response_time_ms: performanceStats.p99_duration_ms
      },
      security: {
        active_sessions: 0, // Would be provided by session manager
        failed_authentications_last_hour: this.getRecentFailedAuthentications(),
        rate_limited_requests: securityStats.rate_limited_users,
        suspicious_activities: securityStats.suspicious_activities
      }
    };

    // Store metrics history
    this.metricsHistory.push(metrics);

    // Maintain retention window
    const cutoffTime = Date.now() - (this.metricsRetentionHours * 60 * 60 * 1000);
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp > cutoffTime);

    // Evaluate alert rules
    await this.evaluateAlerts(metrics);

    return metrics;
  }

  /**
   * Get metrics history for time range
   */
  getMetricsHistory(hoursBack: number = 1): SystemMetrics[] {
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    return this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): Alert[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Resolve an active alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolved_at = Date.now();
      this.activeAlerts.delete(alertId);
      this.emit('alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * Export comprehensive system status for monitoring dashboards
   */
  async getSystemStatus(): Promise<{
    overall_health: 'healthy' | 'degraded' | 'unhealthy';
    health_checks: HealthCheckResult[];
    current_metrics: SystemMetrics;
    active_alerts: Alert[];
    performance_summary: any;
    uptime_seconds: number;
  }> {
    const healthResults = await this.runHealthChecks();
    const currentMetrics = await this.collectMetrics();
    const performanceSummary = this.performanceMonitor.getOverallSummary();

    return {
      overall_health: healthResults.status,
      health_checks: healthResults.checks,
      current_metrics: currentMetrics,
      active_alerts: this.getActiveAlerts(),
      performance_summary: performanceSummary,
      uptime_seconds: (Date.now() - this.startTime) / 1000
    };
  }

  /**
   * Export monitoring data for external systems (Prometheus, etc.)
   */
  exportMetricsForPrometheus(): string {
    if (this.metricsHistory.length === 0) return '';

    const latest = this.metricsHistory[this.metricsHistory.length - 1];
    const lines: string[] = [];

    // System metrics
    lines.push(`# HELP bckb_memory_usage_bytes Memory usage in bytes`);
    lines.push(`# TYPE bckb_memory_usage_bytes gauge`);
    lines.push(`bckb_memory_usage_bytes ${latest.system.memory_usage_mb * 1024 * 1024}`);

    lines.push(`# HELP bckb_memory_usage_percentage Memory usage percentage`);
    lines.push(`# TYPE bckb_memory_usage_percentage gauge`);
    lines.push(`bckb_memory_usage_percentage ${latest.system.memory_usage_percentage}`);

    // Application metrics
    lines.push(`# HELP bckb_active_layers Number of active knowledge layers`);
    lines.push(`# TYPE bckb_active_layers gauge`);
    lines.push(`bckb_active_layers ${latest.application.active_layers}`);

    lines.push(`# HELP bckb_total_topics Total number of topics available`);
    lines.push(`# TYPE bckb_total_topics gauge`);
    lines.push(`bckb_total_topics ${latest.application.total_topics}`);

    lines.push(`# HELP bckb_cache_hit_rate Cache hit rate percentage`);
    lines.push(`# TYPE bckb_cache_hit_rate gauge`);
    lines.push(`bckb_cache_hit_rate ${latest.application.cache_hit_rate}`);

    lines.push(`# HELP bckb_response_time_ms Average response time in milliseconds`);
    lines.push(`# TYPE bckb_response_time_ms gauge`);
    lines.push(`bckb_response_time_ms ${latest.application.average_response_time_ms}`);

    lines.push(`# HELP bckb_error_rate_percentage Error rate percentage`);
    lines.push(`# TYPE bckb_error_rate_percentage gauge`);
    lines.push(`bckb_error_rate_percentage ${latest.application.error_rate_percentage}`);

    // Alert metrics
    lines.push(`# HELP bckb_active_alerts Number of active alerts`);
    lines.push(`# TYPE bckb_active_alerts gauge`);
    lines.push(`bckb_active_alerts ${this.activeAlerts.size}`);

    return lines.join('\n');
  }

  /**
   * Shutdown monitoring and cleanup
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
    }

    console.log('📊 Production monitor shutdown complete');
  }

  // Private implementation methods

  private setupDefaultHealthChecks(): void {
    // Basic system health
    this.registerHealthCheck('system', async () => {
      const start = Date.now();
      const memUsage = process.memoryUsage();
      const duration = Date.now() - start;

      const status = memUsage.heapUsed / (1024 * 1024 * 1024) > 1 ? 'degraded' : 'healthy';

      return {
        service: 'system',
        status,
        message: status === 'healthy' ? 'System operating normally' : 'High memory usage detected',
        details: {
          memory_heap_mb: Math.round(memUsage.heapUsed / 1024 / 1024),
          memory_external_mb: Math.round(memUsage.external / 1024 / 1024)
        },
        response_time_ms: duration,
        timestamp: Date.now()
      };
    });

    // Cache health
    if (this.cacheManager) {
      this.registerHealthCheck('cache', async () => {
        const start = Date.now();
        const cacheStats = this.cacheManager!.getStats();
        const duration = Date.now() - start;

        const status = cacheStats.hit_rate > 60 ? 'healthy' :
                      cacheStats.hit_rate > 30 ? 'degraded' : 'unhealthy';

        return {
          service: 'cache',
          status,
          message: `Cache hit rate: ${cacheStats.hit_rate.toFixed(1)}%`,
          details: cacheStats,
          response_time_ms: duration,
          timestamp: Date.now()
        };
      });
    }

    // Security health
    if (this.securityManager) {
      this.registerHealthCheck('security', async () => {
        const start = Date.now();
        const securityStats = this.securityManager!.getSecurityStats();
        const duration = Date.now() - start;

        const recentFailures = this.getRecentFailedAuthentications();
        const status = recentFailures > 50 ? 'unhealthy' :
                      recentFailures > 20 ? 'degraded' : 'healthy';

        return {
          service: 'security',
          status,
          message: `${recentFailures} failed authentications in last hour`,
          details: securityStats,
          response_time_ms: duration,
          timestamp: Date.now()
        };
      });
    }
  }

  private startMonitoring(): void {
    // Run health checks every minute
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.runHealthChecks();
      } catch (error) {
        console.error('📊 Health check error:', error);
      }
    }, 60000);

    // Collect metrics every 30 seconds
    this.metricsCollectionInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('📊 Metrics collection error:', error);
      }
    }, 30000);
  }

  private async evaluateAlerts(metrics: SystemMetrics): Promise<void> {
    for (const rule of this.alertRules.filter(r => r.enabled)) {
      try {
        if (this.alertCooldowns.has(rule.id) && Date.now() < this.alertCooldowns.get(rule.id)!) {
          continue; // Still in cooldown
        }

        const shouldAlert = this.evaluateCondition(rule.condition, metrics);

        if (shouldAlert && !this.activeAlerts.has(rule.id)) {
          const alert = this.createAlert(rule, metrics);
          this.activeAlerts.set(alert.id, alert);
          this.alertHistory.push(alert);

          // Set cooldown
          this.alertCooldowns.set(rule.id, Date.now() + (rule.cooldown_minutes * 60 * 1000));

          this.emit('alert_triggered', alert);

          if (this.enableFileLogging) {
            await this.logAlertToFile(alert);
          }

          console.warn(`🚨 ALERT [${rule.severity.toUpperCase()}]: ${rule.name}`);
        }
      } catch (error) {
        console.error(`Alert rule evaluation error for ${rule.id}:`, error);
      }
    }
  }

  private evaluateCondition(condition: string, metrics: SystemMetrics): boolean {
    // Simple condition evaluator - in production, would use a more robust parser
    const context = {
      memory_usage_percentage: metrics.system.memory_usage_percentage,
      error_rate_percentage: metrics.application.error_rate_percentage,
      p95_response_time_ms: metrics.performance.p95_response_time_ms,
      cache_hit_rate: metrics.application.cache_hit_rate,
      failed_authentications_last_hour: metrics.security.failed_authentications_last_hour
    };

    try {
      // Replace variables in condition
      let evaluable = condition;
      for (const [key, value] of Object.entries(context)) {
        evaluable = evaluable.replace(new RegExp(key, 'g'), String(value));
      }

      // Simple expression evaluation (would use safer parser in production)
      return eval(evaluable);
    } catch (error) {
      console.error('Condition evaluation error:', error);
      return false;
    }
  }

  private createAlert(rule: AlertRule, metrics: SystemMetrics): Alert {
    return {
      id: `${rule.id}_${Date.now()}`,
      rule_id: rule.id,
      message: `Alert: ${rule.name} - ${rule.condition}`,
      severity: rule.severity,
      timestamp: Date.now(),
      resolved: false,
      metadata: {
        metrics_snapshot: metrics,
        rule: rule
      }
    };
  }

  private async logAlertToFile(alert: Alert): Promise<void> {
    try {
      const logEntry = {
        timestamp: new Date(alert.timestamp).toISOString(),
        alert_id: alert.id,
        rule_id: alert.rule_id,
        message: alert.message,
        severity: alert.severity
      };

      const logLine = JSON.stringify(logEntry) + '\n';
      await writeFile('bckb-alerts.log', logLine, { flag: 'a' });
    } catch (error) {
      console.error('Failed to write alert to log file:', error);
    }
  }

  private getRecentFailedAuthentications(): number {
    if (!this.securityManager) return 0;

    const auditLog = this.securityManager.getAuditLog(1000);
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    return auditLog.filter(event =>
      event.event_type === 'auth_failure' && event.timestamp > oneHourAgo
    ).length;
  }

  private async getSystemMemory(): Promise<number> {
    try {
      if (process.platform === 'linux') {
        const meminfo = await readFile('/proc/meminfo', 'utf8');
        const match = meminfo.match(/MemTotal:\s*(\d+)\s*kB/);
        return match ? parseInt(match[1]) * 1024 : 1024 * 1024 * 1024; // Fallback to 1GB
      }
    } catch (error) {
      // Fallback for non-Linux systems
    }
    return 1024 * 1024 * 1024; // 1GB default
  }

  private async getCPUUsage(): Promise<number> {
    // Simplified CPU usage calculation
    const usage = process.cpuUsage();
    return ((usage.user + usage.system) / 1000000) * 100; // Convert to percentage (rough estimate)
  }
}