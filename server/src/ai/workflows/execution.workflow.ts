import { BaseMessage, isHumanMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { BaseCheckpointSaver, Command, INTERRUPT } from '@langchain/langgraph';
import { aiConfig } from '../../config/ai.config';
import { buildCheckpointConfig, ensurePostgresCheckpointer } from '../runtime/checkpoints';
import {
  GraphApprovalPolicy,
  RunnableChatModel,
  extractStepTracesFromMessages,
} from '../runtime/graph-factory';
import {
  ContextLoaderFn,
  MainOrchestratorConfig,
  createMainOrchestratorGraph,
} from '../runtime/orchestrator';
import { AgentRole, ExecutionMode, PlanStepItem } from '../runtime/state';
import { ApprovalDecisionPayload, ExecutionStepTrace } from '../tools/tool.types';
import { RetryOptions } from './retry.workflow';

export interface MultiStepWorkflowInput {
  model: RunnableChatModel;
  system: string;
  messages: BaseMessage[];
  tools: StructuredToolInterface[];
  maxSteps: number;
  threadId: string;
  executionId: string;
  userId: string;
  sessionId: string;
  objective: string;
  agentRole?: AgentRole;
  mode?: ExecutionMode;
  tokenBudget?: number;
  maxConsecutiveErrors?: number;
  maxReplans?: number;
  checkpointNamespace?: string;
  runId?: string;
  checkpointer?: BaseCheckpointSaver;
  retryOptions?: RetryOptions;
  approvalPolicy?: GraphApprovalPolicy;
  contextLoader?: ContextLoaderFn;
}

export interface ResumeWorkflowInput {
  model: RunnableChatModel;
  system: string;
  tools: StructuredToolInterface[];
  threadId: string;
  checkpointNamespace?: string;
  runId?: string;
  checkpointer?: BaseCheckpointSaver;
  retryOptions?: RetryOptions;
  approvalPolicy?: GraphApprovalPolicy;
  contextLoader?: ContextLoaderFn;
  decisions: Record<string, ApprovalDecisionPayload>;
}

export interface MultiStepWorkflowOutput {
  text: string;
  attempts: number;
  tokensUsed: number;
  checkpointThreadId: string;
  interrupted: boolean;
  pendingApprovalIds: string[];
  stopReason?: string | null;
  replanCount?: number;
  planSteps?: PlanStepItem[];
  steps: ExecutionStepTrace[];
}

const findTurnStartIndex = (messages: BaseMessage[]): number => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const entry = messages[i];
    if (entry && isHumanMessage(entry)) {
      return i + 1;
    }
  }
  return 0;
};

const extractInterruptMetadata = (
  rawResult: unknown
): {
  interrupted: boolean;
  approvalIds: string[];
} => {
  const resultRecord = rawResult as Record<symbol | string, unknown>;
  const interrupts = resultRecord[INTERRUPT] as
    Array<{ value?: { approvals?: Array<{ approvalId?: string }> } }> | undefined;

  if (!Array.isArray(interrupts) || interrupts.length === 0) {
    return { interrupted: false, approvalIds: [] };
  }

  const approvalIds: string[] = [];
  for (const item of interrupts) {
    const approvals = item.value?.approvals;
    if (Array.isArray(approvals)) {
      for (const entry of approvals) {
        if (typeof entry.approvalId === 'string') {
          approvalIds.push(entry.approvalId);
        }
      }
    }
  }

  return { interrupted: true, approvalIds };
};

const compileWorkflowGraph = async (
  config: Omit<MainOrchestratorConfig, 'checkpointer'> & { checkpointer?: BaseCheckpointSaver }
) => {
  const checkpointer = config.checkpointer ?? (await ensurePostgresCheckpointer());
  return createMainOrchestratorGraph({
    ...config,
    checkpointer,
  });
};

