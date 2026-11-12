import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../middleware/error.middleware';
import { EventsService } from './events.service';
import { BackgroundJobRecord, DomainEventRecord } from './events.types';

const makeEvent = (overrides: Partial<DomainEventRecord> = {}): DomainEventRecord => ({
  id: '11111111-1111-1111-1111-111111111111',
  userId: 'user-1',
  eventType: 'TASK_MISSED',
  source: 'SCHEDULER',
  payload: { taskId: 'task-1', title: 'Submit tax filing' },
  status: 'PENDING',
  idempotencyKey: 'task-missed:user-1:task-1:2026-11-12',
  attempts: 0,
  maxAttempts: 3,
  processedAt: null,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeJob = (overrides: Partial<BackgroundJobRecord> = {}): BackgroundJobRecord => ({
  id: '22222222-2222-2222-2222-222222222222',
  userId: 'user-1',
  executionId: null,
  domainEventId: '11111111-1111-1111-1111-111111111111',
  jobType: 'MISSED_TASK_EVENT_REACTION',
  externalJobId: null,
  idempotencyKey: 'event:111:job:MISSED_TASK_EVENT_REACTION',
  payload: { taskId: 'task-1', title: 'Submit tax filing' },
  resultData: null,
  status: 'QUEUED',
  attempts: 0,
  maxAttempts: 3,
  scheduledFor: null,
  startedAt: null,
  finishedAt: null,
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('EventsService', () => {
  it('routes ingested TASK_MISSED event to a background reaction job and marks processed', async () => {
    const initialEvent = makeEvent();
    const processedEvent = makeEvent({ status: 'PROCESSED', processedAt: new Date(), attempts: 1 });
    const queuedJob = makeJob();
    const completedJob = makeJob({
      status: 'COMPLETED',
      attempts: 1,
      resultData: { riskLevel: 'HIGH', reminderCreated: true },
      finishedAt: new Date(),
    });

    const mockRepo = {
      createDomainEventWithDedup: vi
        .fn()
        .mockResolvedValue({ event: initialEvent, deduplicated: false }),
      markDomainEventProcessed: vi.fn().mockResolvedValue(processedEvent),
      markDomainEventFailedOrDeadLetter: vi.fn(),
      createBackgroundJobWithDedup: vi
        .fn()
        .mockResolvedValue({ job: queuedJob, deduplicated: false }),
      attachExternalJobId: vi.fn(),
      markJobRunning: vi.fn().mockResolvedValue(makeJob({ status: 'RUNNING', attempts: 1 })),
      markJobCompleted: vi.fn().mockResolvedValue(completedJob),
      markJobFailedOrDeadLetter: vi.fn(),
    };

    const jobRunner = vi.fn().mockResolvedValue({ riskLevel: 'HIGH', reminderCreated: true });
    const remoteDispatcher = vi
      .fn()
      .mockResolvedValue({ dispatched: false, externalJobId: null, mode: 'IN_PROCESS_FALLBACK' });

    const service = new EventsService(mockRepo as never, jobRunner, remoteDispatcher);
    const result = await service.ingestEvent({
      userId: 'user-1',
      eventType: 'TASK_MISSED',
      source: 'SCHEDULER',
      payload: { taskId: 'task-1', title: 'Submit tax filing' },
      idempotencyKey: 'task-missed:user-1:task-1:2026-11-12',
    });

    expect(result.deduplicated).toBe(false);
    expect(result.event.status).toBe('PROCESSED');
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]?.status).toBe('COMPLETED');
    expect(jobRunner).toHaveBeenCalledTimes(1);
    expect(mockRepo.markJobCompleted).toHaveBeenCalledWith(
      queuedJob.id,
      { riskLevel: 'HIGH', reminderCreated: true },
      undefined
    );
  });

  it('deduplicates repeated ingestEvent calls with the same idempotencyKey', async () => {
    const existingEvent = makeEvent({ status: 'PROCESSED' });
    const mockRepo = {
      createDomainEventWithDedup: vi.fn().mockResolvedValue({
        event: existingEvent,
        deduplicated: true,
      }),
      createBackgroundJobWithDedup: vi.fn(),
    };

    const jobRunner = vi.fn();
    const service = new EventsService(mockRepo as never, jobRunner);

    const result = await service.ingestEvent({
      userId: 'user-1',
      eventType: 'TASK_MISSED',
      source: 'SCHEDULER',
      payload: { taskId: 'task-1' },
      idempotencyKey: 'task-missed:user-1:task-1:2026-11-12',
    });

    expect(result.deduplicated).toBe(true);
    expect(result.jobs).toHaveLength(0);
    expect(mockRepo.createBackgroundJobWithDedup).not.toHaveBeenCalled();
    expect(jobRunner).not.toHaveBeenCalled();
  });

  it('dispatches via Trigger.dev when configured and stores externalJobId', async () => {
    const queuedJob = makeJob({ jobType: 'AGENT_RUN' });
    const trackedJob = makeJob({ jobType: 'AGENT_RUN', externalJobId: 'run_trig_123' });

    const mockRepo = {
      createBackgroundJobWithDedup: vi
        .fn()
        .mockResolvedValue({ job: queuedJob, deduplicated: false }),
      attachExternalJobId: vi.fn().mockResolvedValue(trackedJob),
    };

    const jobRunner = vi.fn();
    const remoteDispatcher = vi.fn().mockResolvedValue({
      dispatched: true,
      externalJobId: 'run_trig_123',
      mode: 'TRIGGER_DEV',
    });

    const service = new EventsService(mockRepo as never, jobRunner, remoteDispatcher);
    const result = await service.dispatchJob({
      userId: 'user-1',
      jobType: 'AGENT_RUN',
      payload: { prompt: 'Prepare weekly reflection' },
    });

    expect(result.dispatchMode).toBe('TRIGGER_DEV');
    expect(result.job.externalJobId).toBe('run_trig_123');
    expect(jobRunner).not.toHaveBeenCalled();
  });

  it('transitions failing job toward DEAD_LETTER and allows retry once reset', async () => {
    const failedJob = makeJob({ status: 'DEAD_LETTER', attempts: 3, maxAttempts: 3 });
    const requeuedJob = makeJob({ status: 'QUEUED', attempts: 3, maxAttempts: 3 });
    const completedJob = makeJob({ status: 'COMPLETED', attempts: 4, maxAttempts: 3 });

    const mockRepo = {
      findBackgroundJobByIdAndUserId: vi.fn().mockResolvedValue(failedJob),
      requeueJob: vi.fn().mockResolvedValue(requeuedJob),
      markJobRunning: vi.fn().mockResolvedValue(makeJob({ status: 'RUNNING', attempts: 4 })),
      markJobCompleted: vi.fn().mockResolvedValue(completedJob),
      markJobFailedOrDeadLetter: vi.fn(),
    };

    const jobRunner = vi.fn().mockResolvedValue({ recovered: true });
    const service = new EventsService(mockRepo as never, jobRunner);

    const retried = await service.retryJob(failedJob.id, 'user-1');
    expect(mockRepo.requeueJob).toHaveBeenCalledWith(failedJob.id);
    expect(retried.status).toBe('COMPLETED');
  });

  it('rejects retrying a COMPLETED job and isolates cross-user job access', async () => {
    const mockRepo = {
      findBackgroundJobByIdAndUserId: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeJob({ status: 'COMPLETED' })),
    };

    const service = new EventsService(mockRepo as never);

    await expect(service.getJobById('missing-id', 'user-1')).rejects.toBeInstanceOf(AppError);
    await expect(
      service.retryJob('22222222-2222-2222-2222-222222222222', 'user-1')
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'JOB_RETRY_CONFLICT',
    });
  });
});
