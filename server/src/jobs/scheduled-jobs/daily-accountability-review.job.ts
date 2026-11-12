import { schedules } from '@trigger.dev/sdk';
import { prisma } from '../../database/prisma';
import { AccountabilityService } from '../../modules/accountability/accountability.service';
import { EventsRepository } from '../../modules/events/events.repository';
import { MemoryRepository } from '../../modules/memory/memory.repository';

export interface DailyAccountabilityReviewOptions {
  userId?: string;
  now?: Date;
  pruneMemories?: boolean;
}

export interface DailyAccountabilityReviewDeps {
  findActiveUserIds?: (targetUserId?: string) => Promise<string[]>;
  generateInterventionsForUser?: (userId: string) => Promise<{
    riskScore: number;
    riskLevel: string;
    interventions: Array<{ action: string; severity: string; title: string }>;
  }>;
  pruneExpiredMemoriesForUser?: (userId: string, now: Date) => Promise<number>;
  recordDailyReviewEvent?: (params: {
    userId: string;
    dayKey: string;
    riskScore: number;
    riskLevel: string;
    interventionCount: number;
    prunedMemories: number;
  }) => Promise<{ deduplicated: boolean }>;
}

export interface DailyAccountabilityReviewResult {
  usersReviewed: number;
  highRiskUsers: number;
  totalInterventions: number;
  prunedMemories: number;
  emittedEvents: number;
}

export const runDailyAccountabilityReview = async (
  options: DailyAccountabilityReviewOptions = {},
  deps: DailyAccountabilityReviewDeps = {}
): Promise<DailyAccountabilityReviewResult> => {
  const now = options.now ?? new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const accountabilityService = new AccountabilityService();
  const memoryRepo = new MemoryRepository();
  const eventsRepo = new EventsRepository();

  const findUsers =
    deps.findActiveUserIds ??
    (async (targetUserId?: string) => {
      if (targetUserId) {
        return [targetUserId];
      }
      const rows = await prisma.user.findMany({
        select: { id: true },
        take: 200,
      });
      return rows.map((row) => row.id);
    });

  const generateInterventions =
    deps.generateInterventionsForUser ??
    ((uid: string) =>
      accountabilityService.generateInterventions(uid, {
        maxInterventions: 5,
        createReminders: false,
        logAlerts: true,
      }));

  const pruneMemories =
    deps.pruneExpiredMemoriesForUser ?? ((uid: string) => memoryRepo.deleteExpiredMemories(uid));

  const recordReviewEvent =
    deps.recordDailyReviewEvent ??
    (async (params) => {
      const res = await eventsRepo.createDomainEventWithDedup({
        userId: params.userId,
        eventType: 'DAILY_REVIEW_TRIGGERED',
        source: 'SCHEDULER',
        payload: {
          dayKey: params.dayKey,
          riskScore: params.riskScore,
          riskLevel: params.riskLevel,
          interventionCount: params.interventionCount,
          prunedMemories: params.prunedMemories,
        },
        idempotencyKey: `daily-review:${params.userId}:${params.dayKey}`,
      });
      return { deduplicated: res.deduplicated };
    });

  const userIds = await findUsers(options.userId);
  let highRiskUsers = 0;
  let totalInterventions = 0;
  let prunedMemoriesCount = 0;
  let emittedEvents = 0;

  for (const uid of userIds) {
    const result = await generateInterventions(uid);
    const pruned = options.pruneMemories === false ? 0 : await pruneMemories(uid, now);
    prunedMemoriesCount += pruned;
    totalInterventions += result.interventions.length;

    if (result.riskLevel === 'HIGH' || result.riskLevel === 'CRITICAL') {
      highRiskUsers += 1;
    }

    const emitted = await recordReviewEvent({
      userId: uid,
      dayKey,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      interventionCount: result.interventions.length,
      prunedMemories: pruned,
    });
    if (!emitted.deduplicated) {
      emittedEvents += 1;
    }
  }

  return {
    usersReviewed: userIds.length,
    highRiskUsers,
    totalInterventions,
    prunedMemories: prunedMemoriesCount,
    emittedEvents,
  };
};

export const dailyAccountabilityReviewSchedule = schedules.task({
  id: 'daily-accountability-review',
  cron: '0 8 * * *',
  run: async (payload) => runDailyAccountabilityReview({ now: payload.timestamp }),
});
