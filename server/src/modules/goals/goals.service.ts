import { AppError } from '../../middleware/error.middleware';
import { GoalsRepository } from './goals.repository';
import {
  CreateGoalInput,
  CreateMilestoneInput,
  GoalsQueryInput,
  UpdateGoalInput,
  UpdateMilestoneInput,
} from './goals.types';

export interface ProgressSnapshot {
  status: string;
  progress: number;
  milestones: Array<{ isCompleted: boolean }>;
  subGoals: Array<{ progress: number }>;
}

export const calculateGoalProgress = (goal: ProgressSnapshot): number => {
  if (goal.status === 'COMPLETED') {
    return 100;
  }
  if (goal.milestones.length > 0) {
    const completedCount = goal.milestones.filter((m) => m.isCompleted).length;
    return Math.round((completedCount / goal.milestones.length) * 100);
  }
  if (goal.subGoals.length > 0) {
    const total = goal.subGoals.reduce((sum, child) => sum + child.progress, 0);
    return Math.round(total / goal.subGoals.length);
  }
  return Math.max(0, Math.min(100, goal.progress));
};

export class GoalsService {
  constructor(private readonly goalsRepository: GoalsRepository = new GoalsRepository()) {}

  private async ensureValidParentGoal(
    userId: string,
    parentGoalId: string,
    currentGoalId?: string
  ): Promise<void> {
    if (currentGoalId && parentGoalId === currentGoalId) {
      throw new AppError(400, 'A goal cannot be its own parent', 'INVALID_GOAL_HIERARCHY');
    }

    const visited = new Set<string>(currentGoalId ? [currentGoalId] : []);
    let cursorId: string | null = parentGoalId;

    while (cursorId) {
      if (visited.has(cursorId)) {
        throw new AppError(400, 'Goal hierarchy cannot contain cycles', 'INVALID_GOAL_HIERARCHY');
      }
      visited.add(cursorId);

      const ancestor = await this.goalsRepository.findByIdAndUserId(cursorId, userId);
      if (!ancestor) {
        throw new AppError(404, 'Parent goal not found', 'GOAL_NOT_FOUND');
      }
      cursorId = ancestor.parentGoalId;
    }
  }

  private async syncGoalProgressChain(goalId: string, userId: string): Promise<void> {
    const visited = new Set<string>();
    let cursorId: string | null = goalId;

    while (cursorId && !visited.has(cursorId)) {
      visited.add(cursorId);
      const goal = await this.goalsRepository.findByIdAndUserId(cursorId, userId);
      if (!goal) {
        break;
      }

      const nextProgress = calculateGoalProgress(goal);
      if (nextProgress !== goal.progress) {
        await this.goalsRepository.updateProgress(goal.id, nextProgress);
      }

      cursorId = goal.parentGoalId;
    }
  }

  async createGoal(userId: string, data: CreateGoalInput) {
    if (data.parentGoalId) {
      await this.ensureValidParentGoal(userId, data.parentGoalId);
    }

    const goal = await this.goalsRepository.create(userId, data);

    if (goal.parentGoalId) {
      await this.syncGoalProgressChain(goal.parentGoalId, userId);
    }

    return goal;
  }

  async getGoals(userId: string, filters: GoalsQueryInput = {}) {
    return this.goalsRepository.findAllByUserId(userId, filters);
  }

  async getGoalById(id: string, userId: string) {
    const goal = await this.goalsRepository.findByIdAndUserId(id, userId);
    if (!goal) {
      throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
    }
    return goal;
  }

  async updateGoal(id: string, userId: string, data: UpdateGoalInput) {
    const existing = await this.getGoalById(id, userId);

    if (data.parentGoalId) {
      await this.ensureValidParentGoal(userId, data.parentGoalId, id);
    }

    const computedProgress =
      data.status === 'COMPLETED'
        ? 100
        : data.progress !== undefined
          ? data.progress
          : calculateGoalProgress({
              status: data.status ?? existing.status,
              progress: existing.progress,
              milestones: existing.milestones,
              subGoals: existing.subGoals,
            });

    const updated = await this.goalsRepository.update(id, {
      ...data,
      progress: computedProgress,
    });

    if (existing.parentGoalId && existing.parentGoalId !== updated.parentGoalId) {
      await this.syncGoalProgressChain(existing.parentGoalId, userId);
    }
    if (updated.parentGoalId) {
      await this.syncGoalProgressChain(updated.parentGoalId, userId);
    }

    return updated;
  }

  async deleteGoal(id: string, userId: string) {
    const existing = await this.getGoalById(id, userId);
    await this.goalsRepository.delete(id);

    if (existing.parentGoalId) {
      await this.syncGoalProgressChain(existing.parentGoalId, userId);
    }
  }

  async addMilestone(goalId: string, userId: string, data: CreateMilestoneInput) {
    await this.getGoalById(goalId, userId);
    const milestone = await this.goalsRepository.createMilestone(goalId, data);
    await this.syncGoalProgressChain(goalId, userId);
    return milestone;
  }

  async updateMilestone(
    goalId: string,
    milestoneId: string,
    userId: string,
    data: UpdateMilestoneInput
  ) {
    await this.getGoalById(goalId, userId);
    const existing = await this.goalsRepository.findMilestoneByIdAndGoalId(milestoneId, goalId);
    if (!existing) {
      throw new AppError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND');
    }
    const updated = await this.goalsRepository.updateMilestone(milestoneId, data);
    await this.syncGoalProgressChain(goalId, userId);
    return updated;
  }

  async deleteMilestone(goalId: string, milestoneId: string, userId: string) {
    await this.getGoalById(goalId, userId);
    const existing = await this.goalsRepository.findMilestoneByIdAndGoalId(milestoneId, goalId);
    if (!existing) {
      throw new AppError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND');
    }
    await this.goalsRepository.deleteMilestone(milestoneId);
    await this.syncGoalProgressChain(goalId, userId);
  }
}
