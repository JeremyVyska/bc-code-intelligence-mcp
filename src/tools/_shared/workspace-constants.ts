/**
 * Shared Workspace Constants
 *
 * Known Business Central MCP servers and their tool signatures
 */

/**
 * Known Business Central MCP servers and their capabilities
 */
export const KNOWN_BC_MCPS = {
  // AL & Business Central MCPs
  'bc-code-intelligence-mcp': 'BC development knowledge with 14 specialist AI personas',
  'al-dependency-mcp-server': 'AL workspace symbol and dependency analysis from .app files',
  'serena-mcp': 'Multi-language LSP-based coding assistant with AL Language Server support',
  'al-objid-mcp-server': 'AL object ID collision prevention and management (Object ID Ninja)',
  'bc-telemetry-buddy': 'BC telemetry collection, KQL query generation, and performance analysis',

  // DevOps & Productivity MCPs
  'azure-devops-mcp': 'Azure DevOps integration (work items, repos, pipelines, wiki)',
  'clockify-mcp': 'Clockify time tracking and project management integration',
  'nab-al-tools-mcp': 'XLIFF/XLF translation tooling for AL projects'
} as const;

/**
 * Map of signature tools to their MCP server
 * Use this to discover which MCP servers are available by checking for these tools
 */
export const MCP_TOOL_SIGNATURES = {
  // BC Telemetry Buddy
  'search_telemetry_traces': 'bc-telemetry-buddy',
  'generate_kql_query': 'bc-telemetry-buddy',
  'analyze_performance_traces': 'bc-telemetry-buddy',

  // AL Object ID Ninja
  'reserve_object_ids': 'al-objid-mcp-server',
  'check_object_id_collision': 'al-objid-mcp-server',
  'get_next_object_id': 'al-objid-mcp-server',

  // AL Dependency MCP Server
  'analyze_dependencies': 'al-dependency-mcp-server',
  'get_workspace_symbols': 'al-dependency-mcp-server',
  'find_references': 'al-dependency-mcp-server',

  // Serena MCP
  'get_lsp_diagnostics': 'serena-mcp',
  'format_document': 'serena-mcp',
  'get_code_actions': 'serena-mcp',

  // Azure DevOps MCP
  'create_work_item': 'azure-devops-mcp',
  'query_work_items': 'azure-devops-mcp',
  'get_pipeline_runs': 'azure-devops-mcp',

  // Clockify MCP
  'track_time_entry': 'clockify-mcp',
  'get_time_entries': 'clockify-mcp',

  // NAB AL Tools MCP
  'translate_xliff': 'nab-al-tools-mcp',
  'export_translations': 'nab-al-tools-mcp'
} as const;

export type KnownMcpServerId = keyof typeof KNOWN_BC_MCPS;

export interface WorkspaceInfo {
  workspace_root: string | null;
  available_mcps: string[];
}
