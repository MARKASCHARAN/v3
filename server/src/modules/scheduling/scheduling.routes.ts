import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { SchedulingController } from './scheduling.controller';
import {
  createTimeBlockSchema,
  schedulingQuerySchema,
  suggestSlotsQuerySchema,
  timeBlockIdParamSchema,
  updateTimeBlockSchema,
} from './scheduling.schema';

const router = Router();
const controller = new SchedulingController();

router.use(requireAuth);

router.get('/slots', validateRequest({ query: suggestSlotsQuerySchema }), controller.suggestSlots);
router.get('/blocks', validateRequest({ query: schedulingQuerySchema }), controller.getAll);
router.post('/blocks', validateRequest({ body: createTimeBlockSchema }), controller.create);
router.get('/blocks/:id', validateRequest({ params: timeBlockIdParamSchema }), controller.getOne);
router.patch(
  '/blocks/:id',
  validateRequest({ params: timeBlockIdParamSchema, body: updateTimeBlockSchema }),
  controller.update
);
router.delete(
  '/blocks/:id',
  validateRequest({ params: timeBlockIdParamSchema }),
  controller.remove
);

export const schedulingRouter = router;
