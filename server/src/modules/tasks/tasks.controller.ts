import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { tasksQuerySchema } from './tasks.schema';
import { TasksService } from './tasks.service';
import { CreateTaskInput, UpdateTaskInput } from './tasks.types';

export class TasksController {
  private readonly tasksService = new TasksService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  private getTaskId(req: AuthenticatedRequest): string {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw new AppError(400, 'Task ID is required', 'VALIDATION_ERROR');
    }
    return id;
  }

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const task = await this.tasksService.createTask(userId, req.body as CreateTaskInput);
    res.status(201).json({ success: true, data: task });
  };

  getAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = tasksQuerySchema.parse(req.query);
    const tasks = await this.tasksService.getTasks(userId, filters);
    res.status(200).json({ success: true, data: tasks });
  };

  getOne = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getTaskId(req);
    const task = await this.tasksService.getTaskById(id, userId);
    res.status(200).json({ success: true, data: task });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getTaskId(req);
    const task = await this.tasksService.updateTask(id, userId, req.body as UpdateTaskInput);
    res.status(200).json({ success: true, data: task });
  };

  remove = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getTaskId(req);
    await this.tasksService.deleteTask(id, userId);
    res.status(200).json({ success: true, data: { message: 'Task deleted successfully' } });
  };
}
