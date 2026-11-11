import { AppError } from '../../middleware/error.middleware';
import { AccountabilityRepository } from './accountability.repository';
import {
  AccountabilityLogsQueryInput,
  CreateAccountabilityLogInput,
  CreateReminderInput,
  RemindersQueryInput,
  UpdateAccountabilityLogInput,
  UpdateReminderInput,
} from './accountability.types';

export class AccountabilityService {
  constructor(
    private readonly accountabilityRepository: AccountabilityRepository = new AccountabilityRepository()
  ) {}

  private async ensureValidRelations(
    userId: string,
    relations: { taskId?: string; goalId?: string }
  ): Promise<void> {
    if (relations.taskId) {
      const task = await this.accountabilityRepository.findOwnedTask(relations.taskId, userId);
      if (!task) {
        throw new AppError(404, 'Task not found', 'TASK_NOT_FOUND');
      }
    }
    if (relations.goalId) {
      const goal = await this.accountabilityRepository.findOwnedGoal(relations.goalId, userId);
      if (!goal) {
        throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
      }
    }
  }

  async getMissedTasks(userId: string) {
    return this.accountabilityRepository.findMissedTasks(userId, new Date());
  }

  async detectAndLogMissedTasks(userId: string) {
    const missedTasks = await this.accountabilityRepository.findMissedTasks(userId, new Date());
    const taskIds = missedTasks.map((task) => task.id);
    const existingLogs = await this.accountabilityRepository.findOpenMissedTaskLogs(
      userId,
      taskIds
    );
    const alreadyLoggedIds = new Set(existingLogs.map((log) => log.taskId).filter(Boolean));

    const newLogs = [];
    for (const task of missedTasks) {
      if (alreadyLoggedIds.has(task.id)) {
        continue;
      }
      const created = await this.accountabilityRepository.createLog(userId, {
        taskId: task.id,
        goalId: task.goalId ?? undefined,
        type: 'MISSED_TASK',
        notes: `Task "${task.title}" passed its due date`,
      });
      newLogs.push(created);
    }

    return {
      missedTasksCount: missedTasks.length,
      newlyLoggedCount: newLogs.length,
      missedTasks,
      newLogs,
    };
  }

  async getProgressSummary(userId: string) {
    const snapshot = await this.accountabilityRepository.getProgressSnapshot(userId, new Date());
    const taskCompletionRate =
      snapshot.totalTasks === 0
        ? 0
        : Math.round((snapshot.completedTasks / snapshot.totalTasks) * 100);
    const activeGoals = snapshot.goals.filter((g) => g.status === 'ACTIVE');
    const averageGoalProgress =
      snapshot.goals.length === 0
        ? 0
        : Math.round(
            snapshot.goals.reduce((sum, goal) => sum + goal.progress, 0) / snapshot.goals.length
          );

    return {
      tasks: {
        total: snapshot.totalTasks,
        completed: snapshot.completedTasks,
        overdue: snapshot.overdueTasks,
        completionRate: taskCompletionRate,
      },
      goals: {
        total: snapshot.goals.length,
        active: activeGoals.length,
        averageProgress: averageGoalProgress,
      },
      pendingReminders: snapshot.pendingReminders,
      openAlerts: snapshot.openAlerts,
    };
  }

  async createReminder(userId: string, data: CreateReminderInput) {
    await this.ensureValidRelations(userId, { taskId: data.taskId, goalId: data.goalId });
    return this.accountabilityRepository.createReminder(userId, data);
  }

  async getReminders(userId: string, filters: RemindersQueryInput = {}) {
    return this.accountabilityRepository.findReminders(userId, filters);
  }

  async updateReminder(id: string, userId: string, data: UpdateReminderInput) {
    const existing = await this.accountabilityRepository.findReminderByIdAndUserId(id, userId);
    if (!existing) {
      throw new AppError(404, 'Reminder not found', 'REMINDER_NOT_FOUND');
    }

    const triggeredAt =
      data.status === 'SENT' && existing.status !== 'SENT' ? new Date() : undefined;

    return this.accountabilityRepository.updateReminder(id, { ...data, triggeredAt });
  }

  async deleteReminder(id: string, userId: string) {
    const existing = await this.accountabilityRepository.findReminderByIdAndUserId(id, userId);
    if (!existing) {
      throw new AppError(404, 'Reminder not found', 'REMINDER_NOT_FOUND');
    }
    await this.accountabilityRepository.deleteReminder(id);
  }

  async createLog(userId: string, data: CreateAccountabilityLogInput) {
    await this.ensureValidRelations(userId, { taskId: data.taskId, goalId: data.goalId });
    return this.accountabilityRepository.createLog(userId, data);
  }

  async getLogs(userId: string, filters: AccountabilityLogsQueryInput = {}) {
    return this.accountabilityRepository.findLogs(userId, filters);
  }

  async updateLog(id: string, userId: string, data: UpdateAccountabilityLogInput) {
    const existing = await this.accountabilityRepository.findLogByIdAndUserId(id, userId);
    if (!existing) {
      throw new AppError(404, 'Accountability log not found', 'ACCOUNTABILITY_LOG_NOT_FOUND');
    }

    let resolvedAt: Date | null | undefined;
    if (data.status === 'RESOLVED' && existing.status !== 'RESOLVED') {
      resolvedAt = new Date();
    } else if (data.status !== 'RESOLVED' && existing.status === 'RESOLVED') {
      resolvedAt = null;
    }

    return this.accountabilityRepository.updateLog(id, { ...data, resolvedAt });
  }
}
