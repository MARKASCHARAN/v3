import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { researchRateLimiter } from '../../middleware/rate-limit.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { ResearchController } from './research.controller';
import {
  conductResearchSchema,
  createResearchSchema,
  researchIdParamSchema,
  researchQuerySchema,
} from './research.schema';

const router = Router();
const controller = new ResearchController();

router.use(requireAuth);

router.post(
  '/search',
  researchRateLimiter,
  validateRequest({ body: conductResearchSchema }),
  controller.conduct
);
router.get('/', validateRequest({ query: researchQuerySchema }), controller.getAll);
router.post('/', validateRequest({ body: createResearchSchema }), controller.create);
router.get('/:id', validateRequest({ params: researchIdParamSchema }), controller.getOne);
router.post(
  '/:id/save-to-memory',
  validateRequest({ params: researchIdParamSchema }),
  controller.saveToMemory
);
router.delete('/:id', validateRequest({ params: researchIdParamSchema }), controller.remove);

export const researchRouter = router;
