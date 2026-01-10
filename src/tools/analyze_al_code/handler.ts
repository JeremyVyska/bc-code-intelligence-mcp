/**
 * analyze_al_code Tool - Handler Implementation
 *
 * AL code analysis and workspace inspection handlers
 */

export function createAnalyzeAlCodeHandler(services: any) {
  const { codeAnalysisService, methodologyService } = services;

  return async (args: any) => {
    const { code, analysis_type = 'comprehensive', operation = 'analyze', bc_version, suggest_workflows = true } = args;

    if (code.toLowerCase() === 'workspace') {
      // Workspace analysis using existing method
      const analysisResult = await codeAnalysisService.analyzeCode({
        code_snippet: "// Workspace analysis requested",
        analysis_type: 'workspace_overview',
        suggest_topics: suggest_workflows,
        bc_version
      });

      if (suggest_workflows) {
        // Suggest relevant workflows based on analysis
        const workflowSuggestions = await methodologyService.findWorkflowsByQuery('code analysis optimization');
        analysisResult.suggested_workflows = workflowSuggestions;
      }

      // VALIDATE OPERATION: Return compliance issues + auto-fix suggestions
      if (operation === 'validate') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              response_type: 'validation_report',
              compliance_issues: analysisResult.issues || [],
              auto_fix_suggestions: analysisResult.patterns
                ?.filter((p: any) => p.auto_fixable === true)
                .map((p: any) => ({
                  issue: p.pattern,
                  fix_action: p.recommended_action,
                  code_snippet: p.code_snippet,
                  confidence: p.confidence || 0.9
                })) || [],
              blocking_issues: analysisResult.issues?.filter((i: any) => i.severity === 'critical') || [],
              warnings: analysisResult.issues?.filter((i: any) => i.severity === 'warning') || [],
              bc_version: bc_version,
              analysis_type: analysis_type
            }, null, 2)
          }]
        };
      }

      // SUGGEST_FIXES OPERATION: Return code transformations
      if (operation === 'suggest_fixes') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              response_type: 'code_transformations',
              transformations: analysisResult.patterns
                ?.map((p: any) => ({
                  pattern: p.pattern,
                  transformation: p.recommended_action,
                  before_code: p.code_snippet,
                  after_code: p.suggested_code || '// Auto-generation not available',
                  impact: p.impact || 'medium',
                  confidence: p.confidence || 0.85
                })) || [],
              recommended_workflow: analysisResult.suggested_workflows?.[0] || null,
              bc_version: bc_version
            }, null, 2)
          }]
        };
      }

      // ANALYZE OPERATION: Return conversational analysis
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(analysisResult, null, 2)
        }]
      };
    } else {
      // Code snippet analysis
      const analysisResult = await codeAnalysisService.analyzeCode({
        code_snippet: code,
        analysis_type,
        suggest_topics: suggest_workflows,
        bc_version
      });

      // VALIDATE OPERATION: Return compliance issues + auto-fix suggestions
      if (operation === 'validate') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              response_type: 'validation_report',
              compliance_issues: analysisResult.issues || [],
              auto_fix_suggestions: analysisResult.patterns
                ?.filter((p: any) => p.auto_fixable === true)
                .map((p: any) => ({
                  issue: p.pattern,
                  fix_action: p.recommended_action,
                  code_snippet: p.code_snippet,
                  confidence: p.confidence || 0.9
                })) || [],
              blocking_issues: analysisResult.issues?.filter((i: any) => i.severity === 'critical') || [],
              warnings: analysisResult.issues?.filter((i: any) => i.severity === 'warning') || [],
              bc_version: bc_version,
              analysis_type: analysis_type
            }, null, 2)
          }]
        };
      }

      // SUGGEST_FIXES OPERATION: Return code transformations
      if (operation === 'suggest_fixes') {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              response_type: 'code_transformations',
              transformations: analysisResult.patterns
                ?.map((p: any) => ({
                  pattern: p.pattern,
                  transformation: p.recommended_action,
                  before_code: p.code_snippet,
                  after_code: p.suggested_code || '// Auto-generation not available',
                  impact: p.impact || 'medium',
                  confidence: p.confidence || 0.85
                })) || [],
              recommended_workflow: suggest_workflows ? await methodologyService.findWorkflowsByQuery('code optimization') : null,
              bc_version: bc_version
            }, null, 2)
          }]
        };
      }

      // ANALYZE OPERATION: Return conversational analysis
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(analysisResult, null, 2)
        }]
      };
    }
  };
}
