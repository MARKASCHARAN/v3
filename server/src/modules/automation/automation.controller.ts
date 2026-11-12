import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { approvalsQuerySchema, executionsQuerySchema } from './automation.schema';
import { AutomationService } from './automation.service';
import { ApprovalDecisionInput, RunAssistantInput } from './automation.types';

export class AutomationController {
  private readonly automationService = new AutomationService();

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

  listTools = (_req: AuthenticatedRequest, res: Response): void => {
    const tools = this.automationService.listTools();
    res.status(200).json({ success: true, data: tools });
  };

  run = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const execution = await this.automationService.runAssistant(
      userId,
      req.body as RunAssistantInput
    );
    res.status(200).json({ success: true, data: execution });
  };

  getExecutions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = executionsQuerySchema.parse(req.query);
    const executions = await this.automationService.getExecutions(userId, filters);
    res.status(200).json({ success: true, data: executions });
  };

  getExecution = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const execution = await this.automationService.getExecutionById(id, userId);
    res.status(200).json({ success: true, data: execution });
  };

  getApprovals = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = approvalsQuerySchema.parse(req.query);
    const approvals = await this.automationService.getApprovals(userId, filters);
    res.status(200).json({ success: true, data: approvals });
  };

  approve = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const approval = await this.automationService.approveToolCall(id, userId);
    res.status(200).json({ success: true, data: approval });
  };

  reject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const body = (req.body || {}) as ApprovalDecisionInput;
    const approval = await this.automationService.rejectToolCall(id, userId, body.reason);
    res.status(200).json({ success: true, data: approval });
  };
}
