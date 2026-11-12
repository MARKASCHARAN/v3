import { randomUUID } from 'node:crypto';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseCheckpointSaver } from '@langchain/langgraph';
import { z } from 'zod';
import { getChatModelForTier } from '../providers/model-router';
import { RunnableChatModel } from '../runtime/graph-factory';
import { ContextLoaderFn } from '../runtime/orchestrator';
import { AgentRole } from '../runtime/state';
import { PendingToolApprovalRequest } from '../tools/tool.types';
import { withAiRetry } from '../workflows/retry.workflow';
import { SpecialistRole, getSpecialistAgent } from './specialist.registry';

const deepWorkstreamSchema = z.object({
  id: z.string().trim().min(1),
  role: z.enum([
    'GOAL_PLANNING',
    'TASK_PROJECT',
    'SCHEDULING',
    'RESEARCH',
    'MEMORY',
    'ACCOUNTABILITY',
    'DEVELOPER',
  ]),
  objective: z.string().trim().min(1).max(2000),
});

const deepDecompositionSchema = z.object({
  workstreams: z.array(deepWorkstreamSchema).min(1).max(4),
  coordinationNote: z.string().trim().min(1).max(1000),
});

export interface DeepHarnessPersistenceHooks {
  createSubagentExecution?: (data: {
    parentExecutionId: string;
    userId: string;
    sessionId: string;
    threadId: string;
    agentRole: AgentRole;
    prompt: string;
    tokenBudget: number;
  }) => Promise<{ id: string }>;
  completeSubagentExecution?: (
    executionId: string,
    data: {
      status: 'COMPLETED' | 'AWAITING_APPROVAL' | 'FAILED';
      responseText?: string;
      errorMessage?: string;
      tokensUsed?: number;
      stepsData?: unknown;
    }
  ) => Promise<void>;
}

export interface RunDeepHarnessParams {
  userId: string;
  parentExecutionId: string;
  parentThreadId: string;
  sessionId: string;
  objective: string;
  allowAutoApproveWrites: boolean;
  onPendingApproval: (request: PendingToolApprovalRequest) => Promise<{ id: string }>;
  contextLoader?: ContextLoaderFn;
  checkpointer?: BaseCheckpointSaver;
  tokenBudget?: number;
  persistence?: DeepHarnessPersistenceHooks;
  decompositionOverride?: z.infer<typeof deepDecompositionSchema>;
  modelOverrideByRole?: Partial<Record<AgentRole, RunnableChatModel>>;
  synthesisOverride?: (input: {
    objective: string;
    results: Array<{ id: string; role: SpecialistRole; summary: string; interrupted: boolean }>;
  }) => Promise<{ summary: string; tokensUsed: number }>;
}

export interface DeepHarnessResult {
  status: 'COMPLETED' | 'APPROVAL_REQUIRED';
  coordinationNote: string;
  workstreamsExecuted: number;
  childExecutionIds: string[];
  pendingApprovalIds: string[];
  totalTokensUsed: number;
  summary: string;
}