export const runMultiStepToolWorkflow = async (
  input: MultiStepWorkflowInput
): Promise<MultiStepWorkflowOutput> => {
  const { graph, getRetryAttempts } = await compileWorkflowGraph({
    model: input.model,
    systemPrompt: input.system,
    tools: input.tools,
    checkpointer: input.checkpointer,
    retryOptions: input.retryOptions,
    approvalPolicy: input.approvalPolicy,
    contextLoader: input.contextLoader,
    maxConsecutiveErrors: input.maxConsecutiveErrors,
    maxReplans: input.maxReplans,
  });

  const config = buildCheckpointConfig(input.threadId, input.checkpointNamespace, input.runId);
  const tokenBudget = input.tokenBudget ?? aiConfig.defaultTokenBudget;
  const activeAgent: AgentRole = input.agentRole ?? 'MAIN_ORCHESTRATOR';
  const mode: ExecutionMode = input.mode ?? 'REQUEST';

  const result = await graph.invoke(
    {
      userId: input.userId,
      executionId: input.executionId,
      threadId: input.threadId,
      sessionId: input.sessionId,
      mode,
      objective: input.objective,
      activeAgent,
      messages: input.messages,
      iterationCount: 0,
      maxIterations: input.maxSteps,
      tokenBudget,
      consecutiveErrors: 0,
      lastToolSignatures: [],
      replanCount: 0,
      stopReason: null,
      finalResponse: '',
      error: null,
    },
    config
  );

  const turnStart = findTurnStartIndex(result.messages);
  const steps = extractStepTracesFromMessages(result.messages, turnStart);
  const interruptState = extractInterruptMetadata(result);

  const text = interruptState.interrupted
    ? result.finalResponse ||
      `${interruptState.approvalIds.length || 1} action(s) queued for your approval.`
    : result.finalResponse;

  return {
    text,
    attempts: getRetryAttempts(),
    tokensUsed: result.tokensUsed,
    checkpointThreadId: input.threadId,
    interrupted: interruptState.interrupted,
    pendingApprovalIds: interruptState.approvalIds,
    stopReason: result.stopReason,
    replanCount: result.replanCount,
    planSteps: result.planSteps,
    steps,
  };
};

export const hasPendingInterruptForThread = async (input: {
  model: RunnableChatModel;
  system: string;
  tools: StructuredToolInterface[];
  threadId: string;
  checkpointNamespace?: string;
  checkpointer?: BaseCheckpointSaver;
  approvalPolicy?: GraphApprovalPolicy;
  contextLoader?: ContextLoaderFn;
}): Promise<boolean> => {
  const { graph } = await compileWorkflowGraph({
    model: input.model,
    systemPrompt: input.system,
    tools: input.tools,
    checkpointer: input.checkpointer,
    approvalPolicy: input.approvalPolicy,
    contextLoader: input.contextLoader,
  });

  const snapshot = await graph.getState(
    buildCheckpointConfig(input.threadId, input.checkpointNamespace)
  );
  return snapshot.tasks.some(
    (task) => Array.isArray(task.interrupts) && task.interrupts.length > 0
  );
};

export const resumeInterruptedToolWorkflow = async (
  input: ResumeWorkflowInput
): Promise<MultiStepWorkflowOutput> => {
  const { graph, getRetryAttempts } = await compileWorkflowGraph({
    model: input.model,
    systemPrompt: input.system,
    tools: input.tools,
    checkpointer: input.checkpointer,
    retryOptions: input.retryOptions,
    approvalPolicy: input.approvalPolicy,
    contextLoader: input.contextLoader,
  });

  const config = buildCheckpointConfig(input.threadId, input.checkpointNamespace, input.runId);
  const result = await graph.invoke(new Command({ resume: input.decisions }), config);

  const turnStart = findTurnStartIndex(result.messages);
  const steps = extractStepTracesFromMessages(result.messages, turnStart);
  const interruptState = extractInterruptMetadata(result);

  return {
    text: interruptState.interrupted
      ? result.finalResponse ||
        `${interruptState.approvalIds.length || 1} action(s) queued for your approval.`
      : result.finalResponse,
    attempts: getRetryAttempts(),
    tokensUsed: result.tokensUsed,
    checkpointThreadId: input.threadId,
    interrupted: interruptState.interrupted,
    pendingApprovalIds: interruptState.approvalIds,
    stopReason: result.stopReason,
    planSteps: result.planSteps,
    steps,
  };
};
