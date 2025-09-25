import { beforeAll } from 'vitest';

/**
 * Integration Test Setup
 * 
 * Sets up environment for integration tests that test the full MCP server
 */

beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Disable logging during tests
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
  
  // Set up test data paths
  process.env.BC_CODE_INTEL_TEST_MODE = 'true';
});
