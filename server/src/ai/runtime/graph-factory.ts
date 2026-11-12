import {
  AIMessage,
  BaseMessage,
  SystemMessage,
  ToolMessage,
  isAIMessage,
  isToolMessage,
} from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { BaseCheckpointSaver, END, START, StateGraph, interrupt } from '@langchain/langgraph';
import { aiConfig } from '../../config/ai.config';
import { executeGuardedTool } from '../../permissions/permission-guard';
import { evaluateToolPermission } from '../../permissions/risk-policy';
import { extractTextContent } from '../providers/model-router';
import { tryGetRegisteredTool } from '../tools/registry';
import {
  ApprovalDecisionPayload,
  ExecutionStepTrace,
  PendingToolApprovalRequest,
} from '../tools/tool.types';
import { RetryOptions, withAiRetry } from '../workflows/retry.workflow';
import { AgentRole, V3AgentState, V3AgentStateAnnotation } from './state';

export interface RunnableChatModel {
  bindTools?(tools: unknown[]): {
    invoke(messages: BaseMessage[]): Promise<AIMessage>;
  };
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
}

export interface GraphApprovalPolicy {
  agentRole: AgentRole;
  userId: string;
  executionId: string;
  allowAutoApproveWrites: boolean;
  approvalTtlMs?: number;
  createPendingApproval: (request: PendingToolApprovalRequest) => Promise<{ id: string }>;
}

export interface FoundationGraphConfig {
  model: RunnableChatModel;
  systemPrompt: string;
  tools: StructuredToolInterface[];
  checkpointer: BaseCheckpointSaver;
  retryOptions?: RetryOptions;
  approvalPolicy?: GraphApprovalPolicy;
}

export interface ToolCallExecutionBatchResult {
  toolMessages: ToolMessage[];
  observations: string[];
  hadErrors: boolean;
  succeededCount: number;
  pendingApprovalIds: string[];
}

export const parseToolOutputSafely = (rawContent: unknown): unknown => {
  if (typeof rawContent !== 'string') {
    return rawContent;
  }
  try {
    return JSON.parse(rawContent);
  } catch {
    return rawContent;
  }
};

export const extractStepTracesFromMessages = (
  messages: BaseMessage[],
  startIndex: number = 0
): ExecutionStepTrace[] => {
  const slice = messages.slice(startIndex);
  const traces: ExecutionStepTrace[] = [];

  for (let i = 0; i < slice.length; i++) {
    const current = slice[i];
    if (!current || !isAIMessage(current)) {
      continue;
    }

    const toolCalls = (current.tool_calls ?? []).map((call) => ({
      toolCallId: call.id ?? call.name,
      toolName: call.name,
      input: call.args,
    }));

    const matchedIds = new Set(toolCalls.map((tc) => tc.toolCallId));
    const toolResults: ExecutionStepTrace['toolResults'] = [];

    for (let j = i + 1; j < slice.length; j++) {
      const candidate = slice[j];
      if (!candidate || isAIMessage(candidate)) {
        break;
      }
      if (isToolMessage(candidate) && matchedIds.has(candidate.tool_call_id)) {
        toolResults.push({
          toolCallId: candidate.tool_call_id,
          toolName: candidate.name ?? 'tool',
          output: parseToolOutputSafely(candidate.content),
        });
      }
    }

    const finishReason =
      typeof current.response_metadata?.finishReason === 'string'
        ? current.response_metadata.finishReason
        : toolCalls.length > 0
          ? 'tool_calls'
          : 'stop';

    traces.push({
      stepNumber: traces.length + 1,
      finishReason,
      text: extractTextContent(current.content),
      toolCalls,
      toolResults,
    });
  }

  return traces;
};

export const evaluateGraphToolPermission = (
  approvalPolicy: GraphApprovalPolicy | undefined,
  toolName: string
) => {
  if (!approvalPolicy) {
    return { decision: 'ALLOW' as const, reason: 'No approval policy configured.' };
  }
  const contract = tryGetRegisteredTool(toolName);
  const riskLevel =
    toolName === 'delegateToSpecialist' ? 'READ' : (contract?.riskLevel ?? 'INTERNAL_WRITE');
  return evaluateToolPermission({
    role: approvalPolicy.agentRole,
    toolName,
    riskLevel,
    allowAutoApproveWrites: approvalPolicy.allowAutoApproveWrites,
  });
};

