/**
 * scaffold_layer_repo Tool - Handler Implementation
 *
 * Creates the folder structure and template files for a new knowledge layer.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface ScaffoldArgs {
  path: string;
  layer_type: 'company' | 'team' | 'project';
  layer_name: string;
  include_examples?: boolean;
}

export function createScaffoldLayerRepoHandler() {
  return async (args: ScaffoldArgs): Promise<CallToolResult> => {
    const { path: layerPath, layer_type, layer_name, include_examples = true } = args;

    if (!layerPath || !layer_type || !layer_name) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'path, layer_type, and layer_name are required parameters'
          }, null, 2)
        }]
      };
    }

    const createdFiles: string[] = [];
    const createdDirs: string[] = [];

    try {
      // Create main directories
      const dirs = ['specialists', 'domains', 'prompts', 'indexes'];
      for (const dir of dirs) {
        const dirPath = path.join(layerPath, dir);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
          createdDirs.push(dir);
        }
      }

      // Create layer-config.yaml
      const layerConfig = {
        name: layer_name,
        type: layer_type,
        priority: layer_type === 'company' ? 20 : layer_type === 'team' ? 100 : 500,
        description: `${layer_name} knowledge layer`,
        version: '1.0.0'
      };

      const configPath = path.join(layerPath, 'layer-config.yaml');
      fs.writeFileSync(configPath, yaml.stringify(layerConfig));
      createdFiles.push('layer-config.yaml');

      // Create README.md
      const readme = generateReadme(layer_type, layer_name);
      fs.writeFileSync(path.join(layerPath, 'README.md'), readme);
      createdFiles.push('README.md');

      // Create template files
      createdFiles.push(...createTemplates(layerPath));

      // Create example content if requested
      if (include_examples) {
        createdFiles.push(...createExamples(layerPath, layer_type, layer_name));
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            path: layerPath,
            created_directories: createdDirs,
            created_files: createdFiles,
            next_steps: [
              'Review and customize layer-config.yaml',
              'Add your specialists to specialists/',
              'Add knowledge topics to domains/',
              'Add workflow prompts to prompts/',
              include_examples ? 'Review and customize the example files' : 'Use the _template.md files as guides'
            ]
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
            created_directories: createdDirs,
            created_files: createdFiles
          }, null, 2)
        }]
      };
    }
  };
}

function createTemplates(layerPath: string): string[] {
  const created: string[] = [];

  // Specialist template
  const specialistTemplate = `---
title: "Specialist Name - Role Title"
specialist_id: "specialist-id"
emoji: "🔧"
role: "Your Role Description"
team: "Development"  # or "Quality & Testing", "Planning & Analysis", "Integration & Business"

persona:
  personality: ["trait1", "trait2", "trait3"]
  communication_style: "Your communication style description"
  greeting: "🔧 Hello! Your greeting here."

expertise:
  primary: ["primary-skill-1", "primary-skill-2"]
  secondary: ["secondary-skill-1", "secondary-skill-2"]

domains:
  - "relevant-domain-1"
  - "relevant-domain-2"

when_to_use:
  - "Situation 1 when to consult this specialist"
  - "Situation 2 when to consult this specialist"

collaboration:
  natural_handoffs:
    - "specialist-id-1"
    - "specialist-id-2"
  team_consultations:
    - "specialist-id-3"

related_specialists:
  - "specialist-id-1"
  - "specialist-id-2"
---

# Specialist Name - Role Title 🔧

Your specialist's system prompt goes here. This content will be used as the chat mode system prompt.

## What I Help With

- Area of expertise 1
- Area of expertise 2

## My Approach

Describe how this specialist approaches problems.
`;

  fs.writeFileSync(path.join(layerPath, 'specialists', '_template.md'), specialistTemplate);
  created.push('specialists/_template.md');

  // Domain topic template
  const topicTemplate = `---
title: "Topic Title"
topic_id: "topic-id"
tags: ["tag1", "tag2", "tag3"]
specialists: ["relevant-specialist-id"]
bc_versions: ["BC22+"]
difficulty: "intermediate"  # beginner, intermediate, advanced
---

# Topic Title

## Overview

Brief description of this topic and why it matters.

## Key Concepts

### Concept 1

Explanation of the first key concept.

### Concept 2

Explanation of the second key concept.

## Best Practices

1. **Practice 1**: Description
2. **Practice 2**: Description

## Code Examples

\`\`\`al
// Example AL code demonstrating this topic
procedure ExampleProcedure()
begin
    // Your code here
end;
\`\`\`

## Common Pitfalls

- Pitfall 1 and how to avoid it
- Pitfall 2 and how to avoid it

## Related Topics

- [[related-topic-1]]
- [[related-topic-2]]
`;

  // Create domains subdirectory for organization
  const domainsPath = path.join(layerPath, 'domains', 'your-domain');
  if (!fs.existsSync(domainsPath)) {
    fs.mkdirSync(domainsPath, { recursive: true });
  }
  fs.writeFileSync(path.join(domainsPath, '_template.md'), topicTemplate);
  created.push('domains/your-domain/_template.md');

  // Prompt template
  const promptTemplate = `---
title: "Workflow Name"
prompt_id: "workflow-id"
type: "workflow"  # or "quick-action", "template"
phases: 3
specialists:
  - "specialist-id-1"
  - "specialist-id-2"
description: "Brief description of what this workflow does"
---

# Workflow Name

## Phase 1: Discovery

### Objective
What this phase accomplishes.

### Steps
1. Step one
2. Step two
3. Step three

### Checklist
- [ ] Item 1 completed
- [ ] Item 2 completed

### Next Phase Trigger
When to advance to Phase 2.

---

## Phase 2: Implementation

### Objective
What this phase accomplishes.

### Steps
1. Step one
2. Step two

### Checklist
- [ ] Item 1 completed
- [ ] Item 2 completed

### Next Phase Trigger
When to advance to Phase 3.

---

## Phase 3: Verification

### Objective
What this phase accomplishes.

### Steps
1. Step one
2. Step two

### Completion Criteria
- Criterion 1
- Criterion 2
`;

  fs.writeFileSync(path.join(layerPath, 'prompts', '_template.md'), promptTemplate);
  created.push('prompts/_template.md');

  return created;
}

function createExamples(layerPath: string, layerType: string, layerName: string): string[] {
  const created: string[] = [];

  // Example specialist override (for company/team layers)
  if (layerType === 'company' || layerType === 'team') {
    const exampleSpecialist = `---
title: "${layerName} Development Standards"
specialist_id: "sam-coder"  # Overrides embedded Sam Coder
emoji: "⚡"
role: "Expert Development + ${layerName} Standards"
team: "Development"

# OVERRIDE: This extends the embedded Sam Coder with company-specific standards
_extends: "embedded:sam-coder"

persona:
  personality: ["results-focused", "thoroughness-minded", "company-standards-aware"]
  communication_style: "focused action-oriented language with ${layerName} conventions"
  greeting: "⚡ Sam here, with ${layerName} best practices!"

expertise:
  primary: ["systematic-development", "pattern-application", "${layerName.toLowerCase().replace(/\s+/g, '-')}-standards"]
  secondary: ["company-boilerplate", "internal-libraries"]

domains:
  - "language-fundamentals"
  - "code-quality"
  - "${layerName.toLowerCase().replace(/\s+/g, '-')}-specific"
---

# Sam Coder - ${layerName} Edition ⚡

I'm Sam with enhanced knowledge of ${layerName}'s specific conventions and standards.

## ${layerName}-Specific Guidelines

Add your company-specific coding standards, naming conventions, and practices here.

## Internal Libraries

Document your internal AL libraries and utilities here.
`;

    fs.writeFileSync(path.join(layerPath, 'specialists', 'sam-coder-override.md'), exampleSpecialist);
    created.push('specialists/sam-coder-override.md');
  }

  // Example domain topic
  const domainSlug = layerName.toLowerCase().replace(/\s+/g, '-');
  const exampleDomain = path.join(layerPath, 'domains', `${domainSlug}-standards`);
  if (!fs.existsSync(exampleDomain)) {
    fs.mkdirSync(exampleDomain, { recursive: true });
  }

  const exampleTopic = `---
title: "${layerName} Coding Standards"
topic_id: "${domainSlug}-coding-standards"
tags: ["standards", "conventions", "${domainSlug}"]
specialists: ["sam-coder", "roger-reviewer"]
bc_versions: ["BC22+"]
difficulty: "beginner"
---

# ${layerName} Coding Standards

## Naming Conventions

Document your naming conventions here.

### Object Naming

- Tables: \`TBL_[Name]\`
- Codeunits: \`CU_[Name]\`
- Pages: \`PG_[Name]\`

### Field Naming

Describe field naming standards.

## Code Organization

How code should be organized in this layer.

## Required Patterns

Patterns that must be followed in this organization.
`;

  fs.writeFileSync(path.join(exampleDomain, 'coding-standards.md'), exampleTopic);
  created.push(`domains/${domainSlug}-standards/coding-standards.md`);

  return created;
}

function generateReadme(layerType: string, layerName: string): string {
  const priority = layerType === 'company' ? '20' : layerType === 'team' ? '100' : '500';

  return `# ${layerName} - BC Code Intelligence Layer

This is a **${layerType}** knowledge layer for BC Code Intelligence.

## Structure

\`\`\`
${layerName}/
├── specialists/          # Specialist overrides or additions
│   └── _template.md      # Template for new specialists
├── domains/              # Knowledge topics organized by domain
│   └── _template.md      # Template for new topics
├── prompts/              # Workflow prompts
│   └── _template.md      # Template for new prompts
├── indexes/              # Optional tag indexes for search
├── codelens-mappings.yaml  # Optional CodeLens pattern mappings
├── layer-config.yaml     # Layer metadata
└── README.md             # This file
\`\`\`

## Adding Content

### Adding a Specialist Override

1. Copy \`specialists/_template.md\`
2. Use the same \`specialist_id\` as the embedded specialist to override
3. Or use a new \`specialist_id\` to add a new specialist

### Adding Knowledge Topics

1. Create a domain folder under \`domains/\`
2. Copy \`domains/your-domain/_template.md\`
3. Fill in the topic content

### Adding Workflow Prompts

1. Copy \`prompts/_template.md\`
2. Define phases and specialist involvement

## Priority

This ${layerType} layer has priority ${priority}.
Higher priority layers override lower priority layers for matching content.

## Contributing

1. Follow the templates provided
2. Test your changes locally before pushing
3. Document any new patterns or conventions
`;
}
