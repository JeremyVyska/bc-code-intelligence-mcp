import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/tools/**/*.test.ts',
      'tests/services/**/*.test.ts'
    ],
    exclude: [
      'tests/integration/**',
      'tests/prompt-validation/**',
      'node_modules/**',
      'dist/**'
    ],
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
