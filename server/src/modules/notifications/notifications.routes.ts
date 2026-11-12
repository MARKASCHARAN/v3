import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { NotificationsController } from './notifications.controller';
import {
  deliveriesQuerySchema,
  deliveryIdParamSchema,
  sendNotificationSchema,
  upsertNotificationPreferenceSchema,
} from './notifications.schema';

const router = Router();
const controller = new NotificationsController();

router.use(requireAuth);

router.get('/preferences', controller.listPreferences);
router.put(
  '/preferences',
  validateRequest({ body: upsertNotificationPreferenceSchema }),
  controller.upsertPreference
);
router.get(
  '/deliveries',
  validateRequest({ query: deliveriesQuerySchema }),
  controller.listDeliveries
);
router.post(
  '/send',
  validateRequest({ body: sendNotificationSchema }),
  controller.sendNotification
);
router.post(
  '/deliveries/:id/retry',
  validateRequest({ params: deliveryIdParamSchema }),
  controller.retryDelivery
);

export const notificationsRouter = router;

