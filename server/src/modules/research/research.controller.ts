import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { researchQuerySchema } from './research.schema';
import { ResearchService } from './research.service';
import { ConductResearchInput, CreateResearchInput } from './research.types';

export class ResearchController {
  private readonly researchService = new ResearchService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  private getResearchId(req: AuthenticatedRequest): string {
    const id = req.params.id;
    if (typeof id !== 'string' || !id) {
      throw new AppError(400, 'Research ID is required', 'VALIDATION_ERROR');
    }
    return id;
  }

  conduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const item = await this.researchService.conductResearch(
      userId,
      req.body as ConductResearchInput
    );
    res.status(201).json({ success: true, data: item });
  };

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const item = await this.researchService.createResearchNote(
      userId,
      req.body as CreateResearchInput
    );
    res.status(201).json({ success: true, data: item });
  };

  getAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = researchQuerySchema.parse(req.query);
    const items = await this.researchService.listResearch(userId, filters);
    res.status(200).json({ success: true, data: items });
  };

  getOne = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getResearchId(req);
    const item = await this.researchService.getResearchById(id, userId);
    res.status(200).json({ success: true, data: item });
  };

  saveToMemory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getResearchId(req);
    const result = await this.researchService.saveToMemory(id, userId);
    res.status(200).json({ success: true, data: result });
  };

  remove = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getResearchId(req);
    await this.researchService.deleteResearch(id, userId);
    res
      .status(200)
      .json({ success: true, data: { message: 'Research item deleted successfully' } });
  };
}
