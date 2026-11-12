import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { aiExecutionRateLimiter } from '../../middleware/rate-limit.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { PlanningController } from './planning.controller';
import {
  applyPlanSchema,
  createPlanSchema,
  generatePlanSchema,
  planIdParamSchema,
  plansQuerySchema,
  updatePlanSchema,
} from './planning.schema';

const router = Router();
const controller = new PlanningController();

router.use(requireAuth);

router.post(
  '/generate',
  aiExecutionRateLimiter,
  validateRequest({ body: generatePlanSchema }),
  controller.generate
);
router.get('/plans', validateRequest({ query: plansQuerySchema }), controller.getAll);
router.post('/plans', validateRequest({ body: createPlanSchema }), controller.create);
router.get('/plans/:id', validateRequest({ params: planIdParamSchema }), controller.getOne);
router.patch(
  '/plans/:id',
  validateRequest({ params: planIdParamSchema, body: updatePlanSchema }),
  controller.update
);
router.post(
  '/plans/:id/apply',
  validateRequest({ params: planIdParamSchema, body: applyPlanSchema }),
  controller.apply
);
router.delete('/plans/:id', validateRequest({ params: planIdParamSchema }), controller.remove);

export const planningRouter = router;
