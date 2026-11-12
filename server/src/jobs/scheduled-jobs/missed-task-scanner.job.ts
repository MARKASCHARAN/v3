import { schedules } from '@trigger.dev/sdk';
import { prisma } from '../../database/prisma';
import { AccountabilityService } from '../../modules/accountability/accountability.service';
import { EventsRepository } from '../../modules/events/events.repository';

export interface MissedTaskScanOptions {
  userId?: string;
  now?: Date;
}

export interface MissedTaskScanDeps {
  findUsersWithOverdueTasks?: (now: Date, userId?: string) => Promise<string[]>;
  checkMissedTasksForUser?: (userId: string) => Promise<{
    detected: number;
    newlyLogged: number;
    missedTasks: Array<{ id: string; title: string; dueDate: Date | null; goalId: string | null }>;
  }>;
  emitMissedTaskEvent?: (params: {
    userId: string;
    taskId: string;
    title: string;
    goalId: string | null;
    dueDate: Date | null;
    dayKey: string;
  }) => Promise<{ deduplicated: boolean }>;
}

export interface MissedTaskScanResult {
  usersScanned: number;
  missedTasksDetected: number;
  newlyLoggedAlerts: number;
  emittedEvents: number;
  deduplicatedEvents: number;
}

export const runMissedTaskScan = async (
  options: MissedTaskScanOptions = {},
  deps: MissedTaskScanDeps = {}
): Promise<MissedTaskScanResult> => {
  const now = options.now ?? new Date();
  const dayKey = now.toISOString().slice(0, 10);
  const accountabilityService = new AccountabilityService();
  const eventsRepo = new EventsRepository();

  const findUsers =
    deps.findUsersWithOverdueTasks ??
    (async (cutoff: Date, targetUserId?: string) => {
      if (targetUserId) {
        return [targetUserId];
      }
      const rows = await prisma.task.findMany({
        where: {
          dueDate: { lt: cutoff },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
        select: { userId: true },
        distinct: ['userId'],
        take: 200,
      });
      return rows.map((row) => row.userId);
    });

  const checkMissed =
    deps.checkMissedTasksForUser ??
    (async (uid: string) => {
      const res = await accountabilityService.detectAndLogMissedTasks(uid);
      return {
        detected: res.missedTasksCount,
        newlyLogged: res.newlyLoggedCount,
        missedTasks: res.missedTasks,
      };
    });

  const emitEvent =
    deps.emitMissedTaskEvent ??
    (async (params) => {
      const result = await eventsRepo.createDomainEventWithDedup({
        userId: params.userId,
        eventType: 'TASK_MISSED',
        source: 'SCHEDULER',
        payload: {
          taskId: params.taskId,
          title: params.title,
          goalId: params.goalId,
          dueDate: params.dueDate ? params.dueDate.toISOString() : null,
        },
        idempotencyKey: `task-missed:${params.userId}:${params.taskId}:${params.dayKey}`,
      });
      return { deduplicated: result.deduplicated };
    });

  const userIds = await findUsers(now, options.userId);
  let missedTasksDetected = 0;
  let newlyLoggedAlerts = 0;
  let emittedEvents = 0;
  let deduplicatedEvents = 0;

  for (const uid of userIds) {
    const check = await checkMissed(uid);
    missedTasksDetected += check.detected;
    newlyLoggedAlerts += check.newlyLogged;

    for (const task of check.missedTasks) {
      const emission = await emitEvent({
        userId: uid,
        taskId: task.id,
        title: task.title,
        goalId: task.goalId,
        dueDate: task.dueDate,
        dayKey,
      });
      if (emission.deduplicated) {
        deduplicatedEvents += 1;
      } else {
        emittedEvents += 1;
      }
    }
  }

  return {
    usersScanned: userIds.length,
    missedTasksDetected,
    newlyLoggedAlerts,
    emittedEvents,
    deduplicatedEvents,
  };
};

export const missedTaskScannerSchedule = schedules.task({
  id: 'missed-task-scanner',
  cron: '0 * * * *',
  run: async (payload) => runMissedTaskScan({ now: payload.timestamp }),
});
