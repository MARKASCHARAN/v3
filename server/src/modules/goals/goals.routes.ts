import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { GoalsController } from './goals.controller';
import {
  createGoalSchema,
  createMilestoneSchema,
  goalIdParamSchema,
  goalsQuerySchema,
  milestoneParamSchema,
  updateGoalSchema,
  updateMilestoneSchema,
} from './goals.schema';

const router = Router();
const controller = new GoalsController();

router.use(requireAuth);

router.get('/', validateRequest({ query: goalsQuerySchema }), controller.getAll);
router.post('/', validateRequest({ body: createGoalSchema }), controller.create);
router.get('/:id', validateRequest({ params: goalIdParamSchema }), controller.getOne);
router.patch(
  '/:id',
  validateRequest({ params: goalIdParamSchema, body: updateGoalSchema }),
  controller.update
);
router.delete('/:id', validateRequest({ params: goalIdParamSchema }), controller.remove);

router.post(
  '/:id/milestones',
  validateRequest({ params: goalIdParamSchema, body: createMilestoneSchema }),
  controller.addMilestone
);
router.patch(
  '/:id/milestones/:milestoneId',
  validateRequest({ params: milestoneParamSchema, body: updateMilestoneSchema }),
  controller.updateMilestone
);
router.delete(
  '/:id/milestones/:milestoneId',
  validateRequest({ params: milestoneParamSchema }),
  controller.removeMilestone
);

export const goalsRouter = router;
