import { prisma } from '../../database/prisma';
import {
  CreateGoalInput,
  CreateMilestoneInput,
  GoalsQueryInput,
  UpdateGoalInput,
  UpdateMilestoneInput,
} from './goals.types';

const goalInclude = {
  milestones: {
    orderBy: [{ order: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  subGoals: {
    select: {
      id: true,
      title: true,
      timeframe: true,
      targetYear: true,
      status: true,
      progress: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  parentGoal: {
    select: {
      id: true,
      title: true,
      timeframe: true,
      targetYear: true,
    },
  },
};

export class GoalsRepository {
  async create(userId: string, data: CreateGoalInput) {
    return prisma.goal.create({
      data: {
        userId,
        parentGoalId: data.parentGoalId,
        title: data.title,
        description: data.description,
        category: data.category,
        timeframe: data.timeframe,
        targetYear: data.targetYear,
        targetDate: data.targetDate,
        status: data.status,
        progress: data.status === 'COMPLETED' ? 100 : (data.progress ?? 0),
      },
      include: goalInclude,
    });
  }

  async findAllByUserId(userId: string, filters: GoalsQueryInput = {}) {
    return prisma.goal.findMany({
      where: {
        userId,
        ...(filters.timeframe ? { timeframe: filters.timeframe } : {}),
        ...(filters.targetYear !== undefined ? { targetYear: filters.targetYear } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.parentGoalId !== undefined
          ? { parentGoalId: filters.parentGoalId === 'null' ? null : filters.parentGoalId }
          : {}),
      },
      include: goalInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdAndUserId(id: string, userId: string) {
    return prisma.goal.findFirst({
      where: { id, userId },
      include: {
        ...goalInclude,
        tasks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async update(id: string, data: UpdateGoalInput) {
    return prisma.goal.update({
      where: { id },
      data: {
        parentGoalId: data.parentGoalId,
        title: data.title,
        description: data.description,
        category: data.category,
        timeframe: data.timeframe,
        targetYear: data.targetYear,
        targetDate: data.targetDate,
        status: data.status,
        progress: data.progress,
      },
      include: goalInclude,
    });
  }

  async updateProgress(id: string, progress: number) {
    return prisma.goal.update({
      where: { id },
      data: { progress },
      include: goalInclude,
    });
  }

  async delete(id: string) {
    return prisma.goal.delete({
      where: { id },
    });
  }

  async createMilestone(goalId: string, data: CreateMilestoneInput) {
    return prisma.milestone.create({
      data: {
        goalId,
        title: data.title,
        description: data.description,
        order: data.order,
        targetDate: data.targetDate,
        isCompleted: data.isCompleted,
        completedAt: data.isCompleted ? new Date() : null,
      },
    });
  }

  async findMilestoneByIdAndGoalId(milestoneId: string, goalId: string) {
    return prisma.milestone.findFirst({
      where: { id: milestoneId, goalId },
    });
  }

  async updateMilestone(milestoneId: string, data: UpdateMilestoneInput) {
    return prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        title: data.title,
        description: data.description,
        order: data.order,
        targetDate: data.targetDate,
        isCompleted: data.isCompleted,
        ...(data.isCompleted !== undefined
          ? { completedAt: data.isCompleted ? new Date() : null }
          : {}),
      },
    });
  }

  async deleteMilestone(milestoneId: string) {
    return prisma.milestone.delete({
      where: { id: milestoneId },
    });
  }
}
