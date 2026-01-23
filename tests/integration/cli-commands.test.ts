/**
 * Integration tests for CLI commands
 * Tests the bc-code-intel CLI for direct specialist access
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, '..', '..', 'dist', 'cli.js');
const TIMEOUT = 30000; // 30 seconds for CLI operations

/**
 * Helper to run CLI command and capture output
 */
async function runCLI(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('node', [CLI_PATH, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code || 0,
      });
    });

    // Timeout safety
    setTimeout(() => {
      proc.kill();
      resolve({
        stdout,
        stderr,
        exitCode: 1,
      });
    }, TIMEOUT);
  });
}

describe('CLI Commands - Integration Tests', () => {
  describe('bc-code-intel specialists', () => {
    it('should list all available specialists', async () => {
      const result = await runCLI(['specialists']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Available BC Specialists');
      expect(result.stdout).toMatch(/sam-coder.*Sam the Coder/);
      expect(result.stdout).toMatch(/alex-architect.*Alex the Architect/);
      expect(result.stdout).toContain('Total:');
    }, TIMEOUT);

    it('should output specialists as JSON', async () => {
      const result = await runCLI(['specialists', '--json']);

      expect(result.exitCode).toBe(0);
      
      const specialists = JSON.parse(result.stdout);
      expect(Array.isArray(specialists)).toBe(true);
      expect(specialists.length).toBeGreaterThan(0);
      
      const samCoder = specialists.find((s: any) => s.id === 'sam-coder');
      expect(samCoder).toBeDefined();
      expect(samCoder.name).toContain('Sam');
      expect(samCoder.role).toBeDefined();
      expect(samCoder.expertise).toBeDefined();
    }, TIMEOUT);
  });

  describe('bc-code-intel who-should-help', () => {
    it('should suggest the right specialist for a BC table question', async () => {
      const result = await runCLI(['who-should-help', 'How do I create a new BC table?']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Best specialist for.*table/i);
      expect(result.stdout).toContain('Role:');
      expect(result.stdout).toContain('Expertise:');
    }, TIMEOUT);

    it('should output specialist suggestion as JSON', async () => {
      const result = await runCLI(['who-should-help', 'Performance optimization tips', '--json']);

      expect(result.exitCode).toBe(0);
      
      const suggestion = JSON.parse(result.stdout);
      expect(suggestion.specialist).toBeDefined();
      expect(suggestion.specialist.id).toBeDefined();
      expect(suggestion.specialist.name).toBeDefined();
      expect(suggestion.specialist.role).toBeDefined();
    }, TIMEOUT);
  });

  describe('bc-code-intel ask', () => {
    it('should answer a BC question with auto-routing', async () => {
      const result = await runCLI(['ask', 'What is a BC table?']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/.*\(.*\):/); // Specialist name and role
      expect(result.stdout.length).toBeGreaterThan(50); // Has meaningful response
    }, TIMEOUT);

    it('should provide JSON output for scripting', async () => {
      const result = await runCLI(['ask', 'What is BC?', '--json']);

      expect(result.exitCode).toBe(0);
      
      const response = JSON.parse(result.stdout);
      expect(response.specialist).toBeDefined();
      expect(response.response).toBeDefined();
      expect(response.specialist.id).toBeDefined();
      expect(response.specialist.name).toBeDefined();
    }, TIMEOUT);

    it('should accept context via --context flag', async () => {
      const result = await runCLI([
        'ask',
        'Is this code optimized?',
        '--context',
        'trigger OnAfterInsert() begin Message(\'Test\'); end;',
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('('); // Has specialist response
    }, TIMEOUT);
  });

  describe('bc-code-intel talk-to', () => {
    it('should talk to a specific specialist', async () => {
      const result = await runCLI(['talk-to', 'sam-coder', 'How do I write a trigger?']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/Sam.*Coder/i);
      expect(result.stdout.length).toBeGreaterThan(50);
    }, TIMEOUT);

    it('should output talk-to response as JSON', async () => {
      const result = await runCLI(['talk-to', 'alex-architect', 'Design patterns?', '--json']);

      expect(result.exitCode).toBe(0);
      
      const response = JSON.parse(result.stdout);
      expect(response.specialist).toBeDefined();
      expect(response.specialist.id).toBe('alex-architect');
      expect(response.response).toBeDefined();
    }, TIMEOUT);

    it('should handle unknown specialist gracefully', async () => {
      const result = await runCLI(['talk-to', 'unknown-specialist', 'test question']);

      // Should either error or handle gracefully
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      // If it errors, should have meaningful error message
      if (result.exitCode !== 0) {
        expect(result.stderr || result.stdout).toMatch(/error|not found|unknown/i);
      }
    }, TIMEOUT);
  });

  describe('CLI Usage and Help', () => {
    it('should show version with --version', async () => {
      const result = await runCLI(['--version']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    }, TIMEOUT);

    it('should show help with --help', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('bc-code-intel');
      expect(result.stdout).toContain('ask');
      expect(result.stdout).toContain('who-should-help');
      expect(result.stdout).toContain('talk-to');
      expect(result.stdout).toContain('specialists');
    }, TIMEOUT);
  });

  describe('Error Handling', () => {
    it('should handle invalid command gracefully', async () => {
      const result = await runCLI(['invalid-command']);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toMatch(/error|unknown|invalid/i);
    }, TIMEOUT);

    it('should handle missing required arguments', async () => {
      const result = await runCLI(['ask']); // Missing question

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr || result.stdout).toMatch(/error|required|missing/i);
    }, TIMEOUT);
  });
});

describe('BC Code Intel SDK Client', () => {
  // These tests verify the SDK can be used programmatically
  it('should export BCCodeIntelClient', async () => {
    const { BCCodeIntelClient } = await import('../../src/sdk/bc-code-intel-client.js');
    expect(BCCodeIntelClient).toBeDefined();
    expect(typeof BCCodeIntelClient).toBe('function');
  });

  it('should have required SDK methods', async () => {
    const { BCCodeIntelClient } = await import('../../src/sdk/bc-code-intel-client.js');
    const client = new BCCodeIntelClient();
    
    expect(typeof client.connect).toBe('function');
    expect(typeof client.disconnect).toBe('function');
    expect(typeof client.askExpert).toBe('function');
    expect(typeof client.suggestSpecialist).toBe('function');
    expect(typeof client.getSpecialistAdvice).toBe('function');
    expect(typeof client.discoverSpecialists).toBe('function');
  });
});
