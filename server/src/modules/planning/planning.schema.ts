import { z } from 'zod';

export const planStatusSchema = z.enum(['DRAFT', 'APPLIED', 'ARCHIVED']);
export const planTaskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const planTimeframeSchema = z.enum(['YEARLY', 'QUARTERLY', 'MONTHLY', 'WEEKLY', 'CUSTOM']);

export const suggestedMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  order: z.number().int().min(0).default(0),
  targetInDays: z.number().int().min(0).max(3650).optional(),
});

export const suggestedTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  priority: planTaskPrioritySchema.default('MEDIUM'),
  milestoneIndex: z.number().int().min(0).optional(),
  estimatedMinutes: z.number().int().min(5).max(480).optional(),
  dueInDays: z.number().int().min(0).max(3650).optional(),
});

export const generatedPlanOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(4000),
  milestones: z.array(suggestedMilestoneSchema).min(1),
  tasks: z.array(suggestedTaskSchema).min(1),
});

export const generatePlanSchema = z
  .object({
    goalId: z.string().uuid('Invalid goal ID').optional(),
    goalTitle: z.string().trim().min(1).max(200).optional(),
    goalDescription: z.string().trim().max(2000).optional(),
    timeframe: planTimeframeSchema.default('YEARLY'),
    targetYear: z.number().int().min(2000).max(2100).optional(),
    additionalContext: z.string().trim().max(2000).optional(),
  })
  .refine((data) => Boolean(data.goalId || data.goalTitle), {
    message: 'Either goalId or goalTitle is required',
    path: ['goalTitle'],
  });

export const createPlanSchema = z.object({
  goalId: z.string().uuid('Invalid goal ID').optional(),
  title: z.string().trim().min(1, 'Plan title is required').max(200),
  summary: z.string().trim().min(1, 'Plan summary is required').max(4000),
  milestones: z.array(suggestedMilestoneSchema).default([]),
  tasks: z.array(suggestedTaskSchema).default([]),
});

export const updatePlanSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().min(1).max(4000).optional(),
  status: planStatusSchema.optional(),
  milestones: z.array(suggestedMilestoneSchema).optional(),
  tasks: z.array(suggestedTaskSchema).optional(),
});

export const applyPlanSchema = z
  .object({
    goalId: z.string().uuid('Invalid goal ID').optional(),
  })
  .default({});

export const plansQuerySchema = z.object({
  goalId: z.string().uuid().optional(),
  status: planStatusSchema.optional(),
});

export const planIdParamSchema = z.object({
  id: z.string().uuid('Invalid plan ID'),
});
