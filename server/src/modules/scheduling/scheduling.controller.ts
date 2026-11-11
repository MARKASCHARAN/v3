import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { schedulingQuerySchema, suggestSlotsQuerySchema } from './scheduling.schema';
import { SchedulingService } from './scheduling.service';
import { CreateTimeBlockInput, UpdateTimeBlockInput } from './scheduling.types';

export class SchedulingController {
  private readonly schedulingService = new SchedulingService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  private getBlockId(req: AuthenticatedRequest): string {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw new AppError(400, 'Time block ID is required', 'VALIDATION_ERROR');
    }
    return id;
  }

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const block = await this.schedulingService.createTimeBlock(
      userId,
      req.body as CreateTimeBlockInput
    );
    res.status(201).json({ success: true, data: block });
  };

  getAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = schedulingQuerySchema.parse(req.query);
    const blocks = await this.schedulingService.getTimeBlocks(userId, filters);
    res.status(200).json({ success: true, data: blocks });
  };

  getOne = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getBlockId(req);
    const block = await this.schedulingService.getTimeBlockById(id, userId);
    res.status(200).json({ success: true, data: block });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getBlockId(req);
    const block = await this.schedulingService.updateTimeBlock(
      id,
      userId,
      req.body as UpdateTimeBlockInput
    );
    res.status(200).json({ success: true, data: block });
  };

  remove = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getBlockId(req);
    await this.schedulingService.deleteTimeBlock(id, userId);
    res.status(200).json({ success: true, data: { message: 'Time block deleted successfully' } });
  };

  suggestSlots = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const query = suggestSlotsQuerySchema.parse(req.query);
    const slots = await this.schedulingService.suggestSlots(userId, query);
    res.status(200).json({ success: true, data: slots });
  };
}
