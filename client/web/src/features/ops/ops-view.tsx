'use client';

import { Activity, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { FormEvent, useCallback, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { eventsApi } from '@/lib/v3-api';

export function OpsView() {
  const [eventType, setEventType] = useState('DAILY_REVIEW_REQUESTED');
  const [source, setSource] = useState('WEB_CONSOLE');
  const [payloadText, setPayloadText] = useState('{"reason":"Manual check-in"}');
  const [sweeping, setSweeping] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchOps = useCallback(async () => {
    const [subscriptions, events, jobs] = await Promise.all([
      eventsApi.listSubscriptions(),
      eventsApi.listEvents(25),
      eventsApi.listJobs(25),
    ]);
    return { subscriptions, events, jobs };
  }, []);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchOps,
    'Failed to load background autonomy telemetry'
  );

  const subscriptions = data?.subscriptions ?? [];
  const events = data?.events ?? [];
  const jobs = data?.jobs ?? [];

  const handleIngest = async (event: FormEvent) => {
    event.preventDefault();
    setIngesting(true);
    setNotice(null);
    try {
      const parsedPayload = JSON.parse(payloadText || '{}') as Record<string, unknown>;
      const res = await eventsApi.ingestEvent({
        eventType: eventType.trim(),
        source: source.trim() || 'WEB_CONSOLE',
        payload: parsedPayload,
        dispatchImmediately: true,
      });
      setNotice(
        res.deduplicated
          ? 'Event deduplicated cleanly via idempotency key.'
          : `Ingested ${res.event.eventType}; routed ${res.jobs.length} background job(s).`
      );
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to ingest domain event');
    } finally {
      setIngesting(false);
    }
  };

  const handleRecoverySweep = async () => {
    setSweeping(true);
    setNotice(null);
    try {
      const result = await eventsApi.runRecoverySweep();
      setNotice(
        `Sweep completed: ${result.expiredApprovals} approvals expired, ${result.prunedMemories} memories pruned, ${result.jobsDeadLettered} dead-lettered.`
      );
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Recovery sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      await eventsApi.retryJob(jobId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to retry background job');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Background Autonomy & Event Ops
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Trigger.dev subscription routing, idempotent DomainEvent streams, job retries, and stalled-run recovery.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reload}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="dark" onClick={handleRecoverySweep} disabled={sweeping}>
            <ShieldCheck className="h-4 w-4 text-orange-400" />
            {sweeping ? 'Sweeping...' : 'Run Recovery Sweep'}
          </Button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">Ingest Domain Event</h2>
          </div>
          <form onSubmit={handleIngest} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className={inputClassName}
              >
                {subscriptions.map((rule) => (
                  <option key={rule.eventType} value={rule.eventType}>
                    {rule.eventType}
                  </option>
                ))}
                {subscriptions.length === 0 && (
                  <option value="DAILY_REVIEW_REQUESTED">DAILY_REVIEW_REQUESTED</option>
                )}
              </select>
              <input
                type="text"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Source"
                className={inputClassName}
              />
            </div>
            <textarea
              rows={2}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              placeholder='{"taskId":"..."}'
              className={`font-mono text-xs ${inputClassName}`}
            />
            <Button type="submit" disabled={ingesting}>
              {ingesting ? 'Dispatching...' : 'Ingest & Route Event'}
            </Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">Subscription Routing Rules</h2>
          </div>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-neutral-500">Loading subscription rules...</p>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((rule) => (
                <div
                  key={rule.eventType}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold text-neutral-950">{rule.eventType}</span>
                    <Badge tone="orange">{rule.jobType}</Badge>
                  </div>
                  <p className="mt-1 text-neutral-600">{rule.description}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-base font-bold text-neutral-950">Domain Event Stream</h2>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading domain events...</p>
          ) : events.length === 0 ? (
            <EmptyState
              title="No domain events ingested"
              description="Task completions, missed-task scans, and webhook events appear here."
            />
          ) : (
            <div className="space-y-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="break-all font-mono font-bold text-neutral-950">{evt.eventType}</p>
                    <p className="text-neutral-500">Source: {evt.source}</p>
                  </div>
                  <Badge
                    tone={
                      evt.status === 'PROCESSED'
                        ? 'green'
                        : evt.status === 'PENDING'
                          ? 'orange'
                          : 'red'
                    }
                  >
                    {evt.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h2 className="text-base font-bold text-neutral-950">Background Job Queue</h2>
          {jobs.length === 0 ? (
            <EmptyState
              title="No background jobs queued"
              description="Trigger.dev and local fallback worker executions appear here."
            />
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="break-all font-mono font-bold text-neutral-950">{job.jobType}</p>
                    <p className="text-neutral-500 tabular-nums">
                      Attempts: {job.attempts}/{job.maxAttempts}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      tone={
                        job.status === 'COMPLETED'
                          ? 'green'
                          : job.status === 'QUEUED' || job.status === 'RUNNING'
                            ? 'orange'
                            : 'red'
                      }
                    >
                      {job.status}
                    </Badge>
                    {(job.status === 'FAILED' || job.status === 'DEAD_LETTER') && (
                      <Button
                        variant="secondary"
                        onClick={() => handleRetryJob(job.id)}
                        className="px-2.5 py-1 text-xs"
                      >
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

