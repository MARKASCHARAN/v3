import { AIMessage, HumanMessage, isSystemMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { configureLangSmithRuntime } from '../../config/ai.config';
import { MODEL_BY_TIER, extractTextContent } from '../providers/model-router';
import { buildLangChainTools } from '../tools/registry';
import {
  resumeInterruptedToolWorkflow,
  runMultiStepToolWorkflow,
} from '../workflows/execution.workflow';
import { buildCheckpointConfig } from './checkpoints';
import { RunnableChatModel } from './graph-factory';

describe('LangGraph & LangChain Agent Runtime Foundation', () => {
  it('binds every registered V3 tool cleanly to ChatGoogleGenerativeAI', () => {
    const tools = buildLangChainTools({
      userId: 'user-1',
      allowAutoApproveWrites: false,
      onPendingApproval: async () => 'approval-1',
    });

    expect(tools.length).toBeGreaterThanOrEqual(13);

    const model = new ChatGoogleGenerativeAI({
      model: MODEL_BY_TIER.ORCHESTRATION,
      apiKey: 'test-dummy-key',
    });

    const bound = model.bindTools(tools);
    expect(bound).toBeDefined();
  });

  it('executes 8-step adaptive orchestrator with contextLoader, planSteps, MemorySaver checkpoints, and token tracking', async () => {
    const checkpointer = new MemorySaver();
    const invokeMock = vi
      .fn()
      .mockResolvedValueOnce(
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'tc-1', name: 'echoTool', args: { text: 'hello' } }],
          usage_metadata: { input_tokens: 40, output_tokens: 15, total_tokens: 55 },
        })
      )
      .mockResolvedValueOnce(
        new AIMessage({
          content: 'Echoed: hello',
          usage_metadata: { input_tokens: 70, output_tokens: 20, total_tokens: 90 },
        })
      );

    const mockModel: RunnableChatModel = {
      bindTools: () => ({ invoke: invokeMock }),
      invoke: invokeMock,
    };

    const echoTool = tool(async ({ text }) => `pong:${text}`, {
      name: 'echoTool',
      description: 'Echoes text back.',
      schema: z.object({ text: z.string() }),
    });

    const output = await runMultiStepToolWorkflow({
      model: mockModel,
      system: 'System context',
      messages: [new HumanMessage('Please echo hello')],
      tools: [echoTool],
      maxSteps: 5,
      threadId: 'thread-runtime-1',
      executionId: 'exec-runtime-1',
      userId: 'user-1',
      sessionId: 'default',
      objective: 'Please echo hello',
      checkpointer,
      contextLoader: async () => ({
        preferences: [{ key: 'focus', value: 'morning' }],
        facts: [],
        structuredMetrics: { overdueTasksCount: 3 },
      }),
    });

    expect(output.interrupted).toBe(false);
    expect(output.stopReason).toBe('COMPLETED');
    expect(output.text).toBe('Echoed: hello');
    expect(output.tokensUsed).toBe(145);
    expect(output.checkpointThreadId).toBe('thread-runtime-1');
    expect(output.planSteps).toHaveLength(1);
    expect(output.planSteps?.[0]?.status).toBe('COMPLETED');
    expect(output.steps).toHaveLength(2);
    expect(output.steps[0]?.toolCalls[0]?.toolName).toBe('echoTool');
    expect(output.steps[0]?.toolResults[0]?.output).toBe('pong:hello');

    const firstCallMessages = invokeMock.mock.calls[0]?.[0] ?? [];
    const systemMsg = firstCallMessages.find((msg: unknown) =>
      isSystemMessage(msg as HumanMessage)
    );
    expect(String(systemMsg?.content)).toContain('overdueTasksCount=3');

    const savedCheckpoint = await checkpointer.getTuple(buildCheckpointConfig('thread-runtime-1'));
    expect(savedCheckpoint).toBeDefined();
    expect(savedCheckpoint?.checkpoint.channel_values.tokensUsed).toBe(145);
  });

  it('pauses at approval_gate via LangGraph interrupt() and resumes via Command({ resume })', async () => {
    const checkpointer = new MemorySaver();
    const createPendingApproval = vi.fn().mockResolvedValue({ id: 'app-int-1' });
    const invokeMock = vi
      .fn()
      .mockResolvedValueOnce(
        new AIMessage({
          content: '',
          tool_calls: [
            {
              id: 'tc-create-task',
              name: 'createTask',
              args: { title: 'Write M2.2 tests', priority: 'HIGH' },
            },
          ],
          usage_metadata: { input_tokens: 50, output_tokens: 20, total_tokens: 70 },
        })
      )
      .mockResolvedValueOnce(
        new AIMessage({
          content: 'Created high-priority task "Write M2.2 tests".',
          usage_metadata: { input_tokens: 90, output_tokens: 25, total_tokens: 115 },
        })
      );

    const mockModel: RunnableChatModel = {
      bindTools: () => ({ invoke: invokeMock }),
      invoke: invokeMock,
    };

    const tools = buildLangChainTools({
      userId: 'user-1',
      executionId: 'exec-int-1',
      agentRole: 'MAIN_ORCHESTRATOR',
      allowAutoApproveWrites: false,
      onPendingApproval: async () => 'unused',
    });

    const approvalPolicy = {
      agentRole: 'MAIN_ORCHESTRATOR' as const,
      userId: 'user-1',
      executionId: 'exec-int-1',
      allowAutoApproveWrites: false,
      createPendingApproval,
    };

    const paused = await runMultiStepToolWorkflow({
      model: mockModel,
      system: 'System context',
      messages: [new HumanMessage('Create a high priority task to write M2.2 tests')],
      tools,
      maxSteps: 5,
      threadId: 'thread-int-1',
      executionId: 'exec-int-1',
      userId: 'user-1',
      sessionId: 'default',
      objective: 'Create task',
      checkpointer,
      approvalPolicy,
    });

    expect(paused.interrupted).toBe(true);
    expect(paused.pendingApprovalIds).toEqual(['app-int-1']);
    expect(createPendingApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'createTask',
        riskLevel: 'INTERNAL_WRITE',
        idempotencyKey: 'exec-int-1:tc-create-task',
      })
    );

    const resumed = await resumeInterruptedToolWorkflow({
      model: mockModel,
      system: 'System context',
      tools,
      threadId: 'thread-int-1',
      checkpointer,
      approvalPolicy,
      decisions: {
        'app-int-1': {
          approvalId: 'app-int-1',
          toolName: 'createTask',
          decision: 'EXECUTED',
          result: { id: 'task-created-1', title: 'Write M2.2 tests' },
        },
      },
    });

    expect(resumed.interrupted).toBe(false);
    expect(resumed.text).toBe('Created high-priority task "Write M2.2 tests".');
    expect(resumed.tokensUsed).toBe(185);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('halts cleanly on maxIterations limit via fallback_summary', async () => {
    const checkpointer = new MemorySaver();
    const loopingModel: RunnableChatModel = {
      bindTools: () => ({
        invoke: vi.fn().mockImplementation(
          async () =>
            new AIMessage({
              content: '',
              tool_calls: [{ id: `tc-${Math.random()}`, name: 'noopTool', args: {} }],
              usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
            })
        ),
      }),
      invoke: vi.fn(),
    };

    const noopTool = tool(async () => 'ok', {
      name: 'noopTool',
      description: 'Does nothing.',
      schema: z.object({}),
    });

    const output = await runMultiStepToolWorkflow({
      model: loopingModel,
      system: 'System context',
      messages: [new HumanMessage('Loop forever')],
      tools: [noopTool],
      maxSteps: 2,
      threadId: 'thread-loop-1',
      executionId: 'exec-loop-1',
      userId: 'user-1',
      sessionId: 'default',
      objective: 'Loop forever',
      checkpointer,
    });

    expect(output.stopReason).toBe('MAX_ITERATIONS');
    expect(output.text).toContain('maximum reasoning iterations');
    expect(output.steps).toHaveLength(2);
  });

  it('triggers token budget guard and fallback summary before extra iterations', async () => {
    const checkpointer = new MemorySaver();
    const invokeMock = vi.fn().mockResolvedValueOnce(
      new AIMessage({
        content: '',
        tool_calls: [{ id: 'tc-budget-1', name: 'noopTool', args: {} }],
        usage_metadata: { input_tokens: 90, output_tokens: 20, total_tokens: 110 },
      })
    );

    const budgetModel: RunnableChatModel = {
      bindTools: () => ({ invoke: invokeMock }),
      invoke: invokeMock,
    };

    const noopTool = tool(async () => 'ok', {
      name: 'noopTool',
      description: 'Does nothing.',
      schema: z.object({}),
    });

    const output = await runMultiStepToolWorkflow({
      model: budgetModel,
      system: 'System context',
      messages: [new HumanMessage('Check budget guard')],
      tools: [noopTool],
      maxSteps: 5,
      tokenBudget: 100,
      threadId: 'thread-budget-1',
      executionId: 'exec-budget-1',
      userId: 'user-1',
      sessionId: 'default',
      objective: 'Check budget guard',
      checkpointer,
    });

    expect(output.stopReason).toBe('BUDGET_EXCEEDED');
    expect(output.text).toContain('token budget');
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it('trips consecutive error circuit breaker and generates fallback summary', async () => {
    const checkpointer = new MemorySaver();
    const invokeMock = vi.fn().mockImplementation(
      async () =>
        new AIMessage({
          content: '',
          tool_calls: [{ id: `tc-err-${Math.random()}`, name: 'failingTool', args: {} }],
          usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        })
    );

    const failingModel: RunnableChatModel = {
      bindTools: () => ({ invoke: invokeMock }),
      invoke: invokeMock,
    };

    const failingTool = tool(
      async () => {
        throw new Error('Upstream dependency failed');
      },
      {
        name: 'failingTool',
        description: 'Always throws an error.',
        schema: z.object({}),
      }
    );

    const output = await runMultiStepToolWorkflow({
      model: failingModel,
      system: 'System context',
      messages: [new HumanMessage('Keep trying failing tool')],
      tools: [failingTool],
      maxSteps: 6,
      maxConsecutiveErrors: 2,
      threadId: 'thread-cb-1',
      executionId: 'exec-cb-1',
      userId: 'user-1',
      sessionId: 'default',
      objective: 'Test circuit breaker',
      checkpointer,
    });

    expect(output.stopReason).toBe('CIRCUIT_BREAKER');
    expect(output.text).toContain('consecutive tool errors');
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('detects repeated tool calls, transitions through replan node, and recovers', async () => {
    const checkpointer = new MemorySaver();
    const invokeMock = vi
      .fn()
      .mockResolvedValueOnce(
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'tc-r1', name: 'echoTool', args: { text: 'stale' } }],
          usage_metadata: { input_tokens: 15, output_tokens: 5, total_tokens: 20 },
        })
      )
      .mockResolvedValueOnce(
        new AIMessage({
          content: '',
          tool_calls: [{ id: 'tc-r2', name: 'echoTool', args: { text: 'stale' } }],
          usage_metadata: { input_tokens: 20, output_tokens: 5, total_tokens: 25 },
        })
      )
      .mockResolvedValueOnce(
        new AIMessage({
          content: 'Recovered after replanning strategy.',
          usage_metadata: { input_tokens: 30, output_tokens: 10, total_tokens: 40 },
        })
      );

    const replanModel: RunnableChatModel = {
      bindTools: () => ({ invoke: invokeMock }),
      invoke: invokeMock,
    };

    const echoTool = tool(async ({ text }) => `echo:${text}`, {
      name: 'echoTool',
      description: 'Echoes text.',
      schema: z.object({ text: z.string() }),
    });

    const output = await runMultiStepToolWorkflow({
      model: replanModel,
      system: 'System context',
      messages: [new HumanMessage('Try completing with adaptation')],
      tools: [echoTool],
      maxSteps: 6,
      maxReplans: 1,
      threadId: 'thread-replan-1',
      executionId: 'exec-replan-1',
      userId: 'user-1',
      sessionId: 'default',
      objective: 'Test replanning',
      checkpointer,
    });

    expect(output.stopReason).toBe('COMPLETED');
    expect(output.replanCount).toBe(1);
    expect(output.text).toBe('Recovered after replanning strategy.');

    const thirdCallMessages = invokeMock.mock.calls[2]?.[0] ?? [];
    const replanSystemMsg = thirdCallMessages.find((msg: unknown) =>
      isSystemMessage(msg as HumanMessage)
    );
    expect(String(replanSystemMsg?.content)).toContain('Replan Directive (1)');
  });

  it('halts with STUCK_LOOP when repeated calls persist after replanning', async () => {
    const checkpointer = new MemorySaver();
    const invokeMock = vi.fn().mockImplementation(
      async () =>
        new AIMessage({
          content: '',
          tool_calls: [
            { id: `tc-stuck-${Math.random()}`, name: 'echoTool', args: { text: 'same' } },
          ],
          usage_metadata: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
        })
    );

    const stuckModel: RunnableChatModel = {
      bindTools: () => ({ invoke: invokeMock }),
      invoke: invokeMock,
    };

    const echoTool = tool(async ({ text }) => `echo:${text}`, {
      name: 'echoTool',
      description: 'Echoes text.',
      schema: z.object({ text: z.string() }),
    });

    const output = await runMultiStepToolWorkflow({
      model: stuckModel,
      system: 'System context',
      messages: [new HumanMessage('Loop on identical signature')],
      tools: [echoTool],
      maxSteps: 6,
      maxReplans: 1,
      threadId: 'thread-stuck-1',
      executionId: 'exec-stuck-1',
      userId: 'user-1',
      sessionId: 'default',
      objective: 'Test stuck loop',
      checkpointer,
    });

    expect(output.stopReason).toBe('STUCK_LOOP');
    expect(output.replanCount).toBe(1);
    expect(output.text).toContain('repeated tool-call loop');
    expect(invokeMock).toHaveBeenCalledTimes(3);
  });

  it('extracts text blocks while ignoring thinking blocks and configures LangSmith safely', () => {
    const extracted = extractTextContent([
      { type: 'thinking', thinking: 'internal chain' },
      { type: 'text', text: 'Final answer' },
    ]);
    expect(extracted).toBe('Final answer');

    const tracingActive = configureLangSmithRuntime();
    expect(typeof tracingActive).toBe('boolean');
  });
});
