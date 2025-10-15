/**
 * Centralized MCP Tools Registry
 * 
 * ALL MCP tools exposed by the BC Code Intelligence server are defined and exported here.
 * This provides a single source of truth for:
 * - Tool definitions (schemas and descriptions)
 * - Tool handlers (implementation)
 * - Tool organization and discoverability
 * 
 * IMPORTANT: When adding new tools, add them here to maintain consistency and discoverability.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// Core BC Knowledge Tools
export { streamlinedTools, STREAMLINED_TOOL_NAMES } from './core-tools.js';

// Specialist Interaction Tools
export { SpecialistTools } from './specialist-tools.js';
export { SpecialistDiscoveryTools, SPECIALIST_DISCOVERY_TOOLS } from './specialist-discovery-tools.js';

// Agent Onboarding Tools
export { AgentOnboardingTools, ONBOARDING_TOOLS } from './onboarding-tools.js';

// Specialist Handoff Tools
export { SpecialistHandoffTools, HANDOFF_TOOLS } from './handoff-tools.js';

// Re-export types
export type { HandoffType } from './handoff-tools.js';

// Import types for function signature
import type { SpecialistTools } from './specialist-tools.js';
import type { SpecialistDiscoveryTools } from './specialist-discovery-tools.js';
import type { AgentOnboardingTools } from './onboarding-tools.js';
import type { SpecialistHandoffTools } from './handoff-tools.js';
import { streamlinedTools } from './core-tools.js';

/**
 * Get all tool definitions for MCP server registration
 * 
 * This aggregates tools from all sources into a single array for the MCP server.
 * Tool instances (classes) are instantiated in index.ts with proper service dependencies.
 */
export function getAllToolDefinitions(params: {
  specialistTools?: SpecialistTools;
  specialistDiscoveryTools?: SpecialistDiscoveryTools;
  onboardingTools?: AgentOnboardingTools;
  handoffTools?: SpecialistHandoffTools;
}): Tool[] {
  const { specialistTools, specialistDiscoveryTools, onboardingTools, handoffTools } = params;
  const tools: Tool[] = [...streamlinedTools];
  
  if (specialistTools) {
    tools.push(...specialistTools.getToolDefinitions());
  }
  
  if (specialistDiscoveryTools) {
    tools.push(...specialistDiscoveryTools.getToolDefinitions());
  }
  
  if (onboardingTools) {
    tools.push(...onboardingTools.getToolDefinitions());
  }
  
  if (handoffTools) {
    tools.push(...handoffTools.getToolDefinitions());
  }
  
  return tools;
}

/**
 * Tool name constants for easy reference and type safety
 */
export const TOOL_NAMES = {
  // Core knowledge tools
  FIND_BC_KNOWLEDGE: 'find_bc_knowledge',
  ASK_BC_EXPERT: 'ask_bc_expert',
  ANALYZE_AL_CODE: 'analyze_al_code',
  GET_BC_TOPIC: 'get_bc_topic',
  START_WORKFLOW: 'start_workflow',
  NEXT_WORKFLOW_STEP: 'next_workflow_step',
  GET_BC_METHODOLOGY: 'get_bc_methodology',
  LIST_BC_DOMAINS: 'list_bc_domains',
  
  // Specialist tools
  SUGGEST_SPECIALIST: 'suggest_specialist',
  GET_SPECIALIST_ADVICE: 'get_specialist_advice',
  LIST_SPECIALISTS: 'list_specialists',
  
  // Discovery tools
  DISCOVER_SPECIALISTS: 'discover_specialists',
  BROWSE_SPECIALISTS: 'browse_specialists',
  GET_SPECIALIST_INFO: 'get_specialist_info',
  
  // Onboarding tools
  INTRODUCE_BC_SPECIALISTS: 'introduce_bc_specialists',
  GET_SPECIALIST_INTRODUCTION: 'get_specialist_introduction',
  SUGGEST_NEXT_SPECIALIST: 'suggest_next_specialist',
  
  // Handoff tools
  HANDOFF_TO_SPECIALIST: 'handoff_to_specialist',
  BRING_IN_SPECIALIST: 'bring_in_specialist',
  GET_HANDOFF_SUMMARY: 'get_handoff_summary'
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
