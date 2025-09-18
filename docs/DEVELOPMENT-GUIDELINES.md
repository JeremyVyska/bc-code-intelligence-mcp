# MCP Tool Development Guidelines

## Preventing Interface/Implementation Drift

This document outlines the process for adding or modifying MCP tools to prevent "dead ends" where tool schemas promise functionality that doesn't exist.

## 🚨 Golden Rule: Schema Last, Implementation First

**Never update tool schemas without corresponding implementation changes.**

## Development Workflow

### 1. **Adding a New Tool**

```bash
# 1. Define the tool interface (but don't add to streamlined-tools.ts yet)
# 2. Implement the service methods
# 3. Add handler logic
# 4. Add tool schema to streamlined-tools.ts
# 5. Validate contract
npm run validate:contracts
```

### 2. **Modifying Existing Tools**

```bash
# 1. Update service implementation first
# 2. Update handler logic
# 3. Update tool schema
# 4. Validate contract
npm run validate:contracts
```

### 3. **Before Every Commit**

```bash
# Required checks before committing
npm run validate:contracts  # Must pass
npm run build              # Must compile
npm test                   # Contract validation (streamlined approach)
```

## Tool Schema Requirements

### Enum Values Must Match Implementation

When defining enum values in tool schemas:

```typescript
// ❌ BAD: Schema enum doesn't match service
workflow_type: {
  enum: ['code-optimization', 'security-audit']  // Service doesn't support these
}

// ✅ GOOD: Schema enum matches service capabilities
workflow_type: {
  enum: ['new-bc-app', 'enhance-bc-app']  // Service has these pipelines
}
```

### Required vs Optional Parameters

- Only mark parameters as `required` if the handler truly needs them
- Provide sensible defaults for optional parameters
- Document what happens when optional parameters are omitted

## Service Method Contracts

### Method Naming Convention

```typescript
// Handler calls should match actual service methods
// ❌ BAD
knowledgeService.findSpecialistsByQuery()  // Method doesn't exist

// ✅ GOOD
knowledgeService.findSpecialistsByQuery()  // Method exists and works
```

### Error Handling

All service methods should:
- Return meaningful error messages
- Never throw unhandled exceptions
- Provide fallback behavior when possible

## Validation Checklist

Before every release, ensure:

- [ ] `npm run validate:contracts` passes
- [ ] All enum values in schemas have corresponding implementations
- [ ] All handler method calls point to existing service methods
- [ ] All required parameters are actually required by handlers
- [ ] Error cases are handled gracefully

## Common Pitfalls

### 1. Copy-Paste Schema Errors
```typescript
// ❌ Copied enum from another project
analysis_type: {
  enum: ['syntax', 'semantic', 'performance']  // Wrong project!
}

// ✅ Project-specific enum
analysis_type: {
  enum: ['performance', 'quality', 'security', 'patterns', 'comprehensive']
}
```

### 2. Method Name Mismatches
```typescript
// ❌ Handler assumes method name
const result = await workflowService.advanceWorkflow(params);

// ✅ Check actual service method name
const result = await workflowService.advancePhase(params);
```

### 3. Missing Service Methods
```typescript
// ❌ Calling non-existent method
const workflows = await methodologyService.findWorkflowsByQuery(query);

// ✅ Implement the method first, then call it
async findWorkflowsByQuery(query: string): Promise<Workflow[]> {
  // Implementation here
}
```

## Automated Safeguards

### Contract Validation Script
- Runs on every `npm test` (streamlined to focus on contract validation)
- Runs before every publish
- Validates enum options match implementations
- Tests basic handler execution

### CI/CD Integration
- Blocks PRs with contract violations
- Runs validation on every push
- Comments on PRs when validation fails

### Development Scripts
```bash
npm run validate:contracts  # Manual validation
npm run dev                 # Development server
npm test                    # Contract validation (streamlined)
```

## Recovery Process

If you discover a dead end:

1. **Don't panic** - this happens to everyone
2. **Identify the scope** - which tools/methods are affected?
3. **Fix implementation first** - add missing service methods
4. **Update schemas** - align with actual capabilities
5. **Validate** - run `npm run validate:contracts`
6. **Test thoroughly** - ensure no regressions
7. **Document** - update this guide if needed

## Version Management

### Schema Changes and Semver

- **Major version**: Breaking changes to tool interfaces
- **Minor version**: New tools or backward-compatible enhancements
- **Patch version**: Bug fixes and dead end corrections

### Release Checklist

- [ ] Contract validation passes
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Breaking changes documented
- [ ] Migration guide provided (if needed)

## Questions?

If you're unsure about interface/implementation alignment:
1. Run `npm run validate:contracts`
2. Check the handler logic in `src/streamlined-handlers.ts`
3. Verify the service method exists and works
4. Test with real data if possible

Remember: **It's better to under-promise and over-deliver than to promise functionality that doesn't exist.**