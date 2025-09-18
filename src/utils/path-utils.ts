import { dirname, join } from 'path';

/**
 * Get the embedded knowledge path, handling different runtime environments
 */
export function getEmbeddedKnowledgePath(): string {
  // Handle test environment where import.meta.url might not work
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined) {
    return join(process.cwd(), 'embedded-knowledge');
  }
  
  // For non-test environments, use a more traditional approach
  // Get the current directory and go up to find embedded-knowledge
  return join(process.cwd(), 'embedded-knowledge');
}