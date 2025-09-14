/**
 * BCKB Knowledge Assistant VS Code Extension
 *
 * Provides seamless integration with BCKB MCP server for Business Central developers,
 * including intelligent search, code analysis, and contextual recommendations.
 */

import * as vscode from 'vscode';
import { BCKBClient, BCKBClientDefaults, BCKBTopic } from '../../src/sdk/bckb-client.js';
import { KnowledgeTreeProvider } from './providers/knowledge-tree-provider.js';
import { SearchResultsProvider } from './providers/search-results-provider.js';
import { RecommendationsProvider } from './providers/recommendations-provider.js';
import { LayerInfoProvider } from './providers/layer-info-provider.js';

export class BCKBExtension {
  private client: BCKBClient;
  private knowledgeProvider: KnowledgeTreeProvider;
  private searchResultsProvider: SearchResultsProvider;
  private recommendationsProvider: RecommendationsProvider;
  private layerInfoProvider: LayerInfoProvider;
  private statusBarItem: vscode.StatusBarItem;
  private outputChannel: vscode.OutputChannel;
  private currentTopicCache = new Map<string, BCKBTopic>();

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('BCKB Knowledge Assistant');

    // Initialize client with configuration
    const config = vscode.workspace.getConfiguration('bckb');
    const clientConfig = BCKBClientDefaults.local(config.get('serverPath'));
    clientConfig.server_args = config.get('serverArgs') || ['dist/index.js'];
    clientConfig.debug_logging = config.get('debugLogging') || false;

    this.client = new BCKBClient(clientConfig);

    // Initialize providers
    this.knowledgeProvider = new KnowledgeTreeProvider(this.client);
    this.searchResultsProvider = new SearchResultsProvider(this.client);
    this.recommendationsProvider = new RecommendationsProvider(this.client);
    this.layerInfoProvider = new LayerInfoProvider(this.client);

    // Initialize status bar
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.statusBarItem.command = 'bckb.showStatus';
    this.statusBarItem.text = '$(book) BCKB: Disconnected';
    this.statusBarItem.show();

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Register tree data providers
      vscode.window.createTreeView('bckb-knowledge', {
        treeDataProvider: this.knowledgeProvider,
        showCollapseAll: true
      });

      vscode.window.createTreeView('bckb-search-results', {
        treeDataProvider: this.searchResultsProvider,
        showCollapseAll: true
      });

      vscode.window.createTreeView('bckb-recommendations', {
        treeDataProvider: this.recommendationsProvider,
        showCollapseAll: false
      });

      vscode.window.createTreeView('bckb-layers', {
        treeDataProvider: this.layerInfoProvider,
        showCollapseAll: false
      });

      // Register commands
      this.registerCommands();

      // Setup event listeners
      this.setupEventListeners();

      // Auto-connect if enabled
      const config = vscode.workspace.getConfiguration('bckb');
      if (config.get('autoConnect')) {
        await this.connectToServer();
      }

