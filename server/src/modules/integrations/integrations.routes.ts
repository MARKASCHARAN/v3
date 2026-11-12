import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateRequest } from '../../middleware/validation.middleware';
import { IntegrationsController } from './integrations.controller';
import {
  connectIntegrationSchema,
  createGithubCommentSchema,
  createGithubIssueSchema,
  githubIssuesQuerySchema,
  githubRepoParamsSchema,
  gmailListQuerySchema,
  googleCalendarSyncSchema,
  integrationProviderParamSchema,
  invokeMcpToolSchema,
  updateIntegrationSchema,
} from './integrations.schema';

const router = Router();
const controller = new IntegrationsController();

router.use(requireAuth);

router.get('/', controller.listAccounts);
router.post(
  '/connect',
  validateRequest({ body: connectIntegrationSchema }),
  controller.connectAccount
);

router.post(
  '/google/calendar/sync',
  validateRequest({ body: googleCalendarSyncSchema }),
  controller.syncGoogleCalendar
);
router.get(
  '/google/gmail/messages',
  validateRequest({ query: gmailListQuerySchema }),
  controller.listGmailMessages
);

router.get('/github/repos', controller.listGithubRepositories);
router.get(
  '/github/repos/:owner/:repo/issues',
  validateRequest({ params: githubRepoParamsSchema, query: githubIssuesQuerySchema }),
  controller.listGithubIssues
);
router.get(
  '/github/repos/:owner/:repo/pulls',
  validateRequest({ params: githubRepoParamsSchema, query: githubIssuesQuerySchema }),
  controller.listGithubPullRequests
);
router.post(
  '/github/issues',
  validateRequest({ body: createGithubIssueSchema }),
  controller.createGithubIssue
);
router.post(
  '/github/issues/comment',
  validateRequest({ body: createGithubCommentSchema }),
  controller.createGithubComment
);

router.get('/mcp/tools', controller.listMcpTools);
router.post(
  '/mcp/invoke',
  validateRequest({ body: invokeMcpToolSchema }),
  controller.invokeMcpTool
);

router.get(
  '/:provider',
  validateRequest({ params: integrationProviderParamSchema }),
  controller.getAccount
);
router.patch(
  '/:provider',
  validateRequest({ params: integrationProviderParamSchema, body: updateIntegrationSchema }),
  controller.updateAccount
);
router.delete(
  '/:provider',
  validateRequest({ params: integrationProviderParamSchema }),
  controller.disconnectAccount
);

export const integrationsRouter = router;
