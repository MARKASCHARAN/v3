import { schedules } from '@trigger.dev/sdk';
import { prisma } from '../../database/prisma';
import { EventsRepository } from '../../modules/events/events.repository';
import { runApprovalExpirySweep } from '../scheduled-jobs/approval-expiry-sweeper.job';

export interface DeadLetterRecoveryOptions {
  userId?: string;
  now?: Date;
  staleMinutes?: number;
  includeApprovalExpiry?: boolean;
  includeMemoryPrune?: boolean;
}

export interface DeadLetterRecoveryDeps {
  findStalledJobs?: (cutoff: Date, userId?: string) => Promise<Array<{ id: string }>>;
  markJobFailedOrDeadLetter?: (jobId: string, errorMessage: string) => Promise<{ status: string }>;
  findRetryableEvents?: (userId?: string) => Promise<Array<{ id: string }>>;
  markEventFailedOrDeadLetter?: (
    eventId: string,
    errorMessage: string
  ) => Promise<{ status: string }>;
  findStaleExecutions?: (cutoff: Date, userId?: string) => Promise<Array<{ id: string }>>;
  markExecutionTimedOut?: (executionId: string, now: Date) => Promise<unknown>;
  runApprovalSweep?: (userId?: string, now?: Date) => Promise<{ expiredCount: number }>;
  pruneExpiredMemories?: (now: Date, userId?: string) => Promise<number>;
}

export interface DeadLetterRecoveryResult {
  stalledJobsInspected: number;
  jobsRequeuedOrFailed: number;
  jobsDeadLettered: number;
  eventsDeadLettered: number;
  staleExecutionsFailed: number;
  expiredApprovals: number;
  prunedMemories: number;
}

export const runDeadLetterAndStalledRecovery = async (
  options: DeadLetterRecoveryOptions = {},
  deps: DeadLetterRecoveryDeps = {}
): Promise<DeadLetterRecoveryResult> => {
  const now = options.now ?? new Date();
  const staleMinutes = options.staleMinutes ?? 30;
  const staleCutoff = new Date(now.getTime() - staleMinutes * 60 * 1000);
  const eventsRepo = new EventsRepository();

  const findStalledJobs =
    deps.findStalledJobs ??
    ((cutoff: Date, uid?: string) => eventsRepo.findStalledRunningJobs(cutoff, uid));
  const markJobOutcome =
    deps.markJobFailedOrDeadLetter ??
    ((jobId: string, reason: string) => eventsRepo.markJobFailedOrDeadLetter(jobId, reason));

  const findRetryableEvents =
    deps.findRetryableEvents ?? ((uid?: string) => eventsRepo.findRetryableDomainEvents(uid));
  const markEventOutcome =
    deps.markEventFailedOrDeadLetter ??
    ((eventId: string, reason: string) =>
      eventsRepo.markDomainEventFailedOrDeadLetter(eventId, reason));

  const findStaleExecutions =
    deps.findStaleExecutions ??
    ((cutoff: Date, uid?: string) =>
      prisma.aiExecution.findMany({
        where: {
          status: 'RUNNING',
          ...(uid ? { userId: uid } : {}),
          OR: [{ timeoutAt: { lt: now } }, { startedAt: { lt: cutoff }, timeoutAt: null }],
        },
        select: { id: true },
        take: 100,
      }));

  const markExecutionTimedOut =
    deps.markExecutionTimedOut ??
    ((executionId: string, timestamp: Date) =>
      prisma.aiExecution.update({
        where: { id: executionId },
        data: {
          status: 'FAILED',
          errorMessage: 'Execution exceeded timeout threshold and was closed by recovery sweep',
          completedAt: timestamp,
        },
      }));

  const stalledJobs = await findStalledJobs(staleCutoff, options.userId);
  let jobsRequeuedOrFailed = 0;
  let jobsDeadLettered = 0;

  for (const job of stalledJobs) {
    const updated = await markJobOutcome(
      job.id,
      `Job exceeded running threshold (${staleMinutes}m) and entered recovery`
    );
    if (updated.status === 'DEAD_LETTER') {
      jobsDeadLettered += 1;
    } else {
      jobsRequeuedOrFailed += 1;
    }
  }

  const failedEvents = await findRetryableEvents(options.userId);
  let eventsDeadLettered = 0;
  for (const evt of failedEvents) {
    const updated = await markEventOutcome(evt.id, 'Event processing retry threshold reached');
    if (updated.status === 'DEAD_LETTER') {
      eventsDeadLettered += 1;
    }
  }

  const staleExecutions = await findStaleExecutions(staleCutoff, options.userId);
  for (const exec of staleExecutions) {
    await markExecutionTimedOut(exec.id, now);
  }

  let expiredApprovals = 0;
  if (options.includeApprovalExpiry !== false) {
    const sweep = deps.runApprovalSweep
      ? await deps.runApprovalSweep(options.userId, now)
      : await runApprovalExpirySweep({ userId: options.userId, now });
    expiredApprovals = sweep.expiredCount;
  }

  let prunedMemories = 0;
  if (options.includeMemoryPrune !== false) {
    prunedMemories = deps.pruneExpiredMemories
      ? await deps.pruneExpiredMemories(now, options.userId)
      : (
          await prisma.memory.deleteMany({
            where: {
              ...(options.userId ? { userId: options.userId } : {}),
              expiresAt: { not: null, lt: now },
            },
          })
        ).count;
  }

  return {
    stalledJobsInspected: stalledJobs.length,
    jobsRequeuedOrFailed,
    jobsDeadLettered,
    eventsDeadLettered,
    staleExecutionsFailed: staleExecutions.length,
    expiredApprovals,
    prunedMemories,
  };
};

export const deadLetterRecoverySchedule = schedules.task({
  id: 'dead-letter-recovery',
  cron: '*/30 * * * *',
  run: async (payload) => runDeadLetterAndStalledRecovery({ now: payload.timestamp }),
});
