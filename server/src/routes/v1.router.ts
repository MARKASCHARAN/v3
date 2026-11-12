import { Router, Request, Response } from 'express';
import { accountabilityRouter } from '../modules/accountability/accountability.routes';
import { authRouter } from '../modules/auth/auth.routes';
import { automationRouter } from '../modules/automation/automation.routes';
import { goalsRouter } from '../modules/goals/goals.routes';
import { memoryRouter } from '../modules/memory/memory.routes';
import { planningRouter } from '../modules/planning/planning.routes';
import { researchRouter } from '../modules/research/research.routes';
import { schedulingRouter } from '../modules/scheduling/scheduling.routes';
import { tasksRouter } from '../modules/tasks/tasks.routes';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      service: 'v3-server-api',
      version: 'v1',
      status: 'operational',
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRouter);
router.use('/goals', goalsRouter);
router.use('/planning', planningRouter);
router.use('/scheduling', schedulingRouter);
router.use('/tasks', tasksRouter);
router.use('/accountability', accountabilityRouter);
router.use('/memory', memoryRouter);
router.use('/research', researchRouter);
router.use('/automation', automationRouter);

export const v1Router = router;
