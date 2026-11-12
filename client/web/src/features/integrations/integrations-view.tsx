'use client';

import { Blocks, Calendar, KeyRound, Mail, Play, ShieldCheck } from 'lucide-react';
import { FormEvent, useCallback, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { integrationsApi } from '@/lib/v3-api';
import { GmailMessageSummary, IntegrationProvider } from '@/types/api';

const providers: IntegrationProvider[] = [
  'GOOGLE',
  'GITHUB',
  'TELEGRAM',
  'DISCORD',
  'WHATSAPP',
  'BHASHINI',
];

export function IntegrationsView() {
  const [provider, setProvider] = useState<IntegrationProvider>('GOOGLE');
  const [tokenValue, setTokenValue] = useState('');
  const [secondaryValue, setSecondaryValue] = useState('');
  const [scopesText, setScopesText] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const [gmailMessages, setGmailMessages] = useState<GmailMessageSummary[] | null>(null);
  const [mcpOutput, setMcpOutput] = useState<string | null>(null);
  const [runningMcp, setRunningMcp] = useState(false);

  const fetchIntegrationsData = useCallback(async () => {
    const [accounts, mcpSnapshot] = await Promise.all([
      integrationsApi.list(),
      integrationsApi.listMcpTools(),
    ]);
    return { accounts, mcpSnapshot };
  }, []);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchIntegrationsData,
    'Failed to load encrypted integrations and MCP registry'
  );

  const accounts = data?.accounts ?? [];
  const mcpSnapshot = data?.mcpSnapshot ?? null;

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    if (!tokenValue.trim()) return;
    setNotice(null);

    const credentials: Record<string, unknown> =
      provider === 'TELEGRAM'
        ? {
            botToken: tokenValue.trim(),
            ...(secondaryValue.trim() ? { chatId: secondaryValue.trim() } : {}),
          }
        : provider === 'DISCORD'
          ? {
              botToken: tokenValue.trim(),
              ...(secondaryValue.trim() ? { channelId: secondaryValue.trim() } : {}),
            }
          : provider === 'WHATSAPP'
            ? {
                accessToken: tokenValue.trim(),
                ...(secondaryValue.trim() ? { phoneNumberId: secondaryValue.trim() } : {}),
              }
            : provider === 'BHASHINI'
              ? { apiKey: tokenValue.trim() }
              : {
                  accessToken: tokenValue.trim(),
                  ...(secondaryValue.trim() ? { refreshToken: secondaryValue.trim() } : {}),
                };

    try {
      await integrationsApi.connect({
        provider,
        credentials,
        scopes: scopesText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setTokenValue('');
      setSecondaryValue('');
      setScopesText('');
      setNotice(`Saved ${provider} credentials inside AES-256-GCM vault.`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : `Failed to connect ${provider}`);
    }
  };

  const handleDisconnect = async (targetProvider: IntegrationProvider) => {
    try {
      await integrationsApi.disconnect(targetProvider);
      setNotice(`Disconnected ${targetProvider}.`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to disconnect provider');
    }
  };

  const handleSyncCalendar = async () => {
    try {
      const res = await integrationsApi.syncGoogleCalendar();
      setNotice(
        `Google Calendar synced ${res.syncedCount} events: ${res.importedTimeBlocks} imported, ${res.skippedTimeBlocks} skipped.`
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Google Calendar sync failed');
    }
  };

  const handleLoadGmail = async () => {
    try {
      const msgs = await integrationsApi.listGmailMessages();
      setGmailMessages(msgs);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to read Gmail');
    }
  };

  const handleInvokeMcp = async (serverName: string, toolName: string) => {
    setRunningMcp(true);
    try {
      const result = await integrationsApi.invokeMcpTool({
        serverName,
        toolName,
        arguments: {},
      });
      setMcpOutput(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'MCP invocation failed');
    } finally {
      setRunningMcp(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
          Encrypted Vault, Google Workspace & MCP
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          AES-256-GCM external token vault, Google Calendar/Gmail sync, and permission-guarded MCP tools.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">Connect External Provider</h2>
          </div>
          <form onSubmit={handleConnect} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as IntegrationProvider)}
                className={inputClassName}
              >
                {providers.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={scopesText}
                onChange={(e) => setScopesText(e.target.value)}
                placeholder="Scopes (comma-separated)"
                className={inputClassName}
              />
            </div>
            <input
              type="password"
              required
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              placeholder="Access token / Bot token / API key"
              className={inputClassName}
            />
            <input
              type="text"
              value={secondaryValue}
              onChange={(e) => setSecondaryValue(e.target.value)}
              placeholder="Optional target (refreshToken / chatId / channelId / phoneNumberId)"
              className={inputClassName}
            />
            <Button type="submit">Encrypt & Save Connection</Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-orange-500" />
              <h2 className="text-base font-bold text-neutral-950">Connected Vault Accounts</h2>
            </div>
            <Badge tone="dark">Credentials Redacted</Badge>
          </div>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading connections...</p>
          ) : accounts.length === 0 ? (
            <EmptyState
              title="No external accounts connected"
              description="Connect Google, GitHub, Telegram, Discord, WhatsApp, or Bhashini."
            />
          ) : (
            <div className="space-y-2.5">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="text-sm font-bold text-neutral-950">{acc.provider}</p>
                    <p className="text-neutral-500">
                      Scopes: {acc.scopes.length > 0 ? acc.scopes.join(', ') : 'default'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={acc.status === 'ACTIVE' ? 'green' : 'orange'}>{acc.status}</Badge>
                    <Button
                      variant="danger"
                      onClick={() => handleDisconnect(acc.provider)}
                      className="px-2.5 py-1 text-xs"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              <h2 className="text-base font-bold text-neutral-950">Google Calendar & Gmail</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="dark" onClick={handleSyncCalendar}>
                Sync Calendar
              </Button>
              <Button variant="secondary" onClick={handleLoadGmail}>
                <Mail className="h-3.5 w-3.5" />
                Read Gmail
              </Button>
            </div>
          </div>

          {gmailMessages ? (
            <div className="space-y-2">
              {gmailMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs"
                >
                  <p className="font-semibold text-neutral-950">{msg.subject}</p>
                  <p className="text-neutral-500">{msg.from}</p>
                  <p className="mt-1 text-neutral-700">{msg.snippet}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              Connect a Google OAuth token to import calendar events into V3 time blocks or inspect Gmail messages.
            </p>
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Blocks className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">
              Model Context Protocol (MCP) Bridge
            </h2>
          </div>
          {mcpSnapshot ? (
            <div className="space-y-3">
              {mcpSnapshot.tools.map((tool) => (
                <div
                  key={tool.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-mono font-bold text-neutral-950">{tool.name}</p>
                    <p className="text-neutral-600">{tool.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="green">{tool.riskLevel}</Badge>
                    <Button
                      variant="secondary"
                      disabled={runningMcp}
                      onClick={() => handleInvokeMcp(tool.serverName, tool.name)}
                      className="px-2.5 py-1 text-xs"
                    >
                      <Play className="h-3 w-3" />
                      Run
                    </Button>
                  </div>
                </div>
              ))}
              {mcpOutput && (
                <pre className="v3-black-panel max-h-48 max-w-full overflow-auto rounded-xl p-3 font-mono text-xs text-orange-300">
                  {mcpOutput}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Loading MCP tools...</p>
          )}
        </Card>
      </div>
    </div>
  );
}