export const runDeepProjectHarness = async (
  params: RunDeepHarnessParams
): Promise<DeepHarnessResult> => {
  const decomposition = params.decompositionOverride
    ? deepDecompositionSchema.parse(params.decompositionOverride)
    : await (async () => {
        const plannerModel = getChatModelForTier('PLANNING').model.withStructuredOutput(
          deepDecompositionSchema,
          { name: 'DeepWorkstreams' }
        );
        const { result } = await withAiRetry(() =>
          plannerModel.invoke([
            new SystemMessage(
              'Decompose a complex multi-step objective into 2 to 4 independent specialist workstreams covering research, planning, tasks, memory, scheduling, or developer analysis.'
            ),
            new HumanMessage(params.objective),
          ])
        );
        return deepDecompositionSchema.parse(result);
      })();

  const totalBudget = params.tokenBudget ?? 50000;
  const perWorkerBudget = Math.max(
    4000,
    Math.floor(totalBudget / decomposition.workstreams.length)
  );
  const pendingApprovalIds: string[] = [];
  const childExecutionIds: string[] = [];
  let workerTokens = 0;

  const outcomes = await Promise.all(
    decomposition.workstreams.map(async (stream, index) => {
      const specialist = getSpecialistAgent(stream.role);
      const subThreadId = `${params.parentThreadId}:deep:${stream.role.toLowerCase()}:${index + 1}:${randomUUID().slice(0, 8)}`;

      const childExecution = params.persistence?.createSubagentExecution
        ? await params.persistence.createSubagentExecution({
            parentExecutionId: params.parentExecutionId,
            userId: params.userId,
            sessionId: params.sessionId,
            threadId: subThreadId,
            agentRole: stream.role,
            prompt: stream.objective,
            tokenBudget: perWorkerBudget,
          })
        : { id: `${params.parentExecutionId}:deep:${index + 1}` };

      childExecutionIds.push(childExecution.id);

      try {
        const result = await specialist.run({
          userId: params.userId,
          executionId: childExecution.id,
          threadId: subThreadId,
          sessionId: params.sessionId,
          objective: stream.objective,
          allowAutoApproveWrites: params.allowAutoApproveWrites,
          onPendingApproval: params.onPendingApproval,
          contextLoader: params.contextLoader,
          checkpointer: params.checkpointer,
          tokenBudgetOverride: perWorkerBudget,
          modelOverride: params.modelOverrideByRole?.[stream.role],
        });

        workerTokens += result.tokensUsed;
        if (result.interrupted && result.pendingApprovalIds.length > 0) {
          pendingApprovalIds.push(...result.pendingApprovalIds);
        }

        if (params.persistence?.completeSubagentExecution) {
          await params.persistence.completeSubagentExecution(childExecution.id, {
            status: result.interrupted ? 'AWAITING_APPROVAL' : 'COMPLETED',
            responseText: result.text,
            tokensUsed: result.tokensUsed,
            stepsData: result.steps,
          });
        }

        return {
          id: stream.id,
          role: stream.role as SpecialistRole,
          summary: result.text,
          interrupted: result.interrupted,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Deep workstream execution failed';
        if (params.persistence?.completeSubagentExecution) {
          await params.persistence.completeSubagentExecution(childExecution.id, {
            status: 'FAILED',
            errorMessage: message,
          });
        }
        return {
          id: stream.id,
          role: stream.role as SpecialistRole,
          summary: `Workstream failed: ${message}`,
          interrupted: false,
        };
      }
    })
  );

  let synthTokens = 0;
  const synthesizedSummary = params.synthesisOverride
    ? await params
        .synthesisOverride({ objective: params.objective, results: outcomes })
        .then((res) => {
          synthTokens = res.tokensUsed;
          return res.summary;
        })
    : await (async () => {
        const model = getChatModelForTier('ORCHESTRATION').model;
        const { result: msg } = await withAiRetry(() =>
          model.invoke([
            new SystemMessage(
              'Synthesize these completed specialist workstream outputs into a unified, actionable final briefing.'
            ),
            new HumanMessage(
              `Objective: ${params.objective}\n\n${outcomes
                .map((o) => `[${o.role}] (${o.id}): ${o.summary}`)
                .join('\n\n')}`
            ),
          ])
        );
        synthTokens = msg.usage_metadata?.total_tokens ?? 0;
        return typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      })();

  return {
    status: pendingApprovalIds.length > 0 ? 'APPROVAL_REQUIRED' : 'COMPLETED',
    coordinationNote: decomposition.coordinationNote,
    workstreamsExecuted: outcomes.length,
    childExecutionIds,
    pendingApprovalIds,
    totalTokensUsed: workerTokens + synthTokens,
    summary: synthesizedSummary,
  };
};
