import { describe, expect, it, vi } from 'vitest';
import { runBackgroundAgentJob } from './agent-jobs/autonomous-agent.job';
import { handleMissedTaskEvent } from './event-jobs/missed-task-event.job';
import { runDeadLetterAndStalledRecovery } from './recovery/dead-letter-recovery.job';
import { runApprovalExpirySweep } from './scheduled-jobs/approval-expiry-sweeper.job';
import { runDailyAccountabilityReview } from './scheduled-jobs/daily-accountability-review.job';
import { runMissedTaskScan } from './scheduled-jobs/missed-task-scanner.job';

describe('Background Autonomy Jobs (M2.7)', () => {
  it('runDailyAccountabilityReview reviews users, prunes expired memories, and emits daily events', async () => {
    const recordDailyReviewEvent = vi
      .fn()
      .mockResolvedValueOnce({ deduplicated: false })
      .mockResolvedValueOnce({ deduplicated: true });

    const result = await runDailyAccountabilityReview(
      { now: new Date('2026-11-12T08:00:00.000Z') },
      {
        findActiveUserIds: async () => ['user-1', 'user-2'],
        generateInterventionsForUser: async (uid) => ({
          riskScore: uid === 'user-1' ? 80 : 15,
          riskLevel: uid === 'user-1' ? 'CRITICAL' : 'LOW',
          interventions:
            uid === 'user-1'
              ? [{ action: 'DECOMPOSE_TASK', severity: 'CRITICAL', title: 'Split overdue work' }]
              : [],
        }),
        pruneExpiredMemoriesForUser: async (uid) => (uid === 'user-1' ? 2 : 0),
        recordDailyReviewEvent,
      }
    );

    expect(result).toEqual({
      usersReviewed: 2,
      highRiskUsers: 1,
      totalInterventions: 1,
      prunedMemories: 2,
      emittedEvents: 1,
    });
    expect(recordDailyReviewEvent).toHaveBeenCalledTimes(2);
  });

  it('runMissedTaskScan emits deduplicated TASK_MISSED events for overdue tasks', async () => {
    const emitMissedTaskEvent = vi
      .fn()
      .mockResolvedValueOnce({ deduplicated: false })
      .mockResolvedValueOnce({ deduplicated: true });

    const result = await runMissedTaskScan(
      { now: new Date('2026-11-12T09:00:00.000Z') },
      {
        findUsersWithOverdueTasks: async () => ['user-1'],
        checkMissedTasksForUser: async () => ({
          detected: 2,
          newlyLogged: 1,
          missedTasks: [
            {
              id: 'task-1',
              title: 'Draft quarterly memo',
              dueDate: new Date('2026-11-10T10:00:00.000Z'),
              goalId: 'goal-1',
            },
            {
              id: 'task-2',
              title: 'Review budget sheet',
              dueDate: new Date('2026-11-11T10:00:00.000Z'),
              goalId: null,
            },
          ],
        }),
        emitMissedTaskEvent,
      }
    );

    expect(result).toEqual({
      usersScanned: 1,
      missedTasksDetected: 2,
      newlyLoggedAlerts: 1,
      emittedEvents: 1,
      deduplicatedEvents: 1,
    });
  });

  it('runApprovalExpirySweep expires pending approvals, records events, and syncs executions', async () => {
    const markApprovalExpired = vi.fn().mockResolvedValue(undefined);
    const syncExecutionStatus = vi.fn().mockResolvedValue(undefined);
    const recordExpiryEvent = vi.fn().mockResolvedValue(undefined);

    const result = await runApprovalExpirySweep(
      { now: new Date('2026-11-12T10:00:00.000Z') },
      {
        findExpiredPendingApprovals: async () => [
          {
            id: 'app-1',
            executionId: 'exec-1',
            userId: 'user-1',
            toolName: 'createGoal',
            expiresAt: new Date('2026-11-12T09:00:00.000Z'),
          },
          {
            id: 'app-2',
            executionId: 'exec-1',
            userId: 'user-1',
            toolName: 'createTask',
            expiresAt: new Date('2026-11-12T09:30:00.000Z'),
          },
        ],
        markApprovalExpired,
        syncExecutionStatus,
        recordExpiryEvent,
      }
    );

    expect(result).toEqual({
      scannedCount: 2,
      expiredCount: 2,
      affectedExecutionIds: ['exec-1'],
    });
    expect(markApprovalExpired).toHaveBeenCalledTimes(2);
    expect(syncExecutionStatus).toHaveBeenCalledTimes(1);
    expect(syncExecutionStatus).toHaveBeenCalledWith('exec-1');
  });

  it('handleMissedTaskEvent creates follow-up reminder when procrastination risk is HIGH or CRITICAL', async () => {
    const createReminderIfMissing = vi.fn().mockResolvedValue({ id: 'rem-1' });

    const result = await handleMissedTaskEvent(
      {
        eventId: 'evt-1',
        userId: 'user-1',
        taskId: 'task-1',
        title: 'Finalize onboarding deck',
        goalId: 'goal-1',
      },
      {
        generateInterventions: async () => ({
          riskScore: 65,
          riskLevel: 'HIGH',
          interventions: [
            {
              action: 'DECOMPOSE_TASK',
              severity: 'HIGH',
              title: 'Break down overdue priority work',
              rationale: 'Task is overdue by 3 days',
            },
          ],
        }),
        createReminderIfMissing,
      }
    );

    expect(result.reminderCreated).toBe(true);
    expect(result.riskLevel).toBe('HIGH');
    expect(createReminderIfMissing).toHaveBeenCalledTimes(1);
  });

  it('runBackgroundAgentJob deduplicates by idempotencyKey before launching orchestrator', async () => {
    const runOrchestrator = vi.fn();

    const dedupResult = await runBackgroundAgentJob(
      {
        userId: 'user-1',
        prompt: 'Analyze weekly goals',
        idempotencyKey: 'bg-agent:daily:user-1:2026-11-12',
      },
      {
        findExistingByIdempotencyKey: async () => ({
          id: 'exec-existing',
          status: 'COMPLETED',
          threadId: 'thread-existing',
          responseText: 'Already processed today.',
        }),
        runOrchestrator,
      }
    );

    expect(dedupResult.deduplicated).toBe(true);
    expect(dedupResult.executionId).toBe('exec-existing');
    expect(runOrchestrator).not.toHaveBeenCalled();

    const freshRunner = vi.fn().mockResolvedValue({
      id: 'exec-new',
      status: 'COMPLETED',
      threadId: 'thread-new',
      responseText: 'Completed fresh run.',
      tokensUsed: 420,
    });

    const freshResult = await runBackgroundAgentJob(
      {
        userId: 'user-1',
        prompt: 'Analyze weekly goals',
        triggerType: 'SCHEDULED',
        idempotencyKey: 'bg-agent:daily:user-1:2026-11-13',
      },
      {
        findExistingByIdempotencyKey: async () => null,
        runOrchestrator: freshRunner,
      }
    );

    expect(freshResult.deduplicated).toBe(false);
    expect(freshResult.executionId).toBe('exec-new');
    expect(freshRunner).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: 'SCHEDULED',
        idempotencyKey: 'bg-agent:daily:user-1:2026-11-13',
      })
    );
  });

  it('runDeadLetterAndStalledRecovery recovers stalled jobs, dead-letters exhausted events, closes timed-out executions, and sweeps expiries', async () => {
    const markJobFailedOrDeadLetter = vi
      .fn()
      .mockResolvedValueOnce({ status: 'FAILED' })
      .mockResolvedValueOnce({ status: 'DEAD_LETTER' });
    const markEventFailedOrDeadLetter = vi.fn().mockResolvedValue({ status: 'DEAD_LETTER' });
    const markExecutionTimedOut = vi.fn().mockResolvedValue(undefined);

    const result = await runDeadLetterAndStalledRecovery(
      {
        now: new Date('2026-11-12T12:00:00.000Z'),
        staleMinutes: 30,
      },
      {
        findStalledJobs: async () => [{ id: 'job-1' }, { id: 'job-2' }],
        markJobFailedOrDeadLetter,
        findRetryableEvents: async () => [{ id: 'evt-1' }],
        markEventFailedOrDeadLetter,
        findStaleExecutions: async () => [{ id: 'exec-stale-1' }],
        markExecutionTimedOut,
        runApprovalSweep: async () => ({ expiredCount: 3 }),
        pruneExpiredMemories: async () => 5,
      }
    );

    expect(result).toEqual({
      stalledJobsInspected: 2,
      jobsRequeuedOrFailed: 1,
      jobsDeadLettered: 1,
      eventsDeadLettered: 1,
      staleExecutionsFailed: 1,
      expiredApprovals: 3,
      prunedMemories: 5,
    });
  });
});

