import { z } from 'zod';

export const reminderStatusSchema = z.enum(['PENDING', 'SENT', 'DISMISSED', 'ACKNOWLEDGED']);
export const reminderChannelSchema = z.enum(['IN_APP', 'EMAIL', 'TELEGRAM', 'DISCORD', 'WHATSAPP']);
export const accountabilityLogTypeSchema = z.enum([
  'MISSED_TASK',
  'CHECK_IN',
  'STREAK_UPDATE',
  'PROGRESS_NUDGE',
  'PROCRASTINATION_RISK',
  'INTERVENTION',
]);
export const accountabilityLogStatusSchema = z.enum(['OPEN', 'ACKNOWLEDGED', 'RESOLVED']);
export const accountabilitySeveritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const createReminderSchema = z.object({
  title: z.string().trim().min(1, 'Reminder title is required').max(200),
  message: z.string().trim().max(2000).optional(),
  remindAt: z.coerce.date(),
  channel: reminderChannelSchema.default('IN_APP'),
  taskId: z.string().uuid('Invalid task ID').optional(),
  goalId: z.string().uuid('Invalid goal ID').optional(),
});

export const updateReminderSchema = z.object({
  title: z.string().trim().min(1, 'Reminder title cannot be empty').max(200).optional(),
  message: z.string().trim().max(2000).nullable().optional(),
  remindAt: z.coerce.date().optional(),
  status: reminderStatusSchema.optional(),
  channel: reminderChannelSchema.optional(),
});

export const remindersQuerySchema = z.object({
  status: reminderStatusSchema.optional(),
  dueOnly: z.enum(['true', 'false']).optional(),
});

export const createAccountabilityLogSchema = z.object({
  taskId: z.string().uuid('Invalid task ID').optional(),
  goalId: z.string().uuid('Invalid goal ID').optional(),
  type: accountabilityLogTypeSchema.default('CHECK_IN'),
  severity: accountabilitySeveritySchema.default('MEDIUM'),
  notes: z.string().trim().max(2000).optional(),
});

export const updateAccountabilityLogSchema = z.object({
  status: accountabilityLogStatusSchema,
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const accountabilityLogsQuerySchema = z.object({
  status: accountabilityLogStatusSchema.optional(),
  type: accountabilityLogTypeSchema.optional(),
});

export const generateInterventionsSchema = z
  .object({
    maxInterventions: z.coerce.number().int().min(1).max(10).default(5),
    createReminders: z.boolean().default(false),
    logAlerts: z.boolean().default(true),
  })
  .default({
    maxInterventions: 5,
    createReminders: false,
    logAlerts: true,
  });

export const accountabilityIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});
