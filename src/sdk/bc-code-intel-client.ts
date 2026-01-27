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

    // Auto-initialize workspace info to prevent servicesInitialized intercept
    // Use current working directory as workspace root for CLI mode
    await this.client.callTool({
      name: "set_workspace_info",
      arguments: {
        workspace_root: process.cwd(),
        available_mcps: [], // CLI mode doesn't need MCP ecosystem awareness
      },
    });
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

    // Handle autonomous_action_plan response format
    if (result.response_type === "autonomous_action_plan") {
      return {
        specialist: {
          id: result.specialist.id || "unknown",
          name: result.specialist.name || "Unknown Specialist",
          role: "",
          emoji: "🤖",
          expertise: result.specialist.expertise || [],
        },
        response: result.action_plan?.primary_action || result.action_plan?.steps?.join("\\n") || "",
        recommended_topics: result.recommended_topics || [],
        follow_up_suggestions: result.action_plan?.alternatives || [],
      };
    }

    // Fallback to legacy format
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

    // Use ask_bc_expert with autonomous mode to get specialist suggestion
    const response = await this.client.callTool({
      name: "ask_bc_expert",
      arguments: {
        question,
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
        id: result.specialist_used || "unknown",
        name: result.specialist_name || "Unknown Specialist",
        role: result.specialist_role || "",
        emoji: result.specialist_emoji || "🤖",
        expertise: result.specialist_expertise || [],
        specializations: result.specialist_specializations || [],
      },
      confidence: result.routing_confidence,
      alternatives: result.alternative_specialists?.map((s: any) => s.name),
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
        preferred_specialist: specialistId,
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

    // Handle autonomous_action_plan response format
    if (result.response_type === "autonomous_action_plan") {
      return {
        specialist: {
          id: result.specialist.id || specialistId,
          name: result.specialist.name || "Unknown Specialist",
          role: "",
          emoji: "🤖",
          expertise: result.specialist.expertise || [],
        },
        response: result.action_plan?.primary_action || result.action_plan?.steps?.join("\\n") || "",
        recommended_topics: result.recommended_topics || [],
        follow_up_suggestions: result.action_plan?.alternatives || [],
      };
    }

    // Fallback to legacy format
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
   * Note: Returns simplified info. Use list_specialists tool directly for full details.
   */
  async discoverSpecialists(query?: string): Promise<SpecialistInfo[]> {
    if (!this.client) {
      throw new Error("Client not connected. Call connect() first.");
    }

    const response = await this.client.callTool({
      name: "list_specialists",
      arguments: {
        expertise: query, // Filter by expertise if provided
      },
    });

    if (response.isError) {
      throw new Error(response.content[0]?.text || "Unknown error");
    }

    // list_specialists returns markdown, so we parse specialist IDs from the text
    const markdownText = response.content[0]?.text || "";
    const specialists: SpecialistInfo[] = [];
    
    // Extract specialist info from markdown using regex
    // Format: **Title** (`specialist-id`)
    const regex = /\*\*(.+?)\*\*\s*\(`([^`]+)`\)/g;
    let match;
    
    while ((match = regex.exec(markdownText)) !== null) {
      specialists.push({
        id: match[2],
        name: match[1],
        role: "", // Not available in list format
        emoji: "🤖",
        expertise: [],
      });
    }

    return specialists;
  }
}
