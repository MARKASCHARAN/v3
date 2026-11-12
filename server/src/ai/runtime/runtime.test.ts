import { AIMessage, HumanMessage } from '@langchain/core/messages';
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

  it('executes multi-step tool workflow with MemorySaver checkpoints and token accumulation', async () => {
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
    });

    expect(output.interrupted).toBe(false);
    expect(output.text).toBe('Echoed: hello');
    expect(output.tokensUsed).toBe(145);
    expect(output.checkpointThreadId).toBe('thread-runtime-1');
    expect(output.steps).toHaveLength(2);
    expect(output.steps[0]?.toolCalls[0]?.toolName).toBe('echoTool');
    expect(output.steps[0]?.toolResults[0]?.output).toBe('pong:hello');

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

  it('halts cleanly on maxIterations limit via budget guard', async () => {
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

    expect(output.text).toContain('maximum reasoning iterations');
    expect(output.steps).toHaveLength(2);
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
