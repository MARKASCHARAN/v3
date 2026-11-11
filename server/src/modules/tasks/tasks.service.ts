import { AppError } from '../../middleware/error.middleware';
import { TasksRepository } from './tasks.repository';
import { CreateTaskInput, TasksQueryInput, UpdateTaskInput } from './tasks.types';

export class TasksService {
  constructor(private readonly tasksRepository: TasksRepository = new TasksRepository()) {}

  private async ensureValidRelations(
    userId: string,
    relations: {
      goalId?: string | null;
      milestoneId?: string | null;
      parentTaskId?: string | null;
    },
    currentTaskId?: string
  ): Promise<void> {
    if (relations.goalId) {
      const goal = await this.tasksRepository.findOwnedGoal(relations.goalId, userId);
      if (!goal) {
        throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
      }
    }

    if (relations.milestoneId) {
      const milestone = await this.tasksRepository.findOwnedMilestone(
        relations.milestoneId,
        userId
      );
      if (!milestone) {
        throw new AppError(404, 'Milestone not found', 'MILESTONE_NOT_FOUND');
      }
      if (relations.goalId && milestone.goalId !== relations.goalId) {
        throw new AppError(
          400,
          'Milestone does not belong to the specified goal',
          'INVALID_TASK_RELATION'
        );
      }
    }

    if (relations.parentTaskId) {
      await this.ensureValidParentTask(userId, relations.parentTaskId, currentTaskId);
    }
  }

  private async ensureValidParentTask(
    userId: string,
    parentTaskId: string,
    currentTaskId?: string
  ): Promise<void> {
    if (currentTaskId && parentTaskId === currentTaskId) {
      throw new AppError(400, 'A task cannot be its own parent', 'INVALID_TASK_HIERARCHY');
    }

    const visited = new Set<string>(currentTaskId ? [currentTaskId] : []);
    let cursorId: string | null = parentTaskId;

    while (cursorId) {
      if (visited.has(cursorId)) {
        throw new AppError(400, 'Task hierarchy cannot contain cycles', 'INVALID_TASK_HIERARCHY');
      }
      visited.add(cursorId);

      const ancestor = await this.tasksRepository.findByIdAndUserId(cursorId, userId);
      if (!ancestor) {
        throw new AppError(404, 'Parent task not found', 'TASK_NOT_FOUND');
      }
      cursorId = ancestor.parentTaskId;
    }
  }

  async createTask(userId: string, data: CreateTaskInput) {
    await this.ensureValidRelations(userId, {
      goalId: data.goalId,
      milestoneId: data.milestoneId,
      parentTaskId: data.parentTaskId,
    });

    const completedAt = data.status === 'DONE' ? new Date() : null;
    return this.tasksRepository.create(userId, { ...data, completedAt });
  }

  async getTasks(userId: string, filters: TasksQueryInput = {}) {
    return this.tasksRepository.findAllByUserId(userId, filters);
  }

  async getTaskById(id: string, userId: string) {
    const task = await this.tasksRepository.findByIdAndUserId(id, userId);
    if (!task) {
      throw new AppError(404, 'Task not found', 'TASK_NOT_FOUND');
    }
    return task;
  }

  async updateTask(id: string, userId: string, data: UpdateTaskInput) {
    const existing = await this.getTaskById(id, userId);

    const effectiveGoalId = data.goalId !== undefined ? data.goalId : existing.goalId;
    const effectiveMilestoneId =
      data.milestoneId !== undefined ? data.milestoneId : existing.milestoneId;

    await this.ensureValidRelations(
      userId,
      {
        goalId: effectiveGoalId,
        milestoneId: effectiveMilestoneId,
        parentTaskId: data.parentTaskId,
      },
      id
    );

    let completedAt: Date | null | undefined;
    if (data.status === 'DONE' && existing.status !== 'DONE') {
      completedAt = new Date();
    } else if (data.status && data.status !== 'DONE' && existing.status === 'DONE') {
      completedAt = null;
    }

    return this.tasksRepository.update(id, { ...data, completedAt });
  }

  async deleteTask(id: string, userId: string) {
    await this.getTaskById(id, userId);
    await this.tasksRepository.delete(id);
  }
}
