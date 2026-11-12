import { AIMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../app';
import { evaluateToolPermission } from '../../permissions/risk-policy';
import { getPromptDefinition } from '../prompts/prompt.registry';
import { RunnableChatModel } from '../runtime/graph-factory';
import { AssistantOrchestrator, OrchestratorPersistence } from './assistant.agent';
import { runDeepProjectHarness } from './deep-harness';
import {
  SPECIALIST_AGENTS,
  buildParallelDelegationTool,
  buildSpecialistDelegationTool,
  getSpecialistAgent,
  listSpecialistAgentsMetadata,
} from './specialist.registry';

describe('Specialist Agents & Delegation (M2.4)', () => {
  it('registers all 6 Phase A core specialists and 2 Phase B specialists with scoped tools and prompts', () => {
    expect(SPECIALIST_AGENTS).toHaveLength(8);

    const metadata = listSpecialistAgentsMetadata();
    const roles = metadata.map((m) => m.role);
    expect(roles).toEqual(
      expect.arrayContaining([
        'GOAL_PLANNING',
        'TASK_PROJECT',
        'SCHEDULING',
        'RESEARCH',
        'MEMORY',
        'ACCOUNTABILITY',
        'COMMUNICATION',
        'DEVELOPER',
      ])
    );

    const scheduling = getSpecialistAgent('SCHEDULING');
    const schedulingToolNames = scheduling
      .getTools({
        userId: 'user-1',
        executionId: 'exec-1',
        allowAutoApproveWrites: false,
        onPendingApproval: async () => 'app-1',
      })
      .map((t) => t.name);

    expect(schedulingToolNames).toEqual(
      expect.arrayContaining(['getSchedule', 'createTimeBlock', 'listTasks', 'listGoals'])
    );
    expect(schedulingToolNames).not.toContain('webResearch');
    expect(schedulingToolNames).not.toContain('delegateToSpecialist');

    expect(
      evaluateToolPermission({
        role: 'MEMORY',
        toolName: 'createGoal',
        riskLevel: 'INTERNAL_WRITE',
      }).decision
    ).toBe('DENY');

    expect(getPromptDefinition('SCHEDULING_AGENT').systemPrompt).toContain('Scheduling Specialist');
    expect(getPromptDefinition('RESEARCH_AGENT').systemPrompt).toContain('Research Specialist');
  });

  it('delegates sub-objectives via delegateToSpecialist and queues approval with specialist agentRole', async () => {
    const checkpointer = new MemorySaver();
    const createPendingApproval = vi.fn().mockResolvedValue({ id: 'app-sched-1' });

    const schedulingModelMock: RunnableChatModel = {
      bindTools: () => ({
        invoke: vi.fn().mockResolvedValueOnce(
          new AIMessage({
            content: '',
            tool_calls: [
              {
                id: 'tc-sched-block',
                name: 'createTimeBlock',
                args: {
                  title: 'Deep Work Block',
                  startTime: '2026-11-13T09:00:00.000Z',
                  endTime: '2026-11-13T10:30:00.000Z',
                  category: 'DEEP_WORK',
                },
              },
            ],
            usage_metadata: { input_tokens: 40, output_tokens: 15, total_tokens: 55 },
          })
        ),
      }),
      invoke: vi.fn(),
    };

    const delegationTool = buildSpecialistDelegationTool({
      userId: 'user-1',
      executionId: 'exec-parent-1',
      parentThreadId: 'thread-parent-1',
      sessionId: 'default',
      allowAutoApproveWrites: false,
      onPendingApproval: createPendingApproval,
      checkpointer,
      modelOverrideByRole: {
        SCHEDULING: schedulingModelMock,
      },
    });

    const rawDelegationResult = await delegationTool.invoke({
      role: 'SCHEDULING',
      objective: 'Schedule 90 minutes of deep work tomorrow morning',
    });

    const parsed = JSON.parse(String(rawDelegationResult)) as {
      status: string;
      delegatedAgent: string;
      pendingApprovalIds: string[];
    };

    expect(parsed.status).toBe('APPROVAL_REQUIRED');
    expect(parsed.delegatedAgent).toBe('SCHEDULING');
    expect(parsed.pendingApprovalIds).toEqual(['app-sched-1']);
    expect(createPendingApproval).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'createTimeBlock',
        agentRole: 'SCHEDULING',
        riskLevel: 'INTERNAL_WRITE',
      })
    );
  });

  it('routes direct specialist execution through AssistantOrchestrator with scoped profile', async () => {
    const persistence: OrchestratorPersistence = {
      loadContext: vi.fn().mockResolvedValue({
        preferences: [],
        memories: [],
        recentMessages: [],
        overdueTasksCount: 1,
        pendingRemindersCount: 0,
      }),
      createExecution: vi.fn().mockResolvedValue({ id: 'exec-spec-1' }),
      saveConversationMessage: vi.fn().mockResolvedValue(undefined),
      createPendingApproval: vi.fn(),
      completeExecution: vi.fn().mockImplementation(async (_id, data) => ({
        id: 'exec-spec-1',
        ...data,
      })),
    };

    const executor = vi.fn().mockResolvedValue({
      provider: 'google',
      model: 'gemini-2.5-flash',
      text: 'Goal analysis done.',
      attempts: 1,
      tokensUsed: 65,
      checkpointThreadId: 'default:1',
      interrupted: false,
      pendingApprovalIds: [],
      steps: [],
    });

    const orchestrator = new AssistantOrchestrator(persistence, executor);
    await orchestrator.run({
      userId: 'user-1',
      prompt: 'Review my yearly career goal',
      sessionId: 'default',
      agentRole: 'GOAL_PLANNING',
      maxSteps: 8,
      allowAutoApproveWrites: false,
    });

    expect(persistence.createExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        agentRole: 'GOAL_PLANNING',
        tokenBudget: 35000,
      })
    );
    expect(executor).toHaveBeenCalledWith(
      expect.objectContaining({
        agentRole: 'GOAL_PLANNING',
        modelTier: 'PLANNING',
        maxSteps: 6,
      })
    );
  });

  it('executes parallel subagents across isolated threads linked via parentExecutionId', async () => {
    const checkpointer = new MemorySaver();
    const createdChildren: Array<{
      parentExecutionId: string;
      agentRole: string;
      threadId: string;
    }> = [];

    const parallelTool = buildParallelDelegationTool({
      userId: 'user-1',
      executionId: 'exec-parent-par',
      parentThreadId: 'thread-par',
      sessionId: 'default',
      allowAutoApproveWrites: false,
      onPendingApproval: async () => ({ id: 'app-1' }),
      checkpointer,
      tokenBudget: 24000,
      createSubagentExecution: async (data) => {
        createdChildren.push({
          parentExecutionId: data.parentExecutionId,
          agentRole: data.agentRole,
          threadId: data.threadId,
        });
        return { id: `child-${createdChildren.length}` };
      },
      completeSubagentExecution: vi.fn().mockResolvedValue(undefined),
      modelOverrideByRole: {
        TASK_PROJECT: {
          bindTools: () => ({
            invoke: vi.fn().mockResolvedValue(
              new AIMessage({
                content: 'Task backlog reviewed.',
                usage_metadata: { input_tokens: 20, output_tokens: 10, total_tokens: 30 },
              })
            ),
          }),
          invoke: vi.fn(),
        },
        ACCOUNTABILITY: {
          bindTools: () => ({
            invoke: vi.fn().mockResolvedValue(
              new AIMessage({
                content: 'Zero overdue risks.',
                usage_metadata: { input_tokens: 20, output_tokens: 12, total_tokens: 32 },
              })
            ),
          }),
          invoke: vi.fn(),
        },
      },
    });

    const raw = await parallelTool.invoke({
      tasks: [
        { role: 'TASK_PROJECT', objective: 'Summarize open tasks' },
        { role: 'ACCOUNTABILITY', objective: 'Check procrastination score' },
      ],
    });

    const parsed = JSON.parse(String(raw)) as {
      status: string;
      parallelCount: number;
      totalTokensUsed: number;
      results: Array<{ delegatedAgent: string; threadId: string; summary: string }>;
    };

    expect(parsed.status).toBe('COMPLETED');
    expect(parsed.parallelCount).toBe(2);
    expect(parsed.totalTokensUsed).toBe(62);
    expect(createdChildren).toHaveLength(2);
    expect(createdChildren[0]?.parentExecutionId).toBe('exec-parent-par');
    expect(createdChildren[1]?.parentExecutionId).toBe('exec-parent-par');
    expect(createdChildren[0]?.threadId).not.toBe(createdChildren[1]?.threadId);
  });

  it('runs the selective deep project execution harness across parallel specialist workstreams', async () => {
    const checkpointer = new MemorySaver();
    const createSubagentExecution = vi
      .fn()
      .mockResolvedValueOnce({ id: 'deep-child-1' })
      .mockResolvedValueOnce({ id: 'deep-child-2' });
    const completeSubagentExecution = vi.fn().mockResolvedValue(undefined);

    const deepResult = await runDeepProjectHarness({
      userId: 'user-1',
      parentExecutionId: 'exec-deep-parent',
      parentThreadId: 'thread-deep-parent',
      sessionId: 'default',
      objective: 'Research pgvector HNSW tuning and draft implementation milestones',
      allowAutoApproveWrites: false,
      onPendingApproval: async () => ({ id: 'app-unused' }),
      checkpointer,
      persistence: {
        createSubagentExecution,
        completeSubagentExecution,
      },
      decompositionOverride: {
        coordinationNote: 'Run research and goal planning in parallel.',
        workstreams: [
          { id: 'ws-1', role: 'RESEARCH', objective: 'Gather HNSW facts' },
          { id: 'ws-2', role: 'GOAL_PLANNING', objective: 'Structure 3 milestones' },
        ],
      },
      modelOverrideByRole: {
        RESEARCH: {
          bindTools: () => ({
            invoke: vi.fn().mockResolvedValue(
              new AIMessage({
                content: 'HNSW cosine index performs well at 768 dims.',
                usage_metadata: { input_tokens: 30, output_tokens: 15, total_tokens: 45 },
              })
            ),
          }),
          invoke: vi.fn(),
        },
        GOAL_PLANNING: {
          bindTools: () => ({
            invoke: vi.fn().mockResolvedValue(
              new AIMessage({
                content: 'Three sequential engineering milestones proposed.',
                usage_metadata: { input_tokens: 25, output_tokens: 15, total_tokens: 40 },
              })
            ),
          }),
          invoke: vi.fn(),
        },
      },
      synthesisOverride: async ({ results }) => ({
        summary: `Synthesized ${results.length} workstreams.`,
        tokensUsed: 20,
      }),
    });

    expect(deepResult.status).toBe('COMPLETED');
    expect(deepResult.workstreamsExecuted).toBe(2);
    expect(deepResult.childExecutionIds).toHaveLength(2);
    expect(deepResult.totalTokensUsed).toBe(105);
    expect(deepResult.summary).toBe('Synthesized 2 workstreams.');
    expect(completeSubagentExecution).toHaveBeenCalledTimes(2);
  });

  it('protects GET /api/v1/automation/agents with authentication', async () => {
    const response = await request(app).get('/api/v1/automation/agents');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
