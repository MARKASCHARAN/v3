import { prisma } from '../../database/prisma';
import {
  AccountabilityLogsQueryInput,
  CreateAccountabilityLogInput,
  CreateReminderInput,
  RemindersQueryInput,
  UpdateAccountabilityLogInput,
  UpdateReminderInput,
} from './accountability.types';

export class AccountabilityRepository {
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

  async findMissedTasks(userId: string, now: Date) {
    return prisma.task.findMany({
      where: {
        userId,
        dueDate: { lt: now },
        status: { notIn: ['DONE', 'CANCELLED'] },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async findOpenMissedTaskLogs(userId: string, taskIds: string[]) {
    if (taskIds.length === 0) {
      return [];
    }
    return prisma.accountabilityLog.findMany({
      where: {
        userId,
        type: 'MISSED_TASK',
        status: { in: ['OPEN', 'ACKNOWLEDGED'] },
        taskId: { in: taskIds },
      },
      select: { taskId: true },
    });
  }

  async createLog(userId: string, data: CreateAccountabilityLogInput) {
    return prisma.accountabilityLog.create({
      data: {
        userId,
        taskId: data.taskId,
        goalId: data.goalId,
        type: data.type,
        notes: data.notes,
      },
    });
  }

  async findLogs(userId: string, filters: AccountabilityLogsQueryInput = {}) {
    return prisma.accountabilityLog.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      orderBy: { detectedAt: 'desc' },
    });
  }

  async findLogByIdAndUserId(id: string, userId: string) {
    return prisma.accountabilityLog.findFirst({
      where: { id, userId },
    });
  }

  async updateLog(id: string, data: UpdateAccountabilityLogInput & { resolvedAt?: Date | null }) {
    return prisma.accountabilityLog.update({
      where: { id },
      data: {
        status: data.status,
        notes: data.notes,
        ...(data.resolvedAt !== undefined ? { resolvedAt: data.resolvedAt } : {}),
      },
    });
  }

  async createReminder(userId: string, data: CreateReminderInput) {
    return prisma.reminder.create({
      data: {
        userId,
        taskId: data.taskId,
        goalId: data.goalId,
        title: data.title,
        message: data.message,
        remindAt: data.remindAt,
        channel: data.channel,
      },
    });
  }

  async findReminders(userId: string, filters: RemindersQueryInput = {}) {
    const now = new Date();
    return prisma.reminder.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.dueOnly === 'true'
          ? {
              remindAt: { lte: now },
              status: 'PENDING',
            }
          : {}),
      },
      orderBy: { remindAt: 'asc' },
    });
  }

  async findReminderByIdAndUserId(id: string, userId: string) {
    return prisma.reminder.findFirst({
      where: { id, userId },
    });
  }

  async updateReminder(id: string, data: UpdateReminderInput & { triggeredAt?: Date | null }) {
    return prisma.reminder.update({
      where: { id },
      data: {
        title: data.title,
        message: data.message,
        remindAt: data.remindAt,
        status: data.status,
        channel: data.channel,
        ...(data.triggeredAt !== undefined ? { triggeredAt: data.triggeredAt } : {}),
      },
    });
  }

  async deleteReminder(id: string) {
    return prisma.reminder.delete({
      where: { id },
    });
  }

  async getProgressSnapshot(userId: string, now: Date) {
    const [totalTasks, completedTasks, overdueTasks, goals, pendingReminders, openAlerts] =
      await Promise.all([
        prisma.task.count({ where: { userId } }),
        prisma.task.count({ where: { userId, status: 'DONE' } }),
        prisma.task.count({
          where: {
            userId,
            dueDate: { lt: now },
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
        }),
        prisma.goal.findMany({
          where: { userId },
          select: { status: true, progress: true },
        }),
        prisma.reminder.count({ where: { userId, status: 'PENDING' } }),
        prisma.accountabilityLog.count({
          where: { userId, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        }),
      ]);

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      goals,
      pendingReminders,
      openAlerts,
    };
  }
}
