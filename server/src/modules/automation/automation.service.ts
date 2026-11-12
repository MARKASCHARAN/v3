import { AssistantOrchestrator } from '../../ai/agents/assistant.agent';
import { AiProviderName } from '../../ai/providers/model-router';
import { AgentRole } from '../../ai/runtime/state';
import { listSpecialistAgentsMetadata } from '../../ai/agents/specialist.registry';
import { executeRegisteredTool, listRegisteredToolsMetadata } from '../../ai/tools/registry';
import { ApprovalDecisionPayload } from '../../ai/tools/tool.types';
import { AppError } from '../../middleware/error.middleware';
import { AutomationRepository } from './automation.repository';
import {
  ApprovalsQueryInput,
  ExecutionsQueryInput,
  RunAssistantInput,
  ToolExecutor,
} from './automation.types';

const mapApprovalStatusToDecision = (
  status: string
): ApprovalDecisionPayload['decision'] | null => {
  if (
    status === 'APPROVED' ||
    status === 'REJECTED' ||
    status === 'EXECUTED' ||
    status === 'FAILED' ||
    status === 'EXPIRED'
  ) {
    return status;
  }
  return null;
};

export class AutomationService {
  constructor(
    private readonly automationRepository: AutomationRepository = new AutomationRepository(),
    private readonly orchestrator: AssistantOrchestrator = new AssistantOrchestrator(),
    private readonly toolExecutor: ToolExecutor = executeRegisteredTool
  ) {}

  listTools() {
    return listRegisteredToolsMetadata();
  }

  listAgents() {
    return listSpecialistAgentsMetadata();
  }

  getObservabilityMetrics(userId: string) {
    return this.automationRepository.getObservabilityMetrics(userId);
  }

  async runAssistant(userId: string, input: RunAssistantInput) {
    return this.orchestrator.run({
      userId,
      prompt: input.prompt,
      sessionId: input.sessionId,
      threadId: input.threadId,
      agentRole: input.agentRole,
      tokenBudget: input.tokenBudget,
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

  private async tryResumeInterruptedExecution(executionId: string, userId: string): Promise<void> {
    if (typeof this.automationRepository.findExecutionForResume !== 'function') {
      return;
    }

    const execution = await this.automationRepository.findExecutionForResume(executionId, userId);
    if (!execution) {
      return;
    }

    const hasPending = execution.approvals.some(
      (approval) => approval.status === 'PENDING' || approval.status === 'APPROVED'
    );
    if (hasPending) {
      return;
    }

    const decisions: Record<string, ApprovalDecisionPayload> = {};
    for (const approval of execution.approvals) {
      const mappedDecision = mapApprovalStatusToDecision(approval.status);
      if (!mappedDecision) {
        continue;
      }
      decisions[approval.id] = {
        approvalId: approval.id,
        toolName: approval.toolName,
        decision: mappedDecision,
        result: approval.resultData ?? undefined,
        reason: approval.decisionReason ?? approval.errorMessage ?? undefined,
      };
    }

    await this.orchestrator.resumeExecution({
      executionId: execution.id,
      userId,
      sessionId: execution.sessionId,
      threadId: execution.threadId,
      agentRole: execution.agentRole as AgentRole,
      provider: (execution.provider as AiProviderName | null) ?? undefined,
      modelId: execution.model ?? undefined,
      decisions,
    });
  }

  async approveToolCall(id: string, userId: string, decisionReason?: string) {
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

    if (approval.expiresAt && approval.expiresAt < new Date()) {
      await this.automationRepository.markApprovalExpired(id);
      await this.automationRepository.syncExecutionStatusFromApprovals(approval.executionId);
      throw new AppError(410, 'Approval request has expired', 'APPROVAL_EXPIRED');
    }

    await this.automationRepository.markApprovalApproved(id, decisionReason);

    try {
      const shouldPassContext = Boolean(
        approval.idempotencyKey ||
        (approval.agentRole && approval.agentRole !== 'MAIN_ORCHESTRATOR')
      );
      const result = shouldPassContext
        ? await this.toolExecutor(approval.toolName, approval.toolArgs, userId, {
            executionId: approval.executionId,
            agentRole: (approval.agentRole as AgentRole | undefined) ?? 'MAIN_ORCHESTRATOR',
            idempotencyKey: approval.idempotencyKey ?? undefined,
            bypassApprovalCheck: true,
          })
        : await this.toolExecutor(approval.toolName, approval.toolArgs, userId);

      const executed = await this.automationRepository.markApprovalExecuted(id, result);
      await this.automationRepository.syncExecutionStatusFromApprovals(approval.executionId);
      await this.tryResumeInterruptedExecution(approval.executionId, userId);
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

    if (approval.expiresAt && approval.expiresAt < new Date()) {
      await this.automationRepository.markApprovalExpired(id);
      await this.automationRepository.syncExecutionStatusFromApprovals(approval.executionId);
      throw new AppError(410, 'Approval request has expired', 'APPROVAL_EXPIRED');
    }

    const rejected = await this.automationRepository.markApprovalRejected(id, reason);
    await this.automationRepository.syncExecutionStatusFromApprovals(approval.executionId);
    await this.tryResumeInterruptedExecution(approval.executionId, userId);
    return rejected;
  }
}
