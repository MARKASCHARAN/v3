import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import {
  ResearchService,
  fetchSafePageExcerpts,
  isSafePublicHttpUrl,
  stripHtmlToText,
} from './research.service';
import { ResearchRepository } from './research.repository';
import { MemoryService } from '../memory/memory.service';
import { conductResearchSchema, createResearchSchema } from './research.schema';
import { WebResearchRunner } from './research.types';
import { AppError } from '../../middleware/error.middleware';

describe('Research Module', () => {
  describe('Schemas, HTML Parsing & URL Safety', () => {
    it('validates conductResearchSchema and createResearchSchema', () => {
      const conduct = conductResearchSchema.parse({
        query: 'Best pgvector index parameters for 768 dims',
        saveToMemory: true,
      });
      expect(conduct.urls).toEqual([]);
      expect(conduct.saveToMemory).toBe(true);

      const note = createResearchSchema.parse({
        query: 'pgvector HNSW',
        title: 'HNSW Summary',
        summary: 'Use cosine distance with HNSW for fast ANN recall.',
      });
      expect(note.keyFindings).toEqual([]);
    });

    it('blocks private and localhost URLs against SSRF', async () => {
      expect(isSafePublicHttpUrl('https://example.com/article')).toBe(true);
      expect(isSafePublicHttpUrl('http://localhost:5000')).toBe(false);
      expect(isSafePublicHttpUrl('http://127.0.0.1/admin')).toBe(false);
      expect(isSafePublicHttpUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
      expect(isSafePublicHttpUrl('file:///etc/passwd')).toBe(false);

      await expect(fetchSafePageExcerpts(['http://127.0.0.1:8080/secret'])).rejects.toThrow(
        'Blocked unsafe or private URL'
      );
    });

    it('strips HTML scripts and tags cleanly', () => {
      const cleaned = stripHtmlToText(
        '<html><head><script>alert(1)</script></head><body><h1>Hello</h1><p>World</p></body></html>'
      );
      expect(cleaned).toBe('Hello World');
    });
  });

  describe('ResearchService', () => {
    it('conducts research, stores result, and saves to semantic memory when requested', async () => {
      const mockRepo = {
        create: vi.fn().mockImplementation(async (_userId, data) => ({
          id: 'res-1',
          ...data,
        })),
      } as unknown as ResearchRepository;

      const mockRunner: WebResearchRunner = {
        research: vi.fn().mockResolvedValue({
          provider: 'google',
          model: 'gemini-2.5-flash',
          title: 'pgvector Tuning',
          summary: 'Cosine similarity works cleanly with normalized vectors.',
          keyFindings: ['Use 768 dimensions for compact storage.'],
          sources: [{ url: 'https://example.com/pgvector', title: 'pgvector Guide' }],
        }),
      };

      const mockMemoryService = {
        createMemory: vi.fn().mockResolvedValue({ id: 'mem-1' }),
      } as unknown as MemoryService;

      const service = new ResearchService(
        mockRepo,
        mockRunner,
        mockMemoryService,
        vi.fn().mockResolvedValue([])
      );

      const created = await service.conductResearch('user-1', {
        query: 'pgvector tuning',
        urls: [],
        saveToMemory: true,
      });

      expect(created.id).toBe('res-1');
      expect(created.status).toBe('SAVED_TO_MEMORY');
      expect(mockMemoryService.createMemory).toHaveBeenCalledOnce();
    });

    it('throws RESEARCH_NOT_FOUND for missing research item', async () => {
      const mockRepo = {
        findByIdAndUserId: vi.fn().mockResolvedValue(null),
      } as unknown as ResearchRepository;
      const service = new ResearchService(mockRepo);

      await expect(service.getResearchById('missing', 'user-1')).rejects.toBeInstanceOf(AppError);
    });
  });

  describe('HTTP Routes', () => {
    it('GET /api/v1/research requires authentication', async () => {
      const response = await request(app).get('/api/v1/research');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
