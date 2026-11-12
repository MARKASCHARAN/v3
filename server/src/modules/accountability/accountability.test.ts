import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { AccountabilityService, scoreProcrastinationSignals } from './accountability.service';
import { AccountabilityRepository } from './accountability.repository';
import {
  createAccountabilityLogSchema,
  createReminderSchema,
  generateInterventionsSchema,
  updateAccountabilityLogSchema,
} from './accountability.schema';

describe('Accountability Module', () => {
  describe('Schemas', () => {
    it('validates reminder, log, and intervention schemas', () => {
      const reminder = createReminderSchema.parse({
        title: 'Review weekly goal',
        remindAt: '2026-11-12T18:00:00.000Z',
      });
      expect(reminder.channel).toBe('IN_APP');

      const log = createAccountabilityLogSchema.parse({ notes: 'Completed 3 tasks' });
      expect(log.type).toBe('CHECK_IN');
      expect(log.severity).toBe('MEDIUM');

      const updated = updateAccountabilityLogSchema.parse({ status: 'RESOLVED' });
      expect(updated.status).toBe('RESOLVED');

      const interventionOpts = generateInterventionsSchema.parse({});
      expect(interventionOpts.maxInterventions).toBe(5);
      expect(interventionOpts.logAlerts).toBe(true);
    });
  });

  describe('AccountabilityService & Adaptive Procrastination Detection', () => {
    it('detects missed tasks without duplicating existing open alerts', async () => {
      const mockRepo = {
        findMissedTasks: vi.fn().mockResolvedValue([
          { id: 'task-1', title: 'Task One', goalId: 'goal-1', priority: 'HIGH' },
          { id: 'task-2', title: 'Task Two', goalId: null, priority: 'MEDIUM' },
        ]),
        findOpenLogsByTypeAndTaskIds: vi.fn().mockResolvedValue([{ taskId: 'task-1' }]),
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

    it('scores procrastination signals across overdue urgent, stale, and missed blocks', () => {
      const now = new Date('2026-11-12T10:00:00.000Z');
      const tenDaysAgo = new Date('2026-11-02T10:00:00.000Z');
      const analysis = scoreProcrastinationSignals(
        {
          activeTasks: [
            {
              id: 'task-1',
              goalId: 'goal-1',
              title: 'Submit application',
              priority: 'URGENT',
              status: 'TODO',
              dueDate: tenDaysAgo,
              updatedAt: tenDaysAgo,
            },
          ],
          recentBlocks: [
            { id: 'b-1', taskId: null, status: 'MISSED', endTime: tenDaysAgo },
            { id: 'b-2', taskId: null, status: 'MISSED', endTime: tenDaysAgo },
          ],
          missedTaskAlertsCount: 3,
        },
        now
      );

      expect(analysis.riskScore).toBeGreaterThanOrEqual(75);
      expect(analysis.riskLevel).toBe('CRITICAL');
      expect(analysis.signals.map((s) => s.type)).toContain('OVERDUE_HIGH_PRIORITY');
      expect(analysis.signals.map((s) => s.type)).toContain('STALE_TASK');
      expect(analysis.signals.map((s) => s.type)).toContain('RECURRING_DEFERRALS');
    });

    it('generates adaptive interventions and logs non-duplicate alerts', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const mockRepo = {
        findAdaptiveSignalsSnapshot: vi.fn().mockResolvedValue({
          activeTasks: [
            {
              id: 'task-1',
              goalId: null,
              title: 'Prepare system design',
              priority: 'HIGH',
              status: 'TODO',
              dueDate: oldDate,
              updatedAt: oldDate,
            },
          ],
          recentBlocks: [],
          missedTaskAlertsCount: 0,
        }),
        findOpenLogsByTypeAndTaskIds: vi.fn().mockResolvedValue([]),
        createLog: vi.fn().mockResolvedValue({ id: 'log-int-1' }),
        createReminder: vi.fn().mockResolvedValue({ id: 'rem-1' }),
      } as unknown as AccountabilityRepository;

      const service = new AccountabilityService(mockRepo);
      const output = await service.generateInterventions('user-1', {
        maxInterventions: 3,
        createReminders: true,
        logAlerts: true,
      });

      expect(output.interventions.length).toBeGreaterThan(0);
      expect(output.createdRemindersCount).toBe(1);
      expect(mockRepo.createReminder).toHaveBeenCalledOnce();
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
    it('GET /api/v1/accountability/summary and /procrastination require authentication', async () => {
      const response = await request(app).get('/api/v1/accountability/summary');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');

      const procRes = await request(app).get('/api/v1/accountability/procrastination');
      expect(procRes.status).toBe(401);
      expect(procRes.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
