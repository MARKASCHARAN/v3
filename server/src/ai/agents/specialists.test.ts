import { AIMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../app';
import { evaluateToolPermission } from '../../permissions/risk-policy';
import { getPromptDefinition } from '../prompts/prompt.registry';
import { RunnableChatModel } from '../runtime/graph-factory';
import { AssistantOrchestrator, OrchestratorPersistence } from './assistant.agent';
import {
  SPECIALIST_AGENTS,
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

  it('protects GET /api/v1/automation/agents with authentication', async () => {
    const response = await request(app).get('/api/v1/automation/agents');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
