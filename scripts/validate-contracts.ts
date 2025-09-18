/**
 * Contract Validation Script
 * 
 * Validates that every tool schema option has a corresponding implementation.
 * Run this during CI/CD and at server startup to catch dead ends early.
 */

import { streamlinedTools } from '../src/streamlined-tools.js';
import { createStreamlinedHandlers } from '../src/streamlined-handlers.js';

interface ValidationResult {
  toolName: string;
  issues: string[];
  warnings: string[];
}

async function validateContracts(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  // Create mock services for validation
  const mockServices = {
    knowledgeService: createMockKnowledgeService(),
    methodologyService: createMockMethodologyService(),
    codeAnalysisService: createMockCodeAnalysisService(),
    workflowService: createMockWorkflowService(),
    layerService: createMockLayerService()
  };

  try {
    const handlers = createStreamlinedHandlers(null, mockServices) as any;
    
    for (const tool of streamlinedTools) {
      const validation: ValidationResult = {
        toolName: tool.name,
        issues: [],
        warnings: []
      };

      // Check if handler exists
      if (!handlers[tool.name]) {
        validation.issues.push(`No handler found for tool: ${tool.name}`);
        results.push(validation);
        continue;
      }

      // Validate enum options in schema
      await validateEnumOptions(tool, handlers[tool.name], validation);
      
      // Test basic handler execution
      await testHandlerExecution(tool, handlers[tool.name], validation);
      
      results.push(validation);
    }
  } catch (error) {
    results.push({
      toolName: 'SYSTEM',
      issues: [`Failed to create handlers: ${error}`],
      warnings: []
    });
  }

  return results;
}

async function validateEnumOptions(tool: any, handler: Function, validation: ValidationResult) {
  const schema = tool.inputSchema;
  
  if (schema?.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const prop = propSchema as any;
      
      if (prop.enum) {
        // For workflow_type, validate against actual service capabilities
        if (propName === 'workflow_type') {
          await validateWorkflowTypes(prop.enum, validation);
        }
        
        // For analysis_type, validate against service implementation
        if (propName === 'analysis_type') {
          await validateAnalysisTypes(prop.enum, validation);
        }
        
        // For search_type, validate against service methods
        if (propName === 'search_type') {
          await validateSearchTypes(prop.enum, validation);
        }
      }
    }
  }
}

async function validateWorkflowTypes(enumValues: string[], validation: ValidationResult) {
  // These should match the pipeline definitions in WorkflowService
  const expectedTypes = [
    'new-bc-app', 'enhance-bc-app', 'review-bc-code', 'debug-bc-issues',
    'modernize-bc-code', 'onboard-developer', 'upgrade-bc-version',
    'add-ecosystem-features', 'document-bc-solution'
  ];
  
  for (const enumValue of enumValues) {
    if (!expectedTypes.includes(enumValue)) {
      validation.issues.push(`Workflow type '${enumValue}' not implemented in WorkflowService`);
    }
  }
}

async function validateAnalysisTypes(enumValues: string[], validation: ValidationResult) {
  // These should match the filterPatternsByAnalysisType method
  const expectedTypes = ['performance', 'quality', 'security', 'patterns', 'comprehensive'];
  
  for (const enumValue of enumValues) {
    if (!expectedTypes.includes(enumValue)) {
      validation.issues.push(`Analysis type '${enumValue}' not implemented in CodeAnalysisService`);
    }
  }
}

async function validateSearchTypes(enumValues: string[], validation: ValidationResult) {
  // These should correspond to actual search capabilities
  const validTypes = ['topics', 'specialists', 'workflows', 'all'];
  
  for (const enumValue of enumValues) {
    if (!validTypes.includes(enumValue)) {
      validation.issues.push(`Search type '${enumValue}' not supported`);
    }
  }
}

async function testHandlerExecution(tool: any, handler: Function, validation: ValidationResult) {
  try {
    // Create minimal valid arguments based on required fields
    const testArgs = createTestArgs(tool);
    
    // Try to execute handler (should not throw)
    const result = await handler(testArgs);
    
    if (!result) {
      validation.warnings.push(`Handler returned falsy value`);
    }
    
    if (!result.content && !result.error) {
      validation.warnings.push(`Handler returned unexpected result format`);
    }
    
  } catch (error) {
    validation.issues.push(`Handler execution failed: ${error}`);
  }
}

function createTestArgs(tool: any): any {
  const args: any = {};
  const schema = tool.inputSchema;
  
  if (schema?.required) {
    for (const requiredField of schema.required) {
      const propSchema = schema.properties?.[requiredField];
      
      if (propSchema) {
        args[requiredField] = createTestValue(propSchema);
      }
    }
  }
  
  return args;
}

function createTestValue(propSchema: any): any {
  if (propSchema.type === 'string') {
    if (propSchema.enum) {
      return propSchema.enum[0]; // Use first enum value
    }
    return 'test-value';
  }
  
  if (propSchema.type === 'number') {
    return propSchema.default || 10;
  }
  
  if (propSchema.type === 'boolean') {
    return propSchema.default || false;
  }
  
  if (propSchema.type === 'object') {
    return {};
  }
  
  return 'test';
}

// Mock service factories
function createMockKnowledgeService() {
  return {
    searchTopics: async () => [],
    getTopic: async () => null,
    findSpecialistsByQuery: () => [],
    askSpecialist: async () => ({ specialist: {}, question: '', relevant_knowledge: [], consultation_guidance: '', follow_up_suggestions: [] })
  };
}

function createMockMethodologyService() {
  return {
    findWorkflowsByQuery: async () => []
  };
}

function createMockCodeAnalysisService() {
  return {
    analyzeCode: async () => ({ issues: [], patterns_detected: [], optimization_opportunities: [], suggested_topics: [] })
  };
}

function createMockWorkflowService() {
  return {
    startWorkflow: async () => ({ id: 'test', type: 'test', current_phase: 0, specialist_pipeline: [] }),
    getPhaseGuidance: async () => 'test guidance',
    advancePhase: async () => ({ session: {}, progress_percentage: 0 }),
    getActiveWorkflows: async () => [],
    getWorkflowStatus: async () => ({ session: {}, progress_percentage: 0 }),
    getWorkflowMethodology: async () => ({ workflow_id: 'test', phases: [] })
  };
}

function createMockLayerService() {
  return {};
}

// Main execution
export async function runContractValidation(): Promise<boolean> {
  console.log('🔍 Validating MCP Tool Contracts...\n');
  
  const results = await validateContracts();
  let hasIssues = false;
  
  for (const result of results) {
    if (result.issues.length > 0 || result.warnings.length > 0) {
      console.log(`📋 ${result.toolName}:`);
      
      for (const issue of result.issues) {
        console.log(`  ❌ ${issue}`);
        hasIssues = true;
      }
      
      for (const warning of result.warnings) {
        console.log(`  ⚠️  ${warning}`);
      }
      
      console.log('');
    }
  }
  
  if (!hasIssues) {
    console.log('✅ All tool contracts validated successfully!');
  } else {
    console.log('💥 Contract validation failed! Fix issues before release.');
  }
  
  return !hasIssues;
}

// CLI execution
const isMainModule = process.argv[1] && process.argv[1].includes('validate-contracts');
if (isMainModule) {
  console.log('🚀 Starting contract validation...');
  runContractValidation().then(success => {
    console.log(`\n📊 Validation ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('💥 Contract validation crashed:', error);
    process.exit(1);
  });
}