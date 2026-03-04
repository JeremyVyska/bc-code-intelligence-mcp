import { describe, it, expect } from "vitest";
import { EmbeddedKnowledgeLayer } from "../../src/layers/embedded-layer.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

describe("Victor Topic Loading", () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const embeddedPath = join(__dirname, "../../embedded-knowledge");

  it("should normalize Victor topic IDs correctly", () => {
    const layer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    // Simulate a Victor file path
    const victorFile = join(embeddedPath, "domains/victor-versioning/bc25-to-bc26/whse-post-shipment.md");
    
    // Call the protected normalizeTopicId method (we'll need to expose it or test via reflection)
    const topicId = (layer as any).normalizeTopicId(victorFile, embeddedPath);
    
    console.log("Generated topic ID:", topicId);
    console.log("File path:", victorFile);
    console.log("Embedded path:", embeddedPath);
    
    expect(topicId).toBeTruthy();
    expect(topicId).not.toBe("");
    expect(topicId).toBe("victor-versioning/bc25-to-bc26/whse-post-shipment");
  });

  it("should validate Victor topic structure correctly", () => {
    const layer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    // Simulate a Victor topic structure
    const victorTopic = {
      id: "victor-versioning/bc25-to-bc26/whse-post-shipment",
      title: "Whse.-Post Shipment - 72 Obsoletions",
      filePath: join(embeddedPath, "domains/victor-versioning/bc25-to-bc26/whse-post-shipment.md"),
      frontmatter: {
        title: "Whse.-Post Shipment - 72 Obsoletions",
        domain: "victor-versioning",
        difficulty: "intermediate" as const,
        migration_type: "obsoletion",
        bc_versions: "24->25",
        urgency: "deprecation-warning",
        tags: ["bc25-migration", "breaking-change", "obsoletion", "codeunit"],
      },
      content: "# Whse.-Post Shipment - 72 Obsoletions\n\nTest content",
      wordCount: 5,
      lastModified: new Date(),
    };
    
    // Call the protected validateTopic method
    const isValid = (layer as any).validateTopic(victorTopic);
    
    console.log("Topic validation result:", isValid);
    console.log("Validation checks:");
    console.log("  - id:", !!victorTopic.id);
    console.log("  - frontmatter.title:", !!victorTopic.frontmatter?.title);
    console.log("  - frontmatter.domain:", !!victorTopic.frontmatter?.domain);
    console.log("  - content:", !!victorTopic.content);
    
    expect(isValid).toBe(true);
  });

  it("should load actual Victor topic from filesystem", async () => {
    const layer = new EmbeddedKnowledgeLayer(embeddedPath);
    
    const victorFile = join(embeddedPath, "domains/victor-versioning/bc16-to-bc17/acc-payables-activities.md");
    
    try {
      // Call the private loadAtomicTopic method
      const topic = await (layer as any).loadAtomicTopic(victorFile);
      
      console.log("Loaded topic:", topic ? {
        id: topic.id,
        title: topic.title,
        domain: topic.frontmatter?.domain,
        hasContent: !!topic.content,
      } : null);
      
      expect(topic).toBeTruthy();
      if (topic) {
        expect(topic.id).toBeTruthy();
        expect(topic.frontmatter?.title).toBeTruthy();
        expect(topic.frontmatter?.domain).toBeTruthy();
        expect(topic.content).toBeTruthy();
        
        // Test validation
        const isValid = (layer as any).validateTopic(topic);
        console.log("Topic passes validation:", isValid);
        expect(isValid).toBe(true);
      }
    } catch (error) {
      console.error("Failed to load Victor topic:", error);
      throw error;
    }
  });
});
