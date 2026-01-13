/**
 * create_layer_content Tool - Handler Implementation
 *
 * Creates properly-formatted content files in a layer.
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface CreateContentArgs {
  layer_path: string;
  content_type: 'topic' | 'specialist' | 'prompt';
  name: string;
  title: string;
  domain?: string;
  metadata?: Record<string, unknown>;
}

export function createCreateLayerContentHandler() {
  return async (args: CreateContentArgs): Promise<CallToolResult> => {
    const { layer_path, content_type, name, title, domain, metadata = {} } = args;

    if (!layer_path || !content_type || !name || !title) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: 'layer_path, content_type, name, and title are required parameters'
          }, null, 2)
        }]
      };
    }

    let filePath: string;
    let content: string;

    switch (content_type) {
      case 'specialist':
        filePath = path.join(layer_path, 'specialists', `${name}.md`);
        content = createSpecialistContent(name, title, metadata);
        break;

      case 'topic':
        if (!domain) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: 'domain is required for topic content type'
              }, null, 2)
            }]
          };
        }
        const domainPath = path.join(layer_path, 'domains', domain);
        if (!fs.existsSync(domainPath)) {
          fs.mkdirSync(domainPath, { recursive: true });
        }
        filePath = path.join(domainPath, `${name}.md`);
        content = createTopicContent(name, title, domain, metadata);
        break;

      case 'prompt':
        filePath = path.join(layer_path, 'prompts', `${name}.md`);
        content = createPromptContent(name, title, metadata);
        break;

      default:
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: `Unknown content type: ${content_type}`
            }, null, 2)
          }]
        };
    }

    // Check if file already exists
    if (fs.existsSync(filePath)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: `File already exists: ${filePath}`,
            suggestion: 'Use a different name or delete the existing file first'
          }, null, 2)
        }]
      };
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(filePath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Write the file
    try {
      fs.writeFileSync(filePath, content);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            file_path: filePath,
            content_type,
            message: `Created ${content_type}: ${title}`,
            next_steps: [
              `Open ${filePath} to customize the content`,
              'Fill in the placeholder sections',
              content_type === 'specialist' ? 'Add your system prompt in the markdown body' : null,
              content_type === 'topic' ? 'Add code examples and best practices' : null,
              content_type === 'prompt' ? 'Define the phases and checklists' : null
            ].filter(Boolean)
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  };
}

function createSpecialistContent(name: string, title: string, metadata: Record<string, unknown>): string {
  const frontmatter = {
    title,
    specialist_id: name,
    emoji: metadata.emoji || '🔧',
    role: metadata.role || 'Specialist Role',
    team: metadata.team || 'Development',
    persona: {
      personality: metadata.personality || ['helpful', 'knowledgeable'],
      communication_style: metadata.communication_style || 'Clear and professional',
      greeting: metadata.greeting || `Hello! I'm here to help with ${title}.`
    },
    expertise: {
      primary: metadata.primary_expertise || ['area-1', 'area-2'],
      secondary: metadata.secondary_expertise || ['area-3']
    },
    domains: metadata.domains || ['general'],
    when_to_use: metadata.when_to_use || ['When you need help with this area'],
    collaboration: {
      natural_handoffs: metadata.handoffs || [],
      team_consultations: metadata.consultations || []
    },
    related_specialists: metadata.related || []
  };

  return `---
${yaml.stringify(frontmatter)}---

# ${title}

## Overview

Describe what this specialist helps with.

## Expertise Areas

- Area 1
- Area 2

## Approach

How this specialist approaches problems and provides guidance.
`;
}

function createTopicContent(name: string, title: string, domain: string, metadata: Record<string, unknown>): string {
  const frontmatter = {
    title,
    topic_id: name,
    tags: metadata.tags || [domain],
    specialists: metadata.specialists || [],
    bc_versions: metadata.bc_versions || ['BC22+'],
    difficulty: metadata.difficulty || 'intermediate'
  };

  return `---
${yaml.stringify(frontmatter)}---

# ${title}

## Overview

Brief description of this topic.

## Key Concepts

Explain the main concepts.

## Best Practices

1. Practice 1
2. Practice 2

## Code Examples

\`\`\`al
// Example code
\`\`\`

## Related Topics

- Topic 1
- Topic 2
`;
}

function createPromptContent(name: string, title: string, metadata: Record<string, unknown>): string {
  const frontmatter = {
    title,
    prompt_id: name,
    type: metadata.type || 'workflow',
    phases: metadata.phases || 3,
    specialists: metadata.specialists || [],
    description: metadata.description || `Workflow for ${title}`
  };

  return `---
${yaml.stringify(frontmatter)}---

# ${title}

## Phase 1: Planning

### Objective
What this phase accomplishes.

### Steps
1. Step one
2. Step two

### Checklist
- [ ] Item completed

---

## Phase 2: Execution

### Objective
What this phase accomplishes.

### Steps
1. Step one
2. Step two

---

## Phase 3: Review

### Objective
Verify the work is complete.

### Completion Criteria
- All items reviewed
- Quality verified
`;
}
