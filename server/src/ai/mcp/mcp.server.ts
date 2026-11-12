import { prisma } from '../../database/prisma';
import { McpJsonRpcRequest, McpJsonRpcResponse, McpToolDescriptor } from './mcp.types';

export const V3_BUILTIN_MCP_TOOLS: McpToolDescriptor[] = [
  {
    serverName: 'v3-core',
    name: 'v3_get_workspace_snapshot',
    description: 'Return active goals count, open tasks count, and pending reminders count.',
    riskLevel: 'READ',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    serverName: 'v3-core',
    name: 'v3_list_upcoming_tasks',
    description: 'List up to 10 upcoming non-completed user tasks ordered by dueDate.',
    riskLevel: 'READ',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 25 },
      },
      additionalProperties: false,
    },
  },
];

export class V3McpServer {
  async handleRequest(
    request: McpJsonRpcRequest,
    context: { userId: string }
  ): Promise<McpJsonRpcResponse> {
    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'v3-builtin-mcp',
            version: '1.0.0',
          },
          capabilities: {
            tools: { listChanged: false },
          },
        },
      };
    }

    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: V3_BUILTIN_MCP_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      };
    }

    if (request.method === 'tools/call') {
      const params = request.params ?? {};
      const toolName = String(params.name ?? '');
      const args = (params.arguments ?? {}) as Record<string, unknown>;

      if (toolName === 'v3_get_workspace_snapshot') {
        const [activeGoalsCount, openTasksCount, pendingRemindersCount] = await Promise.all([
          prisma.goal.count({ where: { userId: context.userId, status: 'ACTIVE' } }),
          prisma.task.count({
            where: { userId: context.userId, status: { notIn: ['DONE', 'CANCELLED'] } },
          }),
          prisma.reminder.count({ where: { userId: context.userId, status: 'PENDING' } }),
        ]);

        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  activeGoalsCount,
                  openTasksCount,
                  pendingRemindersCount,
                }),
              },
            ],
            structuredContent: {
              activeGoalsCount,
              openTasksCount,
              pendingRemindersCount,
            },
          },
        };
      }

      if (toolName === 'v3_list_upcoming_tasks') {
        const rawLimit = typeof args.limit === 'number' ? args.limit : 10;
        const limit = Math.max(1, Math.min(25, Math.floor(rawLimit)));
        const tasks = await prisma.task.findMany({
          where: {
            userId: context.userId,
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
          select: {
            id: true,
            title: true,
            priority: true,
            status: true,
            dueDate: true,
          },
          orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
          take: limit,
        });

        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(tasks) }],
            structuredContent: { tasks },
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Unknown MCP tool: ${toolName}`,
        },
      };
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32601,
        message: `Unsupported MCP method: ${String(request.method)}`,
      },
    };
  }
}

