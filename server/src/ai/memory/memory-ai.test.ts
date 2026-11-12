import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../app';
import { AppError } from '../../middleware/error.middleware';
import { MemoryRepository } from '../../modules/memory/memory.repository';
import {
  KeywordMemoryMatch,
  MemoryRecordSummary,
  SemanticMemoryMatch,
} from '../../modules/memory/memory.types';
import { MemoryConsolidationService } from './consolidation';
import { validateCandidateMemory } from './extraction';
import { fuseMemoriesWithRRF, retrieveHybridMemoryContext } from './hybrid-retrieval';

const makeMemoryRecord = (overrides: Partial<MemoryRecordSummary> = {}): MemoryRecordSummary => ({
  id: 'mem-default',
  userId: 'user-1',
  title: 'Default Title',
  content: 'Default content with enough details to pass validation',
  category: 'FACT',
  memoryType: 'SEMANTIC',
  sourceType: 'MANUAL',
  sourceId: null,
  tags: ['v3'],
  importance: 2,
  confidence: 1.0,
  expiresAt: null,
  supersededById: null,
  createdAt: new Date('2026-11-12T00:00:00Z'),
  updatedAt: new Date('2026-11-12T00:00:00Z'),
  ...overrides,
});

describe('Hybrid Data & Six-Memory Subsystem (M2.5)', () => {
  describe('RRF Hybrid Retrieval', () => {
    it('merges pgvector and keyword results via Reciprocal Rank Fusion boosting dual-hit matches', () => {
      const vectorMatches: SemanticMemoryMatch[] = [
        { ...makeMemoryRecord({ id: 'mem-vec-only', importance: 2 }), similarity: 0.91 },
        { ...makeMemoryRecord({ id: 'mem-dual', importance: 4 }), similarity: 0.85 },
      ];
      const keywordMatches: KeywordMemoryMatch[] = [
        { ...makeMemoryRecord({ id: 'mem-dual', importance: 4 }), keywordRank: 0.8 },
        { ...makeMemoryRecord({ id: 'mem-kw-only', importance: 1 }), keywordRank: 0.4 },
      ];

      const fused = fuseMemoriesWithRRF({
        vectorMatches,
        keywordMatches,
        options: { limit: 10 },
      });

      expect(fused).toHaveLength(3);
      expect(fused[0]?.id).toBe('mem-dual');
      expect(fused[0]?.vectorRankPosition).toBe(2);
      expect(fused[0]?.keywordRankPosition).toBe(1);
    });

    it('falls back cleanly to sql_and_fts mode when embeddings are unconfigured', async () => {
      const mockRepo = {
        findPreferences: vi
          .fn()
          .mockResolvedValue([{ key: 'focus_hours', value: '09-12', category: 'GENERAL' }]),
        findStructuredWorkspaceMetrics: vi.fn().mockResolvedValue({
          activeGoalsCount: 2,
          openTasksCount: 5,
          overdueTasksCount: 1,
          pendingRemindersCount: 1,
          upcomingTimeBlocksCount: 3,
        }),
        findFullTextMemories: vi.fn().mockResolvedValue([
          {
            ...makeMemoryRecord({ id: 'mem-fts-1', content: 'Deep work window starts 9 AM' }),
            keywordRank: 0.65,
          },
        ]),
        findSimilarMemories: vi.fn(),
      } as unknown as MemoryRepository;

      const result = await retrieveHybridMemoryContext(
        { userId: 'user-1', query: 'Deep work' },
        {
          repository: mockRepo,
          embedQuery: vi
            .fn()
            .mockRejectedValue(
              new AppError(503, 'GEMINI_API_KEY missing', 'AI_PROVIDER_UNCONFIGURED')
            ),
        }
      );

      expect(result.mode).toBe('sql_and_fts');
      expect(result.structuredMetrics.overdueTasksCount).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]?.id).toBe('mem-fts-1');
    });
  });

  describe('Candidate Validation & Memory Consolidation', () => {
    it('rejects trivial memories, detects duplicates, and flags title conflicts for supersession', () => {
      const existing = [
        makeMemoryRecord({
          id: 'mem-1',
          title: 'Primary Programming Language',
          content: 'User prefers TypeScript and Python for backend services.',
          memoryType: 'SEMANTIC',
        }),
      ];

      expect(validateCandidateMemory({ content: 'ok' }, existing).status).toBe('REJECTED');

      const dup = validateCandidateMemory(
        {
          title: 'Language',
          content: 'User prefers TypeScript and Python for backend services.',
          memoryType: 'SEMANTIC',
        },
        existing
      );
      expect(dup.status).toBe('DUPLICATE');
      expect(dup.duplicateMemoryId).toBe('mem-1');

      const conflict = validateCandidateMemory(
        {
          title: 'Primary Programming Language',
          content: 'User now standardizes exclusively on TypeScript across backend and web.',
          memoryType: 'SEMANTIC',
          sourceType: 'CONVERSATION',
          confidence: 0.99,
        },
        existing
      );
      expect(conflict.status).toBe('CONFLICT');
      expect(conflict.conflictingMemoryIds).toEqual(['mem-1']);
      expect(conflict.candidate?.confidence).toBe(0.95);
    });

    it('creates superseding memory and updates supersededById cleanly', async () => {
      const existing = makeMemoryRecord({
        id: 'mem-old',
        title: 'Sprint Focus',
        content: 'Current sprint focus is Phase 1 auth setup.',
        memoryType: 'PROJECT',
      });

      const createdRecord = makeMemoryRecord({
        id: 'mem-new',
        title: 'Sprint Focus',
        content: 'Current sprint focus is Milestone 2.5 hybrid memory retrieval.',
        memoryType: 'PROJECT',
      });

      const mockRepo = {
        findActiveMemoriesForValidation: vi.fn().mockResolvedValue([existing]),
        createMemory: vi.fn().mockResolvedValue(createdRecord),
        updateMemoryEmbedding: vi.fn().mockResolvedValue(1),
        markMemoriesSuperseded: vi.fn().mockResolvedValue({ count: 1 }),
        deleteExpiredMemories: vi.fn().mockResolvedValue(2),
      } as unknown as MemoryRepository;

      const consolidation = new MemoryConsolidationService(mockRepo, {
        embedDocument: vi.fn().mockResolvedValue([0.1, 0.2]),
        embedQuery: vi.fn(),
      });

      const proposal = await consolidation.proposeAndPersistMemory('user-1', {
        title: 'Sprint Focus',
        content: 'Current sprint focus is Milestone 2.5 hybrid memory retrieval.',
        category: 'PROJECT_CONTEXT',
        memoryType: 'PROJECT',
        sourceType: 'CONVERSATION',
        tags: ['V3', 'Memory'],
        importance: 4,
        confidence: 0.9,
        autoSupersedeOnConflict: true,
      });

      expect(proposal.action).toBe('SUPERSEDED');
      expect(proposal.supersededIds).toEqual(['mem-old']);
      expect(mockRepo.markMemoriesSuperseded).toHaveBeenCalledWith(['mem-old'], 'mem-new');

      const pruned = await consolidation.pruneExpiredMemories('user-1');
      expect(pruned.prunedCount).toBe(2);
    });
  });

  describe('HTTP Routes', () => {
    it('requires authentication on /api/v1/memory/hybrid and /api/v1/memory/propose', async () => {
      const hybridRes = await request(app).get('/api/v1/memory/hybrid?q=roadmap');
      expect(hybridRes.status).toBe(401);

      const proposeRes = await request(app)
        .post('/api/v1/memory/propose')
        .send({ content: 'Prefers deep work in mornings' });
      expect(proposeRes.status).toBe(401);
    });
  });
});

