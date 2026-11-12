import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { AccountabilityController } from './accountability.controller';
import {
  accountabilityIdParamSchema,
  accountabilityLogsQuerySchema,
  createAccountabilityLogSchema,
  createReminderSchema,
  generateInterventionsSchema,
  remindersQuerySchema,
  updateAccountabilityLogSchema,
  updateReminderSchema,
} from './accountability.schema';

const router = Router();
const controller = new AccountabilityController();

router.use(requireAuth);

router.get('/summary', controller.getSummary);
router.get('/missed-tasks', controller.getMissedTasks);
router.post('/missed-tasks/scan', controller.scanMissedTasks);
router.get('/procrastination', controller.analyzeProcrastination);
router.post(
  '/interventions',
  validateRequest({ body: generateInterventionsSchema }),
  controller.generateInterventions
);

router.get('/reminders', validateRequest({ query: remindersQuerySchema }), controller.getReminders);
router.post(
  '/reminders',
  validateRequest({ body: createReminderSchema }),
  controller.createReminder
);
router.patch(
  '/reminders/:id',
  validateRequest({ params: accountabilityIdParamSchema, body: updateReminderSchema }),
  controller.updateReminder
);
router.delete(
  '/reminders/:id',
  validateRequest({ params: accountabilityIdParamSchema }),
  controller.removeReminder
);

router.get('/logs', validateRequest({ query: accountabilityLogsQuerySchema }), controller.getLogs);
router.post(
  '/logs',
  validateRequest({ body: createAccountabilityLogSchema }),
  controller.createLog
);
router.patch(
  '/logs/:id',
  validateRequest({ params: accountabilityIdParamSchema, body: updateAccountabilityLogSchema }),
  controller.updateLog
);

export const accountabilityRouter = router;
