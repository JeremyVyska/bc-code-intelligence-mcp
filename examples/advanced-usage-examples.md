# Advanced Usage Examples

## Enterprise Integration Patterns

### 1. Multi-Tenant Knowledge Management

```typescript
/**
 * Advanced multi-tenant setup with tenant-specific knowledge layers
 */
import { BCKBClient, BCKBClientDefaults } from '../src/sdk/bckb-client.js';

class TenantKnowledgeManager {
  private clients = new Map<string, BCKBClient>();

  async initializeTenant(tenantId: string, config: {
    baseKnowledgeUrl: string;
    tenantSpecificUrl?: string;
    industryOverrides?: string;
  }) {
    const clientConfig = BCKBClientDefaults.production('node');

    // Customize for tenant
    clientConfig.server_args = [
      'dist/index.js',
      '--tenant', tenantId,
      '--base-layer', config.baseKnowledgeUrl,
      ...(config.tenantSpecificUrl ? ['--tenant-layer', config.tenantSpecificUrl] : []),
      ...(config.industryOverrides ? ['--industry-layer', config.industryOverrides] : [])
    ];

    const client = new BCKBClient(clientConfig);
    await client.connect();

    this.clients.set(tenantId, client);
    return client;
  }

  async searchAcrossTenants(query: string, tenantIds: string[]) {
    const results = new Map<string, any[]>();

    await Promise.all(
      tenantIds.map(async (tenantId) => {
        const client = this.clients.get(tenantId);
        if (client) {
          const topics = await client.searchTopics(query, { limit: 5 });
          results.set(tenantId, topics);
        }
      })
    );

    return results;
  }

  async analyzeCodeWithIndustryContext(
    tenantId: string,
    code: string,
    industryContext: 'manufacturing' | 'retail' | 'services'
  ) {
    const client = this.clients.get(tenantId);
    if (!client) throw new Error(`Tenant ${tenantId} not initialized`);

    return await client.analyzeCode({
      code_snippet: code,
      analysis_type: 'architecture',
      suggest_topics: true,
      bc_version: 'BC365', // Latest for enterprise
      // Custom context for industry-specific patterns
      context: { industry: industryContext }
    });
  }
}

// Usage example
const manager = new TenantKnowledgeManager();

await manager.initializeTenant('contoso-manufacturing', {
  baseKnowledgeUrl: 'https://github.com/bckb/base-knowledge',
  tenantSpecificUrl: 'https://github.com/contoso/bc-knowledge',
  industryOverrides: 'https://github.com/bckb/manufacturing-patterns'
});

const analysis = await manager.analyzeCodeWithIndustryContext(
  'contoso-manufacturing',
  manufacturingCodeunit,
  'manufacturing'
);
```

### 2. DevOps Pipeline Integration

