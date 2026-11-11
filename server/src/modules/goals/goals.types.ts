import { z } from 'zod';
import {
  createGoalSchema,
  createMilestoneSchema,
  goalStatusSchema,
  goalTimeframeSchema,
  goalsQuerySchema,
  updateGoalSchema,
  updateMilestoneSchema,
} from './goals.schema';

export type GoalStatus = z.infer<typeof goalStatusSchema>;
export type GoalTimeframe = z.infer<typeof goalTimeframeSchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type GoalsQueryInput = z.infer<typeof goalsQuerySchema>;
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;
export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;
