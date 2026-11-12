import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  BackgroundJobRecord,
  BackgroundJobStatus,
  BackgroundJobType,
  DomainEventRecord,
  DomainEventStatus,
} from './events.types';

export interface EventsQueryFilter {
  status?: DomainEventStatus;
  eventType?: string;
  limit?: number;
}

export interface JobsQueryFilter {
  status?: BackgroundJobStatus;
  jobType?: BackgroundJobType;
  limit?: number;
}

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

export const computeRetryDelayMs = (attempts: number, baseDelayMs: number = 15_000): number => {
  const exponent = Math.max(0, Math.min(attempts - 1, 6));
  return baseDelayMs * 2 ** exponent;
};

export class EventsRepository {
  async createDomainEventWithDedup(params: {
    userId: string;
    eventType: string;
    source: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    maxAttempts?: number;
  }): Promise<{ event: DomainEventRecord; deduplicated: boolean }> {
    if (params.idempotencyKey) {
      const existing = await prisma.domainEvent.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        return { event: existing, deduplicated: true };
      }
    }

    try {
      const created = await prisma.domainEvent.create({
        data: {
          userId: params.userId,
          eventType: params.eventType,
          source: params.source,
          payload: params.payload as Prisma.InputJsonValue,
          idempotencyKey: params.idempotencyKey,
          maxAttempts: params.maxAttempts ?? 3,
          status: 'PENDING',
        },
      });
      return { event: created, deduplicated: false };
    } catch (error) {
      if (isUniqueConstraintError(error) && params.idempotencyKey) {
        const existing = await prisma.domainEvent.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) {
          return { event: existing, deduplicated: true };
        }
      }
      throw error;
    }
  }

  async findDomainEventsByUserId(
    userId: string,
    filters: EventsQueryFilter = {}
  ): Promise<DomainEventRecord[]> {
    return prisma.domainEvent.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.eventType ? { eventType: filters.eventType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }

  async findDomainEventById(id: string): Promise<DomainEventRecord | null> {
    return prisma.domainEvent.findUnique({
      where: { id },
    });
  }

  async findDomainEventByIdAndUserId(
    id: string,
    userId: string
  ): Promise<DomainEventRecord | null> {
    return prisma.domainEvent.findFirst({
      where: { id, userId },
    });
  }

  async markDomainEventProcessed(id: string): Promise<DomainEventRecord> {
    return prisma.domainEvent.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        errorMessage: null,
        attempts: { increment: 1 },
      },
    });
  }

  async markDomainEventFailedOrDeadLetter(
    id: string,
    errorMessage: string
  ): Promise<DomainEventRecord> {
    const existing = await prisma.domainEvent.findUnique({
      where: { id },
      select: { attempts: true, maxAttempts: true },
    });
    const nextAttempts = (existing?.attempts ?? 0) + 1;
    const maxAttempts = existing?.maxAttempts ?? 3;
    const nextStatus: DomainEventStatus = nextAttempts >= maxAttempts ? 'DEAD_LETTER' : 'FAILED';

    return prisma.domainEvent.update({
      where: { id },
      data: {
        attempts: nextAttempts,
        status: nextStatus,
        errorMessage,
      },
    });
  }

  async createBackgroundJobWithDedup(params: {
    userId: string;
    jobType: BackgroundJobType;
    payload?: Record<string, unknown>;
    executionId?: string;
    domainEventId?: string;
    idempotencyKey?: string;
    maxAttempts?: number;
    scheduledFor?: Date;
  }): Promise<{ job: BackgroundJobRecord; deduplicated: boolean }> {
    if (params.idempotencyKey) {
      const existing = await prisma.backgroundJob.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        return { job: existing, deduplicated: true };
      }
    }

    try {
      const created = await prisma.backgroundJob.create({
        data: {
          userId: params.userId,
          jobType: params.jobType,
          payload: (params.payload ?? {}) as Prisma.InputJsonValue,
          executionId: params.executionId,
          domainEventId: params.domainEventId,
          idempotencyKey: params.idempotencyKey,
          maxAttempts: params.maxAttempts ?? 3,
          scheduledFor: params.scheduledFor,
          status: 'QUEUED',
        },
      });
      return { job: created, deduplicated: false };
    } catch (error) {
      if (isUniqueConstraintError(error) && params.idempotencyKey) {
        const existing = await prisma.backgroundJob.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) {
          return { job: existing, deduplicated: true };
        }
      }
      throw error;
    }
  }

  async findBackgroundJobsByUserId(
    userId: string,
    filters: JobsQueryFilter = {}
  ): Promise<BackgroundJobRecord[]> {
    return prisma.backgroundJob.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.jobType ? { jobType: filters.jobType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }

  async findBackgroundJobById(id: string): Promise<BackgroundJobRecord | null> {
    return prisma.backgroundJob.findUnique({
      where: { id },
    });
  }

  async findBackgroundJobByIdAndUserId(
    id: string,
    userId: string
  ): Promise<BackgroundJobRecord | null> {
    return prisma.backgroundJob.findFirst({
      where: { id, userId },
    });
  }

  async attachExternalJobId(id: string, externalJobId: string): Promise<BackgroundJobRecord> {
    return prisma.backgroundJob.update({
      where: { id },
      data: { externalJobId },
    });
  }

  async markJobRunning(id: string): Promise<BackgroundJobRecord> {
    return prisma.backgroundJob.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
  }

  async markJobCompleted(
    id: string,
    resultData?: Record<string, unknown>,
    executionId?: string
  ): Promise<BackgroundJobRecord> {
    return prisma.backgroundJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
        lastError: null,
        ...(executionId ? { executionId } : {}),
        ...(resultData ? { resultData: resultData as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async markJobFailedOrDeadLetter(id: string, errorMessage: string): Promise<BackgroundJobRecord> {
    const existing = await prisma.backgroundJob.findUnique({
      where: { id },
      select: { attempts: true, maxAttempts: true },
    });

    const attempts = existing?.attempts ?? 1;
    const maxAttempts = existing?.maxAttempts ?? 3;
    const exhausted = attempts >= maxAttempts;
    const nextStatus: BackgroundJobStatus = exhausted ? 'DEAD_LETTER' : 'FAILED';
    const nextRetryAt = exhausted ? null : new Date(Date.now() + computeRetryDelayMs(attempts));

    return prisma.backgroundJob.update({
      where: { id },
      data: {
        status: nextStatus,
        lastError: errorMessage,
        scheduledFor: nextRetryAt,
        ...(exhausted ? { finishedAt: new Date() } : {}),
      },
    });
  }

  async requeueJob(id: string): Promise<BackgroundJobRecord> {
    return prisma.backgroundJob.update({
      where: { id },
      data: {
        status: 'QUEUED',
        lastError: null,
        finishedAt: null,
        scheduledFor: new Date(),
      },
    });
  }

  async findStalledRunningJobs(before: Date, userId?: string): Promise<BackgroundJobRecord[]> {
    return prisma.backgroundJob.findMany({
      where: {
        status: 'RUNNING',
        startedAt: { lt: before },
        ...(userId ? { userId } : {}),
      },
      orderBy: { startedAt: 'asc' },
      take: 100,
    });
  }

  async findRetryableFailedJobs(now: Date, userId?: string): Promise<BackgroundJobRecord[]> {
    return prisma.backgroundJob.findMany({
      where: {
        status: 'FAILED',
        ...(userId ? { userId } : {}),
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
  }

  async findRetryableDomainEvents(userId?: string): Promise<DomainEventRecord[]> {
    return prisma.domainEvent.findMany({
      where: {
        status: 'FAILED',
        ...(userId ? { userId } : {}),
      },
      orderBy: { updatedAt: 'asc' },
      take: 100,
    });
  }
}
