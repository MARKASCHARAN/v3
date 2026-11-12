import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import {
  AssistantOrchestrator,
  OrchestratorPersistence,
  WorkflowExecutor,
} from '../../ai/agents/assistant.agent';
import { getPromptDefinition } from '../../ai/prompts/prompt.registry';
import { buildAssistantSystemContext } from '../../ai/prompts/assistant.prompt';
import { V3_TOOL_REGISTRY, executeRegisteredTool } from '../../ai/tools/v3.tools';
import { withAiRetry } from '../../ai/workflows/retry.workflow';
import { AppError } from '../../middleware/error.middleware';
import { AutomationService } from './automation.service';
import { AutomationRepository } from './automation.repository';
import { runAssistantSchema } from './automation.schema';

describe('Phase 2 AI & Automation Module', () => {
  describe('Prompt Registry & Context', () => {
    it('loads registered prompts and builds user context', () => {
      const prompt = getPromptDefinition('ASSISTANT_ORCHESTRATOR');
      expect(prompt.version).toBe('1.0.0');

      const system = buildAssistantSystemContext({
        preferences: [{ key: 'focus_window', value: '09:00-12:00' }],
        memories: [{ title: 'Goal', content: 'Ship Phase 2', category: 'PROJECT_CONTEXT' }],
        overdueTasksCount: 2,
        pendingRemindersCount: 1,
      });

      expect(system).toContain('2 overdue task(s), 1 pending reminder(s)');
      expect(system).toContain('focus_window: 09:00-12:00');
      expect(system).toContain('Ship Phase 2');
    });
  });

  describe('Retry Logic', () => {
    it('retries transient failures and succeeds', async () => {
      let count = 0;
      const outcome = await withAiRetry(
        async () => {
          count += 1;
          if (count < 3) {
            throw new Error('Request timeout from upstream provider');
          }
          return 'ok';
        },
        { maxAttempts: 3, baseDelayMs: 0 }
      );

      expect(outcome.result).toBe('ok');
      expect(outcome.attempts).toBe(3);
    });

    it('does not retry non-retryable AppError', async () => {
      let count = 0;
      await expect(
        withAiRetry(
          async () => {
            count += 1;
            throw new AppError(400, 'Bad payload', 'BAD_REQUEST');
          },
          { maxAttempts: 3, baseDelayMs: 0 }
        )
      ).rejects.toThrow('Bad payload');

      expect(count).toBe(1);
    });
  });

  describe('Tool Permissions & AssistantOrchestrator', () => {
    it('defines read tools as AUTO_EXECUTE and write tools as REQUIRE_APPROVAL', () => {
      expect(V3_TOOL_REGISTRY.listGoals?.policy).toBe('AUTO_EXECUTE');
      expect(V3_TOOL_REGISTRY.createTask?.policy).toBe('REQUIRE_APPROVAL');
    });

    it('rejects unknown tools in executeRegisteredTool', async () => {
      await expect(executeRegisteredTool('nonExistentTool', {}, 'user-1')).rejects.toThrow(
        'Unknown AI tool'
      );
    });

    it('queues approval when write tool executes without auto-approve and records AWAITING_APPROVAL', async () => {
      const persistence: OrchestratorPersistence = {
        loadContext: vi.fn().mockResolvedValue({
          preferences: [],
          memories: [],
          recentMessages: [{ role: 'USER', content: 'Previous turn' }],
          overdueTasksCount: 0,
          pendingRemindersCount: 0,
        }),
        createExecution: vi.fn().mockResolvedValue({ id: 'exec-1' }),
        saveConversationMessage: vi.fn().mockResolvedValue(undefined),
        createPendingApproval: vi.fn().mockResolvedValue({ id: 'approval-1' }),
        completeExecution: vi.fn().mockImplementation(async (_id, data) => ({
          id: 'exec-1',
          ...data,
        })),
      };

      const executor: WorkflowExecutor = async (input) => {
        const createTaskTool = input.tools.find((entry) => entry.name === 'createTask');
        expect(createTaskTool).toBeDefined();
        const toolResponseRaw = await createTaskTool!.invoke({
          title: 'Draft Phase 2 docs',
          priority: 'HIGH',
        });
        const toolResponse = JSON.parse(String(toolResponseRaw)) as Record<string, unknown>;
        expect(toolResponse).toMatchObject({
          status: 'APPROVAL_REQUIRED',
          approvalId: 'approval-1',
        });

        return {
          provider: 'google',
          model: 'gemini-2.5-flash',
          text: 'Queued task creation for your approval.',
          attempts: 1,
          tokensUsed: 120,
          checkpointThreadId: input.threadId,
          steps: [],
        };
      };

      const orchestrator = new AssistantOrchestrator(persistence, executor);
      const result = (await orchestrator.run({
        userId: 'user-1',
        prompt: 'Create a high priority task to draft Phase 2 docs',
        sessionId: 'default',
        maxSteps: 5,
        allowAutoApproveWrites: false,
      })) as { status: string; responseText: string; tokensUsed: number };

      expect(result.status).toBe('AWAITING_APPROVAL');
      expect(result.tokensUsed).toBe(120);
      expect(persistence.createExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          sessionId: 'default',
          agentRole: 'MAIN_ORCHESTRATOR',
          triggerType: 'REQUEST',
          threadId: expect.stringContaining('default:'),
        })
      );
      expect(persistence.createPendingApproval).toHaveBeenCalledOnce();
      expect(persistence.saveConversationMessage).toHaveBeenCalledTimes(2);
    });

    it('marks execution FAILED when workflow throws', async () => {
      const persistence: OrchestratorPersistence = {
        loadContext: vi.fn().mockResolvedValue({
          preferences: [],
          memories: [],
          recentMessages: [],
          overdueTasksCount: 0,
          pendingRemindersCount: 0,
        }),
        createExecution: vi.fn().mockResolvedValue({ id: 'exec-fail' }),
        saveConversationMessage: vi.fn().mockResolvedValue(undefined),
        createPendingApproval: vi.fn(),
        completeExecution: vi.fn().mockResolvedValue({ id: 'exec-fail', status: 'FAILED' }),
      };

      const failingExecutor: WorkflowExecutor = async () => {
        throw new Error('Provider unreachable');
      };

      const orchestrator = new AssistantOrchestrator(persistence, failingExecutor);
      await expect(
        orchestrator.run({
          userId: 'user-1',
          prompt: 'Summarize my goals',
          sessionId: 'default',
          maxSteps: 5,
          allowAutoApproveWrites: false,
        })
      ).rejects.toThrow('Provider unreachable');

      expect(persistence.completeExecution).toHaveBeenCalledWith('exec-fail', {
        status: 'FAILED',
        errorMessage: 'Provider unreachable',
      });
    });
  });

  describe('AutomationService Approvals & Routes', () => {
    it('executes approved tool call and syncs execution status', async () => {
      const mockRepo = {
        findApprovalByIdAndUserId: vi.fn().mockResolvedValue({
          id: 'app-1',
          executionId: 'exec-1',
          toolName: 'createTask',
          toolArgs: { title: 'Approved Task' },
          status: 'PENDING',
        }),
        markApprovalApproved: vi.fn().mockResolvedValue({}),
        markApprovalExecuted: vi.fn().mockResolvedValue({ id: 'app-1', status: 'EXECUTED' }),
        syncExecutionStatusFromApprovals: vi.fn().mockResolvedValue(undefined),
      } as unknown as AutomationRepository;

      const mockToolExecutor = vi.fn().mockResolvedValue({ id: 'task-99', title: 'Approved Task' });
      const service = new AutomationService(mockRepo, undefined, mockToolExecutor);

      const res = await service.approveToolCall('app-1', 'user-1');
      expect(res.status).toBe('EXECUTED');
      expect(mockToolExecutor).toHaveBeenCalledWith(
        'createTask',
        { title: 'Approved Task' },
        'user-1'
      );
      expect(mockRepo.syncExecutionStatusFromApprovals).toHaveBeenCalledWith('exec-1');
    });

    it('rejects already processed approvals with 409', async () => {
      const mockRepo = {
        findApprovalByIdAndUserId: vi.fn().mockResolvedValue({
          id: 'app-1',
          status: 'EXECUTED',
        }),
      } as unknown as AutomationRepository;
      const service = new AutomationService(mockRepo);

      await expect(service.rejectToolCall('app-1', 'user-1')).rejects.toThrow(
        'Approval has already been processed'
      );
    });

    it('validates runAssistantSchema and requires auth on /api/v1/automation/run', async () => {
      expect(() => runAssistantSchema.parse({ prompt: '' })).toThrow();
      const parsed = runAssistantSchema.parse({ prompt: 'Plan tomorrow' });
      expect(parsed.maxSteps).toBe(5);
      expect(parsed.allowAutoApproveWrites).toBe(false);

      const response = await request(app)
        .post('/api/v1/automation/run')
        .send({ prompt: 'Plan tomorrow' });
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