```typescript
/**
 * Azure DevOps pipeline integration for automated code analysis
 */
import { BCKBClient, BCKBClientDefaults } from '../src/sdk/bckb-client.js';
import { writeFile } from 'fs/promises';

class DevOpsBCKBIntegration {
  private client: BCKBClient;
  private pipelineContext: any;

  constructor(pipelineContext: any) {
    this.pipelineContext = pipelineContext;
    this.client = new BCKBClient(BCKBClientDefaults.production('node'));
  }

  async analyzePullRequest(prFiles: string[]): Promise<{
    overallScore: number;
    issues: any[];
    recommendations: string[];
    reportPath: string;
  }> {
    await this.client.connect();

    const analyses = [];
    const allIssues = [];
    const allRecommendations = [];

    // Analyze each modified AL file
    for (const file of prFiles.filter(f => f.endsWith('.al'))) {
      try {
        const content = await this.readFile(file);
        const analysis = await this.client.analyzeCode({
          code_snippet: content,
          analysis_type: 'validation',
          suggest_topics: true
        });

        analyses.push({
          file,
          analysis,
          timestamp: new Date().toISOString()
        });

        allIssues.push(...analysis.issues.map(issue => ({
          ...issue,
          file,
          severity: this.mapSeverity(issue.severity)
        })));

        allRecommendations.push(...analysis.optimization_opportunities);

      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error);
      }
    }

    // Calculate overall quality score
    const overallScore = this.calculateQualityScore(allIssues);

    // Generate comprehensive report
    const report = {
      pullRequest: this.pipelineContext.pullRequest,
      timestamp: new Date().toISOString(),
      filesAnalyzed: prFiles.length,
      overallScore,
      issues: allIssues,
      recommendations: allRecommendations,
      detailedAnalyses: analyses,
      qualityGate: overallScore >= 80 ? 'PASSED' : 'FAILED'
    };

    // Write report for pipeline artifacts
    const reportPath = `./reports/bckb-analysis-${this.pipelineContext.buildId}.json`;
    await writeFile(reportPath, JSON.stringify(report, null, 2));

    // Generate Azure DevOps work items for high-severity issues
    await this.createWorkItemsForCriticalIssues(allIssues);

    await this.client.disconnect();

    return {
      overallScore,
      issues: allIssues,
      recommendations: allRecommendations,
      reportPath
    };
  }

  private calculateQualityScore(issues: any[]): number {
    const severityWeights = { low: 1, medium: 3, high: 7, critical: 15 };
    const totalDeductions = issues.reduce((sum, issue) =>
      sum + (severityWeights[issue.severity] || 1), 0
    );

    return Math.max(0, 100 - totalDeductions);
  }

  private mapSeverity(severity: string): 1 | 2 | 3 | 4 {
    const mapping = { low: 1, medium: 2, high: 3, critical: 4 };
    return mapping[severity] || 2;
  }

  private async createWorkItemsForCriticalIssues(issues: any[]) {
    const criticalIssues = issues.filter(i => i.severity === 'critical');

    for (const issue of criticalIssues) {
      // Create Azure DevOps work item via REST API
      await this.createWorkItem({
        type: 'Bug',
        title: `Critical Code Issue: ${issue.type}`,
        description: `
          File: ${issue.file}
          Issue: ${issue.description}
          Suggestion: ${issue.suggestion}
          Related Topics: ${issue.related_topics.join(', ')}
        `,
        priority: 1,
        tags: ['bckb-analysis', 'critical-issue', 'code-quality']
      });
    }
  }

  private async readFile(path: string): Promise<string> {
    // Implementation depends on your file system access
    return '';
  }

  private async createWorkItem(workItem: any) {
    // Implementation for Azure DevOps work item creation
  }
}

// Azure DevOps Pipeline YAML snippet
/*
- task: NodeAndroidAzureScript@1
  displayName: 'BCKB Code Analysis'
  inputs:
    scriptType: 'filePath'
    scriptLocation: 'scripts/bckb-analysis.ts'
  env:
    BCKB_SERVER_PATH: $(Agent.BuildDirectory)/bckb-server
    AZURE_DEVOPS_EXT_PAT: $(System.AccessToken)

- task: PublishBuildArtifacts@1
  displayName: 'Publish BCKB Analysis Report'
  inputs:
    pathToPublish: 'reports/bckb-analysis-$(Build.BuildId).json'
    artifactName: 'bckb-analysis-report'
*/
```

### 3. Intelligent Development Assistant

