import { ToolExecutionContext, V3ToolContract } from '../ai/tools/tool.types';
import { prisma } from '../database/prisma';
import { AppError } from '../middleware/error.middleware';
import { evaluateToolPermission } from './risk-policy';

export interface IdempotencyRecordStore {
  findCompletedResult(
    idempotencyKey: string,
    userId: string
  ): Promise<{ found: boolean; data?: unknown }>;
}

const prismaIdempotencyStore: IdempotencyRecordStore = {
  async findCompletedResult(idempotencyKey, userId) {
    const existing = await prisma.aiToolApproval.findUnique({
      where: { idempotencyKey },
      select: {
        userId: true,
        status: true,
        resultData: true,
      },
    });

    if (!existing) {
      return { found: false };
    }

    if (existing.userId !== userId) {
      throw new AppError(403, 'Cross-user idempotency key collision', 'CROSS_USER_FORBIDDEN');
    }

    if (existing.status === 'EXECUTED') {
      return { found: true, data: existing.resultData };
    }

    return { found: false };
  },
};

export const assertValidToolUserContext = (userId: string): void => {
  if (!userId || userId.trim().length === 0) {
    throw new AppError(
      401,
      'Authenticated user context is required for tool execution',
      'UNAUTHORIZED'
    );
  }
};

export const assertNoCrossUserPayload = (rawArgs: unknown, authenticatedUserId: string): void => {
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
    return;
  }

  const record = rawArgs as Record<string, unknown>;
  if ('userId' in record && record.userId !== undefined && record.userId !== authenticatedUserId) {
    throw new AppError(
      403,
      'Tool arguments cannot target a different user',
      'CROSS_USER_FORBIDDEN'
    );
  }
};

export interface ExecuteGuardedToolOptions {
  allowAutoApproveWrites?: boolean;
  bypassApprovalCheck?: boolean;
  idempotencyStore?: IdempotencyRecordStore;
}

export const executeGuardedTool = async (
  contract: V3ToolContract,
  rawArgs: unknown,
  ctx: ToolExecutionContext,
  options: ExecuteGuardedToolOptions = {}
): Promise<unknown> => {
  assertValidToolUserContext(ctx.userId);
  assertNoCrossUserPayload(rawArgs, ctx.userId);

  const evaluation = evaluateToolPermission({
    role: ctx.agentRole,
    toolName: contract.name,
    riskLevel: contract.riskLevel,
    allowAutoApproveWrites: options.allowAutoApproveWrites,
  });

  if (evaluation.decision === 'DENY') {
    throw new AppError(403, evaluation.reason, 'TOOL_PERMISSION_DENIED');
  }

  if (evaluation.decision === 'REQUIRE_APPROVAL' && !options.bypassApprovalCheck) {
    throw new AppError(403, evaluation.reason, 'TOOL_APPROVAL_REQUIRED');
  }

  const parsedInput = contract.inputSchema.parse(rawArgs);

  if (ctx.idempotencyKey) {
    const store = options.idempotencyStore ?? prismaIdempotencyStore;
    const cached = await store.findCompletedResult(ctx.idempotencyKey, ctx.userId);
    if (cached.found) {
      return cached.data;
    }
  }

  const rawOutput = await contract.execute(ctx, parsedInput);
  return contract.outputSchema.parse(rawOutput);
};
