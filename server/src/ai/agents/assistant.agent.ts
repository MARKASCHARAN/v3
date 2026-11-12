import { randomUUID } from 'node:crypto';
import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { Prisma } from '@prisma/client';
import { aiConfig, configureLangSmithRuntime } from '../../config/ai.config';
import { prisma } from '../../database/prisma';
import { buildAssistantSystemContext } from '../prompts/assistant.prompt';
import { AiProviderName, resolveChatModel } from '../providers/model-router';
import { ensurePostgresCheckpointer } from '../runtime/checkpoints';
import { GraphApprovalPolicy } from '../runtime/graph-factory';
import { AgentRole } from '../runtime/state';
import { buildLangChainTools } from '../tools/registry';
import {
  ApprovalDecisionPayload,
  ExecutionStepTrace,
  PendingToolApprovalRequest,
} from '../tools/tool.types';
import {
  MultiStepWorkflowOutput,
  hasPendingInterruptForThread,
  resumeInterruptedToolWorkflow,
  runMultiStepToolWorkflow,
} from '../workflows/execution.workflow';

export interface RunAssistantWorkflowParams {
  userId: string;
  prompt: string;
  sessionId: string;
  provider?: AiProviderName;
  modelId?: string;
  maxSteps: number;
  allowAutoApproveWrites: boolean;
}

export type WorkflowExecutor = (input: {
  provider?: AiProviderName;
  modelId?: string;
  system: string;
  messages: BaseMessage[];
  tools: StructuredToolInterface[];
  maxSteps: number;
  threadId: string;
  executionId: string;
  userId: string;
  sessionId: string;
  objective: string;
  agentRole: AgentRole;
  tokenBudget: number;
  langsmithTraceId?: string;
  approvalPolicy: GraphApprovalPolicy;
}) => Promise<
  MultiStepWorkflowOutput & { provider: string; model: string; langsmithTraceId?: string }
>;

const defaultWorkflowExecutor: WorkflowExecutor = async (input) => {
  const descriptor = resolveChatModel({
    provider: input.provider,
    modelId: input.modelId,
    tier: 'ORCHESTRATION',
  });

  const output = await runMultiStepToolWorkflow({
    model: descriptor.model,
    system: input.system,
    messages: input.messages,
    tools: input.tools,
    maxSteps: input.maxSteps,
    threadId: input.threadId,
    executionId: input.executionId,
    userId: input.userId,
    sessionId: input.sessionId,
    objective: input.objective,
    agentRole: input.agentRole,
    tokenBudget: input.tokenBudget,
    runId: input.langsmithTraceId,
    approvalPolicy: input.approvalPolicy,
  });

  return {
    ...output,
    provider: descriptor.provider,
    model: descriptor.modelId,
    langsmithTraceId: input.langsmithTraceId,
  };
};

export interface OrchestratorPersistence {
  loadContext(
    userId: string,
    sessionId: string
  ): Promise<{
    preferences: Array<{ key: string; value: string }>;
    memories: Array<{ title: string | null; content: string; category: string }>;
    recentMessages: Array<{ role: string; content: string }>;
    overdueTasksCount: number;
    pendingRemindersCount: number;
  }>;
  createExecution(data: {
    userId: string;
    sessionId: string;
    threadId: string;
    agentRole: AgentRole;
    triggerType: string;
    tokenBudget: number;
    langsmithTraceId?: string;
    prompt: string;
    provider?: string;
    model?: string;
  }): Promise<{ id: string }>;
  saveConversationMessage(data: {
    userId: string;
    sessionId: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
  }): Promise<void>;
  createPendingApproval(data: {
    executionId: string;
    userId: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    riskLevel?: string;
    agentRole?: string;
    idempotencyKey?: string;
    expiresAt?: Date;
  }): Promise<{ id: string }>;
  completeExecution(
    executionId: string,
    data: {
      status: 'COMPLETED' | 'AWAITING_APPROVAL' | 'FAILED';
      provider?: string;
      model?: string;
      responseText?: string;
      errorMessage?: string;
      attempts?: number;
      tokensUsed?: number;
      langsmithTraceId?: string;
      stepsData?: ExecutionStepTrace[];
    }
  ): Promise<unknown>;
}

