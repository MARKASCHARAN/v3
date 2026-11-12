import { schedules } from '@trigger.dev/sdk';
import { prisma } from '../../database/prisma';
import { AutomationRepository } from '../../modules/automation/automation.repository';
import { EventsRepository } from '../../modules/events/events.repository';

export interface ApprovalExpirySweepOptions {
  userId?: string;
  now?: Date;
}

export interface ApprovalExpirySweepDeps {
  findExpiredPendingApprovals?: (
    now: Date,
    userId?: string
  ) => Promise<
    Array<{
      id: string;
      executionId: string;
      userId: string;
      toolName: string;
      expiresAt: Date | null;
    }>
  >;
  markApprovalExpired?: (approvalId: string) => Promise<unknown>;
  syncExecutionStatus?: (executionId: string) => Promise<void>;
  recordExpiryEvent?: (params: {
    userId: string;
    approvalId: string;
    executionId: string;
    toolName: string;
  }) => Promise<unknown>;
}

export interface ApprovalExpirySweepResult {
  scannedCount: number;
  expiredCount: number;
  affectedExecutionIds: string[];
}

export const runApprovalExpirySweep = async (
  options: ApprovalExpirySweepOptions = {},
  deps: ApprovalExpirySweepDeps = {}
): Promise<ApprovalExpirySweepResult> => {
  const now = options.now ?? new Date();
  const automationRepo = new AutomationRepository();
  const eventsRepo = new EventsRepository();

  const findExpired =
    deps.findExpiredPendingApprovals ??
    ((cutoff: Date, targetUserId?: string) =>
      prisma.aiToolApproval.findMany({
        where: {
          status: 'PENDING',
          expiresAt: { lt: cutoff },
          ...(targetUserId ? { userId: targetUserId } : {}),
        },
        select: {
          id: true,
          executionId: true,
          userId: true,
          toolName: true,
          expiresAt: true,
        },
        take: 200,
      }));

  const markExpired =
    deps.markApprovalExpired ?? ((id: string) => automationRepo.markApprovalExpired(id));
  const syncExecution =
    deps.syncExecutionStatus ??
    ((executionId: string) => automationRepo.syncExecutionStatusFromApprovals(executionId));
  const recordEvent =
    deps.recordExpiryEvent ??
    ((params) =>
      eventsRepo.createDomainEventWithDedup({
        userId: params.userId,
        eventType: 'APPROVAL_EXPIRED',
        source: 'SCHEDULER',
        payload: {
          approvalId: params.approvalId,
          executionId: params.executionId,
          toolName: params.toolName,
        },
        idempotencyKey: `approval-expired:${params.approvalId}`,
      }));

  const expiredApprovals = await findExpired(now, options.userId);
  const executionIds = new Set<string>();

  for (const approval of expiredApprovals) {
    await markExpired(approval.id);
    executionIds.add(approval.executionId);
    await recordEvent({
      userId: approval.userId,
      approvalId: approval.id,
      executionId: approval.executionId,
      toolName: approval.toolName,
    });
  }

  for (const executionId of executionIds) {
    await syncExecution(executionId);
  }

  return {
    scannedCount: expiredApprovals.length,
    expiredCount: expiredApprovals.length,
    affectedExecutionIds: Array.from(executionIds),
  };
};

export const approvalExpirySweeperSchedule = schedules.task({
  id: 'approval-expiry-sweeper',
  cron: '*/15 * * * *',
  run: async (payload) => runApprovalExpirySweep({ now: payload.timestamp }),
});
