import { z } from 'zod';
import { ToolRiskLevel } from '../../permissions/risk-policy';
import { AgentRole } from '../runtime/state';

export type ToolPermissionPolicy = 'AUTO_EXECUTE' | 'REQUIRE_APPROVAL';

export interface ToolExecutionContext {
  userId: string;
  executionId: string;
  agentRole: AgentRole;
  idempotencyKey?: string;
}

export interface V3ToolContract<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  name: string;
  domain: string;
  description: string;
  riskLevel: ToolRiskLevel;
  idempotent: boolean;
  inputSchema: TInput;
  outputSchema: TOutput;
  toolSchema?: z.ZodType;
  execute: (ctx: ToolExecutionContext, input: z.infer<TInput>) => Promise<z.infer<TOutput>>;
}

export interface PendingToolApprovalRequest {
  toolCallId?: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  agentRole: AgentRole;
  idempotencyKey?: string;
  expiresAt?: Date;
}

export interface ApprovalDecisionPayload {
  approvalId: string;
  toolName: string;
  decision: 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED' | 'EXPIRED';
  result?: unknown;
  reason?: string;
}

export interface ExecutionStepTrace {
  stepNumber: number;
  finishReason: string;
  text: string;
  toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    input: unknown;
  }>;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    output: unknown;
  }>;
}
