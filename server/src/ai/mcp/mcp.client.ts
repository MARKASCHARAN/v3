import { AppError } from '../../middleware/error.middleware';
import { V3McpServer } from './mcp.server';
import {
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpServerConfig,
  McpToolDescriptor,
} from './mcp.types';

export class McpClient {
  private readonly localServer: V3McpServer;

  constructor(localServer?: V3McpServer) {
    this.localServer = localServer ?? new V3McpServer();
  }

  async sendRpc(
    server: McpServerConfig,
    request: McpJsonRpcRequest,
    context: { userId: string }
  ): Promise<McpJsonRpcResponse> {
    if (!server.enabled) {
      throw new AppError(403, `MCP server "${server.name}" is disabled`, 'MCP_SERVER_DISABLED');
    }

    if (server.transport === 'local') {
      return this.localServer.handleRequest(request, context);
    }

    if (!server.endpointUrl) {
      throw new AppError(
        400,
        `MCP HTTP server "${server.name}" is missing endpointUrl`,
        'MCP_ENDPOINT_MISSING'
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(server.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AppError(
          502,
          `MCP server "${server.name}" returned HTTP ${response.status}`,
          'MCP_TRANSPORT_ERROR'
        );
      }

      return (await response.json()) as McpJsonRpcResponse;
    } finally {
      clearTimeout(timer);
    }
  }

  async listTools(
    server: McpServerConfig,
    context: { userId: string }
  ): Promise<McpToolDescriptor[]> {
    const response = await this.sendRpc(
      server,
      {
        jsonrpc: '2.0',
        id: `list-${Date.now()}`,
        method: 'tools/list',
      },
      context
    );

    if (response.error) {
      throw new AppError(502, response.error.message, 'MCP_RPC_ERROR');
    }

    const result = response.result as {
      tools?: Array<{
        name: string;
        description?: string;
        inputSchema?: Record<string, unknown>;
      }>;
    };

    return (result.tools ?? []).map((tool) => ({
      serverName: server.name,
      name: tool.name,
      description: tool.description ?? '',
      riskLevel: server.defaultRiskLevel,
      inputSchema: tool.inputSchema ?? { type: 'object', properties: {} },
    }));
  }

  async callTool(
    server: McpServerConfig,
    params: { toolName: string; arguments: Record<string, unknown>; userId: string }
  ): Promise<unknown> {
    const response = await this.sendRpc(
      server,
      {
        jsonrpc: '2.0',
        id: `call-${Date.now()}`,
        method: 'tools/call',
        params: {
          name: params.toolName,
          arguments: params.arguments,
        },
      },
      { userId: params.userId }
    );

    if (response.error) {
      throw new AppError(502, response.error.message, 'MCP_RPC_ERROR');
    }

    return response.result;
  }
}
