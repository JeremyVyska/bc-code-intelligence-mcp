/**
 * Basic CLI smoke tests
 * Tests that don't require full server initialization
 */

import { describe, it, expect } from "vitest";
import { spawn } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLI_PATH = join(__dirname, "..", "..", "dist", "cli.js");

/**
 * Helper to run CLI command
 */
async function runCLI(
  args: string[],
  timeout = 5000,
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

    setTimeout(() => {
      proc.kill();
      resolve({ stdout, stderr, exitCode: 124 }); // timeout exit code
    }, timeout);
  });
}

describe("CLI Smoke Tests", () => {
  it("should show version", async () => {
    const result = await runCLI(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
  });

  it("should show help", async () => {
    const result = await runCLI(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("bc-code-intel");
    expect(result.stdout).toContain("ask");
    expect(result.stdout).toContain("who-should-help");
    expect(result.stdout).toContain("talk-to");
    expect(result.stdout).toContain("specialists");
  });

  it("should error on invalid command", async () => {
    const result = await runCLI(["invalid-command"]);
    expect(result.exitCode).not.toBe(0);
  });

  it("should error on missing required args", async () => {
    const result = await runCLI(["ask"]);
    expect(result.exitCode).not.toBe(0);
  });
});

describe("SDK Export Tests", () => {
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
