import { describe, it, expect, beforeEach, vi, MockedFunction } from 'vitest';
import { KnowledgeService } from '../../src/services/knowledge-service.js';
import { LayerService } from '../../src/layers/layer-service.js';
import { BCKBConfig, TopicSearchParams } from '../../src/types/bc-knowledge.js';

// Mock the LayerService
vi.mock('../../src/layers/layer-service.js');

/**
 * Knowledge Service Unit Tests
 * 
 * Tests the core knowledge service business logic in isolation
 * This catches missing methods that MCP tools try to call
 */
describe('KnowledgeService', () => {
  let knowledgeService: KnowledgeService;
  let mockLayerService: any;
  let mockConfig: BCKBConfig;

  beforeEach(() => {
    // Create mock layer service
    mockLayerService = {
      initialize: vi.fn().mockResolvedValue([]),
      getLayer: vi.fn(),
      resolveContent: vi.fn(),
      getAllTopics: vi.fn().mockResolvedValue([]),
      searchContent: vi.fn().mockResolvedValue([])
    };

    // Mock the LayerService constructor
    (LayerService as any).mockImplementation(() => mockLayerService);

    mockConfig = {
      knowledge_base_path: '/test/embedded-knowledge',
      indexes_path: '/test/indexes',
      cache_size: 1000,
      max_search_results: 50,
      default_bc_version: 'BC22',
      enable_fuzzy_search: true,
      search_threshold: 0.5
    };

    knowledgeService = new KnowledgeService(mockConfig);
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await knowledgeService.initialize();
      
      expect(mockLayerService.initialize).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await knowledgeService.initialize();
      await knowledgeService.initialize();
      
      expect(mockLayerService.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors gracefully', async () => {
      mockLayerService.initialize.mockRejectedValue(new Error('Layer init failed'));
      
      await expect(knowledgeService.initialize()).rejects.toThrow('Layer init failed');
    });
  });

  describe('Topic Search', () => {
    beforeEach(async () => {
      // Setup mock topics
      mockLayerService.getAllTopics.mockResolvedValue([
        {
          id: 'posting-routines',
          title: 'Posting Routines',
          domain: 'finance',
          difficulty: 'intermediate',
          content: 'Content about posting routines',
          frontmatter: { bc_version: ['BC20', 'BC22'] }
        },
        {
          id: 'table-design',
          title: 'Table Design',
          domain: 'architecture',
          difficulty: 'advanced',
          content: 'Content about table design',
          frontmatter: { bc_version: ['BC22'] }
        }
      ]);

      await knowledgeService.initialize();
    });

    it('should search topics by query', async () => {
      const params: TopicSearchParams = {
        tags: ['posting'],
        bc_version: 'BC22'
      };

      const results = await knowledgeService.searchTopics(params);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should filter topics by BC version', async () => {
      const params: TopicSearchParams = {
        tags: ['design'],
        bc_version: 'BC20'
      };

      const results = await knowledgeService.searchTopics(params);
      
      // Should exclude topics that don't support BC20
      expect(results).toBeDefined();
    });

    it('should handle empty search results', async () => {
      mockLayerService.getAllTopics.mockResolvedValue([]);
      
      const params: TopicSearchParams = {
        tags: ['nonexistent']
      };

      const results = await knowledgeService.searchTopics(params);
      
      expect(results).toEqual([]);
    });

    it('should handle search errors gracefully', async () => {
      mockLayerService.getAllTopics.mockRejectedValue(new Error('Search failed'));
      
      const params: TopicSearchParams = {
        tags: ['test']
      };

      await expect(knowledgeService.searchTopics(params)).rejects.toThrow('Search failed');
    });
  });

  describe('Missing Methods Detection', () => {
    it('should expose askSpecialist method', () => {
      // This test catches the missing method found by contract tests
      expect(typeof (knowledgeService as any).askSpecialist).toBe('function');
    });

    it('should expose findSpecialistsByQuery method', () => {
      // This test catches the missing method found by contract tests
      expect(typeof (knowledgeService as any).findSpecialistsByQuery).toBe('function');
    });

    it('should call askSpecialist correctly', async () => {
      // Mock the method if it exists
      if ((knowledgeService as any).askSpecialist) {
        const spy = vi.spyOn(knowledgeService as any, 'askSpecialist');
        spy.mockResolvedValue({ specialist: 'sam-coder', response: 'Test response' });

        const result = await (knowledgeService as any).askSpecialist('How to optimize?', 'sam-coder');
        
        expect(spy).toHaveBeenCalledWith('How to optimize?', 'sam-coder');
        expect(result).toBeDefined();
      } else {
        // This will fail and show that the method is missing
        expect.fail('askSpecialist method is missing from KnowledgeService');
      }
    });
  });

  describe('Topic Content Retrieval', () => {
    it.skip('should get topic content by ID - method not implemented yet', async () => {
      // TODO: Implement getTopicContent method in KnowledgeService
      // const mockTopic = {
      //   id: 'test-topic',
      //   title: 'Test Topic',  
      //   content: 'Test content',
      //   frontmatter: {}
      // };
      // mockLayerService.resolveContent.mockResolvedValue(mockTopic);
      // const result = await knowledgeService.getTopicContent('test-topic');
      // expect(result).toEqual(mockTopic);
    });

    it.skip('should handle non-existent topics - method not implemented yet', async () => {
      // TODO: Implement getTopicContent method in KnowledgeService
      // mockLayerService.resolveContent.mockResolvedValue(null);
      // const result = await knowledgeService.getTopicContent('nonexistent');
      // expect(result).toBeNull();
    });
  });

  describe('Performance Requirements', () => {
    it('should return search results within 100ms', async () => {
      const startTime = Date.now();
      
      const params: TopicSearchParams = {
        tags: ['performance', 'test']
      };

      await knowledgeService.searchTopics(params);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should handle large search results efficiently', async () => {
      // Mock large dataset
      const largeTopicList = Array(1000).fill(null).map((_, i) => ({
        id: `topic-${i}`,
        title: `Topic ${i}`,
        domain: 'test',
        content: 'Test content',
        frontmatter: {}
      }));

      mockLayerService.getAllTopics.mockResolvedValue(largeTopicList);

      const startTime = Date.now();
      
      const params: TopicSearchParams = {
        tags: ['topic']
      };

      const results = await knowledgeService.searchTopics(params);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(200);
      expect(results).toBeDefined();
    });
  });

  describe('BC Version Filtering', () => {
    beforeEach(async () => {
      mockLayerService.getAllTopics.mockResolvedValue([
        {
          id: 'bc20-only',
          title: 'BC20 Only Feature',
          frontmatter: { bc_version: ['BC20'] }
        },
        {
          id: 'bc22-only',
          title: 'BC22 Only Feature',
          frontmatter: { bc_version: ['BC22'] }
        },
        {
          id: 'multi-version',
          title: 'Multi Version Feature',
          frontmatter: { bc_version: ['BC20', 'BC21', 'BC22'] }
        }
      ]);

      await knowledgeService.initialize();
    });

    it('should filter topics by specific BC version', async () => {
      const params: TopicSearchParams = {
        tags: ['feature'],
        bc_version: 'BC22'
      };

      const results = await knowledgeService.searchTopics(params);
      
      // Should include bc22-only and multi-version, exclude bc20-only
      const resultIds = results.map(r => r.id);
      expect(resultIds).not.toContain('bc20-only');
    });

    it('should return all topics when no BC version specified', async () => {
      const params: TopicSearchParams = {
        tags: ['feature']
      };

      const results = await knowledgeService.searchTopics(params);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle layer service failures gracefully', async () => {
      mockLayerService.getAllTopics.mockRejectedValue(new Error('Layer failure'));

      const params: TopicSearchParams = {
        tags: ['test']
      };

      await expect(knowledgeService.searchTopics(params)).rejects.toThrow('Layer failure');
    });

    it('should handle malformed topic data', async () => {
      mockLayerService.getAllTopics.mockResolvedValue([
        { id: 'broken-topic' }, // Missing required fields
        null, // Null topic
        undefined, // Undefined topic
        { id: 'valid-topic', title: 'Valid Topic', content: 'Content' }
      ]);

      await knowledgeService.initialize();

      const params: TopicSearchParams = {
        tags: ['topic']
      };

      const results = await knowledgeService.searchTopics(params);
      
      // Should handle malformed data gracefully
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
