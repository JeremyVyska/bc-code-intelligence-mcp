# ESLint Rules for Contract Safety

This file contains custom ESLint rules to catch common interface/implementation drift patterns.

## Installation

Add these rules to your `.eslintrc.js`:

```javascript
module.exports = {
  // ... other config
  rules: {
    // Custom rules for MCP tool safety
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    
    // Prevent calling undefined methods
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    
    // Ensure proper error handling
    '@typescript-eslint/no-floating-promises': 'error',
  },
  
  // Custom rules (if we create them)
  overrides: [
    {
      files: ['**/streamlined-handlers.ts'],
      rules: {
        // Ensure all service method calls are checked
        'no-unchecked-service-calls': 'error'
      }
    },
    {
      files: ['**/streamlined-tools.ts'],
      rules: {
        // Ensure enum values are documented
        'enum-documentation-required': 'warn'
      }
    }
  ]
};
```

## Future Custom Rules

We could create custom ESLint rules to catch:

1. **Enum/Implementation Mismatches**
   ```typescript
   // Rule would detect this mismatch
   enum: ['value-not-in-service']  // ❌ Service doesn't handle this
   ```

2. **Undefined Method Calls**
   ```typescript
   // Rule would detect this
   service.methodThatDoesntExist()  // ❌ Method not defined
   ```

3. **Required Parameter Mismatches**
   ```typescript
   // Rule would detect this
   required: ['param']  // ❌ Handler doesn't actually require this
   ```

These would require custom rule development but could provide even stronger guarantees.