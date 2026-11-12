import { AppError } from '../../middleware/error.middleware';
import { SchedulingRepository } from './scheduling.repository';
import {
  AvailableSlot,
  CreateTimeBlockInput,
  SchedulingQueryInput,
  SuggestSlotsQueryInput,
  UpdateTimeBlockInput,
} from './scheduling.types';

export const findAvailableSlots = (
  existingBlocks: Array<{ startTime: Date; endTime: Date }>,
  windowStart: Date,
  windowEnd: Date,
  durationMinutes: number
): AvailableSlot[] => {
  const minDurationMs = durationMinutes * 60 * 1000;
  const sorted = [...existingBlocks]
    .filter((b) => b.endTime > windowStart && b.startTime < windowEnd)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const slots: AvailableSlot[] = [];
  let cursor = windowStart.getTime();
  const limit = windowEnd.getTime();

  for (const block of sorted) {
    const blockStart = Math.max(block.startTime.getTime(), windowStart.getTime());
    const blockEnd = Math.min(block.endTime.getTime(), limit);

    if (blockStart - cursor >= minDurationMs) {
      slots.push({
        startTime: new Date(cursor),
        endTime: new Date(blockStart),
        durationMinutes: Math.floor((blockStart - cursor) / 60000),
      });
    }
    if (blockEnd > cursor) {
      cursor = blockEnd;
    }
  }

  if (limit - cursor >= minDurationMs) {
    slots.push({
      startTime: new Date(cursor),
      endTime: new Date(limit),
      durationMinutes: Math.floor((limit - cursor) / 60000),
    });
  }

  return slots;
};

export class SchedulingService {
  constructor(
    private readonly schedulingRepository: SchedulingRepository = new SchedulingRepository()
  ) {}

  private async ensureValidRelations(
    userId: string,
    relations: { taskId?: string | null; goalId?: string | null }
  ): Promise<void> {
    if (relations.taskId) {
      const task = await this.schedulingRepository.findOwnedTask(relations.taskId, userId);
      if (!task) {
        throw new AppError(404, 'Task not found', 'TASK_NOT_FOUND');
      }
    }
    if (relations.goalId) {
      const goal = await this.schedulingRepository.findOwnedGoal(relations.goalId, userId);
      if (!goal) {
        throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
      }
    }
  }

  private async ensureNoOverlap(
    userId: string,
    startTime: Date,
    endTime: Date,
    allowOverlap: boolean,
    excludeId?: string
  ): Promise<void> {
    if (allowOverlap) {
      return;
    }
    const conflicts = await this.schedulingRepository.findOverlapping(
      userId,
      startTime,
      endTime,
      excludeId
    );
    if (conflicts.length > 0) {
      throw new AppError(
        409,
        'Time block conflicts with an existing scheduled block',
        'SCHEDULING_CONFLICT'
      );
    }
  }

  async createTimeBlock(userId: string, data: CreateTimeBlockInput) {
    const { allowOverlap, ...payload } = data;
    await this.ensureValidRelations(userId, { taskId: payload.taskId, goalId: payload.goalId });
    await this.ensureNoOverlap(userId, payload.startTime, payload.endTime, allowOverlap);
    return this.schedulingRepository.create(userId, payload);
  }

  async getTimeBlocks(userId: string, filters: SchedulingQueryInput = {}) {
    return this.schedulingRepository.findAllByUserId(userId, filters);
  }

  async getTimeBlockById(id: string, userId: string) {
    const block = await this.schedulingRepository.findByIdAndUserId(id, userId);
    if (!block) {
      throw new AppError(404, 'Time block not found', 'TIME_BLOCK_NOT_FOUND');
    }
    return block;
  }

  async updateTimeBlock(id: string, userId: string, data: UpdateTimeBlockInput) {
    const existing = await this.getTimeBlockById(id, userId);
    const { allowOverlap, ...payload } = data;

    const startTime = payload.startTime ?? existing.startTime;
    const endTime = payload.endTime ?? existing.endTime;
    if (endTime <= startTime) {
      throw new AppError(400, 'endTime must be after startTime', 'VALIDATION_ERROR');
    }

    await this.ensureValidRelations(userId, { taskId: payload.taskId, goalId: payload.goalId });

    const nextStatus = payload.status ?? existing.status;
    if (nextStatus === 'SCHEDULED') {
      await this.ensureNoOverlap(userId, startTime, endTime, allowOverlap, id);
    }

    return this.schedulingRepository.update(id, payload);
  }

  async deleteTimeBlock(id: string, userId: string) {
    await this.getTimeBlockById(id, userId);
    await this.schedulingRepository.delete(id);
  }

  async suggestSlots(userId: string, query: SuggestSlotsQueryInput) {
    const windowStart = new Date(query.date);
    windowStart.setUTCHours(query.dayStartHour, query.tzOffsetMinutes, 0, 0);

    const windowEnd = new Date(query.date);
    windowEnd.setUTCHours(query.dayEndHour, query.tzOffsetMinutes, 0, 0);

    const blocks = await this.schedulingRepository.findAllByUserId(userId, {
      from: windowStart,
      to: windowEnd,
      status: 'SCHEDULED',
    });

    return findAvailableSlots(blocks, windowStart, windowEnd, query.durationMinutes);
  }
}
