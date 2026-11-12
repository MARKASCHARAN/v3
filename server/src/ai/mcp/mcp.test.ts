import { describe, expect, it, vi } from 'vitest';
import { getSpecialistAgent } from '../agents/specialist.registry';
import { V3_TOOL_REGISTRY, getToolsForRole } from '../tools/registry';
import { McpPermissionBridge } from './mcp.bridge';
import { McpClient } from './mcp.client';
import { V3McpServer } from './mcp.server';

describe('MCP Bridge & External Tool Permissions (M2.8)', () => {
  it('exposes V3 built-in MCP server capabilities over JSON-RPC 2.0', async () => {
    const server = new V3McpServer();

    const init = await server.handleRequest(
      { jsonrpc: '2.0', id: 1, method: 'initialize' },
      { userId: 'user-1' }
    );
    expect((init.result as { serverInfo: { name: string } }).serverInfo.name).toBe(
      'v3-builtin-mcp'
    );

    const list = await server.handleRequest(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { userId: 'user-1' }
    );
    const tools = (list.result as { tools: Array<{ name: string }> }).tools;
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining(['v3_get_workspace_snapshot', 'v3_list_upcoming_tasks'])
    );
  });

  it('gates MCP invocations through permission-guard.ts against cross-user payloads and risk levels', async () => {
    const mockClient = {
      listTools: vi.fn().mockResolvedValue([
        {
          serverName: 'ext-write',
          name: 'ext_mutate',
          description: 'External mutation',
          riskLevel: 'EXTERNAL_CONSEQUENTIAL',
          inputSchema: {},
        },
      ]),
      callTool: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as McpClient;

    const bridge = new McpPermissionBridge(mockClient, [
      {
        name: 'ext-write',
        description: 'External server',
        transport: 'http',
        endpointUrl: 'https://mcp.example.com/rpc',
        defaultRiskLevel: 'EXTERNAL_CONSEQUENTIAL',
        enabled: true,
      },
    ]);

    await expect(
      bridge.invokeGuardedMcpTool({
        serverName: 'ext-write',
        toolName: 'ext_mutate',
        arguments: { userId: 'other-user' },
        userId: 'user-1',
        agentRole: 'MAIN_ORCHESTRATOR',
        bypassApprovalCheck: true,
      })
    ).rejects.toThrow('Tool arguments cannot target a different user');

    await expect(
      bridge.invokeGuardedMcpTool({
        serverName: 'ext-write',
        toolName: 'ext_mutate',
        arguments: { target: 'repo' },
        userId: 'user-1',
        agentRole: 'MAIN_ORCHESTRATOR',
        allowAutoApproveWrites: true,
        bypassApprovalCheck: false,
      })
    ).rejects.toThrow('requires human approval');

    await expect(
      bridge.invokeGuardedMcpTool({
        serverName: 'ext-write',
        toolName: 'ext_mutate',
        arguments: { target: 'repo' },
        userId: 'user-1',
        agentRole: 'MEMORY',
        bypassApprovalCheck: true,
      })
    ).rejects.toThrow('not permitted to invoke tool');

    const executed = await bridge.invokeGuardedMcpTool({
      serverName: 'ext-write',
      toolName: 'ext_mutate',
      arguments: { target: 'repo' },
      userId: 'user-1',
      agentRole: 'MAIN_ORCHESTRATOR',
      bypassApprovalCheck: true,
    });
    expect(executed).toEqual({ ok: true });
  });

  it('registers external Communication and Developer tools with proper risk levels and specialist scopes', () => {
    expect(V3_TOOL_REGISTRY.sendNotification?.riskLevel).toBe('EXTERNAL_CONSEQUENTIAL');
    expect(V3_TOOL_REGISTRY.syncGoogleCalendar?.riskLevel).toBe('EXTERNAL_REVERSIBLE');
    expect(V3_TOOL_REGISTRY.listGmailMessages?.riskLevel).toBe('READ');
    expect(V3_TOOL_REGISTRY.listGithubRepos?.riskLevel).toBe('READ');
    expect(V3_TOOL_REGISTRY.createGithubIssue?.riskLevel).toBe('EXTERNAL_CONSEQUENTIAL');
    expect(V3_TOOL_REGISTRY.listMcpTools?.riskLevel).toBe('READ');

    const commTools = getToolsForRole('COMMUNICATION').map((t) => t.name);
    expect(commTools).toEqual(
      expect.arrayContaining([
        'sendNotification',
        'listNotificationDeliveries',
        'syncGoogleCalendar',
        'listGmailMessages',
      ])
    );
    expect(commTools).not.toContain('createGithubIssue');

    const devTools = getToolsForRole('DEVELOPER').map((t) => t.name);
    expect(devTools).toEqual(
      expect.arrayContaining([
        'listGithubRepos',
        'listGithubIssues',
        'listGithubPullRequests',
        'createGithubIssue',
        'listMcpTools',
      ])
    );
    expect(devTools).not.toContain('sendNotification');

    expect(getSpecialistAgent('COMMUNICATION').systemPrompt).toContain('Telegram');
    expect(getSpecialistAgent('DEVELOPER').systemPrompt).toContain('GitHub');
  });
});
