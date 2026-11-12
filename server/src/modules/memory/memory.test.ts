import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { MemoryService, buildMemoryEmbeddingText, formatVectorLiteral } from './memory.service';
import { MemoryRepository } from './memory.repository';
import {
  createConversationMessageSchema,
  createMemorySchema,
  memoryQuerySchema,
  semanticSearchQuerySchema,
  upsertPreferenceSchema,
} from './memory.schema';
import { EmbeddingGenerator } from './memory.types';
import { AppError } from '../../middleware/error.middleware';

describe('Memory Module', () => {
  describe('Schemas & Vector Helpers', () => {
    it('validates memory, preference, semantic search, and conversation schemas', () => {
      const memory = createMemorySchema.parse({
        title: 'V3 Stack',
        content: 'Uses Express 5 and Prisma',
        tags: ['architecture'],
      });
      expect(memory.category).toBe('GENERAL');
      expect(memory.importance).toBe(1);

      const pref = upsertPreferenceSchema.parse({ key: 'work_hours', value: '09:00-18:00' });
      expect(pref.category).toBe('GENERAL');

      const msg = createConversationMessageSchema.parse({
        role: 'USER',
        content: 'Plan my week',
      });
      expect(msg.sessionId).toBe('default');

      const query = memoryQuerySchema.parse({ q: 'Express', limit: '10' });
      expect(query.limit).toBe(10);

      const semantic = semanticSearchQuerySchema.parse({
        q: 'morning focus routine',
        minSimilarity: '0.5',
      });
      expect(semantic.minSimilarity).toBe(0.5);
    });

    it('formats pgvector literals and embedding text cleanly', () => {
      expect(formatVectorLiteral([0.1, 0.2, -0.3])).toBe('[0.1,0.2,-0.3]');
      expect(
        buildMemoryEmbeddingText({
          title: 'Sprint Goal',
          category: 'PROJECT_CONTEXT',
          tags: ['v3'],
          content: 'Finish Phase 2',
        })
      ).toBe('[PROJECT_CONTEXT] Sprint Goal Tags: v3 Finish Phase 2');
    });
  });

  describe('MemoryService', () => {
    it('throws MEMORY_NOT_FOUND when memory is missing', async () => {
      const mockRepo = {
        findMemoryByIdAndUserId: vi.fn().mockResolvedValue(null),
      } as unknown as MemoryRepository;
      const service = new MemoryService(mockRepo);

      await expect(service.getMemoryById('missing', 'user-1')).rejects.toBeInstanceOf(AppError);
    });

    it('creates memory and syncs pgvector embedding when provider is available', async () => {
      const mockRepo = {
        createMemory: vi.fn().mockResolvedValue({
          id: 'mem-1',
          userId: 'user-1',
          title: 'Focus',
          category: 'PREFERENCE',
          tags: ['schedule'],
          content: 'Deep work between 9 AM and 12 PM',
        }),
        updateMemoryEmbedding: vi.fn().mockResolvedValue(1),
      } as unknown as MemoryRepository;

      const mockEmbedder: EmbeddingGenerator = {
        embedDocument: vi.fn().mockResolvedValue([0.25, 0.75]),
        embedQuery: vi.fn(),
      };

      const service = new MemoryService(mockRepo, mockEmbedder);
      const created = await service.createMemory('user-1', {
        title: 'Focus',
        content: 'Deep work between 9 AM and 12 PM',
        category: 'PREFERENCE',
        tags: ['schedule'],
        importance: 3,
      });

      expect(created.id).toBe('mem-1');
      expect(mockEmbedder.embedDocument).toHaveBeenCalledOnce();
      expect(mockRepo.updateMemoryEmbedding).toHaveBeenCalledWith('mem-1', '[0.25,0.75]');
    });

    it('runs semanticSearch with pgvector and falls back to keyword when unconfigured', async () => {
      const mockRepo = {
        findSimilarMemories: vi
          .fn()
          .mockResolvedValue([{ id: 'mem-1', content: 'Morning deep work', similarity: 0.91 }]),
        findMemories: vi.fn().mockResolvedValue([{ id: 'mem-2', content: 'Morning routine' }]),
      } as unknown as MemoryRepository;

      const workingEmbedder: EmbeddingGenerator = {
        embedDocument: vi.fn(),
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2]),
      };
      const service = new MemoryService(mockRepo, workingEmbedder);
      const vectorRes = await service.semanticSearch('user-1', {
        q: 'morning focus',
        limit: 10,
        minSimilarity: 0.3,
      });
      expect(vectorRes.mode).toBe('pgvector');
      expect(vectorRes.results).toHaveLength(1);

      const unconfiguredEmbedder: EmbeddingGenerator = {
        embedDocument: vi.fn(),
        embedQuery: vi
          .fn()
          .mockRejectedValue(
            new AppError(503, 'GEMINI_API_KEY missing', 'AI_PROVIDER_UNCONFIGURED')
          ),
      };
      const fallbackService = new MemoryService(mockRepo, unconfiguredEmbedder);
      const fallbackRes = await fallbackService.semanticSearch('user-1', {
        q: 'morning',
        limit: 10,
        minSimilarity: 0.3,
      });
      expect(fallbackRes.mode).toBe('keyword_fallback');
      expect(fallbackRes.results).toHaveLength(1);
    });

    it('retrieves combined context bundle', async () => {
      const mockRepo = {
        findPreferences: vi.fn().mockResolvedValue([{ key: 'timezone', value: 'Asia/Kolkata' }]),
        findMemories: vi.fn().mockResolvedValue([{ id: 'mem-1', content: 'Project V3' }]),
        findConversationMessages: vi.fn().mockResolvedValue([{ role: 'USER', content: 'Hi' }]),
      } as unknown as MemoryRepository;
      const service = new MemoryService(mockRepo);

      const bundle = await service.getContextBundle('user-1', { sessionId: 'default', limit: 10 });
      expect(bundle.preferences).toHaveLength(1);
      expect(bundle.memories).toHaveLength(1);
      expect(bundle.recentMessages).toHaveLength(1);
    });
  });

  describe('HTTP Routes', () => {
    it('GET /api/v1/memory/context and /semantic require authentication', async () => {
      const contextRes = await request(app).get('/api/v1/memory/context');
      expect(contextRes.status).toBe(401);
      expect(contextRes.body.error.code).toBe('UNAUTHORIZED');

      const semanticRes = await request(app).get('/api/v1/memory/semantic?q=test');
      expect(semanticRes.status).toBe(401);
      expect(semanticRes.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