```typescript
/**
 * Advanced AI-powered development assistant using BCKB knowledge
 */
import { BCKBClient, BCKBClientDefaults } from '../src/sdk/bckb-client.js';
import { EventEmitter } from 'events';

class IntelligentBCAssistant extends EventEmitter {
  private client: BCKBClient;
  private conversationHistory: any[] = [];
  private userProfile: {
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    preferredDomains: string[];
    recentTopics: string[];
    codingPatterns: string[];
  };

  constructor() {
    super();
    this.client = new BCKBClient(BCKBClientDefaults.development());
    this.userProfile = {
      skillLevel: 'intermediate',
      preferredDomains: [],
      recentTopics: [],
      codingPatterns: []
    };
  }

  async initialize() {
    await this.client.connect();
    await this.loadUserProfile();
    this.setupIntelligentMonitoring();
  }

  async processCodeInput(code: string, context?: {
    fileName?: string;
    projectContext?: string;
    currentTask?: string;
  }): Promise<{
    analysis: any;
    proactiveInsights: string[];
    learningOpportunities: any[];
    nextSteps: string[];
  }> {
    // Analyze the code
    const analysis = await this.client.analyzeCode({
      code_snippet: code,
      analysis_type: 'general',
      suggest_topics: true
    });

    // Update user profile based on code patterns
    this.updateProfileFromCode(code, analysis);

    // Generate proactive insights
    const insights = await this.generateProactiveInsights(analysis, context);

    // Find learning opportunities
    const learningOps = await this.identifyLearningOpportunities(analysis);

    // Suggest next steps
    const nextSteps = await this.generateNextSteps(analysis, context);

    // Store in conversation history
    this.conversationHistory.push({
      timestamp: new Date(),
      type: 'code_analysis',
      input: { code, context },
      output: { analysis, insights, learningOps, nextSteps }
    });

    return {
      analysis,
      proactiveInsights: insights,
      learningOpportunities: learningOps,
      nextSteps
    };
  }

  async getContextualRecommendations(query?: string): Promise<{
    recommendedTopics: any[];
    skillProgression: any;
    personalizedContent: any[];
  }> {
    // Base search on user profile and history
    const searchQuery = query || this.inferCurrentInterest();

    const topics = await this.client.smartSearch(searchQuery, {
      user_context: {
        difficulty_preference: this.userProfile.skillLevel,
        recent_topics: this.userProfile.recentTopics,
        current_domain: this.userProfile.preferredDomains[0]
      },
      limit: 15
    });

    // Filter and rank based on user profile
    const recommendedTopics = this.personalizeTopics(topics);

    // Generate skill progression recommendations
    const skillProgression = await this.generateSkillProgression();

    // Create personalized content
    const personalizedContent = await this.createPersonalizedContent();

    return {
      recommendedTopics,
      skillProgression,
      personalizedContent
    };
  }

  async generateOptimizationWorkflow(scenario: string): Promise<{
    workflow: any;
    estimatedEffort: string;
    skillRequirements: string[];
    checkpoints: any[];
  }> {
    const workflow = await this.client.getOptimizationWorkflow(scenario, [
      `skill_level:${this.userProfile.skillLevel}`,
      ...this.userProfile.preferredDomains.map(d => `domain:${d}`)
    ]);

    // Enhance with personalized estimates and checkpoints
    const enhancedWorkflow = {
      ...workflow,
      personalized: true,
      userSkillLevel: this.userProfile.skillLevel,
      estimatedEffort: this.estimateEffortForUser(workflow),
      skillRequirements: this.identifySkillGaps(workflow),
      checkpoints: this.createPersonalizedCheckpoints(workflow)
    };

    return enhancedWorkflow;
  }

  private async generateProactiveInsights(analysis: any, context?: any): Promise<string[]> {
    const insights: string[] = [];

    // Pattern-based insights
    if (analysis.patterns_detected?.includes('table_extension_pattern')) {
      insights.push('Consider using table events instead of modifications for better upgradeability');
    }

    // Skill-level appropriate insights
    if (this.userProfile.skillLevel === 'beginner' && analysis.complexity_score > 7) {
      insights.push('This code might be complex for your current level - consider breaking it into smaller procedures');
    }

    // Historical pattern insights
    if (this.hasRecentPattern('performance_issues')) {
      insights.push('Based on your recent code, focus on database optimization patterns');
    }

    return insights;
  }

  private async identifyLearningOpportunities(analysis: any): Promise<any[]> {
    const opportunities = [];

    // Find knowledge gaps based on issues
    for (const issue of analysis.issues) {
      if (this.isNewConceptForUser(issue.type)) {
        const topic = await this.client.searchTopics(issue.type, {
          difficulty: this.userProfile.skillLevel,
          limit: 1
        });

        if (topic.length > 0) {
          opportunities.push({
            type: 'knowledge_gap',
            topic: topic[0],
            relevance: 'high',
            effort: 'medium'
          });
        }
      }
    }

    return opportunities;
  }

  private setupIntelligentMonitoring() {
    // Monitor user patterns and provide proactive assistance
    setInterval(async () => {
      const recommendations = await this.getContextualRecommendations();

      if (recommendations.recommendedTopics.length > 0) {
        this.emit('proactive_recommendation', {
          type: 'learning_opportunity',
          topics: recommendations.recommendedTopics.slice(0, 3),
          reason: 'Based on your recent activity patterns'
        });
      }
    }, 300000); // Every 5 minutes
  }

  private updateProfileFromCode(code: string, analysis: any) {
    // Update skill level based on code complexity
    if (analysis.complexity_score > 8 && this.userProfile.skillLevel === 'beginner') {
      this.userProfile.skillLevel = 'intermediate';
    }

    // Track domains of interest
    analysis.patterns_detected?.forEach(pattern => {
      const domain = this.extractDomainFromPattern(pattern);
      if (domain && !this.userProfile.preferredDomains.includes(domain)) {
        this.userProfile.preferredDomains.push(domain);
        if (this.userProfile.preferredDomains.length > 5) {
          this.userProfile.preferredDomains.shift(); // Keep only last 5
        }
      }
    });

    // Track coding patterns
    this.userProfile.codingPatterns.push(...analysis.patterns_detected);
    if (this.userProfile.codingPatterns.length > 20) {
      this.userProfile.codingPatterns = this.userProfile.codingPatterns.slice(-20);
    }
  }

  private personalizeTopics(topics: any[]): any[] {
    return topics
      .map(topic => ({
        ...topic,
        personalizedScore: this.calculatePersonalizationScore(topic),
        recommendationReason: this.getRecommendationReason(topic)
      }))
      .sort((a, b) => b.personalizedScore - a.personalizedScore)
      .slice(0, 10);
  }

  private calculatePersonalizationScore(topic: any): number {
    let score = topic.relevance_score || 0.5;

    // Boost for preferred domains
    if (this.userProfile.preferredDomains.includes(topic.domain)) {
      score += 0.3;
    }

    // Boost for appropriate difficulty
    if (topic.difficulty === this.userProfile.skillLevel) {
      score += 0.2;
    } else if (this.getNextSkillLevel() === topic.difficulty) {
      score += 0.1; // Slight boost for next level topics
    }

    // Reduce for recently viewed topics
    if (this.userProfile.recentTopics.includes(topic.id)) {
      score -= 0.2;
    }

    return Math.min(1.0, Math.max(0.0, score));
  }

  private getRecommendationReason(topic: any): string {
    if (this.userProfile.preferredDomains.includes(topic.domain)) {
      return `Matches your interest in ${topic.domain}`;
    }
    if (topic.difficulty === this.getNextSkillLevel()) {
      return 'Perfect for your next learning step';
    }
    if (topic.relevance_score > 0.8) {
      return 'Highly relevant to recent activity';
    }
    return 'Recommended based on your profile';
  }

  private getNextSkillLevel(): string {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = levels.indexOf(this.userProfile.skillLevel);
    return levels[Math.min(currentIndex + 1, levels.length - 1)];
  }

  // Additional helper methods...
  private async loadUserProfile() { /* Implementation */ }
  private inferCurrentInterest(): string { return 'general development'; }
  private hasRecentPattern(pattern: string): boolean { return false; }
  private isNewConceptForUser(concept: string): boolean { return true; }
  private extractDomainFromPattern(pattern: string): string | null { return null; }
  private generateSkillProgression(): any { return {}; }
  private createPersonalizedContent(): any[] { return []; }
  private estimateEffortForUser(workflow: any): string { return 'medium'; }
  private identifySkillGaps(workflow: any): string[] { return []; }
  private createPersonalizedCheckpoints(workflow: any): any[] { return []; }
  private generateNextSteps(analysis: any, context?: any): Promise<string[]> { return Promise.resolve([]); }
}

// Usage example
const assistant = new IntelligentBCAssistant();
await assistant.initialize();

// Listen for proactive recommendations
assistant.on('proactive_recommendation', (recommendation) => {
  console.log('💡 Suggestion:', recommendation.reason);
  recommendation.topics.forEach(topic => {
    console.log(`  - ${topic.title} (${topic.domain})`);
  });
});

// Process code with intelligent analysis
const result = await assistant.processCodeInput(`
  codeunit 50100 "Sales Processor"
  {
      procedure ProcessSalesOrder(SalesHeader: Record "Sales Header")
      begin
          // Complex processing logic here
      end;
  }
