import { configure, logger, tasks } from '@trigger.dev/sdk';
import { env } from '../config/env';

let configured = false;

export const isTriggerConfigured = (): boolean =>
  Boolean(env.TRIGGER_SECRET_KEY && env.TRIGGER_SECRET_KEY.trim().length > 0);

export const ensureTriggerConfigured = (): boolean => {
  if (!isTriggerConfigured()) {
    return false;
  }
  if (!configured) {
    configure({
      accessToken: env.TRIGGER_SECRET_KEY,
    });
    configured = true;
  }
  return true;
};

export const TRIGGER_TASK_IDS = {
  AGENT_RUN: 'autonomous-agent-run',
  DAILY_ACCOUNTABILITY_REVIEW: 'daily-accountability-review',
  MISSED_TASK_SCAN: 'missed-task-scanner',
  MISSED_TASK_EVENT_REACTION: 'missed-task-event-reaction',
  APPROVAL_EXPIRY_SWEEP: 'approval-expiry-sweeper',
  MEMORY_PRUNE: 'daily-accountability-review',
  EVENT_DISPATCH: 'domain-event-router',
  DEAD_LETTER_RECOVERY: 'dead-letter-recovery',
} as const;

export interface TriggerDispatchResult {
  dispatched: boolean;
  externalJobId: string | null;
  mode: 'TRIGGER_DEV' | 'IN_PROCESS_FALLBACK';
}

export const triggerRemoteJob = async (
  taskId: string,
  payload: Record<string, unknown>,
  options: { idempotencyKey?: string } = {}
): Promise<TriggerDispatchResult> => {
  if (!ensureTriggerConfigured()) {
    return {
      dispatched: false,
      externalJobId: null,
      mode: 'IN_PROCESS_FALLBACK',
    };
  }

  try {
    const handle = await tasks.trigger(
      taskId,
      payload,
      options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : undefined
    );
    return {
      dispatched: true,
      externalJobId: handle.id,
      mode: 'TRIGGER_DEV',
    };
  } catch (error) {
    logger.warn('Trigger.dev remote trigger failed; falling back to local execution', {
      taskId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      dispatched: false,
      externalJobId: null,
      mode: 'IN_PROCESS_FALLBACK',
    };
  }
};
