import { AssistantOrchestrator } from '../../ai/agents/assistant.agent';
import { V3_TOOL_REGISTRY, executeRegisteredTool } from '../../ai/tools/v3.tools';
import { AppError } from '../../middleware/error.middleware';
import { AutomationRepository } from './automation.repository';
import {
  ApprovalsQueryInput,
  ExecutionsQueryInput,
  RunAssistantInput,
  ToolExecutor,
} from './automation.types';

export class AutomationService {
  constructor(
    private readonly automationRepository: AutomationRepository = new AutomationRepository(),
    private readonly orchestrator: AssistantOrchestrator = new AssistantOrchestrator(),
    private readonly toolExecutor: ToolExecutor = executeRegisteredTool
  ) {}

  listTools() {
    return Object.entries(V3_TOOL_REGISTRY).map(([name, definition]) => ({
      name,
      description: definition.description,
      policy: definition.policy,
    }));
  }

  async runAssistant(userId: string, input: RunAssistantInput) {
    return this.orchestrator.run({
      userId,
      prompt: input.prompt,
      sessionId: input.sessionId,
      provider: input.provider,
      modelId: input.modelId,
      maxSteps: input.maxSteps,
      allowAutoApproveWrites: input.allowAutoApproveWrites,
    });
  }

  async getExecutions(userId: string, filters: Partial<ExecutionsQueryInput> = {}) {
    return this.automationRepository.findExecutions(userId, filters);
  }

  async getExecutionById(id: string, userId: string) {
    const execution = await this.automationRepository.findExecutionByIdAndUserId(id, userId);
    if (!execution) {
      throw new AppError(404, 'AI execution not found', 'EXECUTION_NOT_FOUND');
    }
    return execution;
  }

  async getApprovals(userId: string, filters: Partial<ApprovalsQueryInput> = {}) {
    return this.automationRepository.findApprovals(userId, filters);
  }

  async approveToolCall(id: string, userId: string) {
    const approval = await this.automationRepository.findApprovalByIdAndUserId(id, userId);
    if (!approval) {
      throw new AppError(404, 'Approval request not found', 'APPROVAL_NOT_FOUND');
    }
    if (approval.status !== 'PENDING') {
      throw new AppError(
        409,
        `Approval has already been processed (${approval.status})`,
        'APPROVAL_ALREADY_DECIDED'
      );
    }

    await this.automationRepository.markApprovalApproved(id);

    try {
      const result = await this.toolExecutor(approval.toolName, approval.toolArgs, userId);
      const executed = await this.automationRepository.markApprovalExecuted(id, result);
      await this.automationRepository.syncExecutionStatusFromApprovals(approval.executionId);
      return executed;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      await this.automationRepository.markApprovalFailed(id, message);
      await this.automationRepository.syncExecutionStatusFromApprovals(approval.executionId);
      throw error;
    }
  }

  async rejectToolCall(id: string, userId: string, reason?: string) {
    const approval = await this.automationRepository.findApprovalByIdAndUserId(id, userId);
    if (!approval) {
      throw new AppError(404, 'Approval request not found', 'APPROVAL_NOT_FOUND');
    }
    if (approval.status !== 'PENDING') {
      throw new AppError(
        409,
        `Approval has already been processed (${approval.status})`,
        'APPROVAL_ALREADY_DECIDED'
      );
    }

    const rejected = await this.automationRepository.markApprovalRejected(id, reason);
    await this.automationRepository.syncExecutionStatusFromApprovals(approval.executionId);
    return rejected;
  }
}
