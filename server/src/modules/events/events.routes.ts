import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { EventsController } from './events.controller';
import {
  eventOrJobIdParamSchema,
  eventsQuerySchema,
  ingestDomainEventSchema,
  jobsQuerySchema,
  recoverySweepSchema,
  triggerBackgroundJobSchema,
} from './events.schema';

const router = Router();
const controller = new EventsController();

router.use(requireAuth);

router.get('/subscriptions', controller.listSubscriptions);
router.get('/', validateRequest({ query: eventsQuerySchema }), controller.listEvents);
router.post('/ingest', validateRequest({ body: ingestDomainEventSchema }), controller.ingestEvent);
router.get('/jobs', validateRequest({ query: jobsQuerySchema }), controller.listJobs);
router.post(
  '/jobs/trigger',
  validateRequest({ body: triggerBackgroundJobSchema }),
  controller.triggerJob
);
router.get('/jobs/:id', validateRequest({ params: eventOrJobIdParamSchema }), controller.getJob);
router.post(
  '/jobs/:id/retry',
  validateRequest({ params: eventOrJobIdParamSchema }),
  controller.retryJob
);
router.post(
  '/recovery/sweep',
  validateRequest({ body: recoverySweepSchema }),
  controller.runRecoverySweep
);
router.get('/:id', validateRequest({ params: eventOrJobIdParamSchema }), controller.getEvent);

export const eventsRouter = router;

