import { Output, generateText } from 'ai';
import {
  PLANNING_SYSTEM_PROMPT,
  PlanningPromptInput,
  buildGoalDecompositionPrompt,
} from '../../ai/prompts/planning.prompt';
import { getDefaultLanguageModel } from '../../ai/providers/model.provider';
import { AppError } from '../../middleware/error.middleware';
import { PlanningRepository } from './planning.repository';
import {
  generatedPlanOutputSchema,
  suggestedMilestoneSchema,
  suggestedTaskSchema,
} from './planning.schema';
import {
  CreatePlanInput,
  GeneratePlanInput,
  PlanGenerator,
  PlanGeneratorResult,
  PlansQueryInput,
  UpdatePlanInput,
} from './planning.types';

export class AiPlanGenerator implements PlanGenerator {
  async decomposeGoal(input: PlanningPromptInput): Promise<PlanGeneratorResult> {
    const descriptor = getDefaultLanguageModel();
    const prompt = buildGoalDecompositionPrompt(input);

    const result = await generateText({
      model: descriptor.model,
      system: PLANNING_SYSTEM_PROMPT,
      prompt,
      output: Output.object({
        schema: generatedPlanOutputSchema,
      }),
    });

    if (!result.output) {
      throw new AppError(502, 'AI planner did not produce a valid plan', 'AI_GENERATION_FAILED');
    }

    return {
      provider: descriptor.provider,
      model: descriptor.modelId,
      plan: result.output,
    };
  }
}

export class PlanningService {
  constructor(
    private readonly planningRepository: PlanningRepository = new PlanningRepository(),
    private readonly planGenerator: PlanGenerator = new AiPlanGenerator()
  ) {}

  private async ensureOwnedGoal(goalId: string, userId: string) {
    const goal = await this.planningRepository.findOwnedGoal(goalId, userId);
    if (!goal) {
      throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
    }
    return goal;
  }

  async generatePlan(userId: string, input: GeneratePlanInput) {
    const goal = input.goalId ? await this.ensureOwnedGoal(input.goalId, userId) : null;
    const context = await this.planningRepository.findUserContext(userId);

    const promptInput: PlanningPromptInput = {
      goalTitle: goal?.title ?? input.goalTitle ?? '',
      goalDescription: input.goalDescription ?? goal?.description,
      timeframe: goal?.timeframe ?? input.timeframe,
      targetYear: input.targetYear ?? goal?.targetYear,
      additionalContext: input.additionalContext,
      preferences: context.preferences,
      memories: context.memories,
    };

    const generated = await this.planGenerator.decomposeGoal(promptInput);

    return this.planningRepository.create(userId, {
      goalId: goal?.id,
      title: generated.plan.title,
      summary: generated.plan.summary,
      milestones: generated.plan.milestones,
      tasks: generated.plan.tasks,
      provider: generated.provider,
      model: generated.model,
    });
  }

  async createPlan(userId: string, data: CreatePlanInput) {
    if (data.goalId) {
      await this.ensureOwnedGoal(data.goalId, userId);
    }
    return this.planningRepository.create(userId, data);
  }

  async getPlans(userId: string, filters: PlansQueryInput = {}) {
    return this.planningRepository.findAllByUserId(userId, filters);
  }

  async getPlanById(id: string, userId: string) {
    const plan = await this.planningRepository.findByIdAndUserId(id, userId);
    if (!plan) {
      throw new AppError(404, 'Plan not found', 'PLAN_NOT_FOUND');
    }
    return plan;
  }

  async updatePlan(id: string, userId: string, data: UpdatePlanInput) {
    await this.getPlanById(id, userId);
    return this.planningRepository.update(id, data);
  }

  async applyPlan(id: string, userId: string, overrideGoalId?: string) {
    const plan = await this.getPlanById(id, userId);

    if (plan.status === 'APPLIED') {
      throw new AppError(409, 'Plan has already been applied', 'PLAN_ALREADY_APPLIED');
    }

    const targetGoalId = overrideGoalId ?? plan.goalId;
    if (targetGoalId) {
      await this.ensureOwnedGoal(targetGoalId, userId);
    }

    const milestones = suggestedMilestoneSchema.array().parse(plan.milestonesData);
    const tasks = suggestedTaskSchema.array().parse(plan.tasksData);

    return this.planningRepository.applyPlan({
      userId,
      planId: plan.id,
      planTitle: plan.title,
      planSummary: plan.summary,
      targetGoalId,
      milestones,
      tasks,
    });
  }

  async deletePlan(id: string, userId: string) {
    await this.getPlanById(id, userId);
    await this.planningRepository.delete(id);
  }
}
