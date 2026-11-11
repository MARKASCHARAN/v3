import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { AccountabilityService } from './accountability.service';
import { AccountabilityRepository } from './accountability.repository';
import {
  createAccountabilityLogSchema,
  createReminderSchema,
  updateAccountabilityLogSchema,
} from './accountability.schema';

describe('Accountability Module', () => {
  describe('Schemas', () => {
    it('validates reminder and log schemas', () => {
      const reminder = createReminderSchema.parse({
        title: 'Review weekly goal',
        remindAt: '2026-11-12T18:00:00.000Z',
      });
      expect(reminder.channel).toBe('IN_APP');

      const log = createAccountabilityLogSchema.parse({ notes: 'Completed 3 tasks' });
      expect(log.type).toBe('CHECK_IN');

      const updated = updateAccountabilityLogSchema.parse({ status: 'RESOLVED' });
      expect(updated.status).toBe('RESOLVED');
    });
  });

  describe('AccountabilityService', () => {
    it('detects missed tasks without duplicating existing open alerts', async () => {
      const mockRepo = {
        findMissedTasks: vi.fn().mockResolvedValue([
          { id: 'task-1', title: 'Task One', goalId: 'goal-1' },
          { id: 'task-2', title: 'Task Two', goalId: null },
        ]),
        findOpenMissedTaskLogs: vi.fn().mockResolvedValue([{ taskId: 'task-1' }]),
        createLog: vi
          .fn()
          .mockResolvedValue({ id: 'log-2', taskId: 'task-2', type: 'MISSED_TASK' }),
      } as unknown as AccountabilityRepository;
      const service = new AccountabilityService(mockRepo);

      const result = await service.detectAndLogMissedTasks('user-1');
      expect(result.missedTasksCount).toBe(2);
      expect(result.newlyLoggedCount).toBe(1);
      expect(mockRepo.createLog).toHaveBeenCalledTimes(1);
    });

    it('calculates progress summary metrics', async () => {
      const mockRepo = {
        getProgressSnapshot: vi.fn().mockResolvedValue({
          totalTasks: 4,
          completedTasks: 3,
          overdueTasks: 1,
          goals: [
            { status: 'ACTIVE', progress: 40 },
            { status: 'COMPLETED', progress: 100 },
          ],
          pendingReminders: 2,
          openAlerts: 1,
        }),
      } as unknown as AccountabilityRepository;
      const service = new AccountabilityService(mockRepo);

      const summary = await service.getProgressSummary('user-1');
      expect(summary.tasks.completionRate).toBe(75);
      expect(summary.goals.averageProgress).toBe(70);
      expect(summary.goals.active).toBe(1);
    });
  });

  describe('HTTP Routes', () => {
    it('GET /api/v1/accountability/summary requires authentication', async () => {
      const response = await request(app).get('/api/v1/accountability/summary');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
