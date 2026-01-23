/**
 * Schema Validation Tests
 * 
 * Tests for Zod schema validation, including passthrough behavior
 * for extended frontmatter fields.
 */

import { describe, it, expect } from 'vitest';
import { AtomicTopicFrontmatterSchema } from '../../src/types/bc-knowledge';

describe('AtomicTopicFrontmatterSchema', () => {
  describe('Core fields validation', () => {
    it('should validate a minimal valid frontmatter', () => {
      const frontmatter = {
        title: 'Test Topic',
        domain: 'test-domain',
        difficulty: 'intermediate' as const,
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe('Test Topic');
        expect(result.data.domain).toBe('test-domain');
        expect(result.data.difficulty).toBe('intermediate');
      }
    });

    it('should validate a complete frontmatter with all standard fields', () => {
      const frontmatter = {
        title: 'Complete Topic',
        domain: 'test-domain',
        difficulty: 'advanced' as const,
        bc_versions: '24..25',
        tags: ['test', 'validation'],
        prerequisites: ['topic-1', 'topic-2'],
        related_topics: ['topic-3'],
        samples: 'samples/test.al',
        estimated_time: '15 minutes',
        type: 'code-pattern',
        pattern_type: 'good' as const,
        relevance_signals: {
          constructs: ['FindSet', 'CalcFields'],
          keywords: ['performance', 'optimization'],
        },
        applicable_object_types: ['codeunit', 'table'],
        relevance_threshold: 0.7,
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(true);
    });
  });

  describe('Passthrough behavior for extended fields (Issue #32)', () => {
    it('should accept victor-versioning migration_type field', () => {
      const frontmatter = {
        title: 'Posting Selection Management - 2 Obsoletions',
        domain: 'victor-versioning',
        difficulty: 'intermediate' as const,
        migration_type: 'obsoletion', // ✅ Extended field
        bc_versions: '24->25',
        tags: ['bc25-migration', 'breaking-change'],
        applicable_object_types: ['codeunit'],
        relevance_threshold: 0.6,
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(true);
      
      if (result.success) {
        // Extended field should be preserved via passthrough
        expect((result.data as any).migration_type).toBe('obsoletion');
      }
    });

    it('should accept victor-versioning urgency field', () => {
      const frontmatter = {
        title: 'Test Migration',
        domain: 'victor-versioning',
        difficulty: 'intermediate' as const,
        urgency: 'deprecation-warning', // ✅ Extended field
        bc_versions: '24->25',
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect((result.data as any).urgency).toBe('deprecation-warning');
      }
    });

    it('should accept multiple extended fields simultaneously', () => {
      const frontmatter = {
        title: 'Complex Migration',
        domain: 'victor-versioning',
        difficulty: 'advanced' as const,
        migration_type: 'breaking-change', // ✅ Extended field
        urgency: 'immediate', // ✅ Extended field
        migration_effort: 'high', // ✅ Extended field
        custom_category: 'api-changes', // ✅ Extended field
        bc_versions: '23->24',
        tags: ['migration'],
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(true);
      
      if (result.success) {
        const data = result.data as any;
        expect(data.migration_type).toBe('breaking-change');
        expect(data.urgency).toBe('immediate');
        expect(data.migration_effort).toBe('high');
        expect(data.custom_category).toBe('api-changes');
      }
    });

    it('should preserve standard fields alongside extended fields', () => {
      const frontmatter = {
        title: 'Mixed Fields Topic',
        domain: 'test-domain',
        difficulty: 'intermediate' as const,
        tags: ['standard', 'field'],
        custom_field_1: 'value1', // ✅ Extended field
        custom_field_2: 123, // ✅ Extended field
        bc_versions: '24..',
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(true);
      
      if (result.success) {
        const data = result.data as any;
        // Standard fields
        expect(data.title).toBe('Mixed Fields Topic');
        expect(data.domain).toBe('test-domain');
        expect(data.tags).toEqual(['standard', 'field']);
        // Extended fields
        expect(data.custom_field_1).toBe('value1');
        expect(data.custom_field_2).toBe(123);
      }
    });
  });

  describe('Invalid frontmatter rejection', () => {
    it('should reject invalid difficulty value', () => {
      const frontmatter = {
        title: 'Invalid Topic',
        domain: 'test-domain',
        difficulty: 'super-hard', // ❌ Not in enum
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(false);
    });

    it('should reject invalid pattern_type value', () => {
      const frontmatter = {
        title: 'Invalid Pattern',
        domain: 'test-domain',
        pattern_type: 'maybe', // ❌ Not in enum
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(false);
    });

    it('should reject relevance_threshold outside valid range', () => {
      const frontmatter = {
        title: 'Invalid Threshold',
        domain: 'test-domain',
        relevance_threshold: 1.5, // ❌ Must be 0-1
      };

      const result = AtomicTopicFrontmatterSchema.safeParse(frontmatter);
      expect(result.success).toBe(false);
    });
  });
});