export const executeSingleGraphToolCall = async (
  toolCall: { id?: string; name: string; args: Record<string, unknown> },
  toolByName: Map<string, StructuredToolInterface>,
  approvalPolicy: GraphApprovalPolicy | undefined,
  options: { bypassApprovalCheck?: boolean; idempotencyKey?: string } = {}
): Promise<{ message: ToolMessage; observation: string; isError: boolean }> => {
  const toolCallId = toolCall.id ?? `${toolCall.name}_${Date.now()}`;
  const targetTool = toolByName.get(toolCall.name);
  const contract = tryGetRegisteredTool(toolCall.name);

  if (!targetTool && !contract) {
    return {
      message: new ToolMessage({
        tool_call_id: toolCallId,
        name: toolCall.name,
        content: JSON.stringify({
          status: 'ERROR',
          toolName: toolCall.name,
          error: `Tool "${toolCall.name}" is not available`,
        }),
      }),
      observation: `Tool error: unknown tool ${toolCall.name}`,
      isError: true,
    };
  }

  try {
    let content: string;
    if (approvalPolicy && contract) {
      const result = await executeGuardedTool(
        contract,
        toolCall.args,
        {
          userId: approvalPolicy.userId,
          executionId: approvalPolicy.executionId,
          agentRole: approvalPolicy.agentRole,
          idempotencyKey: options.idempotencyKey,
        },
        {
          allowAutoApproveWrites: approvalPolicy.allowAutoApproveWrites,
          bypassApprovalCheck: options.bypassApprovalCheck,
        }
      );
      content = JSON.stringify({
        status: 'EXECUTED',
        toolName: toolCall.name,
        data: result,
      });
    } else if (targetTool) {
      const rawOutput = await targetTool.invoke(toolCall.args);
      content = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);
    } else {
      return {
        message: new ToolMessage({
          tool_call_id: toolCallId,
          name: toolCall.name,
          content: JSON.stringify({ status: 'ERROR', error: 'Tool unavailable' }),
        }),
        observation: `Tool unavailable: ${toolCall.name}`,
        isError: true,
      };
    }

    return {
      message: new ToolMessage({
        tool_call_id: toolCallId,
        name: toolCall.name,
        content,
      }),
      observation: `Executed ${toolCall.name}`,
      isError: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Tool execution failed';
    return {
      message: new ToolMessage({
        tool_call_id: toolCallId,
        name: toolCall.name,
        content: JSON.stringify({
          status: 'ERROR',
          toolName: toolCall.name,
          error: errorMessage,
        }),
      }),
      observation: `Tool failed (${toolCall.name}): ${errorMessage}`,
      isError: true,
    };
  }
};

export const runStandardToolsBatch = async (
  state: V3AgentState,
  toolByName: Map<string, StructuredToolInterface>,
  approvalPolicy: GraphApprovalPolicy | undefined
): Promise<ToolCallExecutionBatchResult> => {
  const latestMessage = state.messages[state.messages.length - 1];
  if (!latestMessage || !isAIMessage(latestMessage) || !latestMessage.tool_calls?.length) {
    return {
      toolMessages: [],
      observations: [],
      hadErrors: false,
      succeededCount: 0,
      pendingApprovalIds: [],
    };
  }

  const toolMessages: ToolMessage[] = [];
  const observations: string[] = [];
  let hadErrors = false;
  let succeededCount = 0;

  for (const toolCall of latestMessage.tool_calls) {
    const permission = evaluateGraphToolPermission(approvalPolicy, toolCall.name);
    if (permission.decision === 'DENY') {
      const toolCallId = toolCall.id ?? `${toolCall.name}_${Date.now()}`;
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: toolCall.name,
          content: JSON.stringify({
            status: 'DENIED',
            toolName: toolCall.name,
            error: permission.reason,
          }),
        })
      );
      observations.push(`Denied ${toolCall.name}: ${permission.reason}`);
      hadErrors = true;
      continue;
    }

    const executed = await executeSingleGraphToolCall(toolCall, toolByName, approvalPolicy);
    toolMessages.push(executed.message);
    observations.push(executed.observation);
    if (executed.isError) {
      hadErrors = true;
    } else {
      succeededCount += 1;
    }
  }

  return {
    toolMessages,
    observations,
    hadErrors,
    succeededCount,
    pendingApprovalIds: [],
  };
};

