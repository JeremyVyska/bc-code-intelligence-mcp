/**
 * BC Code Intelligence SDK Client
 *
 * Programmatic access to BC specialists without MCP registration.
 * Provides methods for CLI and other programmatic use cases.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface AskExpertOptions {
  context?: string;
  bcVersion?: string;
  format?: "detailed" | "concise";
}

export interface SpecialistAdviceOptions {
  context?: string;
  bcVersion?: string;
}

export interface SpecialistInfo {
  id: string;
  name: string;
  role: string;
  emoji: string;
  expertise: string[];
  specializations?: string[];
}

export interface AskExpertResult {
  specialist: SpecialistInfo;
  response: string;
  recommended_topics?: Array<{
    title: string;
    path: string;
    relevance: number;
  }>;
  follow_up_suggestions?: string[];
}

export interface SpecialistSuggestion {
  specialist: SpecialistInfo;
  confidence?: number;
  alternatives?: string[];
}

/**
 * BCCodeIntelClient - Programmatic access to BC specialists
 */
export class BCCodeIntelClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  /**
   * Connect to the BC Code Intel MCP server
   */
  async connect(): Promise<void> {
    // Spawn the MCP server as a child process
    const serverPath = join(__dirname, "..", "index.js");

    // Create MCP client
    this.client = new Client(
      {
        name: "bc-code-intel-cli",
        version: "1.0.0",
      },
      {
        capabilities: {},
      },
    );

    // Create stdio transport using the server process stdio streams
    this.transport = new StdioClientTransport({
      command: "node",
      args: [serverPath],
      env: { ...process.env, MCP_SERVER_MODE: "stdio" },
    });

    // Connect
    await this.client.connect(this.transport);
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }

  /**
   * Ask any BC question - auto-routes to best specialist
   */
  async askExpert(
    question: string,
    options: AskExpertOptions = {},
  ): Promise<AskExpertResult> {
    if (!this.client) {
      throw new Error("Client not connected. Call connect() first.");
    }

    const response = await this.client.callTool({
      name: "ask_bc_expert",
      arguments: {
        question,
        context: options.context || "",
        bc_version: options.bcVersion,
        autonomous_mode: true, // Get full structured response
      },
    });

    if (response.isError) {
      throw new Error(response.content[0]?.text || "Unknown error");
    }

    // Parse the response
    const resultText = response.content[0]?.text || "{}";
    const result = JSON.parse(resultText);

    return {
      specialist: {
        id: result.specialist_used || "unknown",
        name: result.specialist_name || "Unknown Specialist",
        role: result.specialist_role || "",
        emoji: result.specialist_emoji || "🤖",
        expertise: result.specialist_expertise || [],
      },
      response: result.response || result.answer || "",
      recommended_topics: result.recommended_topics || [],
      follow_up_suggestions: result.follow_up_suggestions || [],
    };
  }

  /**
   * Suggest the best specialist for a question
   */
  async suggestSpecialist(question: string): Promise<SpecialistSuggestion> {
    if (!this.client) {
      throw new Error("Client not connected. Call connect() first.");
    }

    const response = await this.client.callTool({
      name: "discover_specialists",
      arguments: {
        query: question,
      },
    });

    if (response.isError) {
      throw new Error(response.content[0]?.text || "Unknown error");
    }

    const resultText = response.content[0]?.text || "{}";
    const result = JSON.parse(resultText);

    if (!result.specialists || result.specialists.length === 0) {
      throw new Error("No specialists found for this question");
    }

    const topSpecialist = result.specialists[0];
    const alternatives = result.specialists.slice(1, 4).map((s: any) => s.name);

    return {
      specialist: {
        id: topSpecialist.id,
        name: topSpecialist.name,
        role: topSpecialist.role,
        emoji: topSpecialist.emoji || "🤖",
        expertise: topSpecialist.expertise || [],
        specializations: topSpecialist.specializations || [],
      },
      confidence: topSpecialist.relevance_score,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
    };
  }

  /**
   * Get advice from a specific specialist
   */
  async getSpecialistAdvice(
    specialistId: string,
    question: string,
    options: SpecialistAdviceOptions = {},
  ): Promise<AskExpertResult> {
    if (!this.client) {
      throw new Error("Client not connected. Call connect() first.");
    }

    const response = await this.client.callTool({
      name: "ask_bc_expert",
      arguments: {
        question,
        specialist_id: specialistId,
        context: options.context || "",
        bc_version: options.bcVersion,
        autonomous_mode: true,
      },
    });

    if (response.isError) {
      throw new Error(response.content[0]?.text || "Unknown error");
    }

    const resultText = response.content[0]?.text || "{}";
    const result = JSON.parse(resultText);

    return {
      specialist: {
        id: result.specialist_used || specialistId,
        name: result.specialist_name || "Unknown Specialist",
        role: result.specialist_role || "",
        emoji: result.specialist_emoji || "🤖",
        expertise: result.specialist_expertise || [],
      },
      response: result.response || result.answer || "",
      recommended_topics: result.recommended_topics || [],
      follow_up_suggestions: result.follow_up_suggestions || [],
    };
  }

  /**
   * Discover all available specialists
   */
  async discoverSpecialists(query?: string): Promise<SpecialistInfo[]> {
    if (!this.client) {
      throw new Error("Client not connected. Call connect() first.");
    }

    const response = await this.client.callTool({
      name: "discover_specialists",
      arguments: {
        query: query || "*", // Use wildcard to get all specialists
      },
    });

    if (response.isError) {
      throw new Error(response.content[0]?.text || "Unknown error");
    }

    const resultText = response.content[0]?.text || "{}";
    const result = JSON.parse(resultText);

    if (!result.specialists) {
      return [];
    }

    return result.specialists.map((s: any) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      emoji: s.emoji || "🤖",
      expertise: s.expertise || [],
      specializations: s.specializations || [],
    }));
  }
}
