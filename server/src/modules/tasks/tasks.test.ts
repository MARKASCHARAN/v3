import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { TasksService } from './tasks.service';
import { TasksRepository } from './tasks.repository';
import {
  createTaskSchema,
  taskIdParamSchema,
  tasksQuerySchema,
  updateTaskSchema,
} from './tasks.schema';
import { AppError } from '../../middleware/error.middleware';

describe('Tasks Module', () => {
  describe('Schemas', () => {
    it('validates createTaskSchema with defaults', () => {
      const parsed = createTaskSchema.parse({ title: 'Write unit tests' });
      expect(parsed.title).toBe('Write unit tests');
      expect(parsed.priority).toBe('MEDIUM');
      expect(parsed.status).toBe('TODO');
    });

    it('rejects invalid priority and non-UUID param', () => {
      expect(() => createTaskSchema.parse({ title: 'Task', priority: 'CRITICAL' })).toThrow();
      expect(() => taskIdParamSchema.parse({ id: 'invalid' })).toThrow();
    });

    it('validates updateTaskSchema and tasksQuerySchema', () => {
      const updated = updateTaskSchema.parse({ status: 'DONE', priority: 'HIGH' });
      expect(updated.status).toBe('DONE');
      expect(updated.priority).toBe('HIGH');

      const query = tasksQuerySchema.parse({ overdue: 'true', parentTaskId: 'null' });
      expect(query.overdue).toBe('true');
      expect(query.parentTaskId).toBe('null');
    });
  });

  describe('TasksService', () => {
    it('throws TASK_NOT_FOUND when task does not exist', async () => {
      const mockRepo = {
        findByIdAndUserId: vi.fn().mockResolvedValue(null),
      } as unknown as TasksRepository;
      const service = new TasksService(mockRepo);

      await expect(service.getTaskById('missing', 'user-1')).rejects.toBeInstanceOf(AppError);
    });

    it('sets completedAt when transitioning status to DONE and clears when reopened', async () => {
      const taskId = '550e8400-e29b-41d4-a716-446655440010';
      const mockRepo = {
        findByIdAndUserId: vi
          .fn()
          .mockResolvedValueOnce({
            id: taskId,
            status: 'TODO',
            goalId: null,
            milestoneId: null,
            parentTaskId: null,
          })
          .mockResolvedValueOnce({
            id: taskId,
            status: 'DONE',
            goalId: null,
            milestoneId: null,
            parentTaskId: null,
          }),
        update: vi.fn().mockImplementation(async (_id, data) => data),
      } as unknown as TasksRepository;
      const service = new TasksService(mockRepo);

      const doneResult = await service.updateTask(taskId, 'user-1', { status: 'DONE' });
      expect(doneResult.completedAt).toBeInstanceOf(Date);

      const reopenResult = await service.updateTask(taskId, 'user-1', { status: 'IN_PROGRESS' });
      expect(reopenResult.completedAt).toBeNull();
    });

    it('prevents circular subtask hierarchy', async () => {
      const taskA = {
        id: '550e8400-e29b-41d4-a716-446655440021',
        status: 'TODO',
        goalId: null,
        milestoneId: null,
        parentTaskId: null,
      };
      const taskB = {
        id: '550e8400-e29b-41d4-a716-446655440022',
        status: 'TODO',
        goalId: null,
        milestoneId: null,
        parentTaskId: taskA.id,
      };
      const mockRepo = {
        findByIdAndUserId: vi.fn().mockImplementation(async (id: string) => {
          if (id === taskA.id) return taskA;
          if (id === taskB.id) return taskB;
          return null;
        }),
      } as unknown as TasksRepository;
      const service = new TasksService(mockRepo);

      await expect(
        service.updateTask(taskA.id, 'user-1', { parentTaskId: taskB.id })
      ).rejects.toThrow('Task hierarchy cannot contain cycles');
    });
  });

  describe('HTTP Routes', () => {
    it('GET /api/v1/tasks requires authentication', async () => {
      const response = await request(app).get('/api/v1/tasks');
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