export const runApprovalGateBatch = async (
  state: V3AgentState,
  toolByName: Map<string, StructuredToolInterface>,
  approvalPolicy: GraphApprovalPolicy
): Promise<ToolCallExecutionBatchResult> => {
  const latestMessage = state.messages[state.messages.length - 1];
  if (!latestMessage || !isAIMessage(latestMessage) || !latestMessage.tool_calls?.length) {
    return {
      toolMessages: [],
      observations: [],
      hadErrors: false,
      succeededCount: 0,
      pendingApprovalIds: [],
    };
  }

  const ttlMs = approvalPolicy.approvalTtlMs ?? aiConfig.defaultApprovalTtlMs;
  const pendingEntries: Array<{
    approvalId: string;
    toolCallId: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    riskLevel: string;
    idempotencyKey: string;
  }> = [];
  const approvalByCallId = new Map<string, (typeof pendingEntries)[number]>();

  for (let index = 0; index < latestMessage.tool_calls.length; index++) {
    const call = latestMessage.tool_calls[index];
    if (!call) {
      continue;
    }
    const permission = evaluateGraphToolPermission(approvalPolicy, call.name);
    if (permission.decision !== 'REQUIRE_APPROVAL') {
      continue;
    }

    const toolCallId = call.id ?? `${call.name}_${index}`;
    const idempotencyKey = `${state.executionId}:${toolCallId}`;
    const contract = tryGetRegisteredTool(call.name);
    const riskLevel = contract?.riskLevel ?? 'INTERNAL_WRITE';

    const created = await approvalPolicy.createPendingApproval({
      toolCallId,
      toolName: call.name,
      toolArgs: call.args as Record<string, unknown>,
      riskLevel,
      agentRole: approvalPolicy.agentRole,
      idempotencyKey,
      expiresAt: new Date(Date.now() + ttlMs),
    });

    const entry = {
      approvalId: created.id,
      toolCallId,
      toolName: call.name,
      toolArgs: call.args as Record<string, unknown>,
      riskLevel,
      idempotencyKey,
    };
    pendingEntries.push(entry);
    approvalByCallId.set(toolCallId, entry);
  }

  const resumeDecisions = interrupt({
    type: 'TOOL_APPROVAL_REQUIRED',
    executionId: state.executionId,
    threadId: state.threadId,
    approvals: pendingEntries,
  }) as Record<string, ApprovalDecisionPayload> | undefined;

  const toolMessages: ToolMessage[] = [];
  const observations: string[] = [];
  let hadErrors = false;
  let succeededCount = 0;

  for (let index = 0; index < latestMessage.tool_calls.length; index++) {
    const call = latestMessage.tool_calls[index];
    if (!call) {
      continue;
    }

    const toolCallId = call.id ?? `${call.name}_${index}`;
    const permission = evaluateGraphToolPermission(approvalPolicy, call.name);

    if (permission.decision === 'DENY') {
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: call.name,
          content: JSON.stringify({
            status: 'DENIED',
            toolName: call.name,
            error: permission.reason,
          }),
        })
      );
      observations.push(`Denied ${call.name}`);
      hadErrors = true;
      continue;
    }

    if (permission.decision === 'ALLOW') {
      const executed = await executeSingleGraphToolCall(call, toolByName, approvalPolicy);
      toolMessages.push(executed.message);
      observations.push(executed.observation);
      if (executed.isError) {
        hadErrors = true;
      } else {
        succeededCount += 1;
      }
      continue;
    }

    const pending = approvalByCallId.get(toolCallId);
    const approvalId = pending?.approvalId ?? toolCallId;
    const decisionPayload = resumeDecisions?.[approvalId] ?? resumeDecisions?.[toolCallId];

    if (
      !decisionPayload ||
      decisionPayload.decision === 'REJECTED' ||
      decisionPayload.decision === 'EXPIRED'
    ) {
      const status = decisionPayload?.decision ?? 'REJECTED';
      const reason = decisionPayload?.reason ?? 'Human approval rejected.';
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: call.name,
          content: JSON.stringify({
            status,
            approvalId,
            toolName: call.name,
            reason,
          }),
        })
      );
      observations.push(`${call.name} ${status.toLowerCase()}: ${reason}`);
      continue;
    }

    if (decisionPayload.decision === 'FAILED') {
      const errorReason = decisionPayload.reason ?? 'Approved tool execution failed.';
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: call.name,
          content: JSON.stringify({
            status: 'FAILED',
            approvalId,
            toolName: call.name,
            error: errorReason,
          }),
        })
      );
      observations.push(`${call.name} failed: ${errorReason}`);
      hadErrors = true;
      continue;
    }

    if (decisionPayload.decision === 'EXECUTED') {
      toolMessages.push(
        new ToolMessage({
          tool_call_id: toolCallId,
          name: call.name,
          content: JSON.stringify({
            status: 'EXECUTED',
            approvalId,
            toolName: call.name,
            data: decisionPayload.result ?? null,
          }),
        })
      );
      observations.push(`Executed approved tool ${call.name}`);
      succeededCount += 1;
      continue;
    }

    const executed = await executeSingleGraphToolCall(call, toolByName, approvalPolicy, {
      bypassApprovalCheck: true,
      idempotencyKey: pending?.idempotencyKey,
    });
    toolMessages.push(executed.message);
    observations.push(executed.observation);
    if (executed.isError) {
      hadErrors = true;
    } else {
      succeededCount += 1;
    }
  }

  return {
    toolMessages,
    observations,
    hadErrors,
    succeededCount,
    pendingApprovalIds: pendingEntries.map((entry) => entry.approvalId),
  };
};

