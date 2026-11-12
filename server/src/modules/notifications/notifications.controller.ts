import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { deliveriesQuerySchema } from './notifications.schema';
import { NotificationsService } from './notifications.service';
import { SendNotificationInput, UpsertNotificationPreferenceInput } from './notifications.types';

export class NotificationsController {
  private readonly service = new NotificationsService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  listPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const prefs = await this.service.listPreferences(userId);
    res.status(200).json({ success: true, data: prefs });
  };

  upsertPreference = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as UpsertNotificationPreferenceInput;
    const pref = await this.service.upsertPreference(userId, body);
    res.status(200).json({ success: true, data: pref });
  };

  listDeliveries = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const query = deliveriesQuerySchema.parse(req.query);
    const deliveries = await this.service.listDeliveries(userId, query);
    res.status(200).json({ success: true, data: deliveries });
  };

  sendNotification = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as SendNotificationInput;
    const delivery = await this.service.sendNotification(userId, body);
    const statusCode =
      delivery.status === 'FAILED' || delivery.status === 'DEAD_LETTER' ? 202 : 201;
    res.status(statusCode).json({ success: true, data: delivery });
  };

  retryDelivery = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = String(req.params.id);
    const delivery = await this.service.retryDelivery(id, userId);
    res.status(200).json({ success: true, data: delivery });
  };
}