      this.log('BCKB Extension initialized successfully');

    } catch (error) {
      this.log(`Extension initialization failed: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`BCKB Extension failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private registerCommands(): void {
    const commands = [
      vscode.commands.registerCommand('bckb.search', () => this.searchKnowledge()),
      vscode.commands.registerCommand('bckb.analyzeCode', () => this.analyzeCurrentCode()),
      vscode.commands.registerCommand('bckb.getTopic', (topicId: string) => this.getTopicDetails(topicId)),
      vscode.commands.registerCommand('bckb.showStatus', () => this.showServerStatus()),
      vscode.commands.registerCommand('bckb.refreshKnowledge', () => this.refreshKnowledge()),
      vscode.commands.registerCommand('bckb.openTopic', (topic: BCKBTopic) => this.openTopicInEditor(topic)),
      vscode.commands.registerCommand('bckb.copyTopicId', (topic: BCKBTopic) => this.copyTopicId(topic)),
      vscode.commands.registerCommand('bckb.exportAnalysis', () => this.exportAnalysis())
    ];

    commands.forEach(command => this.context.subscriptions.push(command));
  }

  private setupEventListeners(): void {
    // Listen for file save events if analysis on save is enabled
    const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
      const config = vscode.workspace.getConfiguration('bckb');
      if (config.get('analysisOnSave') && document.languageId === 'al') {
        await this.analyzeDocument(document);
      }
    });

    // Listen for active editor changes for recommendations
    const onEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (editor && editor.document.languageId === 'al') {
        await this.updateRecommendations(editor);
      }
    });

    // Listen for selection changes for contextual analysis
    const onSelectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(async (event) => {
      if (event.textEditor.document.languageId === 'al' && !event.selections[0].isEmpty) {
        await this.updateRecommendationsForSelection(event.textEditor);
      }
    });

    // Listen for configuration changes
    const onConfigChangeDisposable = vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (event.affectsConfiguration('bckb')) {
        await this.handleConfigurationChange();
      }
    });

    this.context.subscriptions.push(
      onSaveDisposable,
      onEditorChangeDisposable,
      onSelectionChangeDisposable,
      onConfigChangeDisposable
    );
  }

  private async connectToServer(): Promise<void> {
    try {
      this.statusBarItem.text = '$(sync~spin) BCKB: Connecting...';

      await this.client.connect();

      const status = await this.client.getSystemStatus();
      this.statusBarItem.text = `$(book) BCKB: ${status.layers_active} layers, ${status.total_topics} topics`;

      // Refresh all providers
      this.knowledgeProvider.refresh();
      this.layerInfoProvider.refresh();

      this.log('Connected to BCKB server successfully');
      vscode.window.showInformationMessage('Connected to BCKB Knowledge Server');

    } catch (error) {
      this.statusBarItem.text = '$(error) BCKB: Connection Failed';
      this.log(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Failed to connect to BCKB server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async searchKnowledge(): Promise<void> {
    try {
      const query = await vscode.window.showInputBox({
        prompt: 'Enter search query for Business Central knowledge',
        placeHolder: 'e.g., "SIFT optimization", "flowfield performance", etc.'
      });

      if (!query) return;

      if (!this.client.isConnected()) {
        await this.connectToServer();
      }

      const config = vscode.workspace.getConfiguration('bckb');
      const maxResults = config.get('maxSearchResults', 20);

      // Perform smart search if available
      const results = await this.client.smartSearch(query, { limit: maxResults });

      this.searchResultsProvider.setResults(results);
      vscode.commands.executeCommand('bckb-search-results.focus');

      this.log(`Search completed: ${results.length} results for "${query}"`);

    } catch (error) {
      this.log(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async analyzeCurrentCode(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'al') {
      vscode.window.showWarningMessage('Please open an AL file and select code to analyze');
      return;
    }

    const selection = editor.selection;
    const code = selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(selection);

    if (!code.trim()) {
      vscode.window.showWarningMessage('No code selected for analysis');
      return;
    }

    await this.analyzeCode(code);
  }

  private async analyzeCode(code: string): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        await this.connectToServer();
      }

      const analysis = await this.client.analyzeCode({
        code_snippet: code,
        analysis_type: 'general',
        suggest_topics: true
      });

      await this.showAnalysisResults(analysis);

    } catch (error) {
      this.log(`Code analysis failed: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Code analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async showAnalysisResults(analysis: any): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'bckb-analysis',
      'Code Analysis Results',
      vscode.ViewColumn.Two,
      { enableScripts: true }
    );

    panel.webview.html = this.generateAnalysisHTML(analysis);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'openTopic':
            await this.getTopicDetails(message.topicId);
            break;
          case 'searchTopic':
            const results = await this.client.searchTopics(message.query, { limit: 5 });
            this.searchResultsProvider.setResults(results);
            break;
        }
      },
      undefined,
      this.context.subscriptions
    );
  }

  private async getTopicDetails(topicId: string): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        await this.connectToServer();
      }

      const topic = await this.client.getTopic(topicId);
      if (!topic) {
        vscode.window.showWarningMessage(`Topic not found: ${topicId}`);
        return;
      }

      this.currentTopicCache.set(topicId, topic);
      await this.openTopicInEditor(topic);

    } catch (error) {
      this.log(`Failed to get topic: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Failed to get topic: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async openTopicInEditor(topic: BCKBTopic): Promise<void> {
    const uri = vscode.Uri.parse(`bckb-topic:${topic.id}.bckb-topic`);

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.Two);
  }

  private async copyTopicId(topic: BCKBTopic): Promise<void> {
    await vscode.env.clipboard.writeText(topic.id);
    vscode.window.showInformationMessage(`Copied topic ID: ${topic.id}`);
  }

  private async showServerStatus(): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        vscode.window.showInformationMessage('Not connected to BCKB server');
        return;
      }

      const [status, health, analytics] = await Promise.all([
        this.client.getSystemStatus(),
        this.client.healthCheck(),
        this.client.getSystemAnalytics()
      ]);

      const panel = vscode.window.createWebviewPanel(
        'bckb-status',
        'BCKB Server Status',
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      panel.webview.html = this.generateStatusHTML(status, health, analytics);

    } catch (error) {
      this.log(`Failed to get server status: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Failed to get server status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async refreshKnowledge(): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        await this.connectToServer();
        return;
      }

      await this.client.reloadConfiguration();

      // Refresh all providers
      this.knowledgeProvider.refresh();
      this.searchResultsProvider.refresh();
      this.recommendationsProvider.refresh();
      this.layerInfoProvider.refresh();

      vscode.window.showInformationMessage('Knowledge base refreshed');

    } catch (error) {
      this.log(`Failed to refresh knowledge: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Failed to refresh knowledge: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async exportAnalysis(): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        await this.connectToServer();
      }

      const analytics = await this.client.getSystemAnalytics();

      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file('bckb-analysis.json'),
        filters: { 'JSON Files': ['json'] }
      });

      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(analytics, null, 2)));
        vscode.window.showInformationMessage(`Analysis exported to: ${uri.fsPath}`);
      }

    } catch (error) {
      this.log(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
      vscode.window.showErrorMessage(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods for HTML generation
  private generateAnalysisHTML(analysis: any): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Analysis Results</title>
    <style>
        body { font-family: var(--vscode-font-family); margin: 20px; }
        .issue { margin: 10px 0; padding: 10px; border-left: 4px solid; }
        .critical { border-left-color: #f14c4c; background-color: rgba(241, 76, 76, 0.1); }
        .high { border-left-color: #ff8c00; background-color: rgba(255, 140, 0, 0.1); }
        .medium { border-left-color: #ffcc02; background-color: rgba(255, 204, 2, 0.1); }
        .low { border-left-color: #89d185; background-color: rgba(137, 209, 133, 0.1); }
        .topic-link { color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline; }
        .patterns { margin: 20px 0; }
        .optimization { margin: 10px 0; padding: 8px; background-color: rgba(0, 122, 204, 0.1); }
    </style>
</head>
<body>
    <h2>📊 Code Analysis Results</h2>

    ${analysis.issues.length > 0 ? `
    <h3>🚨 Issues Found (${analysis.issues.length})</h3>
    ${analysis.issues.map((issue: any) => `
        <div class="issue ${issue.severity}">
            <strong>${issue.type.toUpperCase()}</strong> - ${issue.severity.toUpperCase()}<br>
            ${issue.description}<br>
            <em>Suggestion: ${issue.suggestion}</em>
            ${issue.related_topics.length > 0 ? `<br>Related topics: ${issue.related_topics.map((topic: string) =>
                `<span class="topic-link" onclick="openTopic('${topic}')">${topic}</span>`
            ).join(', ')}` : ''}
        </div>
    `).join('')}
    ` : ''}

    ${analysis.patterns_detected.length > 0 ? `
    <h3>🔍 Patterns Detected</h3>
    <div class="patterns">
        ${analysis.patterns_detected.map((pattern: string) => `• ${pattern}`).join('<br>')}
    </div>
    ` : ''}

    ${analysis.optimization_opportunities.length > 0 ? `
    <h3>⚡ Optimization Opportunities</h3>
    ${analysis.optimization_opportunities.map((opp: any) => `
        <div class="optimization">
            <strong>${opp.description}</strong><br>
            Impact: ${opp.impact} | Difficulty: ${opp.difficulty}<br>
            ${opp.related_topics.length > 0 ? `Topics: ${opp.related_topics.map((topic: string) =>
                `<span class="topic-link" onclick="openTopic('${topic}')">${topic}</span>`
            ).join(', ')}` : ''}
        </div>
    `).join('')}
    ` : ''}

    ${analysis.suggested_topics.length > 0 ? `
    <h3>📚 Suggested Learning Topics</h3>
    ${analysis.suggested_topics.map((topic: any) => `
        <div class="topic-link" onclick="openTopic('${topic.id}')">
            📄 ${topic.title} (${topic.difficulty})
        </div>
    `).join('')}
    ` : ''}

    <script>
        const vscode = acquireVsCodeApi();

        function openTopic(topicId) {
            vscode.postMessage({
                command: 'openTopic',
                topicId: topicId
            });
        }
    </script>
</body>
</html>`;
  }

  private generateStatusHTML(status: any, health: any, analytics: any): string {
    const healthIcon = status.overall_health === 'healthy' ? '✅' : status.overall_health === 'degraded' ? '⚠️' : '❌';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BCKB Server Status</title>
    <style>
        body { font-family: var(--vscode-font-family); margin: 20px; }
        .status-card { margin: 15px 0; padding: 15px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; }
        .metric { margin: 5px 0; }
        .healthy { color: #89d185; }
        .degraded { color: #ffcc02; }
        .unhealthy { color: #f14c4c; }
    </style>
</head>
<body>
    <h2>${healthIcon} BCKB Server Status</h2>

    <div class="status-card">
        <h3>🏥 Health Status</h3>
        <div class="metric">Overall Health: <span class="${status.overall_health}">${status.overall_health.toUpperCase()}</span></div>
        <div class="metric">Response Time: ${health.latency_ms}ms</div>
        <div class="metric">Uptime: ${Math.floor(status.uptime_seconds / 3600)}h ${Math.floor((status.uptime_seconds % 3600) / 60)}m</div>
    </div>

    <div class="status-card">
        <h3>📚 Knowledge Base</h3>
        <div class="metric">Active Layers: ${status.layers_active}</div>
        <div class="metric">Total Topics: ${status.total_topics.toLocaleString()}</div>
        <div class="metric">Cache Hit Rate: ${status.cache_hit_rate.toFixed(1)}%</div>
        <div class="metric">Configuration: ${status.configuration_loaded ? '✅ Loaded' : '❌ Not loaded'}</div>
    </div>

    <div class="status-card">
        <h3>📊 System Overview</h3>
        <div class="metric">Server Version: ${analytics.system_overview.server_version}</div>
        <div class="metric">Layers Active: ${analytics.system_overview.layers_active}</div>
        <div class="metric">Configuration Quality: ${analytics.configuration_insights?.configuration_quality.overall_score || 'N/A'}/100</div>
    </div>
</body>
</html>`;
  }

  // Event handlers
  private async analyzeDocument(document: vscode.TextDocument): Promise<void> {
    if (document.languageId !== 'al') return;

    try {
      const code = document.getText();
      await this.analyzeCode(code);
    } catch (error) {
      this.log(`Auto-analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateRecommendations(editor: vscode.TextEditor): Promise<void> {
    // Get recommendations based on current file context
    try {
      if (!this.client.isConnected()) return;

      const config = vscode.workspace.getConfiguration('bckb');
      if (!config.get('enableRecommendations')) return;

      // Extract context from current file
      const document = editor.document;
      const text = document.getText(new vscode.Range(0, 0, Math.min(50, document.lineCount), 0));

      // Simple context extraction - could be enhanced
      const context = text.toLowerCase();
      let domain = 'general';

      if (context.includes('table') || context.includes('record')) domain = 'data';
      else if (context.includes('page') || context.includes('card')) domain = 'ui';
      else if (context.includes('codeunit') || context.includes('procedure')) domain = 'logic';
      else if (context.includes('report')) domain = 'reporting';

      const recommendations = await this.client.searchTopics(domain, { limit: 5 });
      this.recommendationsProvider.setRecommendations(recommendations);

    } catch (error) {
      this.log(`Failed to update recommendations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async updateRecommendationsForSelection(editor: vscode.TextEditor): Promise<void> {
    // Update recommendations based on selected code
    try {
      if (!this.client.isConnected()) return;

      const selection = editor.selection;
      if (selection.isEmpty) return;

      const selectedText = editor.document.getText(selection);

      // Quick analysis for recommendations
      const results = await this.client.smartSearch(selectedText, { limit: 3 });
      this.recommendationsProvider.setRecommendations(results);

    } catch (error) {
      this.log(`Failed to update selection recommendations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async handleConfigurationChange(): Promise<void> {
    const config = vscode.workspace.getConfiguration('bckb');

    // Recreate client with new configuration if server path changed
    const newServerPath = config.get('serverPath');
    const currentConfig = this.client.getClientConfig();

    if (newServerPath !== currentConfig.server_command) {
      await this.client.disconnect();

      const clientConfig = BCKBClientDefaults.local(newServerPath);
      clientConfig.server_args = config.get('serverArgs') || ['dist/index.js'];
      clientConfig.debug_logging = config.get('debugLogging') || false;

      this.client = new BCKBClient(clientConfig);

      if (config.get('autoConnect')) {
        await this.connectToServer();
      }
    }
  }

  private log(message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    this.outputChannel.appendLine(`[${timestamp}] ${message}`);
  }

  public async dispose(): Promise<void> {
    await this.client.disconnect();
    this.statusBarItem.dispose();
    this.outputChannel.dispose();
  }
}

// Extension activation
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('BCKB Knowledge Assistant is activating...');

  const extension = new BCKBExtension(context);

  // Register extension for cleanup
  context.subscriptions.push({
    dispose: () => extension.dispose()
  });

  console.log('BCKB Knowledge Assistant activated successfully');
}

export function deactivate(): void {
  console.log('BCKB Knowledge Assistant is deactivating...');
}