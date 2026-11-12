import { z } from 'zod';
import { AppError } from '../../middleware/error.middleware';
import { executeGuardedTool } from '../../permissions/permission-guard';
import { ToolRiskLevel } from '../../permissions/risk-policy';
import { AgentRole } from '../runtime/state';
import { V3ToolContract } from '../tools/tool.types';
import { McpClient } from './mcp.client';
import { V3_BUILTIN_MCP_TOOLS } from './mcp.server';
import { McpServerConfig, McpToolDescriptor } from './mcp.types';

export const DEFAULT_MCP_SERVERS: McpServerConfig[] = [
  {
    name: 'v3-core',
    description: 'Built-in V3 workspace snapshot & task inspection MCP server',
    transport: 'local',
    defaultRiskLevel: 'READ',
    enabled: true,
  },
];

export class McpPermissionBridge {
  private readonly servers = new Map<string, McpServerConfig>();

  constructor(
    private readonly client: McpClient = new McpClient(),
    initialServers: McpServerConfig[] = DEFAULT_MCP_SERVERS
  ) {
    for (const server of initialServers) {
      this.servers.set(server.name, server);
    }
  }

  registerServer(config: McpServerConfig): void {
    this.servers.set(config.name, config);
  }

  listServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  getServer(serverName: string): McpServerConfig {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new AppError(404, `MCP server "${serverName}" not registered`, 'MCP_SERVER_NOT_FOUND');
    }
    return server;
  }

  async listAvailableTools(userId: string): Promise<McpToolDescriptor[]> {
    const tools: McpToolDescriptor[] = [];
    for (const server of this.servers.values()) {
      if (!server.enabled) continue;
      if (server.transport === 'local') {
        const listed = await this.client.listTools(server, { userId });
        tools.push(...listed);
      } else {
        tools.push(...(V3_BUILTIN_MCP_TOOLS.filter((t) => t.serverName === server.name) ?? []));
      }
    }
    return tools;
  }

  async invokeGuardedMcpTool(params: {
    serverName: string;
    toolName: string;
    arguments: Record<string, unknown>;
    userId: string;
    agentRole: AgentRole;
    executionId?: string;
    allowAutoApproveWrites?: boolean;
    bypassApprovalCheck?: boolean;
    permissionToolName?: string;
    riskLevelOverride?: ToolRiskLevel;
  }): Promise<unknown> {
    const server = this.getServer(params.serverName);
    const descriptor = V3_BUILTIN_MCP_TOOLS.find(
      (t) => t.serverName === params.serverName && t.name === params.toolName
    );
    const riskLevel: ToolRiskLevel =
      params.riskLevelOverride ?? descriptor?.riskLevel ?? server.defaultRiskLevel;

    const contract: V3ToolContract = {
      name: params.permissionToolName ?? params.toolName,
      domain: 'mcp',
      description: descriptor?.description ?? `MCP tool ${params.serverName}:${params.toolName}`,
      riskLevel,
      idempotent: riskLevel === 'READ',
      inputSchema: z.record(z.string(), z.unknown()),
      outputSchema: z.unknown(),
      execute: async (ctx, input) =>
        this.client.callTool(server, {
          toolName: params.toolName,
          arguments: input as Record<string, unknown>,
          userId: ctx.userId,
        }),
    };

    return executeGuardedTool(
      contract,
      params.arguments,
      {
        userId: params.userId,
        executionId: params.executionId ?? `mcp-${Date.now()}`,
        agentRole: params.agentRole,
      },
      {
        allowAutoApproveWrites: params.allowAutoApproveWrites,
        bypassApprovalCheck: params.bypassApprovalCheck,
      }
    );
  }
}

export const defaultMcpBridge = new McpPermissionBridge();
