import { z } from 'zod';

export const timeBlockCategorySchema = z.enum([
  'WORK',
  'DEEP_WORK',
  'MEETING',
  'PERSONAL',
  'HEALTH',
  'LEARNING',
  'BREAK',
]);

export const timeBlockStatusSchema = z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'MISSED']);

export const createTimeBlockSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200),
    description: z.string().trim().max(2000).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    category: timeBlockCategorySchema.default('WORK'),
    status: timeBlockStatusSchema.default('SCHEDULED'),
    taskId: z.string().uuid('Invalid task ID').optional(),
    goalId: z.string().uuid('Invalid goal ID').optional(),
    isRecurring: z.boolean().default(false),
    recurrenceRule: z.string().trim().max(200).optional(),
    allowOverlap: z.boolean().default(false),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: 'endTime must be after startTime',
    path: ['endTime'],
  });

export const updateTimeBlockSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  category: timeBlockCategorySchema.optional(),
  status: timeBlockStatusSchema.optional(),
  taskId: z.string().uuid('Invalid task ID').nullable().optional(),
  goalId: z.string().uuid('Invalid goal ID').nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: z.string().trim().max(200).nullable().optional(),
  allowOverlap: z.boolean().default(false),
});

export const schedulingQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  category: timeBlockCategorySchema.optional(),
  status: timeBlockStatusSchema.optional(),
  taskId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
});

export const suggestSlotsQuerySchema = z
  .object({
    date: z.coerce.date(),
    durationMinutes: z.coerce.number().int().min(15).max(480).default(60),
    dayStartHour: z.coerce.number().int().min(0).max(23).default(8),
    dayEndHour: z.coerce.number().int().min(1).max(24).default(20),
  })
  .refine((data) => data.dayEndHour > data.dayStartHour, {
    message: 'dayEndHour must be after dayStartHour',
    path: ['dayEndHour'],
  });

export const timeBlockIdParamSchema = z.object({
  id: z.string().uuid('Invalid time block ID'),
});
