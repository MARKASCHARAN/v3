import { task } from '@trigger.dev/sdk';
import { AccountabilityService } from '../../modules/accountability/accountability.service';
import { DomainEventRecord } from '../../modules/events/events.types';

export interface MissedTaskEventPayload {
  eventId?: string;
  userId: string;
  taskId?: string;
  title?: string;
  goalId?: string | null;
  dueDate?: string | null;
}

export interface MissedTaskEventDeps {
  generateInterventions?: (userId: string) => Promise<{
    riskScore: number;
    riskLevel: string;
    interventions: Array<{ action: string; severity: string; title: string; rationale: string }>;
  }>;
  createReminderIfMissing?: (params: {
    userId: string;
    taskId?: string;
    goalId?: string | null;
    title: string;
    message: string;
  }) => Promise<unknown>;
}

export interface MissedTaskEventResult {
  userId: string;
  taskId: string | null;
  riskScore: number;
  riskLevel: string;
  interventionCount: number;
  reminderCreated: boolean;
}

export const handleMissedTaskEvent = async (
  payload: MissedTaskEventPayload,
  deps: MissedTaskEventDeps = {}
): Promise<MissedTaskEventResult> => {
  const accountabilityService = new AccountabilityService();
  const generateInterventions =
    deps.generateInterventions ??
    ((uid: string) =>
      accountabilityService.generateInterventions(uid, {
        maxInterventions: 5,
        createReminders: false,
        logAlerts: true,
      }));

  const createReminder =
    deps.createReminderIfMissing ??
    ((params) =>
      accountabilityService.createReminder(params.userId, {
        taskId: params.taskId,
        goalId: params.goalId ?? undefined,
        title: params.title,
        message: params.message,
        remindAt: new Date(Date.now() + 60 * 60 * 1000),
        channel: 'IN_APP',
      }));

  const outcome = await generateInterventions(payload.userId);
  let reminderCreated = false;

  if (payload.title && (outcome.riskLevel === 'HIGH' || outcome.riskLevel === 'CRITICAL')) {
    await createReminder({
      userId: payload.userId,
      taskId: payload.taskId,
      goalId: payload.goalId,
      title: `Follow up overdue task: ${payload.title}`,
      message:
        outcome.interventions[0]?.rationale ??
        `Task "${payload.title}" missed its deadline. Break down or reschedule the next step.`,
    });
    reminderCreated = true;
  }

  return {
    userId: payload.userId,
    taskId: payload.taskId ?? null,
    riskScore: outcome.riskScore,
    riskLevel: outcome.riskLevel,
    interventionCount: outcome.interventions.length,
    reminderCreated,
  };
};

export const mapDomainEventToMissedTaskPayload = (
  event: DomainEventRecord
): MissedTaskEventPayload => {
  const data =
    typeof event.payload === 'object' && event.payload !== null
      ? (event.payload as Record<string, unknown>)
      : {};
  return {
    eventId: event.id,
    userId: event.userId,
    taskId: typeof data.taskId === 'string' ? data.taskId : undefined,
    title: typeof data.title === 'string' ? data.title : undefined,
    goalId: typeof data.goalId === 'string' ? data.goalId : null,
    dueDate: typeof data.dueDate === 'string' ? data.dueDate : null,
  };
};

export const missedTaskEventReactionTask = task({
  id: 'missed-task-event-reaction',
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
  },
  run: async (payload: MissedTaskEventPayload) => handleMissedTaskEvent(payload),
});
