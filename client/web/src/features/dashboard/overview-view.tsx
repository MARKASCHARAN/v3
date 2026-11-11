'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ProgressBar,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { accountabilityApi, schedulingApi } from '@/lib/v3-api';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function OverviewView() {
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [scanning, setScanning] = useState(false);

  const fetchOverview = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [summary, missedTasks, reminders, logs, todayBlocks] = await Promise.all([
      accountabilityApi.getSummary(),
      accountabilityApi.getMissedTasks(),
      accountabilityApi.listReminders(),
      accountabilityApi.listLogs(),
      schedulingApi.listBlocks({
        from: startOfDay.toISOString(),
        to: endOfDay.toISOString(),
      }),
    ]);

    return { summary, missedTasks, reminders, logs, todayBlocks };
  }, []);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchOverview,
    'Failed to load dashboard overview'
  );

  const summary = data?.summary ?? null;
  const missedTasks = data?.missedTasks ?? [];
  const reminders = data?.reminders ?? [];
  const logs = data?.logs ?? [];
  const todayBlocks = data?.todayBlocks ?? [];

  const handleScanMissedTasks = async () => {
    setScanning(true);
    try {
      await accountabilityApi.scanMissedTasks();
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to scan missed tasks');
    } finally {
      setScanning(false);
    }
  };

  const handleCreateReminder = async (event: FormEvent) => {
    event.preventDefault();
    if (!reminderTitle.trim() || !reminderAt) {
      return;
    }
    try {
      await accountabilityApi.createReminder({
        title: reminderTitle.trim(),
        remindAt: new Date(reminderAt).toISOString(),
      });
      setReminderTitle('');
      setReminderAt('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create reminder');
    }
  };

  const handleResolveLog = async (id: string) => {
    try {
      await accountabilityApi.updateLog(id, { status: 'RESOLVED' });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to resolve alert');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Progress & Overview</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track goal progress, task completion, schedule blocks, and accountability alerts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleScanMissedTasks} disabled={scanning}>
            {scanning ? 'Scanning...' : 'Scan Missed Tasks'}
          </Button>
          <Link href="/dashboard/planning">
            <Button>Open AI Planner</Button>
          </Link>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading workspace metrics...</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Task Completion
              </p>
              <p className="mt-2 text-2xl font-bold">{summary?.tasks.completionRate ?? 0}%</p>
              <div className="mt-3">
                <ProgressBar value={summary?.tasks.completionRate ?? 0} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {summary?.tasks.completed ?? 0} of {summary?.tasks.total ?? 0} tasks done
              </p>
            </Card>

            <Card>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Goal Progress
              </p>
              <p className="mt-2 text-2xl font-bold">{summary?.goals.averageProgress ?? 0}%</p>
              <div className="mt-3">
                <ProgressBar value={summary?.goals.averageProgress ?? 0} />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {summary?.goals.active ?? 0} active / {summary?.goals.total ?? 0} total goals
              </p>
            </Card>

            <Card>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Overdue Tasks
              </p>
              <p className="mt-2 text-2xl font-bold">{summary?.tasks.overdue ?? 0}</p>
              <p className="mt-3 text-xs text-slate-500">
                {summary?.openAlerts ?? 0} open accountability alerts
              </p>
            </Card>

            <Card>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Pending Reminders
              </p>
              <p className="mt-2 text-2xl font-bold">{summary?.pendingReminders ?? 0}</p>
              <p className="mt-3 text-xs text-slate-500">
                {todayBlocks.length} scheduled blocks today
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Today&apos;s Schedule</h2>
                <Link href="/dashboard/schedule" className="text-xs font-medium underline">
                  Manage calendar
                </Link>
              </div>
              {todayBlocks.length === 0 ? (
                <EmptyState
                  title="No blocks scheduled today"
                  description="Add time blocks on the Schedule page to structure your day."
                />
              ) : (
                <div className="space-y-2.5">
                  {todayBlocks.map((block) => (
                    <div
                      key={block.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800"
                    >
                      <div>
                        <p className="text-sm font-medium">{block.title}</p>
                        <p className="text-xs text-slate-500">
                          {formatTime(block.startTime)} – {formatTime(block.endTime)}
                        </p>
                      </div>
                      <Badge tone="blue">{block.category}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Missed Tasks & Alerts</h2>
                <Link href="/dashboard/tasks" className="text-xs font-medium underline">
                  View all tasks
                </Link>
              </div>

              {missedTasks.length === 0 && logs.filter((l) => l.status !== 'RESOLVED').length === 0 ? (
                <EmptyState
                  title="All caught up"
                  description="No overdue tasks or unresolved accountability alerts."
                />
              ) : (
                <div className="space-y-2.5">
                  {missedTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50/50 px-3 py-2 dark:border-rose-900/50 dark:bg-rose-950/20"
                    >
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-slate-500">
                          Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <Badge tone="red">{task.priority}</Badge>
                    </div>
                  ))}
                  {logs
                    .filter((l) => l.status !== 'RESOLVED')
                    .slice(0, 4)
                    .map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                      >
                        <div>
                          <p className="text-sm font-medium">{log.type}</p>
                          <p className="text-xs text-slate-500">{log.notes || 'Accountability log'}</p>
                        </div>
                        <Button variant="secondary" onClick={() => handleResolveLog(log.id)}>
                          Resolve
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="space-y-4">
            <h2 className="text-base font-semibold">Quick Reminder</h2>
            <form onSubmit={handleCreateReminder} className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                required
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="Reminder title"
                className={inputClassName}
              />
              <input
                type="datetime-local"
                required
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className={inputClassName}
              />
              <Button type="submit">Schedule Reminder</Button>
            </form>

            {reminders.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {reminders.slice(0, 6).map((rem) => (
                  <div
                    key={rem.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <div>
                      <p className="text-sm font-medium">{rem.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(rem.remindAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge tone={rem.status === 'PENDING' ? 'amber' : 'green'}>{rem.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
