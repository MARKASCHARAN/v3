import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../app';
import { GithubAdapter } from '../../integrations/github/github.adapter';
import { GoogleWorkspaceAdapter } from '../../integrations/google/google-workspace.adapter';
import {
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from './integrations.crypto';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService, TimeBlockImportStore } from './integrations.service';
import { IntegrationAccountRecord } from './integrations.types';

const makeAccount = (
  overrides: Partial<IntegrationAccountRecord> = {}
): IntegrationAccountRecord => ({
  id: 'acc-1',
  userId: 'user-1',
  provider: 'GOOGLE',
  externalAccountId: 'user@gmail.com',
  encryptedCredentials: encryptIntegrationCredentials(
    { accessToken: 'secret-token-123', refreshToken: 'refresh-456' },
    'test-master-key-32-chars-minimum'
  ),
  scopes: ['calendar.readonly', 'gmail.readonly'],
  status: 'ACTIVE',
  lastSyncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Integrations Module (M2.8)', () => {
  it('encrypts and decrypts credentials via AES-256-GCM and rejects tampered ciphertext', () => {
    const key = 'test-integration-encryption-secret';
    const payload = { accessToken: 'tok_abc', botToken: 'bot_xyz' };
    const encrypted = encryptIntegrationCredentials(payload, key);

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain('tok_abc');
    expect(encrypted).not.toContain('bot_xyz');

    const decrypted = decryptIntegrationCredentials<typeof payload>(encrypted, key);
    expect(decrypted).toEqual(payload);

    const [p0, p1, p2, p3] = encrypted.split('.');
    const tampered = [p0, p1, p2, 'AAAA' + (p3 ?? '').slice(4)].join('.');
    expect(() => decryptIntegrationCredentials(tampered, key)).toThrow(
      'Failed to decrypt integration credentials'
    );
  });

  it('connects integration accounts securely without returning encryptedCredentials in API models', async () => {
    const repo = {
      upsertAccount: vi.fn().mockImplementation(async (params) =>
        makeAccount({
          provider: params.provider,
          encryptedCredentials: params.encryptedCredentials,
          scopes: params.scopes,
        })
      ),
      findByUserId: vi.fn().mockResolvedValue([makeAccount()]),
    } as unknown as IntegrationsRepository;

    const service = new IntegrationsService(repo);
    const connected = await service.connectAccount('user-1', {
      provider: 'GITHUB',
      credentials: { accessToken: 'ghp_super_secret' },
      scopes: ['repo', 'read:user'],
    });

    expect(connected.provider).toBe('GITHUB');
    expect(connected.hasCredentials).toBe(true);
    expect('encryptedCredentials' in connected).toBe(false);

    const list = await service.listAccounts('user-1');
    expect(list).toHaveLength(1);
    expect('encryptedCredentials' in list[0]!).toBe(false);
  });

  it('syncs Google Calendar events and imports them as TimeBlocks via TimeBlockImportStore', async () => {
    const encrypted = encryptIntegrationCredentials({
      accessToken: 'google-access-tok',
      refreshToken: 'google-refresh-tok',
    });

    const repo = {
      findByUserIdAndProvider: vi
        .fn()
        .mockResolvedValue(makeAccount({ provider: 'GOOGLE', encryptedCredentials: encrypted })),
      updateAccount: vi.fn().mockResolvedValue(makeAccount()),
    } as unknown as IntegrationsRepository;

    const googleAdapter: GoogleWorkspaceAdapter = {
      listCalendarEvents: vi.fn().mockResolvedValue([
        {
          id: 'gcal-1',
          summary: 'Architecture Review',
          startTime: '2026-11-15T10:00:00.000Z',
          endTime: '2026-11-15T11:00:00.000Z',
        },
      ]),
      createCalendarEvent: vi.fn(),
      listGmailMessages: vi.fn().mockResolvedValue([
        {
          id: 'msg-1',
          subject: 'Sprint Update',
          from: 'lead@company.com',
          snippet: 'Phase 2 ETA',
        },
      ]),
      sendGmailMessage: vi.fn(),
    };

    const timeBlockStore: TimeBlockImportStore = {
      importGoogleEvents: vi.fn().mockResolvedValue({ createdCount: 1, skippedCount: 0 }),
    };

    const service = new IntegrationsService(
      repo,
      googleAdapter,
      undefined,
      undefined,
      timeBlockStore
    );
    const syncResult = await service.syncGoogleCalendar('user-1', { importAsTimeBlocks: true });
    expect(syncResult.syncedCount).toBe(1);
    expect(syncResult.importedTimeBlocks).toBe(1);
    expect(timeBlockStore.importGoogleEvents).toHaveBeenCalledOnce();

    const gmailMessages = await service.listGmailMessages('user-1', { q: 'Sprint' });
    expect(gmailMessages).toHaveLength(1);
    expect(gmailMessages[0]?.subject).toBe('Sprint Update');
  });

  it('lists GitHub repos and creates issues using decrypted user credentials', async () => {
    const encrypted = encryptIntegrationCredentials({ accessToken: 'ghp_user_tok' });
    const repo = {
      findByUserIdAndProvider: vi
        .fn()
        .mockResolvedValue(makeAccount({ provider: 'GITHUB', encryptedCredentials: encrypted })),
      updateAccount: vi.fn().mockResolvedValue(makeAccount({ provider: 'GITHUB' })),
    } as unknown as IntegrationsRepository;

    const githubAdapter: GithubAdapter = {
      isConfigured: vi.fn().mockReturnValue(true),
      listRepositories: vi.fn().mockResolvedValue([
        {
          id: 1,
          fullName: 'user/v3',
          description: 'V3 assistant',
          private: true,
          defaultBranch: 'main',
          openIssuesCount: 2,
          htmlUrl: 'https://github.com/user/v3',
          updatedAt: null,
        },
      ]),
      listIssues: vi.fn().mockResolvedValue([]),
      listPullRequests: vi.fn().mockResolvedValue([]),
      createIssue: vi.fn().mockResolvedValue({
        id: 101,
        number: 12,
        title: 'Add MCP monitoring',
        state: 'open',
        isPullRequest: false,
        author: 'user',
        htmlUrl: 'https://github.com/user/v3/issues/12',
        body: 'Track MCP calls',
        createdAt: '2026-11-12T10:00:00Z',
        updatedAt: '2026-11-12T10:00:00Z',
      }),
      createIssueComment: vi.fn(),
    };

    const service = new IntegrationsService(repo, undefined, githubAdapter);
    const repos = await service.listGithubRepositories('user-1');
    expect(repos[0]?.fullName).toBe('user/v3');
    expect(githubAdapter.listRepositories).toHaveBeenCalledWith('ghp_user_tok', { limit: 20 });

    const issue = await service.createGithubIssue('user-1', {
      owner: 'user',
      repo: 'v3',
      title: 'Add MCP monitoring',
      body: 'Track MCP calls',
    });
    expect(issue.number).toBe(12);
  });

  it('requires authentication on /api/v1/integrations endpoints', async () => {
    const listRes = await request(app).get('/api/v1/integrations');
    expect(listRes.status).toBe(401);

    const mcpRes = await request(app).get('/api/v1/integrations/mcp/tools');
    expect(mcpRes.status).toBe(401);
  });
});
