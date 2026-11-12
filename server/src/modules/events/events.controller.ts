import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { eventsQuerySchema, jobsQuerySchema } from './events.schema';
import { EventsService } from './events.service';
import { BackgroundJobType } from './events.types';

export class EventsController {
  private readonly eventsService = new EventsService();

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

  listSubscriptions = (_req: AuthenticatedRequest, res: Response): void => {
    const subscriptions = this.eventsService.listSubscriptionRules();
    res.status(200).json({ success: true, data: subscriptions });
  };

  ingestEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      eventType: string;
      source: string;
      payload: Record<string, unknown>;
      idempotencyKey?: string;
      maxAttempts: number;
      dispatchImmediately: boolean;
    };
    const result = await this.eventsService.ingestEvent({
      userId,
      eventType: body.eventType,
      source: body.source,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
      maxAttempts: body.maxAttempts,
      dispatchImmediately: body.dispatchImmediately,
    });
    res.status(result.deduplicated ? 200 : 201).json({ success: true, data: result });
  };

  listEvents = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = eventsQuerySchema.parse(req.query);
    const events = await this.eventsService.listEvents(userId, filters);
    res.status(200).json({ success: true, data: events });
  };

  getEvent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const event = await this.eventsService.getEventById(id, userId);
    res.status(200).json({ success: true, data: event });
  };

  listJobs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = jobsQuerySchema.parse(req.query);
    const jobs = await this.eventsService.listJobs(userId, filters);
    res.status(200).json({ success: true, data: jobs });
  };

  getJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const job = await this.eventsService.getJobById(id, userId);
    res.status(200).json({ success: true, data: job });
  };

  triggerJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      jobType: BackgroundJobType;
      payload: Record<string, unknown>;
      idempotencyKey?: string;
      maxAttempts: number;
      scheduledFor?: Date;
      executeImmediately: boolean;
    };
    const result = await this.eventsService.dispatchJob({
      userId,
      jobType: body.jobType,
      payload: body.payload,
      idempotencyKey: body.idempotencyKey,
      maxAttempts: body.maxAttempts,
      scheduledFor: body.scheduledFor,
      executeImmediately: body.executeImmediately,
    });
    res.status(result.deduplicated ? 200 : 202).json({ success: true, data: result });
  };

  retryJob = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getIdParam(req);
    const job = await this.eventsService.retryJob(id, userId);
    res.status(200).json({ success: true, data: job });
  };

  runRecoverySweep = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      staleMinutes?: number;
      includeApprovalExpiry?: boolean;
      includeMemoryPrune?: boolean;
    };
    const result = await this.eventsService.runRecoverySweep(userId, body);
    res.status(200).json({ success: true, data: result });
  };
}
