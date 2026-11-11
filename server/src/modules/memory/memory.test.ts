import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { MemoryService } from './memory.service';
import { MemoryRepository } from './memory.repository';
import {
  createConversationMessageSchema,
  createMemorySchema,
  memoryQuerySchema,
  upsertPreferenceSchema,
} from './memory.schema';
import { AppError } from '../../middleware/error.middleware';

describe('Memory Module', () => {
  describe('Schemas', () => {
    it('validates memory, preference, and conversation schemas', () => {
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
    it('GET /api/v1/memory/context requires authentication', async () => {
      const response = await request(app).get('/api/v1/memory/context');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
