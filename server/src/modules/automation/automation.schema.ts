import { z } from 'zod';

export const aiProviderSchema = z.enum(['google']);
export const aiExecutionStatusSchema = z.enum([
  'RUNNING',
  'AWAITING_APPROVAL',
  'COMPLETED',
  'FAILED',
  'REJECTED',
]);
export const aiApprovalStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'FAILED',
  'EXPIRED',
]);

export const runAssistantSchema = z.object({
  prompt: z.string().trim().min(1, 'Prompt is required').max(10000),
  sessionId: z.string().trim().min(1).max(100).default('default'),
  threadId: z.string().trim().min(1).max(150).optional(),
  tokenBudget: z.number().int().min(1000).max(200000).optional(),
  provider: aiProviderSchema.optional(),
  modelId: z.string().trim().min(1).max(100).optional(),
  maxSteps: z.number().int().min(1).max(8).default(5),
  allowAutoApproveWrites: z.boolean().default(false),
});

export const executionsQuerySchema = z.object({
  status: aiExecutionStatusSchema.optional(),
  sessionId: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const approvalsQuerySchema = z.object({
  status: aiApprovalStatusSchema.optional(),
  executionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const approvalDecisionSchema = z
  .object({
    reason: z.string().trim().max(500).optional(),
  })
  .default({});

export const automationIdParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});
