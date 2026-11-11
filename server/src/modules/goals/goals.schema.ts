import { z } from 'zod';

export const goalStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED']);
export const goalTimeframeSchema = z.enum(['YEARLY', 'QUARTERLY', 'MONTHLY', 'WEEKLY', 'CUSTOM']);

export const createGoalSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(1).max(100).default('GENERAL'),
  timeframe: goalTimeframeSchema.default('YEARLY'),
  targetYear: z.number().int().min(2000).max(2100).optional(),
  parentGoalId: z.string().uuid('Invalid parent goal ID').optional(),
  targetDate: z.coerce.date().optional(),
  status: goalStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

export const updateGoalSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  category: z.string().trim().min(1).max(100).optional(),
  timeframe: goalTimeframeSchema.optional(),
  targetYear: z.number().int().min(2000).max(2100).nullable().optional(),
  parentGoalId: z.string().uuid('Invalid parent goal ID').nullable().optional(),
  targetDate: z.coerce.date().nullable().optional(),
  status: goalStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

export const goalsQuerySchema = z.object({
  timeframe: goalTimeframeSchema.optional(),
  targetYear: z.coerce.number().int().min(2000).max(2100).optional(),
  status: goalStatusSchema.optional(),
  parentGoalId: z.union([z.literal('null'), z.string().uuid()]).optional(),
});

export const goalIdParamSchema = z.object({
  id: z.string().uuid('Invalid goal ID'),
});

export const milestoneParamSchema = z.object({
  id: z.string().uuid('Invalid goal ID'),
  milestoneId: z.string().uuid('Invalid milestone ID'),
});

export const createMilestoneSchema = z.object({
  title: z.string().trim().min(1, 'Milestone title is required').max(200),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().min(0).default(0),
  targetDate: z.coerce.date().optional(),
  isCompleted: z.boolean().default(false),
});

export const updateMilestoneSchema = z.object({
  title: z.string().trim().min(1, 'Milestone title cannot be empty').max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  order: z.number().int().min(0).optional(),
  targetDate: z.coerce.date().nullable().optional(),
  isCompleted: z.boolean().optional(),
});
