import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  CreatePlanInput,
  PlansQueryInput,
  SuggestedMilestone,
  SuggestedTask,
  UpdatePlanInput,
} from './planning.types';

const planInclude = {
  goal: {
    select: {
      id: true,
      title: true,
      timeframe: true,
      targetYear: true,
      status: true,
    },
  },
};

const addDays = (base: Date, days?: number): Date | undefined => {
  if (days === undefined) {
    return undefined;
  }
  const result = new Date(base);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

export class PlanningRepository {
  async create(userId: string, data: CreatePlanInput & { provider?: string; model?: string }) {
    return prisma.plan.create({
      data: {
        userId,
        goalId: data.goalId,
        title: data.title,
        summary: data.summary,
        milestonesData: data.milestones as unknown as Prisma.InputJsonValue,
        tasksData: data.tasks as unknown as Prisma.InputJsonValue,
        provider: data.provider,
        model: data.model,
      },
      include: planInclude,
    });
  }

  async findAllByUserId(userId: string, filters: PlansQueryInput = {}) {
    return prisma.plan.findMany({
      where: {
        userId,
        ...(filters.goalId ? { goalId: filters.goalId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: planInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdAndUserId(id: string, userId: string) {
    return prisma.plan.findFirst({
      where: { id, userId },
      include: planInclude,
    });
  }

  async findOwnedGoal(goalId: string, userId: string) {
    return prisma.goal.findFirst({
      where: { id: goalId, userId },
    });
  }

  async findUserContext(userId: string) {
    const [preferences, memories] = await Promise.all([
      prisma.userPreference.findMany({
        where: { userId },
        select: { key: true, value: true },
        take: 20,
      }),
      prisma.memory.findMany({
        where: { userId },
        select: { title: true, content: true, category: true },
        orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
        take: 15,
      }),
    ]);

    return { preferences, memories };
  }

  async update(id: string, data: UpdatePlanInput) {
    return prisma.plan.update({
      where: { id },
      data: {
        title: data.title,
        summary: data.summary,
        status: data.status,
        ...(data.milestones !== undefined
          ? { milestonesData: data.milestones as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.tasks !== undefined
          ? { tasksData: data.tasks as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: planInclude,
    });
  }

  async delete(id: string) {
    return prisma.plan.delete({
      where: { id },
    });
  }

  async applyPlan(params: {
    userId: string;
    planId: string;
    planTitle: string;
    planSummary: string;
    targetGoalId?: string | null;
    milestones: SuggestedMilestone[];
    tasks: SuggestedTask[];
  }) {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      let goalId = params.targetGoalId ?? null;

      if (!goalId) {
        const createdGoal = await tx.goal.create({
          data: {
            userId: params.userId,
            title: params.planTitle,
            description: params.planSummary,
            category: 'GENERAL',
            timeframe: 'YEARLY',
          },
        });
        goalId = createdGoal.id;
      }

      const createdMilestones = [];
      for (const milestone of params.milestones) {
        const created = await tx.milestone.create({
          data: {
            goalId,
            title: milestone.title,
            description: milestone.description,
            order: milestone.order,
            targetDate: addDays(now, milestone.targetInDays),
          },
        });
        createdMilestones.push(created);
      }

      const createdTasks = [];
      for (const task of params.tasks) {
        const linkedMilestone =
          task.milestoneIndex !== undefined ? createdMilestones[task.milestoneIndex] : undefined;

        const created = await tx.task.create({
          data: {
            userId: params.userId,
            goalId,
            milestoneId: linkedMilestone?.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            status: 'TODO',
            dueDate: addDays(now, task.dueInDays),
          },
        });
        createdTasks.push(created);
      }

      const allGoalMilestones = await tx.milestone.findMany({
        where: { goalId },
        select: { isCompleted: true },
      });
      if (allGoalMilestones.length > 0) {
        const completed = allGoalMilestones.filter((m) => m.isCompleted).length;
        const progress = Math.round((completed / allGoalMilestones.length) * 100);
        await tx.goal.update({
          where: { id: goalId },
          data: { progress },
        });
      }

      const updatedPlan = await tx.plan.update({
        where: { id: params.planId },
        data: {
          goalId,
          status: 'APPLIED',
          appliedAt: now,
        },
        include: planInclude,
      });

      return {
        plan: updatedPlan,
        goalId,
        createdMilestones,
        createdTasks,
      };
    });
  }
}
