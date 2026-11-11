import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { accountabilityLogsQuerySchema, remindersQuerySchema } from './accountability.schema';
import { AccountabilityService } from './accountability.service';
import {
  CreateAccountabilityLogInput,
  CreateReminderInput,
  UpdateAccountabilityLogInput,
  UpdateReminderInput,
} from './accountability.types';

export class AccountabilityController {
  private readonly accountabilityService = new AccountabilityService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  private getIdParam(req: AuthenticatedRequest): string {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw new AppError(400, 'ID is required', 'VALIDATION_ERROR');
    }
    return id;
  }

  getSummary = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const summary = await this.accountabilityService.getProgressSummary(userId);
    res.status(200).json({ success: true, data: summary });
  };

  getMissedTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const tasks = await this.accountabilityService.getMissedTasks(userId);
    res.status(200).json({ success: true, data: tasks });
  };

  scanMissedTasks = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const report = await this.accountabilityService.detectAndLogMissedTasks(userId);
    res.status(200).json({ success: true, data: report });
  };

  createReminder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const reminder = await this.accountabilityService.createReminder(
      userId,
      req.body as CreateReminderInput
    );
    res.status(201).json({ success: true, data: reminder });
  };

  getReminders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = remindersQuerySchema.parse(req.query);
    const reminders = await this.accountabilityService.getReminders(userId, filters);
    res.status(200).json({ success: true, data: reminders });
  };

  updateReminder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const reminder = await this.accountabilityService.updateReminder(
      id,
      userId,
      req.body as UpdateReminderInput
    );
    res.status(200).json({ success: true, data: reminder });
  };

  removeReminder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    await this.accountabilityService.deleteReminder(id, userId);
    res.status(200).json({ success: true, data: { message: 'Reminder deleted successfully' } });
  };

  createLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const log = await this.accountabilityService.createLog(
      userId,
      req.body as CreateAccountabilityLogInput
    );
    res.status(201).json({ success: true, data: log });
  };

  getLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = accountabilityLogsQuerySchema.parse(req.query);
    const logs = await this.accountabilityService.getLogs(userId, filters);
    res.status(200).json({ success: true, data: logs });
  };

  updateLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const log = await this.accountabilityService.updateLog(
      id,
      userId,
      req.body as UpdateAccountabilityLogInput
    );
    res.status(200).json({ success: true, data: log });
  };
}
