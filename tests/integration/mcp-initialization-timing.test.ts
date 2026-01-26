/**
 * MCP Server Initialization Performance Tests
 *
 * Tests for Issue #31 - ensures MCP handshake completes quickly
 * before heavy knowledge loading
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "child_process";
import { join } from "path";
import { setTimeout as sleep } from "timers/promises";

describe("MCP Server Initialization Performance (Issue #31)", () => {
  const projectRoot = join(__dirname, "../../");
  const serverPath = join(projectRoot, "dist/index.js");
  const timeout = 10000; // 10 second timeout (well under 60 seconds)

  // Helper to start server and measure initialization
  async function startServerAndMeasure(): Promise<{
    handshakeTime: number;
    fullStartupTime: number;
    success: boolean;
    error?: string;
  }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let handshakeTime = 0;
      let fullStartupTime = 0;

      const proc = spawn("node", [serverPath], {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: projectRoot,
      });

      let stderrOutput = "";
      let handshakeDetected = false;
      let fullStartupDetected = false;

      proc.stderr.on("data", (data) => {
        const output = data.toString();
        stderrOutput += output;

        // Detect MCP handshake completion
        if (!handshakeDetected && output.includes("MCP transport connected")) {
          handshakeTime = Date.now() - startTime;
          handshakeDetected = true;
        }

        // Detect full startup completion
        if (!fullStartupDetected && output.includes("started successfully")) {
          fullStartupTime = Date.now() - startTime;
          fullStartupDetected = true;

          // Clean shutdown after successful start
          proc.kill("SIGTERM");

          setTimeout(() => {
            resolve({
              handshakeTime,
              fullStartupTime,
              success: true,
            });
          }, 100);
        }
      });

      proc.on("error", (error) => {
        resolve({
          handshakeTime: 0,
          fullStartupTime: 0,
          success: false,
          error: error.message,
        });
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!fullStartupDetected) {
          proc.kill("SIGKILL");
          resolve({
            handshakeTime,
            fullStartupTime: 0,
            success: false,
            error: `Timeout after 10s. Handshake: ${handshakeDetected ? "yes" : "no"}. Output: ${stderrOutput.slice(-500)}`,
          });
        }
      }, timeout);
    });
  }

  describe("Handshake timing", () => {
    it(
      "should complete MCP handshake in under 5 seconds",
      async () => {
        const result = await startServerAndMeasure();

        expect(result.success).toBe(true);
        expect(result.handshakeTime).toBeGreaterThan(0);
        expect(result.handshakeTime).toBeLessThan(5000); // 5 second limit
      },
      timeout,
    );

    it(
      "should complete MCP handshake before heavy initialization",
      async () => {
        const result = await startServerAndMeasure();

        expect(result.success).toBe(true);
        expect(result.handshakeTime).toBeGreaterThan(0);
        expect(result.fullStartupTime).toBeGreaterThan(result.handshakeTime);

        // Handshake should be much faster than full startup
        const ratio = result.fullStartupTime / result.handshakeTime;
        expect(ratio).toBeGreaterThan(2); // At least 2x faster
      },
      timeout,
    );

    it(
      "should not timeout during initialization (Windsurf issue)",
      async () => {
        const result = await startServerAndMeasure();

        if (!result.success) {
          console.error("Initialization failed:", result.error);
        }

        expect(result.success).toBe(true);
        expect(result.fullStartupTime).toBeLessThan(timeout);
      },
      timeout,
    );
  });

  describe("Startup sequence", () => {
    it(
      "should log transport connection before service initialization",
      async () => {
        return new Promise((resolve) => {
          const proc = spawn("node", [serverPath], {
            stdio: ["pipe", "pipe", "pipe"],
            cwd: projectRoot,
          });

          let stderrOutput = "";
          const events: string[] = [];

          proc.stderr.on("data", (data) => {
            const output = data.toString();
            stderrOutput += output;

            if (output.includes("Connecting MCP transport")) {
              events.push("transport_connecting");
            }
            if (output.includes("MCP transport connected")) {
              events.push("transport_connected");
            }
            if (output.includes("Starting service initialization")) {
              events.push("services_initializing");
            }
            if (output.includes("started successfully")) {
              events.push("startup_complete");
              proc.kill("SIGTERM");

              // Verify order: connect transport BEFORE initializing services
              setTimeout(() => {
                const connectIdx = events.indexOf("transport_connected");
                const initIdx = events.indexOf("services_initializing");

                expect(connectIdx).toBeGreaterThan(-1);
                expect(initIdx).toBeGreaterThan(-1);
                expect(connectIdx).toBeLessThan(initIdx); // Connect before init

                resolve(undefined);
              }, 100);
            }
          });

          setTimeout(() => {
            if (!events.includes("startup_complete")) {
              proc.kill("SIGKILL");
              expect.fail(
                `Timeout. Events: ${events.join(" -> ")}. Last output: ${stderrOutput.slice(-300)}`,
              );
            }
          }, timeout);
        });
      },
      timeout,
    );
  });
});
