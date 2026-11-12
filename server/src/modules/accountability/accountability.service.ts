import { AppError } from '../../middleware/error.middleware';
import { AccountabilityRepository } from './accountability.repository';
import {
  AccountabilityLogsQueryInput,
  CreateAccountabilityLogInput,
  CreateReminderInput,
  GenerateInterventionsInput,
  InterventionRecommendation,
  ProcrastinationAnalysis,
  ProcrastinationRiskLevel,
  ProcrastinationSignal,
  RemindersQueryInput,
  UpdateAccountabilityLogInput,
  UpdateReminderInput,
} from './accountability.types';

export interface AdaptiveSignalsSnapshot {
  activeTasks: Array<{
    id: string;
    goalId: string | null;
    title: string;
    priority: string;
    status: string;
    dueDate: Date | null;
    updatedAt: Date;
  }>;
  recentBlocks: Array<{
    id: string;
    taskId: string | null;
    status: string;
    endTime: Date;
  }>;
  missedTaskAlertsCount: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const classifyRiskLevel = (score: number): ProcrastinationRiskLevel => {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
};

export const scoreProcrastinationSignals = (
  snapshot: AdaptiveSignalsSnapshot,
  now: Date
): ProcrastinationAnalysis => {
  const signals: ProcrastinationSignal[] = [];
  const scheduledTaskIds = new Set(
    snapshot.recentBlocks
      .filter((b) => b.taskId && b.status === 'SCHEDULED' && b.endTime > now)
      .map((b) => b.taskId as string)
  );

  const atRiskTasks: ProcrastinationAnalysis['atRiskTasks'] = [];

  for (const task of snapshot.activeTasks) {
    const daysStale = Math.floor((now.getTime() - task.updatedAt.getTime()) / MS_PER_DAY);
    const isOverdue = Boolean(task.dueDate && task.dueDate < now);
    const isHighPriority = task.priority === 'URGENT' || task.priority === 'HIGH';

    if (isOverdue && isHighPriority) {
      signals.push({
        type: 'OVERDUE_HIGH_PRIORITY',
        severity: task.priority === 'URGENT' ? 'CRITICAL' : 'HIGH',
        points: task.priority === 'URGENT' ? 25 : 18,
        taskId: task.id,
        goalId: task.goalId,
        message: `${task.priority} task "${task.title}" is overdue`,
      });
    }

    if (daysStale >= 7) {
      signals.push({
        type: 'STALE_TASK',
        severity: daysStale >= 14 ? 'HIGH' : 'MEDIUM',
        points: daysStale >= 14 ? 15 : 10,
        taskId: task.id,
        goalId: task.goalId,
        message: `Task "${task.title}" has had no activity for ${daysStale} days`,
      });
    }

    if (isHighPriority && !scheduledTaskIds.has(task.id)) {
      signals.push({
        type: 'UNSCHEDULED_URGENT_TASK',
        severity: 'MEDIUM',
        points: 10,
        taskId: task.id,
        goalId: task.goalId,
        message: `Priority task "${task.title}" has no upcoming time block`,
      });
    }

    if (isOverdue || daysStale >= 7 || (isHighPriority && !scheduledTaskIds.has(task.id))) {
      atRiskTasks.push({
        id: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        daysStale,
      });
    }
  }

  const missedBlocks = snapshot.recentBlocks.filter(
    (block) => block.status === 'MISSED' || (block.status === 'SCHEDULED' && block.endTime < now)
  );
  if (missedBlocks.length >= 2) {
    signals.push({
      type: 'MISSED_TIME_BLOCKS',
      severity: missedBlocks.length >= 4 ? 'HIGH' : 'MEDIUM',
      points: Math.min(20, missedBlocks.length * 5),
      message: `${missedBlocks.length} scheduled time blocks were missed or left uncompleted`,
    });
  }

  if (snapshot.missedTaskAlertsCount >= 3) {
    signals.push({
      type: 'RECURRING_DEFERRALS',
      severity: 'HIGH',
      points: 20,
      message: `${snapshot.missedTaskAlertsCount} missed-task alerts recorded in the last 14 days`,
    });
  }

  const rawScore = signals.reduce((sum, signal) => sum + signal.points, 0);
  const riskScore = Math.min(100, rawScore);

  return {
    riskScore,
    riskLevel: classifyRiskLevel(riskScore),
    signals,
    atRiskTasks: atRiskTasks.slice(0, 10),
  };
};

const mapSignalToIntervention = (signal: ProcrastinationSignal): InterventionRecommendation => {
  if (signal.type === 'OVERDUE_HIGH_PRIORITY') {
    return {
      action: 'DECOMPOSE_TASK',
      severity: signal.severity,
      taskId: signal.taskId,
      goalId: signal.goalId,
      title: 'Break down overdue priority work',
      rationale: signal.message,
      suggestedSteps: [
        'Split the task into a 20-minute starter subtask.',
        'Use AI Planning or assign an explicit due date today.',
      ],
    };
  }

  if (signal.type === 'UNSCHEDULED_URGENT_TASK') {
    return {
      action: 'SCHEDULE_MICRO_BLOCK',
      severity: signal.severity,
      taskId: signal.taskId,
      goalId: signal.goalId,
      title: 'Reserve a focus time block',
      rationale: signal.message,
      suggestedSteps: [
        'Pick the next open 30–60 minute slot in Scheduling.',
        'Link the time block directly to this task.',
      ],
    };
  }

  if (signal.type === 'STALE_TASK') {
    return {
      action: 'REPRIORITIZE_OR_ARCHIVE',
      severity: signal.severity,
      taskId: signal.taskId,
      goalId: signal.goalId,
      title: 'Unblock, reschedule, or cancel stale task',
      rationale: signal.message,
      suggestedSteps: [
        'Clarify the next concrete physical action if still relevant.',
        'Mark CANCELLED if no longer aligned with your active goals.',
      ],
    };
  }

  return {
    action: 'DAILY_CHECK_IN',
    severity: signal.severity,
    title: 'Reset cadence with an accountability check-in',
    rationale: signal.message,
    suggestedSteps: [
      'Reduce today’s scheduled blocks to realistic capacity.',
      'Set one short end-of-day check-in reminder.',
    ],
  };
};

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
    const existingLogs = await this.accountabilityRepository.findOpenLogsByTypeAndTaskIds(
      userId,
      'MISSED_TASK',
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
        severity: task.priority === 'URGENT' ? 'HIGH' : 'MEDIUM',
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

  async analyzeProcrastination(userId: string) {
    const now = new Date();
    const snapshot = await this.accountabilityRepository.findAdaptiveSignalsSnapshot(userId, now);
    return scoreProcrastinationSignals(snapshot, now);
  }

  async generateInterventions(
    userId: string,
    options: GenerateInterventionsInput = {
      maxInterventions: 5,
      createReminders: false,
      logAlerts: true,
    }
  ) {
    const analysis = await this.analyzeProcrastination(userId);
    const orderedSignals = [...analysis.signals]
      .sort((a, b) => b.points - a.points)
      .slice(0, options.maxInterventions);

    const interventions = orderedSignals.map(mapSignalToIntervention);
    const createdLogs = [];
    const createdReminders = [];

    if (options.logAlerts) {
      const taskIds = interventions.map((item) => item.taskId).filter(Boolean) as string[];
      const openLogs = await this.accountabilityRepository.findOpenLogsByTypeAndTaskIds(
        userId,
        'INTERVENTION',
        taskIds
      );
      const existingTaskIds = new Set(openLogs.map((l) => l.taskId).filter(Boolean));

      for (const item of interventions) {
        if (item.taskId && existingTaskIds.has(item.taskId)) {
          continue;
        }
        const created = await this.accountabilityRepository.createLog(userId, {
          taskId: item.taskId,
          goalId: item.goalId ?? undefined,
          type: 'INTERVENTION',
          severity: item.severity,
          notes: `${item.title}: ${item.rationale}`,
          metadata: {
            action: item.action,
            suggestedSteps: item.suggestedSteps,
          },
        });
        createdLogs.push(created);
      }
    }

    if (options.createReminders && interventions.length > 0) {
      const remindAt = new Date(Date.now() + 30 * 60 * 1000);
      const top = interventions[0]!;
      const reminder = await this.accountabilityRepository.createReminder(userId, {
        title: top.title,
        message: top.rationale,
        remindAt,
        channel: 'IN_APP',
        taskId: top.taskId,
        goalId: top.goalId ?? undefined,
      });
      createdReminders.push(reminder);
    }

    return {
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      interventions,
      loggedAlertsCount: createdLogs.length,
      createdRemindersCount: createdReminders.length,
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
