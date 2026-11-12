import { BaseMessage, SystemMessage, isAIMessage, isToolMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { BaseCheckpointSaver, END, START, StateGraph } from '@langchain/langgraph';
import { aiConfig } from '../../config/ai.config';
import { extractTextContent } from '../providers/model-router';
import { RetryOptions, withAiRetry } from '../workflows/retry.workflow';
import {
  GraphApprovalPolicy,
  RunnableChatModel,
  evaluateGraphToolPermission,
  runApprovalGateBatch,
  runStandardToolsBatch,
} from './graph-factory';
import { PlanStepItem, RetrievedContextSlice, V3AgentState, V3AgentStateAnnotation } from './state';

export type ContextLoaderFn = (input: {
  userId: string;
  sessionId: string;
  objective: string;
}) => Promise<RetrievedContextSlice>;

export interface MainOrchestratorConfig {
  model: RunnableChatModel;
  systemPrompt: string;
  tools: StructuredToolInterface[];
  checkpointer: BaseCheckpointSaver;
  retryOptions?: RetryOptions;
  approvalPolicy?: GraphApprovalPolicy;
  contextLoader?: ContextLoaderFn;
  maxConsecutiveErrors?: number;
  maxReplans?: number;
}

const buildStepPlanFromToolCalls = (
  existingSteps: PlanStepItem[],
  toolCalls: Array<{ id?: string; name: string }>,
  state: V3AgentState
): PlanStepItem[] => {
  const newSteps: PlanStepItem[] = toolCalls.map((call, idx) => ({
    id: call.id ?? `step-${state.iterationCount + 1}-${idx + 1}`,
    assignedAgent: state.activeAgent,
    description: `Execute ${call.name}`,
    status: 'IN_PROGRESS',
  }));
  return [...existingSteps, ...newSteps];
};

const updateStepsAfterObserve = (
  steps: PlanStepItem[],
  observations: string[],
  hadErrors: boolean
): PlanStepItem[] =>
  steps.map((step) => {
    if (step.status !== 'IN_PROGRESS') {
      return step;
    }
    return {
      ...step,
      status: hadErrors ? 'FAILED' : 'COMPLETED',
      resultSummary: observations[observations.length - 1] ?? step.resultSummary,
    };
  });

const computeToolSignatures = (
  toolCalls: Array<{ name: string; args?: Record<string, unknown> }>
): string[] => toolCalls.map((call) => `${call.name}:${JSON.stringify(call.args ?? {})}`).sort();

const signaturesMatch = (a: string[], b: string[]): boolean => {
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return a.every((value, idx) => value === b[idx]);
};

const findLatestTurnSignatures = (messages: BaseMessage[]): string[] => {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && isAIMessage(msg) && (msg.tool_calls?.length ?? 0) > 0) {
      return computeToolSignatures(msg.tool_calls ?? []);
    }
  }
  return [];
};

const buildFallbackSummaryText = (state: V3AgentState): string => {
  const observationsBlock =
    state.observations.length > 0
      ? `\n\nCompleted observations:\n- ${state.observations.slice(-5).join('\n- ')}`
      : '';

  if (state.stopReason === 'STUCK_LOOP') {
    return `Stopped execution after detecting a repeated tool-call loop that persisted past replanning.${observationsBlock}`;
  }

  if (state.stopReason === 'CIRCUIT_BREAKER') {
    return `Stopped execution after repeated consecutive tool errors to prevent an unstable loop.${observationsBlock}`;
  }

  if (state.stopReason === 'BUDGET_EXCEEDED') {
    return `Execution paused after reaching the token budget (${state.tokensUsed}/${state.tokenBudget}).${observationsBlock}`;
  }

  if (state.stopReason === 'MAX_ITERATIONS') {
    return `Execution stopped after reaching the maximum reasoning iterations (${state.iterationCount}/${state.maxIterations}).${observationsBlock}`;
  }

  if (state.observations.length > 0) {
    return `Completed requested tool workflow steps.${observationsBlock}`;
  }

  return 'Completed.';
};

const buildAdaptiveSystemMessage = (basePrompt: string, state: V3AgentState): SystemMessage => {
  const sections: string[] = [basePrompt];

  if (state.retrievedContext) {
    const metrics = Object.entries(state.retrievedContext.structuredMetrics);
    if (metrics.length > 0) {
      sections.push(`Runtime Metrics: ${metrics.map(([k, v]) => `${k}=${String(v)}`).join(', ')}.`);
    }
  }

  if (state.replanCount > 0) {
    sections.push(
      `Replan Directive (${state.replanCount}): Previous attempts repeated without progress. Choose a different tool, narrow parameters, delegate to another specialist, or synthesize what is currently known for the user.`
    );
  }

  if (state.consecutiveErrors > 0) {
    sections.push(
      `Notice: Previous step encountered ${state.consecutiveErrors} consecutive tool error(s). Adapt your approach or explain the issue clearly instead of retrying the exact failing call.`
    );
  }

  return new SystemMessage(sections.join('\n\n'));
};

