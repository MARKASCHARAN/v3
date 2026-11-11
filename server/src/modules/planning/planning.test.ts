import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { PlanningService } from './planning.service';
import { PlanningRepository } from './planning.repository';
import { PlanGenerator } from './planning.types';
import { createPlanSchema, generatePlanSchema } from './planning.schema';
import { buildGoalDecompositionPrompt } from '../../ai/prompts/planning.prompt';

describe('Planning Module', () => {
  describe('Schemas & Prompt', () => {
    it('validates generatePlanSchema requires goalId or goalTitle', () => {
      expect(() => generatePlanSchema.parse({})).toThrow();
      const parsed = generatePlanSchema.parse({ goalTitle: 'Launch V3 Beta', targetYear: 2026 });
      expect(parsed.timeframe).toBe('YEARLY');
    });

    it('validates createPlanSchema defaults', () => {
      const plan = createPlanSchema.parse({
        title: 'Launch Plan',
        summary: 'Three phase execution',
      });
      expect(plan.milestones).toEqual([]);
      expect(plan.tasks).toEqual([]);
    });

    it('builds prompt including preferences and memories', () => {
      const prompt = buildGoalDecompositionPrompt({
        goalTitle: 'Run Half Marathon',
        timeframe: 'QUARTERLY',
        preferences: [{ key: 'training_days', value: 'Tue, Thu, Sun' }],
        memories: [
          { title: 'Injury note', content: 'Avoid back-to-back long runs', category: 'FACT' },
        ],
      });
      expect(prompt).toContain('Run Half Marathon');
      expect(prompt).toContain('training_days: Tue, Thu, Sun');
      expect(prompt).toContain('Avoid back-to-back long runs');
    });
  });

  describe('PlanningService', () => {
    it('decomposes goal using generator and saves draft plan', async () => {
      const mockRepo = {
        findUserContext: vi.fn().mockResolvedValue({ preferences: [], memories: [] }),
        create: vi.fn().mockImplementation(async (_userId, data) => ({
          id: 'plan-1',
          status: 'DRAFT',
          ...data,
        })),
      } as unknown as PlanningRepository;

      const mockGenerator: PlanGenerator = {
        decomposeGoal: vi.fn().mockResolvedValue({
          provider: 'google',
          model: 'gemini-2.5-flash',
          plan: {
            title: 'Master TypeScript',
            summary: '4-week roadmap',
            milestones: [{ title: 'Core Types', order: 0 }],
            tasks: [{ title: 'Practice generics', priority: 'HIGH', milestoneIndex: 0 }],
          },
        }),
      };

      const service = new PlanningService(mockRepo, mockGenerator);
      const result = await service.generatePlan('user-1', {
        goalTitle: 'Master TypeScript',
        timeframe: 'MONTHLY',
      });

      expect(result.title).toBe('Master TypeScript');
      expect(result.provider).toBe('google');
      expect(mockGenerator.decomposeGoal).toHaveBeenCalledOnce();
    });

    it('prevents re-applying an already applied plan', async () => {
      const mockRepo = {
        findByIdAndUserId: vi.fn().mockResolvedValue({
          id: 'plan-1',
          status: 'APPLIED',
          milestonesData: [],
          tasksData: [],
        }),
      } as unknown as PlanningRepository;
      const service = new PlanningService(mockRepo);

      await expect(service.applyPlan('plan-1', 'user-1')).rejects.toThrow(
        'Plan has already been applied'
      );
    });
  });

  describe('HTTP Routes', () => {
    it('GET /api/v1/planning/plans requires authentication', async () => {
      const response = await request(app).get('/api/v1/planning/plans');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
