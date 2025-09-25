import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/integration/**/*.test.ts'
    ],
    exclude: [
      'tests/unit/**',
      'tests/tools/**',
      'tests/services/**',
      'tests/prompt-validation/**',
      'node_modules/**',
      'dist/**'
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Integration tests often need more setup time
    setupFiles: ['./tests/integration/setup.ts']
  }
});
