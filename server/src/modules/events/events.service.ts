import { executeBackgroundJobLocally } from '../../jobs/event-jobs/event-router.job';
import { runDeadLetterAndStalledRecovery } from '../../jobs/recovery/dead-letter-recovery.job';
import { TRIGGER_TASK_IDS, triggerRemoteJob } from '../../jobs/trigger.client';
import { AppError } from '../../middleware/error.middleware';
import { EventsQueryFilter, EventsRepository, JobsQueryFilter } from './events.repository';
import {
  BackgroundJobRecord,
  BackgroundJobType,
  DispatchBackgroundJobParams,
  DomainEventRecord,
  EventSubscriptionRule,
  IngestDomainEventParams,
} from './events.types';

export const EVENT_SUBSCRIPTION_RULES: EventSubscriptionRule[] = [
  {
    eventType: 'TASK_MISSED',
    jobType: 'MISSED_TASK_EVENT_REACTION',
    description: 'Analyze procrastination signals and schedule follow-up reminder on missed tasks',
    autoEnqueue: true,
  },
  {
    eventType: 'DAILY_REVIEW_REQUESTED',
    jobType: 'DAILY_ACCOUNTABILITY_REVIEW',
    description: 'Run daily accountability review and expired ephemeral memory pruning',
    autoEnqueue: true,
  },
  {
    eventType: 'MISSED_TASK_SCAN_REQUESTED',
    jobType: 'MISSED_TASK_SCAN',
    description: 'Scan overdue tasks across workspace and emit deduplicated missed-task events',
    autoEnqueue: true,
  },
  {
    eventType: 'APPROVAL_EXPIRY_SWEEP_REQUESTED',
    jobType: 'APPROVAL_EXPIRY_SWEEP',
    description: 'Expire stale pending approvals and synchronize parent AI execution status',
    autoEnqueue: true,
  },
  {
    eventType: 'BACKGROUND_AGENT_REQUESTED',
    jobType: 'AGENT_RUN',
    description: 'Launch an autonomous background orchestrator or specialist execution',
    autoEnqueue: true,
  },
  {
    eventType: 'MEMORY_PRUNE_REQUESTED',
    jobType: 'MEMORY_PRUNE',
    description: 'Prune expired ephemeral memory entries for the user',
    autoEnqueue: true,
  },
];

export type BackgroundJobRunner = (
  job: Pick<
    BackgroundJobRecord,
    'id' | 'userId' | 'jobType' | 'payload' | 'domainEventId' | 'idempotencyKey'
  >
) => Promise<Record<string, unknown>>;

export type RemoteJobDispatcher = typeof triggerRemoteJob;

export class EventsService {
  constructor(
    private readonly eventsRepository: EventsRepository = new EventsRepository(),
    private readonly jobRunner: BackgroundJobRunner = executeBackgroundJobLocally,
    private readonly remoteDispatcher: RemoteJobDispatcher = triggerRemoteJob
  ) {}

  listSubscriptionRules(): EventSubscriptionRule[] {
    return EVENT_SUBSCRIPTION_RULES;
  }

  getMatchingRules(eventType: string): EventSubscriptionRule[] {
    return EVENT_SUBSCRIPTION_RULES.filter(
      (rule) => rule.eventType === eventType && rule.autoEnqueue
    );
  }

  async listEvents(userId: string, filters: EventsQueryFilter = {}) {
    return this.eventsRepository.findDomainEventsByUserId(userId, filters);
  }

  async getEventById(id: string, userId: string): Promise<DomainEventRecord> {
    const event = await this.eventsRepository.findDomainEventByIdAndUserId(id, userId);
    if (!event) {
      throw new AppError(404, 'Domain event not found', 'DOMAIN_EVENT_NOT_FOUND');
    }
    return event;
  }

  async listJobs(userId: string, filters: JobsQueryFilter = {}) {
    return this.eventsRepository.findBackgroundJobsByUserId(userId, filters);
  }

  async getJobById(id: string, userId: string): Promise<BackgroundJobRecord> {
    const job = await this.eventsRepository.findBackgroundJobByIdAndUserId(id, userId);
    if (!job) {
      throw new AppError(404, 'Background job not found', 'BACKGROUND_JOB_NOT_FOUND');
    }
    return job;
  }

