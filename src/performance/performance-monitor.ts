/**
 * Performance Monitor for BCKB System
 *
 * Tracks performance metrics, identifies bottlenecks, and provides
 * optimization recommendations for production deployments.
 */

export interface PerformanceMetric {
  operation: string;
  duration_ms: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface PerformanceSummary {
  total_operations: number;
  average_duration_ms: number;
  p95_duration_ms: number;
  p99_duration_ms: number;
  operations_per_second: number;
  slowest_operations: PerformanceMetric[];
  fastest_operations: PerformanceMetric[];
}

export interface SystemHealthMetrics {
  memory_usage_mb: number;
  cache_hit_rate: number;
  active_layers: number;
  total_topics: number;
  average_response_time_ms: number;
  error_rate: number;
  uptime_seconds: number;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private errorCount = 0;
  private totalRequests = 0;
  private startTime = Date.now();
  private readonly maxMetrics = 1000; // Keep last 1000 metrics

  constructor(
    private readonly enableDetailedTracking: boolean = true,
    private readonly enableSlowQueryLogging: boolean = true,
    private readonly slowQueryThresholdMs: number = 1000
  ) {
    console.log(`📊 Performance monitor initialized (detailed: ${enableDetailedTracking})`);
  }

  /**
   * Track a performance metric
   */
  trackOperation(operation: string, durationMs: number, metadata?: Record<string, any>): void {
    if (!this.enableDetailedTracking) return;

    const metric: PerformanceMetric = {
      operation,
      duration_ms: durationMs,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);

    // Log slow operations
    if (this.enableSlowQueryLogging && durationMs > this.slowQueryThresholdMs) {
      console.warn(`🐌 Slow operation detected: ${operation} took ${durationMs}ms`, metadata);
    }

    // Keep only recent metrics to prevent memory growth
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    this.totalRequests++;
  }

  /**
   * Time and track an async operation
   */
  async timeOperation<T>(operation: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.trackOperation(operation, duration, { ...metadata, success: true });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.errorCount++;
      this.trackOperation(operation, duration, {
        ...metadata,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Create a timer for manual tracking
   */
  createTimer(operation: string, metadata?: Record<string, any>) {
    const startTime = Date.now();

    return {
      stop: (additionalMetadata?: Record<string, any>) => {
        const duration = Date.now() - startTime;
        this.trackOperation(operation, duration, { ...metadata, ...additionalMetadata });
        return duration;
      }
    };
  }

  /**
   * Get performance summary for a specific operation
   */
  getOperationSummary(operation: string): PerformanceSummary | null {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);

    if (operationMetrics.length === 0) return null;

    const durations = operationMetrics.map(m => m.duration_ms).sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      total_operations: operationMetrics.length,
      average_duration_ms: total / operationMetrics.length,
      p95_duration_ms: durations[Math.floor(durations.length * 0.95)] || 0,
      p99_duration_ms: durations[Math.floor(durations.length * 0.99)] || 0,
      operations_per_second: this.calculateOpsPerSecond(operationMetrics),
      slowest_operations: [...operationMetrics]
        .sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0))
        .slice(0, 5),
      fastest_operations: [...operationMetrics]
        .sort((a, b) => (a.duration_ms || 0) - (b.duration_ms || 0))
        .slice(0, 5)
    };
  }

  /**
   * Get overall system performance summary
   */
  getOverallSummary(): PerformanceSummary {
    if (this.metrics.length === 0) {
      return {
        total_operations: 0,
        average_duration_ms: 0,
        p95_duration_ms: 0,
        p99_duration_ms: 0,
        operations_per_second: 0,
        slowest_operations: [],
        fastest_operations: []
      };
    }

    const durations = this.metrics.map(m => m.duration_ms).sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);

