import { task } from '@trigger.dev/sdk';
import { AssistantOrchestrator } from '../../ai/agents/assistant.agent';
import { AgentRole } from '../../ai/runtime/state';
import { aiConfig } from '../../config/ai.config';
import { prisma } from '../../database/prisma';

export interface AutonomousAgentJobPayload {
  userId: string;
  prompt: string;
  sessionId?: string;
  agentRole?: AgentRole;
  tokenBudget?: number;
  maxSteps?: number;
  triggerType?: 'EVENT' | 'SCHEDULED';
  idempotencyKey?: string;
  allowAutoApproveWrites?: boolean;
  timeoutMs?: number;
}

export interface AutonomousAgentJobDeps {
  findExistingByIdempotencyKey?: (idempotencyKey: string) => Promise<{
    id: string;
    status: string;
    threadId: string;
    responseText: string | null;
  } | null>;
  runOrchestrator?: (params: {
    userId: string;
    prompt: string;
    sessionId: string;
    agentRole: AgentRole;
    tokenBudget: number;
    maxSteps: number;
    allowAutoApproveWrites: boolean;
    triggerType: 'EVENT' | 'SCHEDULED';
    idempotencyKey?: string;
    timeoutAt?: Date;
  }) => Promise<{
    id: string;
    status: string;
    threadId?: string;
    responseText?: string | null;
    tokensUsed?: number;
  }>;
}

export interface AutonomousAgentJobResult {
  deduplicated: boolean;
  executionId: string;
  status: string;
  threadId?: string;
  responseText?: string | null;
  tokensUsed?: number;
}

export const runBackgroundAgentJob = async (
  payload: AutonomousAgentJobPayload,
  deps: AutonomousAgentJobDeps = {}
): Promise<AutonomousAgentJobResult> => {
  const findExisting =
    deps.findExistingByIdempotencyKey ??
    ((key: string) =>
      prisma.aiExecution.findUnique({
        where: { idempotencyKey: key },
        select: { id: true, status: true, threadId: true, responseText: true },
      }));

  if (payload.idempotencyKey) {
    const existing = await findExisting(payload.idempotencyKey);
    if (existing) {
      return {
        deduplicated: true,
        executionId: existing.id,
        status: existing.status,
        threadId: existing.threadId,
        responseText: existing.responseText,
      };
    }
  }

  const orchestrator = new AssistantOrchestrator();
  const runOrchestrator =
    deps.runOrchestrator ??
    (async (runParams) => {
      const exec = await orchestrator.run(runParams);
      return exec as {
        id: string;
        status: string;
        threadId?: string;
        responseText?: string | null;
        tokensUsed?: number;
      };
    });

  const timeoutMs = payload.timeoutMs ?? 5 * 60 * 1000;
  const execution = await runOrchestrator({
    userId: payload.userId,
    prompt: payload.prompt,
    sessionId: payload.sessionId ?? 'background',
    agentRole: payload.agentRole ?? 'MAIN_ORCHESTRATOR',
    tokenBudget: payload.tokenBudget ?? aiConfig.defaultTokenBudget,
    maxSteps: payload.maxSteps ?? aiConfig.defaultMaxIterations,
    allowAutoApproveWrites: payload.allowAutoApproveWrites ?? false,
    triggerType: payload.triggerType ?? 'EVENT',
    idempotencyKey: payload.idempotencyKey,
    timeoutAt: new Date(Date.now() + timeoutMs),
  });

  return {
    deduplicated: false,
    executionId: execution.id,
    status: execution.status,
    threadId: execution.threadId,
    responseText: execution.responseText,
    tokensUsed: execution.tokensUsed,
  };
};

export const autonomousAgentTask = task({
  id: 'autonomous-agent-run',
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 60000,
    factor: 2,
  },
  run: async (payload: AutonomousAgentJobPayload) => runBackgroundAgentJob(payload),
});
