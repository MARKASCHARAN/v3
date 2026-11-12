import { BaseMessage, isHumanMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { BaseCheckpointSaver } from '@langchain/langgraph';
import { aiConfig } from '../../config/ai.config';
import { buildCheckpointConfig, ensurePostgresCheckpointer } from '../runtime/checkpoints';
import {
  RunnableChatModel,
  createFoundationAgentGraph,
  extractStepTracesFromMessages,
} from '../runtime/graph-factory';
import { AgentRole, ExecutionMode } from '../runtime/state';
import { ExecutionStepTrace } from '../tools/tool.types';
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
  checkpointNamespace?: string;
  runId?: string;
  checkpointer?: BaseCheckpointSaver;
  retryOptions?: RetryOptions;
}

export interface MultiStepWorkflowOutput {
  text: string;
  attempts: number;
  tokensUsed: number;
  checkpointThreadId: string;
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

export const runMultiStepToolWorkflow = async (
  input: MultiStepWorkflowInput
): Promise<MultiStepWorkflowOutput> => {
  const checkpointer = input.checkpointer ?? (await ensurePostgresCheckpointer());
  const { graph, getRetryAttempts } = createFoundationAgentGraph({
    model: input.model,
    systemPrompt: input.system,
    tools: input.tools,
    checkpointer,
    retryOptions: input.retryOptions,
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
      maxIterations: input.maxSteps,
      tokenBudget,
    },
    config
  );

  const turnStart = findTurnStartIndex(result.messages);
  const steps = extractStepTracesFromMessages(result.messages, turnStart);

  return {
    text: result.finalResponse,
    attempts: getRetryAttempts(),
    tokensUsed: result.tokensUsed,
    checkpointThreadId: input.threadId,
    steps,
  };
};
