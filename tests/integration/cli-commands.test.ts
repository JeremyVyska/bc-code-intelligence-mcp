/**
 * Integration tests for CLI commands
 * Tests the bc-code-intel CLI for direct specialist access
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, "..", "..", "dist", "cli.js");
const TIMEOUT = 30000; // 30 seconds for CLI operations

/**
 * Helper to run CLI command and capture output
 */
async function runCLI(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn("node", [CLI_PATH, ...args], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
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

describe("CLI Commands - Integration Tests", () => {
  describe("bc-code-intel specialists", () => {
    it(
      "should list all available specialists",
      async () => {
        const result = await runCLI(["specialists"]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("Available BC Specialists");
        // Check for any specialist ID format
        expect(result.stdout).toMatch(/sam-coder|alex-architect|quinn-tester/);
        expect(result.stdout).toMatch(/Sam|Alex|Quinn/);
      },
      TIMEOUT,
    );

    it(
      "should output specialists as JSON",
      async () => {
        const result = await runCLI(["specialists", "--json"]);

        expect(result.exitCode).toBe(0);

        const specialists = JSON.parse(result.stdout);
        expect(Array.isArray(specialists)).toBe(true);
        expect(specialists.length).toBeGreaterThan(0);

        const samCoder = specialists.find((s: any) => s.id === "sam-coder");
        expect(samCoder).toBeDefined();
        expect(samCoder.name).toContain("Sam");
        expect(samCoder.role).toBeDefined();
        expect(samCoder.expertise).toBeDefined();
      },
      TIMEOUT,
    );
  });

  describe("bc-code-intel who-should-help", () => {
    it(
      "should suggest the right specialist for a BC table question",
      async () => {
        const result = await runCLI([
          "who-should-help",
          "How do I create a new BC table?",
        ]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/Best specialist for.*table/i);
        expect(result.stdout).toContain("Role:");
        expect(result.stdout).toContain("Expertise:");
      },
      TIMEOUT,
    );

    it(
      "should output specialist suggestion as JSON",
      async () => {
        const result = await runCLI([
          "who-should-help",
          "Performance optimization tips",
          "--json",
        ]);

        expect(result.exitCode).toBe(0);

        const suggestion = JSON.parse(result.stdout);
        expect(suggestion.specialist).toBeDefined();
        expect(suggestion.specialist.id).toBeDefined();
        expect(suggestion.specialist.name).toBeDefined();
        expect(suggestion.specialist.role).toBeDefined();
      },
      TIMEOUT,
    );
  });

  describe("bc-code-intel ask", () => {
    it(
      "should answer a BC question with auto-routing",
      async () => {
        const result = await runCLI(["ask", "What is a BC table?"]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/.*\(.*\):/); // Specialist name and role
        expect(result.stdout.length).toBeGreaterThan(50); // Has meaningful response
      },
      TIMEOUT,
    );

    it(
      "should provide JSON output for scripting",
      async () => {
        const result = await runCLI(["ask", "What is BC?", "--json"]);

        expect(result.exitCode).toBe(0);

        const response = JSON.parse(result.stdout);
        expect(response.specialist).toBeDefined();
        expect(response.response).toBeDefined();
        expect(response.specialist.id).toBeDefined();
        expect(response.specialist.name).toBeDefined();
      },
      TIMEOUT,
    );

    it(
      "should accept context via --context flag",
      async () => {
        const result = await runCLI([
          "ask",
          "Is this code optimized?",
          "--context",
          "trigger OnAfterInsert() begin Message('Test'); end;",
        ]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("("); // Has specialist response
      },
      TIMEOUT,
    );
  });

  describe("bc-code-intel talk-to", () => {
    it(
      "should talk to a specific specialist",
      async () => {
        const result = await runCLI([
          "talk-to",
          "sam-coder",
          "How do I write a trigger?",
        ]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/Sam.*Coder/i);
        expect(result.stdout.length).toBeGreaterThan(50);
      },
      TIMEOUT,
    );

    it(
      "should output talk-to response as JSON",
      async () => {
        const result = await runCLI([
          "talk-to",
          "alex-architect",
          "Design patterns?",
          "--json",
        ]);

        expect(result.exitCode).toBe(0);

        const response = JSON.parse(result.stdout);
        expect(response.specialist).toBeDefined();
        expect(response.specialist.id).toBe("alex-architect");
        expect(response.response).toBeDefined();
      },
      TIMEOUT,
    );

    it(
      "should handle unknown specialist gracefully",
      async () => {
        const result = await runCLI([
          "talk-to",
          "unknown-specialist",
          "test question",
        ]);

        // Should either error or handle gracefully
        expect(result.exitCode).toBeGreaterThanOrEqual(0);
        // If it errors, should have meaningful error message
        if (result.exitCode !== 0) {
          expect(result.stderr || result.stdout).toMatch(
            /error|not found|unknown/i,
          );
        }
      },
      TIMEOUT,
    );
  });

  describe("CLI Usage and Help", () => {
    it(
      "should show version with --version",
      async () => {
        const result = await runCLI(["--version"]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
      },
      TIMEOUT,
    );

    it(
      "should show help with --help",
      async () => {
        const result = await runCLI(["--help"]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("bc-code-intel");
        expect(result.stdout).toContain("ask");
        expect(result.stdout).toContain("who-should-help");
        expect(result.stdout).toContain("talk-to");
        expect(result.stdout).toContain("specialists");
      },
      TIMEOUT,
    );
  });

  describe("Error Handling", () => {
    it(
      "should handle invalid command gracefully",
      async () => {
        const result = await runCLI(["invalid-command"]);

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr || result.stdout).toMatch(
          /error|unknown|invalid/i,
        );
      },
      TIMEOUT,
    );

    it(
      "should handle missing required arguments",
      async () => {
        const result = await runCLI(["ask"]); // Missing question

        expect(result.exitCode).not.toBe(0);
        expect(result.stderr || result.stdout).toMatch(
          /error|required|missing/i,
        );
      },
      TIMEOUT,
    );
  });

  describe("Issue #33 Regression Tests - JSON Parse Error Prevention", () => {
    it(
      "should NOT crash with JSON parse error on 'ask' command",
      async () => {
        const result = await runCLI(["ask", "What is a FlowField?"]);

        // The bug was: "Error: Unexpected token '⚠', \"⚠️ **Works\"... is not valid JSON"
        expect(result.exitCode).toBe(0);
        expect(result.stderr).not.toContain("Unexpected token");
        expect(result.stderr).not.toContain("is not valid JSON");
        expect(result.stderr).not.toContain("JSON.parse");
      },
      TIMEOUT,
    );

    it(
      "should NOT crash with JSON parse error on 'specialists' command",
      async () => {
        const result = await runCLI(["specialists"]);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).not.toContain("Unexpected token");
        expect(result.stderr).not.toContain("is not valid JSON");
      },
      TIMEOUT,
    );

    it(
      "should NOT crash with JSON parse error on 'who-should-help' command",
      async () => {
        const result = await runCLI(["who-should-help", "How do I optimize code?"]);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).not.toContain("Unexpected token");
        expect(result.stderr).not.toContain("is not valid JSON");
      },
      TIMEOUT,
    );

    it(
      "should NOT crash with JSON parse error on 'talk-to' command",
      async () => {
        const result = await runCLI(["talk-to", "sam-coder", "Help with caching"]);

        expect(result.exitCode).toBe(0);
        expect(result.stderr).not.toContain("Unexpected token");
        expect(result.stderr).not.toContain("is not valid JSON");
      },
      TIMEOUT,
    );

    it(
      "should return valid JSON when --json flag is used on 'ask' command",
      async () => {
        const result = await runCLI(["ask", "What is a FlowField?", "--json"]);

        expect(result.exitCode).toBe(0);
        
        // Should be parseable JSON
        let parsed: any;
        expect(() => {
          parsed = JSON.parse(result.stdout);
        }).not.toThrow();

        // Ensure parsed is defined
        expect(parsed).toBeDefined();

        // Should have expected structure
        expect(parsed).toHaveProperty("specialist");
        expect(parsed).toHaveProperty("response");
        expect(parsed.specialist).toHaveProperty("id");
        expect(parsed.specialist.id).not.toBe("unknown"); // Should actually route
      },
      TIMEOUT,
    );

    it(
      "should NOT return markdown warning messages in responses",
      async () => {
        const result = await runCLI(["ask", "What is a FlowField?", "--json"]);

        expect(result.exitCode).toBe(0);
        
        const parsed = JSON.parse(result.stdout);
        
        // The bug was returning "⚠️ **Workspace Not Configured**" markdown
        expect(parsed.response).not.toContain("⚠️");
        expect(parsed.response).not.toContain("**Workspace Not Configured**");
        expect(parsed.response).not.toContain("set_workspace_info");
        expect(parsed.response).not.toContain("available_mcps");
      },
      TIMEOUT,
    );

    it(
      "should have workspace initialized automatically (no manual set_workspace_info needed)",
      async () => {
        // This is the core fix: connect() should auto-call set_workspace_info
        const result = await runCLI(["ask", "test question", "--json"]);

        expect(result.exitCode).toBe(0);
        
        const parsed = JSON.parse(result.stdout);
        
        // If workspace wasn't initialized, we'd get the warning message
        // Instead we should get actual specialist response
        expect(parsed.specialist.id).toBeTruthy();
        expect(parsed.specialist.name).toBeTruthy();
        expect(parsed.response).toBeTruthy();
      },
      TIMEOUT,
    );
  });
});

describe("BC Code Intel SDK Client", () => {
  // These tests verify the SDK can be used programmatically
  it("should export BCCodeIntelClient", async () => {
    const { BCCodeIntelClient } = await import(
      "../../src/sdk/bc-code-intel-client.js"
    );
    expect(BCCodeIntelClient).toBeDefined();
    expect(typeof BCCodeIntelClient).toBe("function");
  });

  it("should have required SDK methods", async () => {
    const { BCCodeIntelClient } = await import(
      "../../src/sdk/bc-code-intel-client.js"
    );
    const client = new BCCodeIntelClient();

    expect(typeof client.connect).toBe("function");
    expect(typeof client.disconnect).toBe("function");
    expect(typeof client.askExpert).toBe("function");
    expect(typeof client.suggestSpecialist).toBe("function");
    expect(typeof client.getSpecialistAdvice).toBe("function");
    expect(typeof client.discoverSpecialists).toBe("function");
  });
});
