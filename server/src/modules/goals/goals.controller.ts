import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { goalsQuerySchema } from './goals.schema';
import { GoalsService } from './goals.service';
import {
  CreateGoalInput,
  CreateMilestoneInput,
  UpdateGoalInput,
  UpdateMilestoneInput,
} from './goals.types';

export class GoalsController {
  private readonly goalsService = new GoalsService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  private getParam(req: AuthenticatedRequest, key: string, label: string): string {
    const value = req.params[key];
    if (typeof value !== 'string' || !value) {
      throw new AppError(400, `${label} is required`, 'VALIDATION_ERROR');
    }
    return value;
  }

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const goal = await this.goalsService.createGoal(userId, req.body as CreateGoalInput);
    res.status(201).json({ success: true, data: goal });
  };

  getAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = goalsQuerySchema.parse(req.query);
    const goals = await this.goalsService.getGoals(userId, filters);
    res.status(200).json({ success: true, data: goals });
  };

  getOne = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getParam(req, 'id', 'Goal ID');
    const goal = await this.goalsService.getGoalById(id, userId);
    res.status(200).json({ success: true, data: goal });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getParam(req, 'id', 'Goal ID');
    const goal = await this.goalsService.updateGoal(id, userId, req.body as UpdateGoalInput);
    res.status(200).json({ success: true, data: goal });
  };

  remove = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getParam(req, 'id', 'Goal ID');
    await this.goalsService.deleteGoal(id, userId);
    res.status(200).json({ success: true, data: { message: 'Goal deleted successfully' } });
  };

  addMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const goalId = this.getParam(req, 'id', 'Goal ID');
    const milestone = await this.goalsService.addMilestone(
      goalId,
      userId,
      req.body as CreateMilestoneInput
    );
    res.status(201).json({ success: true, data: milestone });
  };

  updateMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const goalId = this.getParam(req, 'id', 'Goal ID');
    const milestoneId = this.getParam(req, 'milestoneId', 'Milestone ID');
    const milestone = await this.goalsService.updateMilestone(
      goalId,
      milestoneId,
      userId,
      req.body as UpdateMilestoneInput
    );
    res.status(200).json({ success: true, data: milestone });
  };

  removeMilestone = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const goalId = this.getParam(req, 'id', 'Goal ID');
    const milestoneId = this.getParam(req, 'milestoneId', 'Milestone ID');
    await this.goalsService.deleteMilestone(goalId, milestoneId, userId);
    res.status(200).json({ success: true, data: { message: 'Milestone deleted successfully' } });
  };
}
