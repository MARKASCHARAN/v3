import { z } from 'zod';
import { AgentRole } from '../../ai/runtime/state';
import {
  aiApprovalStatusSchema,
  aiExecutionStatusSchema,
  aiProviderSchema,
  approvalDecisionSchema,
  approvalsQuerySchema,
  executionsQuerySchema,
  runAssistantSchema,
} from './automation.schema';

export type AiProvider = z.infer<typeof aiProviderSchema>;
export type AiExecutionStatus = z.infer<typeof aiExecutionStatusSchema>;
export type AiApprovalStatus = z.infer<typeof aiApprovalStatusSchema>;
export type RunAssistantInput = z.infer<typeof runAssistantSchema>;
export type ExecutionsQueryInput = z.infer<typeof executionsQuerySchema>;
export type ApprovalsQueryInput = z.infer<typeof approvalsQuerySchema>;
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

export interface ToolExecutorContext {
  executionId?: string;
  agentRole?: AgentRole;
  idempotencyKey?: string;
  allowAutoApproveWrites?: boolean;
  bypassApprovalCheck?: boolean;
}

export type ToolExecutor = (
  toolName: string,
  rawArgs: unknown,
  userId: string,
  contextOverrides?: ToolExecutorContext
) => Promise<unknown>;
