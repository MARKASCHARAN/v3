import { prisma } from '../../database/prisma';
import { CreateTaskInput, TasksQueryInput, UpdateTaskInput } from './tasks.types';

const taskInclude = {
  subtasks: {
    orderBy: { createdAt: 'asc' as const },
  },
  goal: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
  milestone: {
    select: {
      id: true,
      title: true,
      isCompleted: true,
    },
  },
};

export class TasksRepository {
  async create(userId: string, data: CreateTaskInput & { completedAt?: Date | null }) {
    return prisma.task.create({
      data: {
        userId,
        goalId: data.goalId,
        milestoneId: data.milestoneId,
        parentTaskId: data.parentTaskId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        dueDate: data.dueDate,
        completedAt: data.completedAt ?? null,
      },
      include: taskInclude,
    });
  }

  async findAllByUserId(userId: string, filters: TasksQueryInput = {}) {
    const now = new Date();
    return prisma.task.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.priority ? { priority: filters.priority } : {}),
        ...(filters.goalId ? { goalId: filters.goalId } : {}),
        ...(filters.milestoneId ? { milestoneId: filters.milestoneId } : {}),
        ...(filters.parentTaskId !== undefined
          ? { parentTaskId: filters.parentTaskId === 'null' ? null : filters.parentTaskId }
          : {}),
        ...(filters.overdue === 'true'
          ? {
              dueDate: { lt: now },
              status: { notIn: ['DONE', 'CANCELLED'] },
            }
          : {}),
      },
      include: taskInclude,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findByIdAndUserId(id: string, userId: string) {
    return prisma.task.findFirst({
      where: { id, userId },
      include: taskInclude,
    });
  }

  async findOwnedGoal(goalId: string, userId: string) {
    return prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });
  }

  async findOwnedMilestone(milestoneId: string, userId: string) {
    return prisma.milestone.findFirst({
      where: { id: milestoneId, goal: { userId } },
      select: { id: true, goalId: true },
    });
  }

  async update(id: string, data: UpdateTaskInput & { completedAt?: Date | null }) {
    return prisma.task.update({
      where: { id },
      data: {
        goalId: data.goalId,
        milestoneId: data.milestoneId,
        parentTaskId: data.parentTaskId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        dueDate: data.dueDate,
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
      },
      include: taskInclude,
    });
  }

  async delete(id: string) {
    return prisma.task.delete({
      where: { id },
    });
  }
}