    return {
      total_operations: this.metrics.length,
      average_duration_ms: total / this.metrics.length,
      p95_duration_ms: durations[Math.floor(durations.length * 0.95)] || 0,
      p99_duration_ms: durations[Math.floor(durations.length * 0.99)] || 0,
      operations_per_second: this.calculateOpsPerSecond(this.metrics),
      slowest_operations: [...this.metrics]
        .sort((a, b) => (b.duration_ms || 0) - (a.duration_ms || 0))
        .slice(0, 10),
      fastest_operations: [...this.metrics]
        .sort((a, b) => (a.duration_ms || 0) - (b.duration_ms || 0))
        .slice(0, 10)
    };
  }

  /**
   * Get system health metrics
   */
  getSystemHealth(): SystemHealthMetrics {
    const memoryUsage = process.memoryUsage();
    const uptime = (Date.now() - this.startTime) / 1000;

    // Calculate average response time from recent metrics
    const recentMetrics = this.metrics.slice(-100); // Last 100 operations
    const avgResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration_ms, 0) / recentMetrics.length
      : 0;

    return {
      memory_usage_mb: memoryUsage.heapUsed / 1024 / 1024,
      cache_hit_rate: 0, // This would be provided by cache manager
      active_layers: 0, // This would be provided by layer service
      total_topics: 0, // This would be provided by layer service
      average_response_time_ms: avgResponseTime,
      error_rate: this.totalRequests > 0 ? (this.errorCount / this.totalRequests * 100) : 0,
      uptime_seconds: uptime
    };
  }

  /**
   * Get optimization recommendations based on performance data
   */
  getOptimizationRecommendations(): Array<{ type: string; message: string; priority: 'high' | 'medium' | 'low'; impact: string }> {
    const recommendations = [];
    const summary = this.getOverallSummary();
    const health = this.getSystemHealth();

    // High latency detection
    if (summary.average_duration_ms > 500) {
      recommendations.push({
        type: 'latency',
        message: 'Average response time is high. Consider optimizing slow operations or increasing cache size.',
        priority: 'high' as const,
        impact: 'Significant performance improvement'
      });
    }

    // Memory usage recommendations
    if (health.memory_usage_mb > 500) {
      recommendations.push({
        type: 'memory',
        message: 'High memory usage detected. Consider reducing cache size or optimizing memory-intensive operations.',
        priority: 'medium' as const,
        impact: 'Reduced memory pressure'
      });
    }

    // Error rate recommendations
    if (health.error_rate > 5) {
      recommendations.push({
        type: 'reliability',
        message: 'High error rate detected. Review error logs and improve error handling.',
        priority: 'high' as const,
        impact: 'Improved system stability'
      });
    }

    // Performance variance recommendations
    if (summary.p99_duration_ms > summary.average_duration_ms * 5) {
      recommendations.push({
        type: 'consistency',
        message: 'High performance variance detected. Some operations are much slower than others.',
        priority: 'medium' as const,
        impact: 'More consistent response times'
      });
    }

    return recommendations;
  }

  /**
   * Get operation breakdown by frequency and performance
   */
  getOperationBreakdown(): Record<string, { count: number; avg_duration: number; total_time: number }> {
    const breakdown: Record<string, { count: number; total_duration: number }> = {};

    for (const metric of this.metrics) {
      if (!breakdown[metric.operation]) {
        breakdown[metric.operation] = { count: 0, total_duration: 0 };
      }
      breakdown[metric.operation].count++;
      breakdown[metric.operation].total_duration += metric.duration_ms;
    }

    // Convert to final format with averages
    const result: Record<string, { count: number; avg_duration: number; total_time: number }> = {};
    for (const [operation, data] of Object.entries(breakdown)) {
      result[operation] = {
        count: data.count,
        avg_duration: data.total_duration / data.count,
        total_time: data.total_duration
      };
    }

    return result;
  }

  /**
   * Clear all metrics (useful for testing or memory management)
   */
  clearMetrics(): void {
    this.metrics = [];
    this.errorCount = 0;
    this.totalRequests = 0;
    console.log('📊 Performance metrics cleared');
  }

  /**
   * Export metrics for external analysis
   */
  exportMetrics(): {
    metrics: PerformanceMetric[];
    summary: PerformanceSummary;
    system_health: SystemHealthMetrics;
    operation_breakdown: Record<string, any>;
  } {
    return {
      metrics: [...this.metrics], // Copy to prevent external modification
      summary: this.getOverallSummary(),
      system_health: this.getSystemHealth(),
      operation_breakdown: this.getOperationBreakdown()
    };
  }

  // Private helper methods

  private calculateOpsPerSecond(metrics: PerformanceMetric[]): number {
    if (metrics.length < 2) return 0;

    const timeSpan = metrics[metrics.length - 1].timestamp - metrics[0].timestamp;
    if (timeSpan === 0) return 0;

    return (metrics.length / timeSpan) * 1000; // Convert to operations per second
  }
}