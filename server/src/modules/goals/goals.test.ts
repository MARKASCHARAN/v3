import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { Request, Response } from 'express';
import { app } from '../../app';
import { GoalsService, calculateGoalProgress } from './goals.service';
import { GoalsRepository } from './goals.repository';
import {
  createGoalSchema,
  createMilestoneSchema,
  goalIdParamSchema,
  goalsQuerySchema,
  updateGoalSchema,
} from './goals.schema';
import { AppError } from '../../middleware/error.middleware';
import { validateRequest } from '../../middleware/validation.middleware';

describe('Goals Module', () => {
  describe('Schemas', () => {
    it('validates createGoalSchema with yearly defaults', () => {
      const parsed = createGoalSchema.parse({ title: 'Ship V3 Phase 1', targetYear: 2026 });
      expect(parsed.title).toBe('Ship V3 Phase 1');
      expect(parsed.category).toBe('GENERAL');
      expect(parsed.timeframe).toBe('YEARLY');
      expect(parsed.targetYear).toBe(2026);
    });

    it('rejects empty title in createGoalSchema', () => {
      expect(() => createGoalSchema.parse({ title: '   ' })).toThrow();
    });

    it('validates updateGoalSchema and goalsQuerySchema', () => {
      const updated = updateGoalSchema.parse({ status: 'COMPLETED', parentGoalId: null });
      expect(updated.status).toBe('COMPLETED');
      expect(updated.parentGoalId).toBeNull();

      const query = goalsQuerySchema.parse({
        timeframe: 'YEARLY',
        targetYear: '2026',
        parentGoalId: 'null',
      });
      expect(query.targetYear).toBe(2026);
      expect(query.parentGoalId).toBe('null');
    });

    it('validates milestone and UUID param schemas', () => {
      expect(() => goalIdParamSchema.parse({ id: 'not-a-uuid' })).toThrow();
      const valid = goalIdParamSchema.parse({ id: '550e8400-e29b-41d4-a716-446655440000' });
      expect(valid.id).toBe('550e8400-e29b-41d4-a716-446655440000');

      const milestone = createMilestoneSchema.parse({ title: 'Define schema' });
      expect(milestone.order).toBe(0);
      expect(milestone.isCompleted).toBe(false);
    });
  });

  describe('Progress Calculation & Hierarchy', () => {
    it('calculates progress from milestones, subGoals, and completed status', () => {
      expect(
        calculateGoalProgress({
          status: 'ACTIVE',
          progress: 0,
          milestones: [{ isCompleted: true }, { isCompleted: false }, { isCompleted: true }],
          subGoals: [],
        })
      ).toBe(67);

      expect(
        calculateGoalProgress({
          status: 'ACTIVE',
          progress: 0,
          milestones: [],
          subGoals: [{ progress: 50 }, { progress: 100 }],
        })
      ).toBe(75);

      expect(
        calculateGoalProgress({
          status: 'COMPLETED',
          progress: 10,
          milestones: [{ isCompleted: false }],
          subGoals: [],
        })
      ).toBe(100);
    });

    it('throws GOAL_NOT_FOUND when goal does not exist', async () => {
      const mockRepo = {
        findByIdAndUserId: vi.fn().mockResolvedValue(null),
      } as unknown as GoalsRepository;
      const service = new GoalsService(mockRepo);

      await expect(service.getGoalById('missing-id', 'user-1')).rejects.toBeInstanceOf(AppError);
    });

    it('prevents circular parentGoalId assignment', async () => {
      const goalA = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        parentGoalId: null,
        status: 'ACTIVE',
        progress: 0,
        milestones: [],
        subGoals: [],
      };
      const goalB = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        parentGoalId: goalA.id,
        status: 'ACTIVE',
        progress: 0,
        milestones: [],
        subGoals: [],
      };
      const mockRepo = {
        findByIdAndUserId: vi.fn().mockImplementation(async (id: string) => {
          if (id === goalA.id) return goalA;
          if (id === goalB.id) return goalB;
          return null;
        }),
      } as unknown as GoalsRepository;
      const service = new GoalsService(mockRepo);

      await expect(
        service.updateGoal(goalA.id, 'user-1', { parentGoalId: goalB.id })
      ).rejects.toThrow('Goal hierarchy cannot contain cycles');
    });

    it('recalculates goal progress when milestone is toggled', async () => {
      const goalId = '550e8400-e29b-41d4-a716-446655440001';
      const milestoneId = '550e8400-e29b-41d4-a716-446655440099';
      const mockRepo = {
        findByIdAndUserId: vi
          .fn()
          .mockResolvedValueOnce({
            id: goalId,
            parentGoalId: null,
            status: 'ACTIVE',
            progress: 0,
            milestones: [{ isCompleted: false }, { isCompleted: false }],
            subGoals: [],
          })
          .mockResolvedValueOnce({
            id: goalId,
            parentGoalId: null,
            status: 'ACTIVE',
            progress: 0,
            milestones: [{ isCompleted: true }, { isCompleted: false }],
            subGoals: [],
          }),
        findMilestoneByIdAndGoalId: vi.fn().mockResolvedValue({ id: milestoneId, goalId }),
        updateMilestone: vi.fn().mockResolvedValue({ id: milestoneId, isCompleted: true }),
        updateProgress: vi.fn().mockResolvedValue({ id: goalId, progress: 50 }),
      } as unknown as GoalsRepository;
      const service = new GoalsService(mockRepo);

      await service.updateMilestone(goalId, milestoneId, 'user-1', { isCompleted: true });
      expect(mockRepo.updateProgress).toHaveBeenCalledWith(goalId, 50);
    });
  });

  describe('Validation Middleware', () => {
    it('parses valid body and calls next', () => {
      const middleware = validateRequest({ body: createGoalSchema });
      const req = { body: { title: '  Finish Backend  ' } } as Request;
      const next = vi.fn();
      middleware(req, {} as Response, next);
      expect(req.body.title).toBe('Finish Backend');
      expect(req.body.category).toBe('GENERAL');
      expect(next).toHaveBeenCalledOnce();
    });

    it('throws ZodError for invalid params', () => {
      const middleware = validateRequest({ params: goalIdParamSchema });
      const req = { params: { id: 'bad-id' } } as unknown as Request;
      expect(() => middleware(req, {} as Response, vi.fn())).toThrow();
    });
  });

  describe('HTTP Routes', () => {
    it('GET /api/v1/goals requires authentication', async () => {
      const response = await request(app).get('/api/v1/goals');
      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
