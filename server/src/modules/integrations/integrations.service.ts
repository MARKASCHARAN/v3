import { McpPermissionBridge, defaultMcpBridge } from '../../ai/mcp/mcp.bridge';
import { prisma } from '../../database/prisma';
import { GithubAdapter, OctokitGithubAdapter } from '../../integrations/github/github.adapter';
import {
  GoogleApisWorkspaceAdapter,
  GoogleWorkspaceAdapter,
} from '../../integrations/google/google-workspace.adapter';
import { AppError } from '../../middleware/error.middleware';
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from './integrations.crypto';
import { IntegrationsRepository } from './integrations.repository';
import {
  ConnectIntegrationInput,
  DecryptedCredentials,
  IntegrationAccountRecord,
  IntegrationProvider,
  SanitizedIntegrationAccount,
  UpdateIntegrationInput,
} from './integrations.types';

export interface TimeBlockImportStore {
  importGoogleEvents(
    userId: string,
    events: Array<{
      id: string;
      summary: string;
      description?: string;
      startTime: string;
      endTime: string;
    }>
  ): Promise<{ createdCount: number; skippedCount: number }>;
}

const prismaTimeBlockImportStore: TimeBlockImportStore = {
  async importGoogleEvents(userId, events) {
    let createdCount = 0;
    let skippedCount = 0;

    for (const event of events) {
      const startTime = new Date(event.startTime);
      const endTime = new Date(event.endTime);
      if (
        Number.isNaN(startTime.getTime()) ||
        Number.isNaN(endTime.getTime()) ||
        endTime <= startTime
      ) {
        skippedCount += 1;
        continue;
      }

      const existing = await prisma.timeBlock.findFirst({
        where: {
          userId,
          title: event.summary,
          startTime,
          endTime,
        },
        select: { id: true },
      });

      if (existing) {
        skippedCount += 1;
        continue;
      }

      await prisma.timeBlock.create({
        data: {
          userId,
          title: event.summary,
          description: event.description ?? `Synced from Google Calendar (${event.id})`,
          startTime,
          endTime,
          category: 'MEETING',
          status: 'SCHEDULED',
        },
      });
      createdCount += 1;
    }

    return { createdCount, skippedCount };
  },
};

