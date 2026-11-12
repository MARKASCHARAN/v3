import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { AutomationController } from './automation.controller';
import {
  approvalDecisionSchema,
  approvalsQuerySchema,
  automationIdParamSchema,
  executionsQuerySchema,
  runAssistantSchema,
} from './automation.schema';

const router = Router();
const controller = new AutomationController();

router.use(requireAuth);

router.get('/tools', controller.listTools);
router.post('/run', validateRequest({ body: runAssistantSchema }), controller.run);
router.get(
  '/executions',
  validateRequest({ query: executionsQuerySchema }),
  controller.getExecutions
);
router.get(
  '/executions/:id',
  validateRequest({ params: automationIdParamSchema }),
  controller.getExecution
);
router.get('/approvals', validateRequest({ query: approvalsQuerySchema }), controller.getApprovals);
router.post(
  '/approvals/:id/approve',
  validateRequest({ params: automationIdParamSchema, body: approvalDecisionSchema }),
  controller.approve
);
router.post(
  '/approvals/:id/reject',
  validateRequest({ params: automationIdParamSchema, body: approvalDecisionSchema }),
  controller.reject
);

export const automationRouter = router;
