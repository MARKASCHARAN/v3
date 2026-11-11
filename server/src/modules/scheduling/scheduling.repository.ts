import { prisma } from '../../database/prisma';
import {
  CreateTimeBlockInput,
  SchedulingQueryInput,
  UpdateTimeBlockInput,
} from './scheduling.types';

const timeBlockInclude = {
  task: {
    select: {
      id: true,
      title: true,
      priority: true,
      status: true,
    },
  },
  goal: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
};

export class SchedulingRepository {
  async create(userId: string, data: Omit<CreateTimeBlockInput, 'allowOverlap'>) {
    return prisma.timeBlock.create({
      data: {
        userId,
        taskId: data.taskId,
        goalId: data.goalId,
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        category: data.category,
        status: data.status,
        isRecurring: data.isRecurring,
        recurrenceRule: data.recurrenceRule,
      },
      include: timeBlockInclude,
    });
  }

  async findAllByUserId(userId: string, filters: SchedulingQueryInput = {}) {
    return prisma.timeBlock.findMany({
      where: {
        userId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(filters.goalId ? { goalId: filters.goalId } : {}),
        ...(filters.from ? { endTime: { gt: filters.from } } : {}),
        ...(filters.to ? { startTime: { lt: filters.to } } : {}),
      },
      include: timeBlockInclude,
      orderBy: { startTime: 'asc' },
    });
  }

  async findByIdAndUserId(id: string, userId: string) {
    return prisma.timeBlock.findFirst({
      where: { id, userId },
      include: timeBlockInclude,
    });
  }

  async findOverlapping(userId: string, startTime: Date, endTime: Date, excludeId?: string) {
    return prisma.timeBlock.findMany({
      where: {
        userId,
        status: 'SCHEDULED',
        startTime: { lt: endTime },
        endTime: { gt: startTime },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOwnedTask(taskId: string, userId: string) {
    return prisma.task.findFirst({
      where: { id: taskId, userId },
      select: { id: true },
    });
  }

  async findOwnedGoal(goalId: string, userId: string) {
    return prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });
  }

  async update(id: string, data: Omit<UpdateTimeBlockInput, 'allowOverlap'>) {
    return prisma.timeBlock.update({
      where: { id },
      data: {
        taskId: data.taskId,
        goalId: data.goalId,
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        category: data.category,
        status: data.status,
        isRecurring: data.isRecurring,
        recurrenceRule: data.recurrenceRule,
      },
      include: timeBlockInclude,
    });
  }

  async delete(id: string) {
    return prisma.timeBlock.delete({
      where: { id },
    });
  }
}
