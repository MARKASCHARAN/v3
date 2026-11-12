import { ModelMessage, ToolSet } from 'ai';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { buildAssistantSystemContext } from '../prompts/assistant.prompt';
import { AiProviderName, resolveLanguageModel } from '../providers/model.provider';
import { ExecutionStepTrace, PendingToolApprovalRequest } from '../tools/tool.types';
import { buildAiSdkToolSet } from '../tools/v3.tools';
import { MultiStepWorkflowOutput, runMultiStepToolWorkflow } from '../workflows/execution.workflow';

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
  messages: ModelMessage[];
  tools: ToolSet;
  maxSteps: number;
}) => Promise<MultiStepWorkflowOutput & { provider: string; model: string }>;

const defaultWorkflowExecutor: WorkflowExecutor = async (input) => {
  const descriptor = resolveLanguageModel({
    provider: input.provider,
    modelId: input.modelId,
  });

  const output = await runMultiStepToolWorkflow({
    model: descriptor.model,
    system: input.system,
    messages: input.messages,
    tools: input.tools,
    maxSteps: input.maxSteps,
  });

  return {
    ...output,
    provider: descriptor.provider,
    model: descriptor.modelId,
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

  createPendingApproval(data) {
    return prisma.aiToolApproval.create({
      data: {
        executionId: data.executionId,
        userId: data.userId,
        toolName: data.toolName,
        toolArgs: data.toolArgs as Prisma.InputJsonValue,
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
    const context = await this.persistence.loadContext(params.userId, params.sessionId);
    const execution = await this.persistence.createExecution({
      userId: params.userId,
      sessionId: params.sessionId,
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

    const historyMessages: ModelMessage[] = context.recentMessages
      .filter((msg) => msg.role === 'USER' || msg.role === 'ASSISTANT')
      .map((msg) => ({
        role: msg.role === 'USER' ? 'user' : 'assistant',
        content: msg.content,
      }));

    const messages: ModelMessage[] = [...historyMessages, { role: 'user', content: params.prompt }];

    let pendingApprovalsCount = 0;

    const tools = buildAiSdkToolSet({
      userId: params.userId,
      allowAutoApproveWrites: params.allowAutoApproveWrites,
      onPendingApproval: async (request: PendingToolApprovalRequest) => {
        const approval = await this.persistence.createPendingApproval({
          executionId: execution.id,
          userId: params.userId,
          toolName: request.toolName,
          toolArgs: request.toolArgs,
        });
        pendingApprovalsCount += 1;
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
      });

      const status = pendingApprovalsCount > 0 ? 'AWAITING_APPROVAL' : 'COMPLETED';
      const responseText =
        output.text ||
        (pendingApprovalsCount > 0
          ? `${pendingApprovalsCount} action(s) queued for your approval.`
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
}