const prismaPersistence: OrchestratorPersistence = {
  async loadContext(userId, sessionId) {
    const now = new Date();
    const [preferences, memories, recentMessages, overdueTasksCount, pendingRemindersCount] =
      await Promise.all([
        prisma.userPreference.findMany({
          where: { userId },
          select: { key: true, value: true },
          take: 25,
        }),
        prisma.memory.findMany({
          where: { userId },
          select: { title: true, content: true, category: true },
          orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
          take: 20,
        }),
        prisma.conversationMessage.findMany({
          where: { userId, sessionId },
          select: { role: true, content: true },
          orderBy: { createdAt: 'asc' },
          take: 20,
        }),
        prisma.task.count({
          where: {
            userId,
            dueDate: { lt: now },
            status: { notIn: ['DONE', 'CANCELLED'] },
          },
        }),
        prisma.reminder.count({
          where: { userId, status: 'PENDING' },
        }),
      ]);

    return {
      preferences,
      memories,
      recentMessages,
      overdueTasksCount,
      pendingRemindersCount,
    };
  },

  createExecution(data) {
    return prisma.aiExecution.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        threadId: data.threadId,
        agentRole: data.agentRole,
        triggerType: data.triggerType,
        tokenBudget: data.tokenBudget,
        langsmithTraceId: data.langsmithTraceId,
        prompt: data.prompt,
        status: 'RUNNING',
        provider: data.provider,
        model: data.model,
      },
      select: { id: true },
    });
  },

  async saveConversationMessage(data) {
    await prisma.conversationMessage.create({
      data: {
        userId: data.userId,
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
      },
    });
  },

  async createPendingApproval(data) {
    if (data.idempotencyKey) {
      const existing = await prisma.aiToolApproval.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return existing;
      }
    }

    return prisma.aiToolApproval.create({
      data: {
        executionId: data.executionId,
        userId: data.userId,
        toolName: data.toolName,
        toolArgs: data.toolArgs as Prisma.InputJsonValue,
        riskLevel: data.riskLevel ?? 'INTERNAL_WRITE',
        agentRole: data.agentRole ?? 'MAIN_ORCHESTRATOR',
        idempotencyKey: data.idempotencyKey,
        expiresAt: data.expiresAt,
        status: 'PENDING',
      },
      select: { id: true },
    });
  },

  completeExecution(executionId, data) {
    return prisma.aiExecution.update({
      where: { id: executionId },
      data: {
        status: data.status,
        provider: data.provider,
        model: data.model,
        responseText: data.responseText,
        errorMessage: data.errorMessage,
        attempts: data.attempts,
        tokensUsed: data.tokensUsed,
        langsmithTraceId: data.langsmithTraceId,
        stepsData: data.stepsData as unknown as Prisma.InputJsonValue | undefined,
        completedAt: new Date(),
      },
      include: {
        approvals: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  },
};

export class AssistantOrchestrator {
  constructor(
    private readonly persistence: OrchestratorPersistence = prismaPersistence,
    private readonly workflowExecutor: WorkflowExecutor = defaultWorkflowExecutor
  ) {}

  async run(params: RunAssistantWorkflowParams) {
    const langsmithEnabled = configureLangSmithRuntime();
    const threadId = `${params.sessionId}:${randomUUID()}`;
    const agentRole: AgentRole = 'MAIN_ORCHESTRATOR';
    const tokenBudget = aiConfig.defaultTokenBudget;
    const langsmithTraceId = langsmithEnabled ? randomUUID() : undefined;

    const context = await this.persistence.loadContext(params.userId, params.sessionId);
    const execution = await this.persistence.createExecution({
      userId: params.userId,
      sessionId: params.sessionId,
      threadId,
      agentRole,
      triggerType: 'REQUEST',
      tokenBudget,
      langsmithTraceId,
      prompt: params.prompt,
      provider: params.provider,
      model: params.modelId,
    });

    await this.persistence.saveConversationMessage({
      userId: params.userId,
      sessionId: params.sessionId,
      role: 'USER',
      content: params.prompt,
    });

    const system = buildAssistantSystemContext({
      preferences: context.preferences,
      memories: context.memories,
      overdueTasksCount: context.overdueTasksCount,
      pendingRemindersCount: context.pendingRemindersCount,
    });

    const historyMessages: BaseMessage[] = context.recentMessages
      .filter((msg) => msg.role === 'USER' || msg.role === 'ASSISTANT')
      .map((msg) =>
        msg.role === 'USER' ? new HumanMessage(msg.content) : new AIMessage(msg.content)
      );

    const messages: BaseMessage[] = [...historyMessages, new HumanMessage(params.prompt)];

    let pendingApprovalsCount = 0;

    const createApprovalRecord = async (request: PendingToolApprovalRequest) => {
      const approval = await this.persistence.createPendingApproval({
        executionId: execution.id,
        userId: params.userId,
        toolName: request.toolName,
        toolArgs: request.toolArgs,
        riskLevel: request.riskLevel,
        agentRole: request.agentRole,
        idempotencyKey: request.idempotencyKey,
        expiresAt: request.expiresAt ?? new Date(Date.now() + aiConfig.defaultApprovalTtlMs),
      });
      pendingApprovalsCount += 1;
      return approval;
    };

    const tools = buildLangChainTools({
      userId: params.userId,
      executionId: execution.id,
      agentRole,
      allowAutoApproveWrites: params.allowAutoApproveWrites,
      onPendingApproval: async (request) => {
        const approval = await createApprovalRecord(request);
        return approval.id;
      },
    });

    try {
      const output = await this.workflowExecutor({
        provider: params.provider,
        modelId: params.modelId,
        system,
        messages,
        tools,
        maxSteps: params.maxSteps,
        threadId,
        executionId: execution.id,
        userId: params.userId,
        sessionId: params.sessionId,
        objective: params.prompt,
        agentRole,
        tokenBudget,
        langsmithTraceId,
        approvalPolicy: {
          agentRole,
          userId: params.userId,
          executionId: execution.id,
          allowAutoApproveWrites: params.allowAutoApproveWrites,
          createPendingApproval: createApprovalRecord,
        },
      });

      const isAwaitingApproval = output.interrupted || pendingApprovalsCount > 0;
      const status = isAwaitingApproval ? 'AWAITING_APPROVAL' : 'COMPLETED';
      const responseText =
        output.text ||
        (isAwaitingApproval
          ? `${pendingApprovalsCount || output.pendingApprovalIds.length || 1} action(s) queued for your approval.`
          : 'Completed.');

      await this.persistence.saveConversationMessage({
        userId: params.userId,
        sessionId: params.sessionId,
        role: 'ASSISTANT',
        content: responseText,
      });

      return this.persistence.completeExecution(execution.id, {
        status,
        provider: output.provider,
        model: output.model,
        responseText,
        attempts: output.attempts,
        tokensUsed: output.tokensUsed,
        langsmithTraceId: output.langsmithTraceId ?? langsmithTraceId,
        stepsData: output.steps,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI execution failed';
      await this.persistence.completeExecution(execution.id, {
        status: 'FAILED',
        errorMessage: message,
      });
      throw error;
    }
  }

  async resumeExecution(params: {
    executionId: string;
    userId: string;
    sessionId: string;
    threadId: string;
    agentRole: AgentRole;
    provider?: AiProviderName;
    modelId?: string;
    decisions: Record<string, ApprovalDecisionPayload>;
  }) {
    const checkpointer = await ensurePostgresCheckpointer();
    const descriptor = resolveChatModel({
      provider: params.provider,
      modelId: params.modelId,
      tier: 'ORCHESTRATION',
    });

    const context = await this.persistence.loadContext(params.userId, params.sessionId);
    const system = buildAssistantSystemContext({
      preferences: context.preferences,
      memories: context.memories,
      overdueTasksCount: context.overdueTasksCount,
      pendingRemindersCount: context.pendingRemindersCount,
    });

    const createApprovalRecord = async (request: PendingToolApprovalRequest) =>
      this.persistence.createPendingApproval({
        executionId: params.executionId,
        userId: params.userId,
        toolName: request.toolName,
        toolArgs: request.toolArgs,
        riskLevel: request.riskLevel,
        agentRole: request.agentRole,
        idempotencyKey: request.idempotencyKey,
        expiresAt: request.expiresAt ?? new Date(Date.now() + aiConfig.defaultApprovalTtlMs),
      });

    const tools = buildLangChainTools({
      userId: params.userId,
      executionId: params.executionId,
      agentRole: params.agentRole,
      allowAutoApproveWrites: false,
      onPendingApproval: async (request) => {
        const created = await createApprovalRecord(request);
        return created.id;
      },
    });

    const approvalPolicy: GraphApprovalPolicy = {
      agentRole: params.agentRole,
      userId: params.userId,
      executionId: params.executionId,
      allowAutoApproveWrites: false,
      createPendingApproval: createApprovalRecord,
    };

    const canResume = await hasPendingInterruptForThread({
      model: descriptor.model,
      system,
      tools,
      threadId: params.threadId,
      checkpointer,
      approvalPolicy,
    });

    if (!canResume) {
      return null;
    }

    const output = await resumeInterruptedToolWorkflow({
      model: descriptor.model,
      system,
      tools,
      threadId: params.threadId,
      checkpointer,
      decisions: params.decisions,
      approvalPolicy,
    });

    const status = output.interrupted ? 'AWAITING_APPROVAL' : 'COMPLETED';
    await this.persistence.saveConversationMessage({
      userId: params.userId,
      sessionId: params.sessionId,
      role: 'ASSISTANT',
      content: output.text,
    });

    return this.persistence.completeExecution(params.executionId, {
      status,
      provider: descriptor.provider,
      model: descriptor.modelId,
      responseText: output.text,
      attempts: output.attempts,
      tokensUsed: output.tokensUsed,
      stepsData: output.steps,
    });
  }
}
