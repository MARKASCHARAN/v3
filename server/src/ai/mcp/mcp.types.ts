import { ToolRiskLevel } from '../../permissions/risk-policy';

export type McpTransportType = 'local' | 'http';

export interface McpServerConfig {
  name: string;
  description: string;
  transport: McpTransportType;
  endpointUrl?: string;
  defaultRiskLevel: ToolRiskLevel;
  enabled: boolean;
}

export interface McpToolDescriptor {
  serverName: string;
  name: string;
  description: string;
  riskLevel: ToolRiskLevel;
  inputSchema: Record<string, unknown>;
}

export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: 'initialize' | 'tools/list' | 'tools/call';
  params?: Record<string, unknown>;
}

export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}
