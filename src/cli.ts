#!/usr/bin/env node

/**
 * BC Code Intelligence CLI
 *
 * Command-line interface for direct specialist access without MCP registration.
 * Allows on-demand specialist queries, reducing context overhead.
 */

import { program } from "commander";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Import the MCP server for programmatic access
import { BCCodeIntelClient } from "./sdk/bc-code-intel-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load package.json for version
function getVersion(): string {
  try {
    const packagePath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    return packageJson.version || "1.0.0";
  } catch {
    return "1.0.0";
  }
}

/**
 * Main CLI program
 */
program
  .name("bc-code-intel")
  .description(
    "BC Code Intelligence - Direct specialist access from command line",
  )
  .version(getVersion());

/**
 * ask - Ask any BC question (auto-routes to best specialist)
 */
program
  .command("ask <question>")
  .description(
    "Ask any BC question - automatically routes to the best specialist",
  )
  .option("-c, --context <context>", "Additional context or code snippet")
  .option("-f, --code-file <file>", "Path to code file for context")
  .option("--json", "Output as JSON for scripting")
  .action(async (question, options) => {
    try {
      const client = new BCCodeIntelClient();
      await client.connect();

      // Read code file if provided
      let codeContext = options.context || "";
      if (options.codeFile) {
        const { readFileSync } = await import("fs");
        codeContext += "\\n\\n" + readFileSync(options.codeFile, "utf-8");
      }

      const result = await client.askExpert(question, {
        context: codeContext,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Formatted output
        console.log(
          `\\n💬 ${result.specialist.name} (${result.specialist.role}):\\n`,
        );
        console.log(result.response);

        if (result.recommended_topics && result.recommended_topics.length > 0) {
          console.log(`\\n📚 Related topics:`);
          result.recommended_topics.slice(0, 3).forEach((topic: any) => {
            console.log(`   - ${topic.title}`);
          });
        }

        if (
          result.follow_up_suggestions &&
          result.follow_up_suggestions.length > 0
        ) {
          console.log(`\\n🤝 For more help, consider:`);
          result.follow_up_suggestions.forEach((s: string) => {
            console.log(`   - ${s}`);
          });
        }
      }

      await client.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

/**
 * who-should-help - Find the right specialist for a question
 */
program
  .command("who-should-help <question>")
  .description("Suggest the best specialist for your question")
  .option("--json", "Output as JSON")
  .action(async (question, options) => {
    try {
      const client = new BCCodeIntelClient();
      await client.connect();

      const result = await client.suggestSpecialist(question);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`\\n🎯 Best specialist for "${question}":\\n`);
        console.log(`   ${result.specialist.emoji} ${result.specialist.name}`);
        console.log(`   Role: ${result.specialist.role}`);
        console.log(`   Expertise: ${result.specialist.expertise.join(", ")}`);

        if (result.confidence) {
          console.log(
            `   Confidence: ${(result.confidence * 100).toFixed(0)}%`,
          );
        }

        if (result.alternatives && result.alternatives.length > 0) {
          console.log(`\\n   Other options: ${result.alternatives.join(", ")}`);
        }
      }

      await client.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

/**
 * talk-to - Talk to a specific specialist
 */
program
  .command("talk-to <specialist> <question>")
  .description("Ask a question to a specific specialist")
  .option("-c, --context <context>", "Additional context")
  .option("-f, --code-file <file>", "Path to code file for context")
  .option("--json", "Output as JSON")
  .action(async (specialistId, question, options) => {
    try {
      const client = new BCCodeIntelClient();
      await client.connect();

      // Read code file if provided
      let codeContext = options.context || "";
      if (options.codeFile) {
        const { readFileSync } = await import("fs");
        codeContext += "\\n\\n" + readFileSync(options.codeFile, "utf-8");
      }

      const result = await client.getSpecialistAdvice(specialistId, question, {
        context: codeContext,
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(
          `\\n${result.specialist.emoji} ${result.specialist.name}:\\n`,
        );
        console.log(result.response);
      }

      await client.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

/**
 * specialists - List all available specialists
 */
program
  .command("specialists")
  .description("List all available BC specialists")
  .option("--json", "Output as JSON")
  .action(async (options) => {
    try {
      const client = new BCCodeIntelClient();
      await client.connect();

      const specialists = await client.discoverSpecialists();

      if (options.json) {
        console.log(JSON.stringify(specialists, null, 2));
      } else {
        console.log("\\n📋 Available BC Specialists:\\n");

        for (const specialist of specialists) {
          console.log(
            `   ${specialist.emoji} ${specialist.id.padEnd(20)} - ${specialist.name}`,
          );
          console.log(`      ${specialist.role}`);
          console.log("");
        }

        console.log(`Total: ${specialists.length} specialists\\n`);
      }

      await client.disconnect();
      process.exit(0);
    } catch (error) {
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
