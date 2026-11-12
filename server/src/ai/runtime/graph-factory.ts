import {
  AIMessage,
  BaseMessage,
  SystemMessage,
  ToolMessage,
  isAIMessage,
  isToolMessage,
} from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { BaseCheckpointSaver, END, START, StateGraph } from '@langchain/langgraph';
import { extractTextContent } from '../providers/model-router';
import { ExecutionStepTrace } from '../tools/tool.types';
import { RetryOptions, withAiRetry } from '../workflows/retry.workflow';
import { V3AgentState, V3AgentStateAnnotation } from './state';

export interface RunnableChatModel {
  bindTools?(tools: unknown[]): {
    invoke(messages: BaseMessage[]): Promise<AIMessage>;
  };
  invoke(messages: BaseMessage[]): Promise<AIMessage>;
}

export interface FoundationGraphConfig {
  model: RunnableChatModel;
  systemPrompt: string;
  tools: StructuredToolInterface[];
  checkpointer: BaseCheckpointSaver;
  retryOptions?: RetryOptions;
}

const parseToolOutputSafely = (rawContent: unknown): unknown => {
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
    const latestMessage = state.messages[state.messages.length - 1];
    if (!latestMessage || !isAIMessage(latestMessage) || !latestMessage.tool_calls?.length) {
      return {};
    }

    const toolMessages: ToolMessage[] = [];
    const observations: string[] = [];

    for (const toolCall of latestMessage.tool_calls) {
      const toolCallId = toolCall.id ?? `${toolCall.name}_${Date.now()}`;
      const targetTool = toolByName.get(toolCall.name);

      if (!targetTool) {
        const missingPayload = JSON.stringify({
          status: 'ERROR',
          toolName: toolCall.name,
          error: `Tool "${toolCall.name}" is not available`,
        });
        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolCall.name,
            content: missingPayload,
          })
        );
        observations.push(`Tool error: unknown tool ${toolCall.name}`);
        continue;
      }

      try {
        const rawOutput = await targetTool.invoke(toolCall.args);
        const content = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput);
        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolCall.name,
            content,
          })
        );
        observations.push(`Executed ${toolCall.name}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tool execution failed';
        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCallId,
            name: toolCall.name,
            content: JSON.stringify({
              status: 'ERROR',
              toolName: toolCall.name,
              error: message,
            }),
          })
        );
        observations.push(`Tool failed (${toolCall.name}): ${message}`);
      }
    }

    return {
      messages: toolMessages,
      observations,
    };
  };

  const budgetGuardNode = async (state: V3AgentState) => {
    const reason =
      state.tokensUsed >= state.tokenBudget
        ? 'Execution paused after reaching the configured token budget.'
        : 'Execution stopped after reaching the maximum reasoning iterations.';

    return {
      finalResponse: state.finalResponse || reason,
    };
  };

  const routeAfterReason = (state: V3AgentState): 'tools' | 'budget_guard' | typeof END => {
    const latestMessage = state.messages[state.messages.length - 1];
    const hasToolCalls = Boolean(
      latestMessage && isAIMessage(latestMessage) && (latestMessage.tool_calls?.length ?? 0) > 0
    );

    if (!hasToolCalls) {
      return END;
    }

    if (state.iterationCount >= state.maxIterations || state.tokensUsed >= state.tokenBudget) {
      return 'budget_guard';
    }

    return 'tools';
  };

  const graph = new StateGraph(V3AgentStateAnnotation)
    .addNode('reason', reasonNode)
    .addNode('tools', toolsNode)
    .addNode('budget_guard', budgetGuardNode)
    .addEdge(START, 'reason')
    .addConditionalEdges('reason', routeAfterReason, ['tools', 'budget_guard', END])
    .addEdge('tools', 'reason')
    .addEdge('budget_guard', END)
    .compile({ checkpointer: config.checkpointer });

  return {
    graph,
    getRetryAttempts: () => Math.max(1, totalRetryAttempts),
  };
};