export const sanitizeIntegrationAccount = (
  record: IntegrationAccountRecord
): SanitizedIntegrationAccount => ({
  id: record.id,
  userId: record.userId,
  provider: record.provider,
  externalAccountId: record.externalAccountId,
  scopes: record.scopes,
  status: record.status,
  lastSyncedAt: record.lastSyncedAt,
  hasCredentials: Boolean(record.encryptedCredentials && record.encryptedCredentials.length > 0),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export class IntegrationsService {
  constructor(
    private readonly repo: IntegrationsRepository = new IntegrationsRepository(),
    private readonly googleAdapter: GoogleWorkspaceAdapter = new GoogleApisWorkspaceAdapter(),
    private readonly githubAdapter: GithubAdapter = new OctokitGithubAdapter(),
    private readonly mcpBridge: McpPermissionBridge = defaultMcpBridge,
    private readonly timeBlockStore: TimeBlockImportStore = prismaTimeBlockImportStore
  ) {}

  async listAccounts(userId: string): Promise<SanitizedIntegrationAccount[]> {
    const accounts = await this.repo.findByUserId(userId);
    return accounts.map(sanitizeIntegrationAccount);
  }

  async getAccount(
    userId: string,
    provider: IntegrationProvider
  ): Promise<SanitizedIntegrationAccount> {
    const account = await this.repo.findByUserIdAndProvider(userId, provider);
    if (!account) {
      throw new AppError(404, `Integration for provider ${provider} not found`, 'NOT_FOUND');
    }
    return sanitizeIntegrationAccount(account);
  }

  async getDecryptedCredentials(
    userId: string,
    provider: IntegrationProvider
  ): Promise<DecryptedCredentials | null> {
    const account = await this.repo.findByUserIdAndProvider(userId, provider);
    if (!account || account.status !== 'ACTIVE') {
      return null;
    }
    return decryptIntegrationCredentials<DecryptedCredentials>(account.encryptedCredentials);
  }

  async connectAccount(
    userId: string,
    input: ConnectIntegrationInput
  ): Promise<SanitizedIntegrationAccount> {
    const encryptedCredentials = encryptIntegrationCredentials(input.credentials);
    const saved = await this.repo.upsertAccount({
      userId,
      provider: input.provider,
      encryptedCredentials,
      externalAccountId: input.externalAccountId,
      scopes: input.scopes ?? [],
    });
    return sanitizeIntegrationAccount(saved);
  }

  async updateAccount(
    userId: string,
    provider: IntegrationProvider,
    input: UpdateIntegrationInput
  ): Promise<SanitizedIntegrationAccount> {
    const existing = await this.repo.findByUserIdAndProvider(userId, provider);
    if (!existing) {
      throw new AppError(404, `Integration for provider ${provider} not found`, 'NOT_FOUND');
    }

    const encryptedCredentials = input.credentials
      ? encryptIntegrationCredentials(input.credentials)
      : undefined;

    const updated = await this.repo.updateAccount(userId, provider, {
      ...(encryptedCredentials ? { encryptedCredentials } : {}),
      ...(input.externalAccountId !== undefined
        ? { externalAccountId: input.externalAccountId }
        : {}),
      ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });

    return sanitizeIntegrationAccount(updated);
  }

  async disconnectAccount(userId: string, provider: IntegrationProvider): Promise<void> {
    const existing = await this.repo.findByUserIdAndProvider(userId, provider);
    if (!existing) {
      throw new AppError(404, `Integration for provider ${provider} not found`, 'NOT_FOUND');
    }
    await this.repo.deleteAccount(userId, provider);
  }

  async syncGoogleCalendar(
    userId: string,
    params: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      importAsTimeBlocks?: boolean;
    }
  ) {
    const credentials = await this.getDecryptedCredentials(userId, 'GOOGLE');
    if (!credentials) {
      throw new AppError(
        400,
        'Active GOOGLE integration account is required for calendar sync',
        'GOOGLE_NOT_CONNECTED'
      );
    }

    const events = await this.googleAdapter.listCalendarEvents(
      {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
      },
      params
    );

    const importResult =
      params.importAsTimeBlocks !== false
        ? await this.timeBlockStore.importGoogleEvents(userId, events)
        : { createdCount: 0, skippedCount: events.length };

    await this.repo.updateAccount(userId, 'GOOGLE', { lastSyncedAt: new Date() });

    return {
      syncedCount: events.length,
      importedTimeBlocks: importResult.createdCount,
      skippedTimeBlocks: importResult.skippedCount,
      events,
    };
  }

  async listGmailMessages(userId: string, params: { q?: string; maxResults?: number }) {
    const credentials = await this.getDecryptedCredentials(userId, 'GOOGLE');
    if (!credentials) {
      throw new AppError(
        400,
        'Active GOOGLE integration account is required to read Gmail messages',
        'GOOGLE_NOT_CONNECTED'
      );
    }

    const messages = await this.googleAdapter.listGmailMessages(
      {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
      },
      { query: params.q, maxResults: params.maxResults }
    );

    await this.repo.updateAccount(userId, 'GOOGLE', { lastSyncedAt: new Date() });
    return messages;
  }

  private async resolveGithubToken(userId: string): Promise<string | undefined> {
    const credentials = await this.getDecryptedCredentials(userId, 'GITHUB');
    return (
      credentials?.accessToken ??
      (typeof credentials?.token === 'string' ? credentials.token : undefined)
    );
  }

  async listGithubRepositories(userId: string, limit: number = 20) {
    const token = await this.resolveGithubToken(userId);
    const repos = await this.githubAdapter.listRepositories(token, { limit });
    if (token) {
      await this.repo
        .updateAccount(userId, 'GITHUB', { lastSyncedAt: new Date() })
        .catch(() => undefined);
    }
    return repos;
  }

  async listGithubIssues(
    userId: string,
    params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; limit?: number }
  ) {
    const token = await this.resolveGithubToken(userId);
    return this.githubAdapter.listIssues(params, token);
  }

  async listGithubPullRequests(
    userId: string,
    params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; limit?: number }
  ) {
    const token = await this.resolveGithubToken(userId);
    return this.githubAdapter.listPullRequests(params, token);
  }

  async createGithubIssue(
    userId: string,
    params: { owner: string; repo: string; title: string; body?: string; labels?: string[] }
  ) {
    const token = await this.resolveGithubToken(userId);
    return this.githubAdapter.createIssue(params, token);
  }

  async createGithubComment(
    userId: string,
    params: { owner: string; repo: string; issueNumber: number; body: string }
  ) {
    const token = await this.resolveGithubToken(userId);
    return this.githubAdapter.createIssueComment(params, token);
  }

  async listMcpServersAndTools(userId: string) {
    const [servers, tools] = await Promise.all([
      Promise.resolve(this.mcpBridge.listServers()),
      this.mcpBridge.listAvailableTools(userId),
    ]);
    return { servers, tools };
  }

  async invokeMcpTool(
    userId: string,
    params: {
      serverName: string;
      toolName: string;
      arguments: Record<string, unknown>;
      allowAutoApproveWrites?: boolean;
    }
  ) {
    return this.mcpBridge.invokeGuardedMcpTool({
      serverName: params.serverName,
      toolName: params.toolName,
      arguments: params.arguments,
      userId,
      agentRole: 'MAIN_ORCHESTRATOR',
      allowAutoApproveWrites: params.allowAutoApproveWrites,
    });
  }
}