`, {
  fileName: 'SalesProcessor.al',
  currentTask: 'Implementing sales order workflow'
});

console.log('Analysis:', result.analysis);
console.log('Insights:', result.proactiveInsights);
console.log('Learning Opportunities:', result.learningOpportunities);
```

### 4. Performance Monitoring and Analytics

```typescript
/**
 * Advanced performance monitoring and analytics for BCKB integrations
 */
import { BCKBClient, BCKBClientDefaults } from '../src/sdk/bckb-client.js';
import { EventEmitter } from 'events';

class BCKBPerformanceMonitor extends EventEmitter {
  private clients: Map<string, BCKBClient> = new Map();
  private metrics: Map<string, any[]> = new Map();
  private alerts: any[] = [];

  async monitorMultipleInstances(instances: {
    id: string;
    config: any;
    healthCheckInterval?: number;
  }[]) {
    for (const instance of instances) {
      const client = new BCKBClient(instance.config);
      await client.connect();

      this.clients.set(instance.id, client);
      this.startHealthMonitoring(instance.id, instance.healthCheckInterval || 30000);
    }
  }

  private async startHealthMonitoring(instanceId: string, interval: number) {
    setInterval(async () => {
      const client = this.clients.get(instanceId);
      if (!client) return;

      try {
        const startTime = Date.now();
        const health = await client.healthCheck();
        const status = await client.getSystemStatus();
        const analytics = await client.getSystemAnalytics();
        const endTime = Date.now();

        const metrics = {
          timestamp: new Date().toISOString(),
          instanceId,
          health: health.healthy,
          latency: health.latency_ms,
          responseTime: endTime - startTime,
          cacheHitRate: status.cache_hit_rate,
          activeConnections: status.layers_active,
          totalTopics: status.total_topics,
          memoryUsage: process.memoryUsage(),
          topicAccess: analytics.usage_patterns?.topic_access_frequency || {},
          errorRate: analytics.system_overview?.error_rate || 0
        };

        this.recordMetrics(instanceId, metrics);
        this.checkForAlerts(instanceId, metrics);

      } catch (error) {
        this.recordMetrics(instanceId, {
          timestamp: new Date().toISOString(),
          instanceId,
          error: error.message,
          health: false
        });

        this.emit('instance_error', { instanceId, error });
      }
    }, interval);
  }

  private recordMetrics(instanceId: string, metrics: any) {
    if (!this.metrics.has(instanceId)) {
      this.metrics.set(instanceId, []);
    }

    const instanceMetrics = this.metrics.get(instanceId)!;
    instanceMetrics.push(metrics);

    // Keep only last 1000 entries
    if (instanceMetrics.length > 1000) {
      instanceMetrics.splice(0, instanceMetrics.length - 1000);
    }

    this.emit('metrics_recorded', { instanceId, metrics });
  }

  private checkForAlerts(instanceId: string, metrics: any) {
    const alerts = [];

    // Health check alerts
    if (!metrics.health) {
      alerts.push({
        type: 'health',
        severity: 'critical',
        message: `Instance ${instanceId} is unhealthy`
      });
    }

    // Performance alerts
    if (metrics.latency > 5000) {
      alerts.push({
        type: 'performance',
        severity: 'warning',
        message: `High latency detected: ${metrics.latency}ms`
      });
    }

    if (metrics.cacheHitRate < 0.7) {
      alerts.push({
        type: 'cache',
        severity: 'info',
        message: `Low cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`
      });
    }

    // Memory alerts
    const memoryUsageMB = metrics.memoryUsage.heapUsed / 1024 / 1024;
    if (memoryUsageMB > 512) {
      alerts.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${memoryUsageMB.toFixed(1)}MB`
      });
    }

    // Error rate alerts
    if (metrics.errorRate > 0.05) {
      alerts.push({
        type: 'errors',
        severity: 'critical',
        message: `High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`
      });
    }

    alerts.forEach(alert => {
      this.alerts.push({ ...alert, instanceId, timestamp: new Date() });
      this.emit('alert', alert);
    });
  }

  async generatePerformanceReport(timeRange: {
    start: Date;
    end: Date;
  }): Promise<{
    summary: any;
    instanceReports: Map<string, any>;
    recommendations: string[];
  }> {
    const instanceReports = new Map();

    for (const [instanceId, metrics] of this.metrics.entries()) {
      const filteredMetrics = metrics.filter(m => {
        const timestamp = new Date(m.timestamp);
        return timestamp >= timeRange.start && timestamp <= timeRange.end;
      });

      if (filteredMetrics.length === 0) continue;

      const report = this.analyzeInstanceMetrics(instanceId, filteredMetrics);
      instanceReports.set(instanceId, report);
    }

    const summary = this.generateSummary(instanceReports);
    const recommendations = this.generateRecommendations(instanceReports);

    return {
      summary,
      instanceReports,
      recommendations
    };
  }

  private analyzeInstanceMetrics(instanceId: string, metrics: any[]): any {
    const healthyCount = metrics.filter(m => m.health).length;
    const avgLatency = metrics.reduce((sum, m) => sum + (m.latency || 0), 0) / metrics.length;
    const avgCacheHitRate = metrics.reduce((sum, m) => sum + (m.cacheHitRate || 0), 0) / metrics.length;
    const maxMemory = Math.max(...metrics.map(m => m.memoryUsage?.heapUsed || 0)) / 1024 / 1024;

    return {
      instanceId,
      totalChecks: metrics.length,
      healthyChecks: healthyCount,
      uptime: (healthyCount / metrics.length) * 100,
      averageLatency: avgLatency,
      averageCacheHitRate: avgCacheHitRate,
      peakMemoryUsageMB: maxMemory,
      alertCount: this.alerts.filter(a => a.instanceId === instanceId).length
    };
  }

  private generateSummary(instanceReports: Map<string, any>): any {
    const reports = Array.from(instanceReports.values());

    return {
      totalInstances: reports.length,
      averageUptime: reports.reduce((sum, r) => sum + r.uptime, 0) / reports.length,
      averageLatency: reports.reduce((sum, r) => sum + r.averageLatency, 0) / reports.length,
      averageCacheHitRate: reports.reduce((sum, r) => sum + r.averageCacheHitRate, 0) / reports.length,
      totalAlerts: this.alerts.length,
      criticalAlerts: this.alerts.filter(a => a.severity === 'critical').length
    };
  }

  private generateRecommendations(instanceReports: Map<string, any>): string[] {
    const recommendations = [];

    for (const [instanceId, report] of instanceReports.entries()) {
      if (report.uptime < 95) {
        recommendations.push(`Instance ${instanceId}: Investigate stability issues (${report.uptime.toFixed(1)}% uptime)`);
      }

      if (report.averageLatency > 3000) {
        recommendations.push(`Instance ${instanceId}: Optimize performance (${report.averageLatency.toFixed(0)}ms avg latency)`);
      }

      if (report.averageCacheHitRate < 0.8) {
        recommendations.push(`Instance ${instanceId}: Improve caching strategy (${(report.averageCacheHitRate * 100).toFixed(1)}% hit rate)`);
      }

      if (report.peakMemoryUsageMB > 400) {
        recommendations.push(`Instance ${instanceId}: Monitor memory usage (${report.peakMemoryUsageMB.toFixed(1)}MB peak)`);
      }
    }

    return recommendations;
  }

  async exportMetrics(format: 'json' | 'csv', filePath: string) {
    const allMetrics = [];

    for (const [instanceId, metrics] of this.metrics.entries()) {
      allMetrics.push(...metrics.map(m => ({ instanceId, ...m })));
    }

    if (format === 'json') {
      await writeFile(filePath, JSON.stringify(allMetrics, null, 2));
    } else if (format === 'csv') {
      const csv = this.convertToCSV(allMetrics);
      await writeFile(filePath, csv);
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row =>
        headers.map(header =>
          typeof row[header] === 'object' ? JSON.stringify(row[header]) : row[header]
        ).join(',')
      )
    ].join('\n');

    return csvContent;
  }
}

