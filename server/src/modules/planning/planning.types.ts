import { z } from 'zod';
import {
  applyPlanSchema,
  createPlanSchema,
  generatePlanSchema,
  generatedPlanOutputSchema,
  planStatusSchema,
  plansQuerySchema,
  suggestedMilestoneSchema,
  suggestedTaskSchema,
  updatePlanSchema,
} from './planning.schema';
import { PlanningPromptInput } from '../../ai/prompts/planning.prompt';

export type PlanStatus = z.infer<typeof planStatusSchema>;
export type SuggestedMilestone = z.infer<typeof suggestedMilestoneSchema>;
export type SuggestedTask = z.infer<typeof suggestedTaskSchema>;
export type GeneratedPlanOutput = z.infer<typeof generatedPlanOutputSchema>;
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type ApplyPlanInput = z.infer<typeof applyPlanSchema>;
export type PlansQueryInput = z.infer<typeof plansQuerySchema>;

export interface PlanGeneratorResult {
  provider: string;
  model: string;
  plan: GeneratedPlanOutput;
}

export interface PlanGenerator {
  decomposeGoal(input: PlanningPromptInput): Promise<PlanGeneratorResult>;
}
