import { z } from 'zod';

export type ToolPermissionPolicy = 'AUTO_EXECUTE' | 'REQUIRE_APPROVAL';

export interface V3ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  description: string;
  policy: ToolPermissionPolicy;
  inputSchema: TSchema;
  execute: (userId: string, args: z.infer<TSchema>) => Promise<unknown>;
}

export interface PendingToolApprovalRequest {
  toolName: string;
  toolArgs: Record<string, unknown>;
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