export const createFoundationAgentGraph = (config: FoundationGraphConfig) => {
  const runnableModel =
    config.tools.length > 0 && config.model.bindTools
      ? config.model.bindTools(config.tools)
      : config.model;

  const toolByName = new Map<string, StructuredToolInterface>(
    config.tools.map((entry) => [entry.name, entry])
  );

  let totalRetryAttempts = 0;

  const reasonNode = async (state: V3AgentState) => {
    const promptMessages: BaseMessage[] = [
      new SystemMessage(config.systemPrompt),
      ...state.messages,
    ];
    const { result: response, attempts } = await withAiRetry(
      () => runnableModel.invoke(promptMessages),
      config.retryOptions
    );
    totalRetryAttempts += attempts;

    const deltaTokens = response.usage_metadata?.total_tokens ?? 0;
    const textContent = extractTextContent(response.content);
    const hasToolCalls = (response.tool_calls?.length ?? 0) > 0;

    return {
      messages: [response],
      iterationCount: state.iterationCount + 1,
      tokensUsed: deltaTokens,
      finalResponse: hasToolCalls ? state.finalResponse : textContent,
    };
  };

  const toolsNode = async (state: V3AgentState) => {
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

  const budgetGuardNode = async (state: V3AgentState) => {
    const reason =
      state.tokensUsed >= state.tokenBudget
        ? 'Execution paused after reaching the configured token budget.'
        : 'Execution stopped after reaching the maximum reasoning iterations.';

    return {
      stopReason: state.tokensUsed >= state.tokenBudget ? 'BUDGET_EXCEEDED' : 'MAX_ITERATIONS',
      finalResponse: state.finalResponse || reason,
    };
  };

  const routeAfterReason = (
    state: V3AgentState
  ): 'tools' | 'approval_gate' | 'budget_guard' | typeof END => {
    const latestMessage = state.messages[state.messages.length - 1];
    const toolCalls =
      latestMessage && isAIMessage(latestMessage) ? (latestMessage.tool_calls ?? []) : [];

    if (toolCalls.length === 0) {
      return END;
    }

    if (state.iterationCount >= state.maxIterations || state.tokensUsed >= state.tokenBudget) {
      return 'budget_guard';
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

    return 'tools';
  };

  const graph = new StateGraph(V3AgentStateAnnotation)
    .addNode('reason', reasonNode)
    .addNode('tools', toolsNode)
    .addNode('approval_gate', approvalGateNode)
    .addNode('budget_guard', budgetGuardNode)
    .addEdge(START, 'reason')
    .addConditionalEdges('reason', routeAfterReason, [
      'tools',
      'approval_gate',
      'budget_guard',
      END,
    ])
    .addEdge('tools', 'reason')
    .addEdge('approval_gate', 'reason')
    .addEdge('budget_guard', END)
    .compile({ checkpointer: config.checkpointer });

  return {
    graph,
    getRetryAttempts: () => Math.max(1, totalRetryAttempts),
  };
};
