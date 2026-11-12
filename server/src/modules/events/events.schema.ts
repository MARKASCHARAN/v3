import { z } from 'zod';

export const domainEventStatusSchema = z.enum(['PENDING', 'PROCESSED', 'FAILED', 'DEAD_LETTER']);

export const backgroundJobStatusSchema = z.enum([
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'DEAD_LETTER',
]);

export const backgroundJobTypeSchema = z.enum([
  'AGENT_RUN',
  'DAILY_ACCOUNTABILITY_REVIEW',
  'MISSED_TASK_SCAN',
  'MISSED_TASK_EVENT_REACTION',
  'APPROVAL_EXPIRY_SWEEP',
  'MEMORY_PRUNE',
  'EVENT_DISPATCH',
]);

export const ingestDomainEventSchema = z.object({
  eventType: z.string().trim().min(2).max(100),
  source: z.string().trim().min(2).max(60).default('API'),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  dispatchImmediately: z.boolean().default(true),
});

export const eventsQuerySchema = z.object({
  status: domainEventStatusSchema.optional(),
  eventType: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const jobsQuerySchema = z.object({
  status: backgroundJobStatusSchema.optional(),
  jobType: backgroundJobTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const triggerBackgroundJobSchema = z.object({
  jobType: backgroundJobTypeSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  maxAttempts: z.number().int().min(1).max(10).default(3),
  scheduledFor: z.coerce.date().optional(),
  executeImmediately: z.boolean().default(true),
});

export const eventOrJobIdParamSchema = z.object({
  id: z.string().uuid('Invalid identifier'),
});

export const recoverySweepSchema = z
  .object({
    staleMinutes: z.number().int().min(5).max(1440).default(30),
    includeApprovalExpiry: z.boolean().default(true),
    includeMemoryPrune: z.boolean().default(true),
  })
  .default({
    staleMinutes: 30,
    includeApprovalExpiry: true,
    includeMemoryPrune: true,
  });
