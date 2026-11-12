import { z } from 'zod';
import {
  createGoalSchema,
  goalStatusSchema,
  goalTimeframeSchema,
  goalsQuerySchema,
} from '../../../modules/goals/goals.schema';
import { GoalsService } from '../../../modules/goals/goals.service';
import { V3ToolContract } from '../tool.types';

const goalsService = new GoalsService();

const listGoalsToolSchema = z.object({
  timeframe: goalTimeframeSchema.optional(),
  targetYear: z.number().int().min(2000).max(2100).optional(),
  status: goalStatusSchema.optional(),
  parentGoalId: z.string().optional(),
});

const createGoalToolSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(1).max(100).default('GENERAL'),
  timeframe: goalTimeframeSchema.default('YEARLY'),
  targetYear: z.number().int().min(2000).max(2100).optional(),
  parentGoalId: z.string().uuid().optional(),
  targetDate: z.string().describe('ISO 8601 target datetime').optional(),
  status: goalStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

const listGoalsOutputSchema = z.array(z.record(z.string(), z.unknown()));
const createGoalOutputSchema = z.object({ id: z.string() }).catchall(z.unknown());

export const GOALS_TOOLS: V3ToolContract[] = [
  {
    name: 'listGoals',
    domain: 'goals',
    description: 'List user goals with optional timeframe, targetYear, or status filters.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: goalsQuerySchema,
    outputSchema: listGoalsOutputSchema,
    toolSchema: listGoalsToolSchema,
    execute: (ctx, input) =>
      goalsService.getGoals(ctx.userId, input as z.infer<typeof goalsQuerySchema>),
  } as V3ToolContract,
  {
    name: 'createGoal',
    domain: 'goals',
    description: 'Create a new personal or yearly goal for the user.',
    riskLevel: 'INTERNAL_WRITE',
    idempotent: false,
    inputSchema: createGoalSchema,
    outputSchema: createGoalOutputSchema,
    toolSchema: createGoalToolSchema,
    execute: (ctx, input) =>
      goalsService.createGoal(ctx.userId, input as z.infer<typeof createGoalSchema>),
  } as V3ToolContract,
];
