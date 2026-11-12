import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { githubIssuesQuerySchema, gmailListQuerySchema } from './integrations.schema';
import { IntegrationsService } from './integrations.service';
import {
  ConnectIntegrationInput,
  IntegrationProvider,
  UpdateIntegrationInput,
} from './integrations.types';

export class IntegrationsController {
  private readonly service = new IntegrationsService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  listAccounts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const accounts = await this.service.listAccounts(userId);
    res.status(200).json({ success: true, data: accounts });
  };

  getAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const provider = req.params.provider as IntegrationProvider;
    const account = await this.service.getAccount(userId, provider);
    res.status(200).json({ success: true, data: account });
  };

  connectAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as ConnectIntegrationInput;
    const account = await this.service.connectAccount(userId, body);
    res.status(201).json({ success: true, data: account });
  };

  updateAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const provider = req.params.provider as IntegrationProvider;
    const body = req.body as UpdateIntegrationInput;
    const account = await this.service.updateAccount(userId, provider, body);
    res.status(200).json({ success: true, data: account });
  };

  disconnectAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const provider = req.params.provider as IntegrationProvider;
    await this.service.disconnectAccount(userId, provider);
    res.status(200).json({ success: true, data: { disconnected: true, provider } });
  };

  syncGoogleCalendar = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      importAsTimeBlocks?: boolean;
    };
    const result = await this.service.syncGoogleCalendar(userId, body);
    res.status(200).json({ success: true, data: result });
  };

  listGmailMessages = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const query = gmailListQuerySchema.parse(req.query);
    const messages = await this.service.listGmailMessages(userId, query);
    res.status(200).json({ success: true, data: messages });
  };

  listGithubRepositories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const repos = await this.service.listGithubRepositories(userId);
    res.status(200).json({ success: true, data: repos });
  };

  listGithubIssues = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    const query = githubIssuesQuerySchema.parse(req.query);
    const issues = await this.service.listGithubIssues(userId, { owner, repo, ...query });
    res.status(200).json({ success: true, data: issues });
  };

  listGithubPullRequests = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const owner = String(req.params.owner);
    const repo = String(req.params.repo);
    const query = githubIssuesQuerySchema.parse(req.query);
    const pulls = await this.service.listGithubPullRequests(userId, { owner, repo, ...query });
    res.status(200).json({ success: true, data: pulls });
  };

  createGithubIssue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      owner: string;
      repo: string;
      title: string;
      body?: string;
      labels?: string[];
    };
    const issue = await this.service.createGithubIssue(userId, body);
    res.status(201).json({ success: true, data: issue });
  };

  createGithubComment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      owner: string;
      repo: string;
      issueNumber: number;
      body: string;
    };
    const comment = await this.service.createGithubComment(userId, body);
    res.status(201).json({ success: true, data: comment });
  };

  listMcpTools = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const data = await this.service.listMcpServersAndTools(userId);
    res.status(200).json({ success: true, data });
  };

  invokeMcpTool = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      serverName: string;
      toolName: string;
      arguments: Record<string, unknown>;
      allowAutoApproveWrites?: boolean;
    };
    const result = await this.service.invokeMcpTool(userId, body);
    res.status(200).json({ success: true, data: result });
  };
}
