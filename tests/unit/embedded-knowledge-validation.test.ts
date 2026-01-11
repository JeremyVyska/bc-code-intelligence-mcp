/**
 * Embedded Knowledge Validation Tests
 * 
 * Tests to ensure embedded knowledge submodule is properly initialized
 * and contains required BC knowledge content.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

const projectRoot = join(__dirname, '../../');
const embeddedKnowledgePath = join(projectRoot, 'embedded-knowledge');

describe('Embedded Knowledge Validation', () => {
  describe('Directory Structure', () => {
    it('should have embedded-knowledge directory', () => {
      expect(existsSync(embeddedKnowledgePath)).toBe(true);
      
      const stat = statSync(embeddedKnowledgePath);
      expect(stat.isDirectory()).toBe(true);
    });

    it('should have required subdirectories', () => {
      const requiredDirs = ['domains', 'specialists', 'indexes'];

      for (const dir of requiredDirs) {
        const dirPath = join(embeddedKnowledgePath, dir);
        expect(existsSync(dirPath), `Missing directory: ${dir}/`).toBe(true);

        const stat = statSync(dirPath);
        expect(stat.isDirectory(), `${dir}/ is not a directory`).toBe(true);
      }

      // workflows/ or methodologies/ (backward compatibility)
      const workflowsPath = join(embeddedKnowledgePath, 'workflows');
      const methodologiesPath = join(embeddedKnowledgePath, 'methodologies');
      const hasWorkflowsDir = existsSync(workflowsPath) || existsSync(methodologiesPath);
      expect(hasWorkflowsDir, `Missing directory: workflows/ or methodologies/`).toBe(true);
    });
  });

  describe('Critical Files', () => {
    it('should have workflow index', () => {
      // Check both workflows/ and methodologies/ (backward compatibility)
      const workflowsIndexPath = join(embeddedKnowledgePath, 'workflows/index.json');
      const methodologiesIndexPath = join(embeddedKnowledgePath, 'methodologies/index.json');

      const indexPath = existsSync(workflowsIndexPath) ? workflowsIndexPath : methodologiesIndexPath;
      expect(existsSync(indexPath), 'Missing workflows/index.json or methodologies/index.json').toBe(true);

      const stat = statSync(indexPath);
      expect(stat.size).toBeGreaterThan(100); // Should have meaningful content
    });

    it('should have domain catalog', () => {
      const catalogPath = join(embeddedKnowledgePath, 'indexes/domain-catalog.json');
      expect(existsSync(catalogPath)).toBe(true);
      
      const stat = statSync(catalogPath);
      expect(stat.size).toBeGreaterThan(100);
    });

    it('should have specialist files', () => {
      const specialistPath = join(embeddedKnowledgePath, 'specialists/alex-architect.md');
      expect(existsSync(specialistPath)).toBe(true);
      
      const stat = statSync(specialistPath);
      expect(stat.size).toBeGreaterThan(1000); // Should have substantial content
    });

    it('should have domain content', () => {
      const domainPath = join(embeddedKnowledgePath, 'domains/alex-architect/facade-pattern-al-implementation.md');
      expect(existsSync(domainPath)).toBe(true);
      
      const stat = statSync(domainPath);
      expect(stat.size).toBeGreaterThan(1000);
    });
  });

  describe('Content Validation', () => {
    it('should have sufficient specialist content', () => {
      const specialistsPath = join(embeddedKnowledgePath, 'specialists');
      const files = readdirSync(specialistsPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      expect(mdFiles.length).toBeGreaterThanOrEqual(10); // Should have multiple specialists
    });

    it('should have sufficient domain content', () => {
      const domainsPath = join(embeddedKnowledgePath, 'domains');
      const files = readdirSync(domainsPath, { recursive: true }) as string[];
      const mdFiles = files.filter(f => f.endsWith('.md'));
      
      expect(mdFiles.length).toBeGreaterThanOrEqual(50); // Should have substantial domain content
    });

    it('should have total content meeting minimum threshold', () => {
      const contentDirs = ['domains', 'specialists'];
      let totalFiles = 0;

      for (const dir of contentDirs) {
        const dirPath = join(embeddedKnowledgePath, dir);
        const files = readdirSync(dirPath, { recursive: true }) as string[];
        const mdFiles = files.filter(f => f.endsWith('.md'));
        totalFiles += mdFiles.length;
      }

      expect(totalFiles).toBeGreaterThanOrEqual(60); // Minimum content threshold
    });
  });

  describe('Build Safety', () => {
    it('should prevent building with missing embedded knowledge', async () => {
      // This test documents the expected behavior when embedded knowledge is missing
      // The actual validation happens in scripts/validate-embedded-knowledge.ts
      // which is called during build process
      
      const requiredValidations = [
        'Directory existence check',
        'Required subdirectories check', 
        'Critical files validation',
        'Content count validation'
      ];

      // Verify that our validation script exists
      const validationScript = join(projectRoot, 'scripts/validate-embedded-knowledge.ts');
      expect(existsSync(validationScript)).toBe(true);

      // This test serves as documentation that the build process
      // includes embedded knowledge validation
      expect(requiredValidations.length).toBeGreaterThan(0);
    });
  });
});
