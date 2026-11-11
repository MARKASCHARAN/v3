import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { plansQuerySchema } from './planning.schema';
import { PlanningService } from './planning.service';
import {
  ApplyPlanInput,
  CreatePlanInput,
  GeneratePlanInput,
  UpdatePlanInput,
} from './planning.types';

export class PlanningController {
  private readonly planningService = new PlanningService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  private getPlanId(req: AuthenticatedRequest): string {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw new AppError(400, 'Plan ID is required', 'VALIDATION_ERROR');
    }
    return id;
  }

  generate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const plan = await this.planningService.generatePlan(userId, req.body as GeneratePlanInput);
    res.status(201).json({ success: true, data: plan });
  };

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const plan = await this.planningService.createPlan(userId, req.body as CreatePlanInput);
    res.status(201).json({ success: true, data: plan });
  };

  getAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = plansQuerySchema.parse(req.query);
    const plans = await this.planningService.getPlans(userId, filters);
    res.status(200).json({ success: true, data: plans });
  };

  getOne = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getPlanId(req);
    const plan = await this.planningService.getPlanById(id, userId);
    res.status(200).json({ success: true, data: plan });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getPlanId(req);
    const plan = await this.planningService.updatePlan(id, userId, req.body as UpdatePlanInput);
    res.status(200).json({ success: true, data: plan });
  };

  apply = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getPlanId(req);
    const body = (req.body || {}) as ApplyPlanInput;
    const applied = await this.planningService.applyPlan(id, userId, body.goalId);
    res.status(200).json({ success: true, data: applied });
  };

  remove = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getPlanId(req);
    await this.planningService.deletePlan(id, userId);
    res.status(200).json({ success: true, data: { message: 'Plan deleted successfully' } });
  };
}
