import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { AiExecutionStatus, ApprovalsQueryInput, ExecutionsQueryInput } from './automation.types';

export class AutomationRepository {
  async findExecutions(userId: string, filters: Partial<ExecutionsQueryInput> = {}) {
    return prisma.aiExecution.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.sessionId ? { sessionId: filters.sessionId } : {}),
      },
      include: {
        approvals: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 25,
    });
  }

  async findExecutionByIdAndUserId(id: string, userId: string) {
    return prisma.aiExecution.findFirst({
      where: { id, userId },
      include: {
        approvals: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findExecutionForResume(executionId: string, userId: string) {
    return prisma.aiExecution.findFirst({
      where: { id: executionId, userId },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        threadId: true,
        agentRole: true,
        provider: true,
        model: true,
        approvals: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findApprovals(userId: string, filters: Partial<ApprovalsQueryInput> = {}) {
    return prisma.aiToolApproval.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.executionId ? { executionId: filters.executionId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }

  async findApprovalByIdAndUserId(id: string, userId: string) {
    return prisma.aiToolApproval.findFirst({
      where: { id, userId },
    });
  }

  async markApprovalApproved(id: string, decisionReason?: string) {
    return prisma.aiToolApproval.update({
      where: { id },
      data: {
        status: 'APPROVED',
        decisionReason,
        decidedAt: new Date(),
      },
    });
  }

  async markApprovalExecuted(id: string, resultData: unknown) {
    return prisma.aiToolApproval.update({
      where: { id },
      data: {
        status: 'EXECUTED',
        resultData: resultData as Prisma.InputJsonValue,
        executedAt: new Date(),
      },
    });
  }

  async markApprovalFailed(id: string, errorMessage: string) {
    return prisma.aiToolApproval.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage,
        executedAt: new Date(),
      },
    });
  }

  async markApprovalRejected(id: string, reason?: string) {
    return prisma.aiToolApproval.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decisionReason: reason,
        errorMessage: reason,
        decidedAt: new Date(),
      },
    });
  }

  async markApprovalExpired(id: string) {
    return prisma.aiToolApproval.update({
      where: { id },
      data: {
        status: 'EXPIRED',
        decisionReason: 'Approval request expired',
        errorMessage: 'Approval request expired',
        decidedAt: new Date(),
      },
    });
  }

  async syncExecutionStatusFromApprovals(executionId: string): Promise<void> {
    const approvals = await prisma.aiToolApproval.findMany({
      where: { executionId },
      select: { status: true },
    });

    const hasPending = approvals.some((a) => a.status === 'PENDING' || a.status === 'APPROVED');
    if (hasPending) {
      return;
    }

    const hasExecuted = approvals.some((a) => a.status === 'EXECUTED');
    const hasFailed = approvals.some((a) => a.status === 'FAILED');
    const allRejectedOrExpired =
      approvals.length > 0 &&
      approvals.every((a) => a.status === 'REJECTED' || a.status === 'EXPIRED');

    const nextStatus: AiExecutionStatus = allRejectedOrExpired
      ? 'REJECTED'
      : hasFailed && !hasExecuted
        ? 'FAILED'
        : 'COMPLETED';

    await prisma.aiExecution.update({
      where: { id: executionId },
      data: {
        status: nextStatus,
        completedAt: new Date(),
      },
    });
  }
}