  async ingestEvent(params: IngestDomainEventParams): Promise<{
    event: DomainEventRecord;
    deduplicated: boolean;
    jobs: BackgroundJobRecord[];
  }> {
    const { event, deduplicated } = await this.eventsRepository.createDomainEventWithDedup({
      userId: params.userId,
      eventType: params.eventType,
      source: params.source,
      payload: params.payload,
      idempotencyKey: params.idempotencyKey,
      maxAttempts: params.maxAttempts,
    });

    if (deduplicated) {
      return {
        event,
        deduplicated: true,
        jobs: [],
      };
    }

    const rules = this.getMatchingRules(params.eventType);
    const createdJobs: BackgroundJobRecord[] = [];

    try {
      for (const rule of rules) {
        const dispatched = await this.dispatchJob({
          userId: params.userId,
          jobType: rule.jobType,
          payload: params.payload,
          domainEventId: event.id,
          idempotencyKey: `event:${event.id}:job:${rule.jobType}`,
          executeImmediately: params.dispatchImmediately ?? true,
        });
        createdJobs.push(dispatched.job);
      }

      const processed = await this.eventsRepository.markDomainEventProcessed(event.id);
      return {
        event: processed,
        deduplicated: false,
        jobs: createdJobs,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Domain event routing failed';
      const failedEvent = await this.eventsRepository.markDomainEventFailedOrDeadLetter(
        event.id,
        message
      );
      return {
        event: failedEvent,
        deduplicated: false,
        jobs: createdJobs,
      };
    }
  }

  async emitSafe(params: IngestDomainEventParams): Promise<void> {
    try {
      await this.ingestEvent(params);
    } catch {
      return;
    }
  }

  async dispatchJob(params: DispatchBackgroundJobParams): Promise<{
    job: BackgroundJobRecord;
    deduplicated: boolean;
    dispatchMode: 'DEDUPLICATED' | 'TRIGGER_DEV' | 'EXECUTED_LOCALLY' | 'QUEUED_FOR_LATER';
  }> {
    const { job, deduplicated } = await this.eventsRepository.createBackgroundJobWithDedup({
      userId: params.userId,
      jobType: params.jobType,
      payload: params.payload,
      executionId: params.executionId,
      domainEventId: params.domainEventId,
      idempotencyKey: params.idempotencyKey,
      maxAttempts: params.maxAttempts,
      scheduledFor: params.scheduledFor,
    });

    if (deduplicated) {
      return {
        job,
        deduplicated: true,
        dispatchMode: 'DEDUPLICATED',
      };
    }

    const isFutureScheduled = Boolean(
      params.scheduledFor && params.scheduledFor.getTime() > Date.now()
    );
    if (isFutureScheduled || params.executeImmediately === false) {
      return {
        job,
        deduplicated: false,
        dispatchMode: 'QUEUED_FOR_LATER',
      };
    }

    const taskId = TRIGGER_TASK_IDS[params.jobType as BackgroundJobType];
    if (taskId) {
      const remoteResult = await this.remoteDispatcher(
        taskId,
        {
          jobId: job.id,
          userId: job.userId,
          jobType: job.jobType,
          domainEventId: job.domainEventId,
          ...(typeof job.payload === 'object' && job.payload !== null
            ? (job.payload as Record<string, unknown>)
            : {}),
        },
        {
          idempotencyKey: job.idempotencyKey ?? job.id,
        }
      );

      if (remoteResult.dispatched && remoteResult.externalJobId) {
        const updated = await this.eventsRepository.attachExternalJobId(
          job.id,
          remoteResult.externalJobId
        );
        return {
          job: updated,
          deduplicated: false,
          dispatchMode: 'TRIGGER_DEV',
        };
      }
    }

    const executed = await this.executeJobRecord(job);
    return {
      job: executed,
      deduplicated: false,
      dispatchMode: 'EXECUTED_LOCALLY',
    };
  }

  async executeJobRecord(job: BackgroundJobRecord): Promise<BackgroundJobRecord> {
    await this.eventsRepository.markJobRunning(job.id);
    try {
      const resultData = await this.jobRunner({
        id: job.id,
        userId: job.userId,
        jobType: job.jobType,
        payload: job.payload,
        domainEventId: job.domainEventId,
        idempotencyKey: job.idempotencyKey,
      });
      const executionId =
        typeof resultData.executionId === 'string' ? resultData.executionId : undefined;
      return this.eventsRepository.markJobCompleted(job.id, resultData, executionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Background job execution failed';
      return this.eventsRepository.markJobFailedOrDeadLetter(job.id, message);
    }
  }

  async retryJob(id: string, userId: string): Promise<BackgroundJobRecord> {
    const existing = await this.getJobById(id, userId);
    if (existing.status === 'RUNNING' || existing.status === 'COMPLETED') {
      throw new AppError(
        409,
        `Job cannot be retried while in status ${existing.status}`,
        'JOB_RETRY_CONFLICT'
      );
    }

    const requeued = await this.eventsRepository.requeueJob(existing.id);
    return this.executeJobRecord(requeued);
  }

  async runRecoverySweep(
    userId: string,
    options: {
      staleMinutes?: number;
      includeApprovalExpiry?: boolean;
      includeMemoryPrune?: boolean;
    } = {}
  ) {
    return runDeadLetterAndStalledRecovery({
      userId,
      staleMinutes: options.staleMinutes ?? 30,
      includeApprovalExpiry: options.includeApprovalExpiry ?? true,
      includeMemoryPrune: options.includeMemoryPrune ?? true,
    });
  }
}
