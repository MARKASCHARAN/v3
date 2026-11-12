export type DomainEventStatus = 'PENDING' | 'PROCESSED' | 'FAILED' | 'DEAD_LETTER';

export type BackgroundJobStatus =
  'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'DEAD_LETTER';

export type BackgroundJobType =
  | 'AGENT_RUN'
  | 'DAILY_ACCOUNTABILITY_REVIEW'
  | 'MISSED_TASK_SCAN'
  | 'MISSED_TASK_EVENT_REACTION'
  | 'APPROVAL_EXPIRY_SWEEP'
  | 'MEMORY_PRUNE'
  | 'EVENT_DISPATCH';

export interface DomainEventRecord {
  id: string;
  userId: string;
  eventType: string;
  source: string;
  payload: unknown;
  status: string;
  idempotencyKey: string | null;
  attempts: number;
  maxAttempts: number;
  processedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BackgroundJobRecord {
  id: string;
  userId: string;
  executionId: string | null;
  domainEventId: string | null;
  jobType: string;
  externalJobId: string | null;
  idempotencyKey: string | null;
  payload: unknown;
  resultData: unknown;
  status: string;
  attempts: number;
  maxAttempts: number;
  scheduledFor: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventSubscriptionRule {
  eventType: string;
  jobType: BackgroundJobType;
  description: string;
  autoEnqueue: boolean;
}

export interface IngestDomainEventParams {
  userId: string;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  maxAttempts?: number;
  dispatchImmediately?: boolean;
}

export interface DispatchBackgroundJobParams {
  userId: string;
  jobType: BackgroundJobType;
  payload?: Record<string, unknown>;
  executionId?: string;
  domainEventId?: string;
  idempotencyKey?: string;
  maxAttempts?: number;
  scheduledFor?: Date;
  executeImmediately?: boolean;
}

export interface JobExecutionOutcome {
  jobId: string;
  status: BackgroundJobStatus;
  externalJobId?: string | null;
  resultData?: Record<string, unknown> | null;
  errorMessage?: string | null;
}
