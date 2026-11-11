import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { TasksController } from './tasks.controller';
import {
  createTaskSchema,
  taskIdParamSchema,
  tasksQuerySchema,
  updateTaskSchema,
} from './tasks.schema';

const router = Router();
const controller = new TasksController();

router.use(requireAuth);

router.get('/', validateRequest({ query: tasksQuerySchema }), controller.getAll);
router.post('/', validateRequest({ body: createTaskSchema }), controller.create);
router.get('/:id', validateRequest({ params: taskIdParamSchema }), controller.getOne);
router.patch(
  '/:id',
  validateRequest({ params: taskIdParamSchema, body: updateTaskSchema }),
  controller.update
);
router.delete('/:id', validateRequest({ params: taskIdParamSchema }), controller.remove);

export const tasksRouter = router;
