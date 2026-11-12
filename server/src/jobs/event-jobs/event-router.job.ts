import { task } from '@trigger.dev/sdk';
import { prisma } from '../../database/prisma';
import { BackgroundJobRecord, BackgroundJobType } from '../../modules/events/events.types';
import {
  AutonomousAgentJobPayload,
  runBackgroundAgentJob,
} from '../agent-jobs/autonomous-agent.job';
import { runApprovalExpirySweep } from '../scheduled-jobs/approval-expiry-sweeper.job';
import { runDailyAccountabilityReview } from '../scheduled-jobs/daily-accountability-review.job';
import { runMissedTaskScan } from '../scheduled-jobs/missed-task-scanner.job';
import { handleMissedTaskEvent, MissedTaskEventPayload } from './missed-task-event.job';

export const executeBackgroundJobLocally = async (
  job: Pick<
    BackgroundJobRecord,
    'id' | 'userId' | 'jobType' | 'payload' | 'domainEventId' | 'idempotencyKey'
  >
): Promise<Record<string, unknown>> => {
  const payload =
    typeof job.payload === 'object' && job.payload !== null
      ? (job.payload as Record<string, unknown>)
      : {};
  const jobType = job.jobType as BackgroundJobType;

  if (jobType === 'DAILY_ACCOUNTABILITY_REVIEW') {
    const result = await runDailyAccountabilityReview({
      userId: job.userId,
      pruneMemories: payload.pruneMemories !== false,
    });
    return result as unknown as Record<string, unknown>;
  }

  if (jobType === 'MISSED_TASK_SCAN') {
    const result = await runMissedTaskScan({
      userId: job.userId,
    });
    return result as unknown as Record<string, unknown>;
  }

  if (jobType === 'MISSED_TASK_EVENT_REACTION') {
    const reactionPayload: MissedTaskEventPayload = {
      eventId: job.domainEventId ?? undefined,
      userId: job.userId,
      taskId: typeof payload.taskId === 'string' ? payload.taskId : undefined,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      goalId: typeof payload.goalId === 'string' ? payload.goalId : null,
      dueDate: typeof payload.dueDate === 'string' ? payload.dueDate : null,
    };
    const result = await handleMissedTaskEvent(reactionPayload);
    return result as unknown as Record<string, unknown>;
  }

  if (jobType === 'APPROVAL_EXPIRY_SWEEP') {
    const result = await runApprovalExpirySweep({
      userId: job.userId,
    });
    return result as unknown as Record<string, unknown>;
  }

  if (jobType === 'MEMORY_PRUNE') {
    const deleted = await prisma.memory.deleteMany({
      where: {
        userId: job.userId,
        expiresAt: { not: null, lt: new Date() },
      },
    });
    return { prunedMemories: deleted.count };
  }

  if (jobType === 'AGENT_RUN') {
    const agentPayload: AutonomousAgentJobPayload = {
      userId: job.userId,
      prompt:
        typeof payload.prompt === 'string' && payload.prompt.trim().length > 0
          ? payload.prompt
          : 'Review active workspace context and summarize next recommended actions.',
      sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : 'background',
      agentRole:
        typeof payload.agentRole === 'string'
          ? (payload.agentRole as AutonomousAgentJobPayload['agentRole'])
          : 'MAIN_ORCHESTRATOR',
      tokenBudget: typeof payload.tokenBudget === 'number' ? payload.tokenBudget : undefined,
      maxSteps: typeof payload.maxSteps === 'number' ? payload.maxSteps : 5,
      triggerType: payload.triggerType === 'SCHEDULED' ? 'SCHEDULED' : 'EVENT',
      idempotencyKey:
        typeof payload.idempotencyKey === 'string'
          ? payload.idempotencyKey
          : (job.idempotencyKey ?? `job:${job.id}`),
      allowAutoApproveWrites: payload.allowAutoApproveWrites === true,
    };
    const result = await runBackgroundAgentJob(agentPayload);
    return result as unknown as Record<string, unknown>;
  }

  return {
    acknowledged: true,
    jobType,
    payload,
  };
};

export const domainEventRouterTask = task({
  id: 'domain-event-router',
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 3000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: {
    jobId: string;
    userId: string;
    jobType: BackgroundJobType;
    eventPayload: Record<string, unknown>;
    domainEventId?: string;
    idempotencyKey?: string;
  }) =>
    executeBackgroundJobLocally({
      id: payload.jobId,
      userId: payload.userId,
      jobType: payload.jobType,
      payload: payload.eventPayload,
      domainEventId: payload.domainEventId ?? null,
      idempotencyKey: payload.idempotencyKey ?? null,
    }),
});