// Usage example
const monitor = new BCKBPerformanceMonitor();

// Monitor multiple instances
await monitor.monitorMultipleInstances([
  {
    id: 'production',
    config: BCKBClientDefaults.production('node'),
    healthCheckInterval: 30000
  },
  {
    id: 'staging',
    config: BCKBClientDefaults.development('npm'),
    healthCheckInterval: 60000
  }
]);

// Set up alert handling
monitor.on('alert', (alert) => {
  console.log(`🚨 Alert: ${alert.message}`);
  // Send to monitoring system, email, Slack, etc.
});

monitor.on('metrics_recorded', ({ instanceId, metrics }) => {
  if (!metrics.health) {
    console.log(`❌ Instance ${instanceId} health check failed`);
  }
});

// Generate performance report
setTimeout(async () => {
  const report = await monitor.generatePerformanceReport({
    start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
    end: new Date()
  });

  console.log('Performance Summary:', report.summary);
  console.log('Recommendations:', report.recommendations);

  // Export metrics for further analysis
  await monitor.exportMetrics('json', './performance-metrics.json');
}, 300000); // After 5 minutes
```

---

These advanced examples demonstrate enterprise-level usage patterns for the BCKB MCP Server, including multi-tenant management, DevOps integration, intelligent assistance, and comprehensive monitoring. Each example can be adapted and extended based on specific organizational needs and infrastructure requirements.