export const createMainOrchestratorGraph = (config: MainOrchestratorConfig) => {
  const runnableModel =
    config.tools.length > 0 && config.model.bindTools
      ? config.model.bindTools(config.tools)
      : config.model;

  const toolByName = new Map<string, StructuredToolInterface>(
    config.tools.map((entry) => [entry.name, entry])
  );

  const maxConsecutiveErrors = config.maxConsecutiveErrors ?? aiConfig.defaultMaxConsecutiveErrors;
  const maxReplans = config.maxReplans ?? aiConfig.defaultMaxReplans;
  let totalRetryAttempts = 0;

  const receiveAndContextNode = async (state: V3AgentState) => {
    const retrievedContext =
      state.retrievedContext ??
      (config.contextLoader
        ? await config.contextLoader({
            userId: state.userId,
            sessionId: state.sessionId,
            objective: state.objective,
          })
        : null);

    return {
      retrievedContext,
      stopReason: null,
      error: null,
    };
  };

  const reasonNode = async (state: V3AgentState) => {
    const systemMessage = buildAdaptiveSystemMessage(config.systemPrompt, state);
    const promptMessages: BaseMessage[] = [systemMessage, ...state.messages];

    const { result: response, attempts } = await withAiRetry(
      () => runnableModel.invoke(promptMessages),
      config.retryOptions
    );
    totalRetryAttempts += attempts;

    const deltaTokens = response.usage_metadata?.total_tokens ?? 0;
    const textContent = extractTextContent(response.content);
    const toolCalls = response.tool_calls ?? [];
    const hasToolCalls = toolCalls.length > 0;
    const nextPlanSteps = hasToolCalls
      ? buildStepPlanFromToolCalls(state.planSteps, toolCalls, state)
      : state.planSteps;

    return {
      messages: [response],
      iterationCount: state.iterationCount + 1,
      tokensUsed: deltaTokens,
      planSteps: nextPlanSteps,
      finalResponse: hasToolCalls ? state.finalResponse : textContent,
    };
  };

  const executeToolsNode = async (state: V3AgentState) => {
    const batch = await runStandardToolsBatch(state, toolByName, config.approvalPolicy);
    return {
      messages: batch.toolMessages,
      observations: batch.observations,
    };
  };

  const approvalGateNode = async (state: V3AgentState) => {
    if (!config.approvalPolicy) {
      return {};
    }
    const batch = await runApprovalGateBatch(state, toolByName, config.approvalPolicy);
    return {
      messages: batch.toolMessages,
      observations: batch.observations,
      pendingApprovalIds: batch.pendingApprovalIds,
    };
  };

  const observeNode = async (state: V3AgentState) => {
    const latestTurnMessages: BaseMessage[] = [];
    for (let i = state.messages.length - 1; i >= 0; i--) {
      const msg = state.messages[i];
      if (!msg) {
        continue;
      }
      if (isAIMessage(msg)) {
        break;
      }
      if (isToolMessage(msg)) {
        latestTurnMessages.unshift(msg);
      }
    }

    let turnHadError = false;
    let turnHadSuccess = false;
    const latestObservations: string[] = [];

    for (const toolMsg of latestTurnMessages) {
      const raw = typeof toolMsg.content === 'string' ? toolMsg.content : '';
      let status: string;
      try {
        const parsed = JSON.parse(raw) as { status?: string };
        status = parsed.status ?? 'EXECUTED';
      } catch {
        status = raw.toLowerCase().includes('error') ? 'ERROR' : 'EXECUTED';
      }

      if (status === 'ERROR' || status === 'FAILED' || status === 'DENIED') {
        turnHadError = true;
      } else {
        turnHadSuccess = true;
      }
      latestObservations.push(`${toolMsg.name ?? 'tool'}:${status}`);
    }

    const nextConsecutiveErrors = turnHadError && !turnHadSuccess ? state.consecutiveErrors + 1 : 0;

    const currentSignatures = findLatestTurnSignatures(state.messages);
    const repeatedSameCalls = signaturesMatch(currentSignatures, state.lastToolSignatures);

    const updatedPlanSteps = updateStepsAfterObserve(
      state.planSteps,
      latestObservations,
      turnHadError && !turnHadSuccess
    );

    const stopReason =
      nextConsecutiveErrors >= maxConsecutiveErrors
        ? 'CIRCUIT_BREAKER'
        : repeatedSameCalls && state.replanCount >= maxReplans
          ? 'STUCK_LOOP'
          : state.tokensUsed >= state.tokenBudget
            ? 'BUDGET_EXCEEDED'
            : state.iterationCount >= state.maxIterations
              ? 'MAX_ITERATIONS'
              : repeatedSameCalls
                ? 'REPLAN_REQUIRED'
                : null;

    return {
      consecutiveErrors: nextConsecutiveErrors,
      lastToolSignatures: currentSignatures,
      planSteps: updatedPlanSteps,
      stopReason,
    };
  };

  const replanNode = async (state: V3AgentState) => {
    const nextReplanCount = state.replanCount + 1;
    return {
      replanCount: nextReplanCount,
      stopReason: null,
      observations: [
        `Replan #${nextReplanCount}: detected repeated tool call signatures; switching execution strategy.`,
      ],
    };
  };

  const evaluateNode = async (state: V3AgentState) => {
    const finalizedSteps = state.planSteps.map((step) =>
      step.status === 'IN_PROGRESS' ? { ...step, status: 'COMPLETED' as const } : step
    );

    return {
      planSteps: finalizedSteps,
      stopReason: state.stopReason ?? 'COMPLETED',
      finalResponse: state.finalResponse || buildFallbackSummaryText(state),
    };
  };

  const fallbackSummaryNode = async (state: V3AgentState) => {
    const stopReason =
      state.stopReason ??
      (state.tokensUsed >= state.tokenBudget
        ? 'BUDGET_EXCEEDED'
        : state.iterationCount >= state.maxIterations
          ? 'MAX_ITERATIONS'
          : 'CIRCUIT_BREAKER');

    const nextState: V3AgentState = { ...state, stopReason };
    const summaryText = buildFallbackSummaryText(nextState);

    return {
      stopReason,
      finalResponse: state.finalResponse ? `${state.finalResponse}\n\n${summaryText}` : summaryText,
    };
  };

  const routeAfterReason = (
    state: V3AgentState
  ): 'execute_tools' | 'approval_gate' | 'fallback_summary' | 'evaluate' => {
    const latestMessage = state.messages[state.messages.length - 1];
    const toolCalls =
      latestMessage && isAIMessage(latestMessage) ? (latestMessage.tool_calls ?? []) : [];

    if (toolCalls.length === 0) {
      return 'evaluate';
    }

    if (state.tokensUsed >= state.tokenBudget || state.iterationCount >= state.maxIterations) {
      return 'fallback_summary';
    }

    if (config.approvalPolicy) {
      const requiresApproval = toolCalls.some(
        (call) =>
          evaluateGraphToolPermission(config.approvalPolicy, call.name).decision ===
          'REQUIRE_APPROVAL'
      );
      if (requiresApproval) {
        return 'approval_gate';
      }
    }

    return 'execute_tools';
  };

  const routeAfterObserve = (state: V3AgentState): 'reason' | 'replan' | 'fallback_summary' => {
    if (
      state.stopReason === 'CIRCUIT_BREAKER' ||
      state.stopReason === 'STUCK_LOOP' ||
      state.stopReason === 'BUDGET_EXCEEDED' ||
      state.stopReason === 'MAX_ITERATIONS' ||
      state.consecutiveErrors >= maxConsecutiveErrors ||
      state.tokensUsed >= state.tokenBudget ||
      state.iterationCount >= state.maxIterations
    ) {
      return 'fallback_summary';
    }

    if (state.stopReason === 'REPLAN_REQUIRED') {
      return 'replan';
    }

    return 'reason';
  };

  const graph = new StateGraph(V3AgentStateAnnotation)
    .addNode('receive_and_context', receiveAndContextNode)
    .addNode('reason', reasonNode)
    .addNode('execute_tools', executeToolsNode)
    .addNode('approval_gate', approvalGateNode)
    .addNode('observe', observeNode)
    .addNode('replan', replanNode)
    .addNode('evaluate', evaluateNode)
    .addNode('fallback_summary', fallbackSummaryNode)
    .addEdge(START, 'receive_and_context')
    .addEdge('receive_and_context', 'reason')
    .addConditionalEdges('reason', routeAfterReason, [
      'execute_tools',
      'approval_gate',
      'fallback_summary',
      'evaluate',
    ])
    .addEdge('execute_tools', 'observe')
    .addEdge('approval_gate', 'observe')
    .addConditionalEdges('observe', routeAfterObserve, ['reason', 'replan', 'fallback_summary'])
    .addEdge('replan', 'reason')
    .addEdge('evaluate', END)
    .addEdge('fallback_summary', END)
    .compile({ checkpointer: config.checkpointer });

  return {
    graph,
    getRetryAttempts: () => Math.max(1, totalRetryAttempts),
  };
};
