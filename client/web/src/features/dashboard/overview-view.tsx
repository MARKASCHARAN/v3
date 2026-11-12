'use client';

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Bot,
  Calendar,
  CheckCircle2,
  Flag,
  Flame,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Terminal,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  MotionStaggerGrid,
  MotionStaggerItem,
} from '@/components/ui/motion';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { useAuthSession } from '@/lib/auth-storage';
import { accountabilityApi, automationApi, schedulingApi, tasksApi } from '@/lib/v3-api';
import { InterventionGenerationResult } from '@/types/api';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function OverviewView() {
  const session = useAuthSession();
  const operatorName =
    session?.user?.name || (session?.user?.email ? session.user.email.split('@')[0] : 'Operator');
  const [utcClock, setUtcClock] = useState('--:--:-- UTC');
  const [intentInput, setIntentInput] = useState('');
  const [intentSubmitting, setIntentSubmitting] = useState(false);
  const [intentFeedback, setIntentFeedback] = useState<string | null>(null);

  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [scanning, setScanning] = useState(false);
  const [generatingInterventions, setGeneratingInterventions] = useState(false);
  const [interventionsResult, setInterventionsResult] =
    useState<InterventionGenerationResult | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcClock(`${h}:${m}:${s} UTC`);
    };
    const initial = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const fetchOverview = useCallback(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [summary, missedTasks, reminders, logs, todayBlocks, procrastination] =
      await Promise.all([
        accountabilityApi.getSummary(),
        accountabilityApi.getMissedTasks(),
        accountabilityApi.listReminders(),
        accountabilityApi.listLogs(),
        schedulingApi.listBlocks({
          from: startOfDay.toISOString(),
          to: endOfDay.toISOString(),
        }),
        accountabilityApi.getProcrastination(),
      ]);

    return { summary, missedTasks, reminders, logs, todayBlocks, procrastination };
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
  const procrastination = data?.procrastination ?? null;
  const openLogs = logs.filter((l) => l.status !== 'RESOLVED');

  const handleDispatchIntent = async (event: FormEvent) => {
    event.preventDefault();
    if (!intentInput.trim()) return;
    setIntentSubmitting(true);
    setIntentFeedback(null);
    try {
      const result = await automationApi.run({
        prompt: intentInput.trim(),
        agentRole: 'MAIN_ORCHESTRATOR',
        sessionId: 'overview-capture',
        maxSteps: 5,
      });
      setIntentFeedback(
        result.status === 'AWAITING_APPROVAL'
          ? 'Intent queued — approval signature requested in AI Command Center.'
          : result.responseText || 'Synthesized intent executed by V3 Orchestrator.'
      );
      setIntentInput('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to dispatch intent');
    } finally {
      setIntentSubmitting(false);
    }
  };

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
    if (!reminderTitle.trim() || !reminderAt) return;
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

  const handleCompleteMissedTask = async (taskId: string) => {
    try {
      await tasksApi.update(taskId, { status: 'DONE' });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to complete task');
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

  const handleGenerateInterventions = async () => {
    setGeneratingInterventions(true);
    try {
      const result = await accountabilityApi.generateInterventions({
        maxInterventions: 4,
        createReminders: false,
        logAlerts: true,
      });
      setInterventionsResult(result);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to generate interventions');
    } finally {
      setGeneratingInterventions(false);
    }
  };

  const efficiencyRate = summary?.tasks.completionRate ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl bg-[#ffffff] p-6 shadow-xs lg:flex-row lg:items-end">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#ff6b35]/8 blur-3xl" />

        <div className="relative z-10 flex max-w-3xl flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ff6b35]/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-[#ab3500]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff6b35]" />
              Telemetry Stream Active
            </span>
            <span className="font-mono text-[11px] text-[#5f5e5e]">Node: v3-aether-primary</span>
          </div>

          <h1 className="text-2xl font-medium leading-tight tracking-tight text-[#1a1c1a] sm:text-4xl">
            Welcome back, {operatorName}. Workspace completion at{' '}
            <span className="font-semibold text-[#ab3500] tabular-nums">{efficiencyRate}%</span>.
          </h1>

          <p className="text-sm text-[#5f5e5e]">
            {summary
              ? `${summary.goals.active} active strategic goals, ${summary.tasks.overdue} overdue tasks, and ${summary.openAlerts} open accountability alerts in queue.`
              : 'Synchronizing real-time goals, time blocks, and adaptive accountability telemetry.'}
          </p>
        </div>

        <div className="relative z-10 flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f4f3f1] px-4 py-2.5 shadow-2xs sm:w-auto sm:gap-4 lg:self-end">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#5f5e5e]">
              Chrono Synchronizer
            </span>
            <span className="font-mono text-sm font-semibold tracking-wider text-[#1a1c1a] tabular-nums">
              {utcClock}
            </span>
          </div>
          <div className="hidden h-8 w-px bg-[#e3e2e0] sm:block" />
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#5f5e5e]">
              Risk Score
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff6b35]" />
              <span className="font-mono text-sm font-semibold text-[#ab3500] tabular-nums">
                {procrastination ? `${procrastination.riskScore}/100` : '--'}
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleScanMissedTasks}
            disabled={scanning}
            className="w-full py-1.5 text-xs sm:w-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Missed'}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl bg-[#ffffff] p-3 shadow-xs sm:p-4">
        <form onSubmit={handleDispatchIntent} className="flex w-full flex-col items-center gap-2 sm:flex-row">
          <div className="flex w-full flex-1 items-center gap-2.5 pl-2 text-[#ab3500]">
            <Terminal className="h-5 w-5 shrink-0" />
            <input
              type="text"
              value={intentInput}
              onChange={(e) => setIntentInput(e.target.value)}
              placeholder="Autonomous Capture Console: Summarize today's blockers, schedule 90m deep work, or review pending approvals..."
              className="w-full border-0 bg-transparent text-sm text-[#1a1c1a] placeholder:text-[#5f5e5e] focus:outline-none"
            />
          </div>
          <div className="flex w-full items-center gap-2 self-end sm:w-auto sm:self-center">
            <span className="hidden rounded-lg bg-[#f4f3f1] px-2 py-1 font-mono text-[11px] text-[#5f5e5e] md:inline-flex">
              Enter
            </span>
            <button
              type="submit"
              disabled={intentSubmitting}
              className="flex w-full items-center justify-center gap-1.5 rounded-full bg-[#ff6b35] px-5 py-2.5 text-sm font-semibold text-[#ffffff] shadow-xs transition-colors hover:bg-[#ab3500] disabled:opacity-50 sm:w-auto"
            >
              <span>{intentSubmitting ? 'Dispatching...' : 'Execute Intent'}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
        {intentFeedback && (
          <div className="mt-2 rounded-xl bg-[#f4f3f1] px-4 py-2 font-mono text-xs text-[#ab3500]">
            {intentFeedback}
          </div>
        )}
      </section>

      {error && <ErrorBanner message={error} />}

      {loading ? (
        <div className="rounded-2xl bg-[#ffffff] p-6 shadow-xs">
          <p className="text-sm text-[#5f5e5e]">Loading AETHER workspace telemetry...</p>
        </div>
      ) : (
        <div className="grid w-full grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="flex w-full flex-col gap-6 xl:col-span-8">
            <section className="flex flex-col gap-4 rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
              <div className="flex flex-col justify-between gap-2 pb-1 sm:flex-row sm:items-center">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                    System Diagnostics
                  </span>
                  <h2 className="text-xl font-medium tracking-tight text-[#1a1c1a]">
                    Telemetry &amp; Accountability
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#f4f3f1] px-3 py-1 font-mono text-[11px] text-[#5f5e5e] sm:self-auto">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ab3500]" />
                  Autonomy Policy Active
                </span>
              </div>

              <MotionStaggerGrid className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MotionStaggerItem>
                  <div className="flex h-full flex-col justify-between rounded-xl bg-[#f4f3f1] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#5f5e5e]">
                        Task Completion
                      </span>
                      <CheckCircle2 className="h-4 w-4 text-[#ab3500]" />
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-semibold tracking-tight text-[#1a1c1a] tabular-nums">
                        {summary?.tasks.completionRate ?? 0}%
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-medium text-[#ab3500]">
                      {summary?.tasks.completed ?? 0} of {summary?.tasks.total ?? 0} tasks done
                    </span>
                  </div>
                </MotionStaggerItem>

                <MotionStaggerItem>
                  <div className="flex h-full flex-col justify-between rounded-xl bg-[#f4f3f1] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#5f5e5e]">
                        Goal Progress
                      </span>
                      <Flag className="h-4 w-4 text-[#5f5e5e]" />
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-semibold tracking-tight text-[#1a1c1a] tabular-nums">
                        {summary?.goals.averageProgress ?? 0}%
                      </span>
                    </div>
                    <div className="my-1 h-1.5 w-full overflow-hidden rounded-full bg-[#e3e2e0]">
                      <div
                        className="h-full rounded-full bg-[#ff6b35]"
                        style={{ width: `${summary?.goals.averageProgress ?? 0}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-[#5f5e5e]">
                      {summary?.goals.active ?? 0} active / {summary?.goals.total ?? 0} goals
                    </span>
                  </div>
                </MotionStaggerItem>

                <MotionStaggerItem>
                  <div className="flex h-full flex-col justify-between rounded-xl bg-[#f4f3f1] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#5f5e5e]">
                        Action Overdue
                      </span>
                      <AlertTriangle className="h-4 w-4 text-[#ab3500]" />
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-semibold tracking-tight text-[#ab3500] tabular-nums">
                        {String(summary?.tasks.overdue ?? 0).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-[#5f5e5e]">Open alerts</span>
                      <span className="font-semibold text-[#ab3500]">
                        {summary?.openAlerts ?? 0} logged
                      </span>
                    </div>
                  </div>
                </MotionStaggerItem>

                <MotionStaggerItem>
                  <div className="flex h-full flex-col justify-between rounded-xl bg-[#f4f3f1] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#5f5e5e]">
                        Procrastination Index
                      </span>
                      <Flame className="h-4 w-4 text-[#5f5e5e]" />
                    </div>
                    <div className="my-2 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tracking-tight text-[#1a1c1a] tabular-nums">
                        {procrastination?.riskScore ?? 0}%
                      </span>
                      <span className="rounded bg-[#ffffff] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#5f5e5e]">
                        {procrastination?.riskLevel ?? 'LOW'}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#5f5e5e]">
                      {summary?.pendingReminders ?? 0} pending reminders
                    </span>
                  </div>
                </MotionStaggerItem>
              </MotionStaggerGrid>

              <div className="flex flex-col items-start justify-between gap-4 rounded-xl bg-[#f4f3f1] p-4 md:flex-row md:items-center">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#5f5e5e]">Signals Detected:</span>
                    <span className="font-mono font-semibold text-[#1a1c1a]">
                      {procrastination?.signals.length ?? 0}
                    </span>
                  </div>
                  <div className="hidden h-4 w-px bg-[#e3e2e0] sm:block" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#5f5e5e]">At-Risk Tasks:</span>
                    <span className="font-mono font-semibold text-[#ab3500]">
                      {procrastination?.atRiskTasks.length ?? 0}
                    </span>
                  </div>
                  <div className="hidden h-4 w-px bg-[#e3e2e0] sm:block" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[#5f5e5e]">Today&apos;s Blocks:</span>
                    <span className="font-mono font-semibold text-[#1a1c1a]">
                      {todayBlocks.length}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGenerateInterventions}
                  disabled={generatingInterventions}
                  className="inline-flex items-center justify-center gap-1.5 self-stretch rounded-full bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-[#ffffff] shadow-xs transition-all hover:bg-[#ab3500] disabled:opacity-50 md:self-auto"
                >
                  <Zap className="h-4 w-4" />
                  <span>{generatingInterventions ? 'Analyzing...' : 'Intervene'}</span>
                </button>
              </div>
            </section>

            <section className="flex flex-col gap-4 rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                    Chrono-Architecture
                  </span>
                  <h2 className="text-xl font-medium tracking-tight text-[#1a1c1a]">
                    Focus Cadence &amp; Execution Timeline
                  </h2>
                </div>
                <Link
                  href="/dashboard/schedule"
                  className="inline-flex items-center gap-1 font-mono text-xs font-medium text-[#ab3500] hover:underline"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Open Time Studio</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {todayBlocks.length === 0 ? (
                <EmptyState
                  title="No focus blocks scheduled today"
                  description="Allocate deep-work or review blocks in Time Studio to anchor your execution cadence."
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {todayBlocks.map((block, index) => {
                    const isFirst = index === 0;
                    return (
                      <div
                        key={block.id}
                        className={`flex flex-col justify-between gap-3 rounded-xl p-4 transition-colors sm:flex-row sm:items-center ${
                          isFirst
                            ? 'bg-[#ffffff] shadow-md ring-1 ring-[#ff6b35]'
                            : 'bg-[#f4f3f1] hover:bg-[#efeeeb]'
                        }`}
                      >
                        <div className="flex items-start gap-4 sm:items-center">
                          <div
                            className={`min-w-[64px] font-mono text-sm font-semibold tabular-nums ${
                              isFirst ? 'text-[#ab3500]' : 'text-[#5f5e5e]'
                            }`}
                          >
                            {formatTime(block.startTime)}
                          </div>
                          <div
                            className={`h-9 w-1.5 rounded-full ${
                              isFirst ? 'bg-[#ff6b35]' : 'bg-[#e3e2e0]'
                            }`}
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-[#1a1c1a]">
                                {block.title}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                  isFirst
                                    ? 'bg-[#ff6b35]/10 text-[#ab3500]'
                                    : 'bg-[#e3e2e0] text-[#594139]'
                                }`}
                              >
                                {block.category}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-[#5f5e5e]">
                              {block.description || `${formatTime(block.startTime)} – ${formatTime(block.endTime)}`}
                            </p>
                          </div>
                        </div>
                        <Badge tone={block.status === 'COMPLETED' ? 'green' : isFirst ? 'orange' : 'neutral'}>
                          {block.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-4 rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                    Triage Queue
                  </span>
                  <h2 className="text-xl font-medium tracking-tight text-[#1a1c1a]">
                    Missed Tasks &amp; Latency Resolution
                  </h2>
                </div>
                <span className="rounded-full bg-[#ff6b35]/10 px-2.5 py-1 font-mono text-[11px] font-semibold text-[#ab3500]">
                  {missedTasks.length + openLogs.length} Pending Attention
                </span>
              </div>

              {missedTasks.length === 0 && openLogs.length === 0 ? (
                <EmptyState
                  title="Triage queue clear"
                  description="Zero overdue tasks or unresolved accountability alerts."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {missedTasks.slice(0, 4).map((task) => (
                    <div
                      key={task.id}
                      className="flex flex-col justify-between gap-3 rounded-xl bg-[#f4f3f1] p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="font-semibold uppercase text-[#ad3300]">
                            {task.priority} PRIORITY
                          </span>
                          <span className="text-[#5f5e5e]">
                            Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-[#1a1c1a]">{task.title}</h3>
                        <p className="text-xs text-[#5f5e5e]">
                          {task.description || 'Missed scheduled window — complete or delegate.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCompleteMissedTask(task.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#ff6b35] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#ffffff] transition-colors hover:bg-[#ab3500]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Mark Done</span>
                        </button>
                        <Link
                          href="/dashboard/assistant"
                          className="inline-flex items-center gap-1 rounded-lg bg-[#ffffff] px-2.5 py-1.5 font-mono text-[11px] text-[#1a1c1a] transition-colors hover:bg-[#e9e8e5]"
                        >
                          <Bot className="h-3.5 w-3.5 text-[#ab3500]" />
                          <span>Delegate to Agent</span>
                        </Link>
                      </div>
                    </div>
                  ))}

                  {openLogs.slice(0, 2).map((log) => (
                    <div
                      key={log.id}
                      className="flex flex-col justify-between gap-3 rounded-xl bg-[#f4f3f1] p-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px]">
                          <span className="font-semibold uppercase text-[#5f5e5e]">{log.type}</span>
                          <span className="text-[#ab3500]">{log.status}</span>
                        </div>
                        <p className="text-sm font-semibold text-[#1a1c1a]">
                          {log.notes || 'Accountability check-in logged'}
                        </p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => handleResolveLog(log.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#1a1c1a] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#ffffff] hover:bg-[#2f312f]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Resolve Alert</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="flex w-full flex-col gap-6 xl:col-span-4">
            <section className="flex flex-col gap-4 rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                    Autonomous Feeds
                  </span>
                  <h2 className="text-xl font-medium tracking-tight text-[#1a1c1a]">
                    Active Interventions
                  </h2>
                </div>
                <span className="h-2.5 w-2.5 animate-ping rounded-full bg-[#ff6b35]" />
              </div>

              {interventionsResult && interventionsResult.interventions.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {interventionsResult.interventions.map((item, idx) => (
                    <div
                      key={`${item.action}-${idx}`}
                      className="flex flex-col gap-1.5 rounded-xl border-l-4 border-l-[#ff6b35] bg-[#f4f3f1] p-4"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-semibold uppercase text-[#ab3500]">
                          {item.action}
                        </span>
                        <span className="text-[#5f5e5e]">{item.severity}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#1a1c1a]">{item.title}</p>
                      <p className="text-xs text-[#594139]">{item.rationale}</p>
                    </div>
                  ))}
                </div>
              ) : procrastination && procrastination.signals.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {procrastination.signals.slice(0, 3).map((signal, idx) => (
                    <div
                      key={`${signal.type}-${idx}`}
                      className="flex flex-col gap-1.5 rounded-xl border-l-4 border-l-[#ad3300] bg-[#f4f3f1] p-4"
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="font-semibold text-[#ad3300]">{signal.type}</span>
                        <span className="text-[#5f5e5e]">+{signal.points} risk</span>
                      </div>
                      <p className="text-xs font-medium text-[#1a1c1a]">{signal.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-[#f4f3f1] p-4 text-xs text-[#5f5e5e]">
                  No drift signals detected. Click <strong className="text-[#1a1c1a]">Intervene</strong> in Telemetry to synthesize proactive AI schedule optimizations.
                </div>
              )}

              <Link
                href="/dashboard/assistant"
                className="flex items-center justify-between rounded-xl bg-[#2f312f] px-4 py-3 text-xs font-medium text-[#ffffff] transition-colors hover:bg-[#1a1c1a]"
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#ff6b35]" />
                  Open AI Command Center
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <section className="flex flex-col gap-4 rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                    Chrono Triggers
                  </span>
                  <h2 className="text-xl font-medium tracking-tight text-[#1a1c1a]">
                    Quick Reminder
                  </h2>
                </div>
                <ShieldAlert className="h-4 w-4 text-[#ab3500]" />
              </div>

              <form onSubmit={handleCreateReminder} className="space-y-3">
                <input
                  type="text"
                  required
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="Reminder title..."
                  className={inputClassName}
                />
                <input
                  type="datetime-local"
                  required
                  value={reminderAt}
                  onChange={(e) => setReminderAt(e.target.value)}
                  className={inputClassName}
                />
                <Button type="submit" className="w-full">
                  <Plus className="h-4 w-4" />
                  Schedule Reminder
                </Button>
              </form>

              {reminders.length > 0 && (
                <div className="space-y-2 border-t border-[#e9e8e5] pt-3">
                  {reminders.slice(0, 4).map((rem) => (
                    <div
                      key={rem.id}
                      className="flex items-center justify-between rounded-xl bg-[#f4f3f1] px-3 py-2.5"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-xs font-semibold text-[#1a1c1a]">{rem.title}</p>
                        <p className="font-mono text-[10px] text-[#5f5e5e]">
                          {new Date(rem.remindAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={rem.status === 'PENDING' ? 'orange' : 'green'}>
                        {rem.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      )}

      <footer className="flex flex-col items-start justify-between gap-3 overflow-hidden rounded-2xl bg-[#ffffff] p-4 shadow-xs md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#ff6b35]" />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#5f5e5e]">
            Multi-Thread Orchestration Stream
          </span>
        </div>
        <div className="flex w-full items-center gap-3 overflow-x-auto py-0.5 font-mono text-[11px] text-[#594139]">
          <div className="flex shrink-0 items-center gap-1.5 rounded bg-[#f4f3f1] px-2.5 py-1">
            <span className="text-[#5f5e5e]">[TASKS]</span>
            <span className="text-[#1a1c1a]">{summary?.tasks.total ?? 0} tracked</span>
            <span className="font-semibold text-[#ab3500]">LIVE</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded bg-[#f4f3f1] px-2.5 py-1">
            <span className="text-[#5f5e5e]">[GOALS]</span>
            <span className="text-[#1a1c1a]">{summary?.goals.active ?? 0} active ambitions</span>
            <span className="font-semibold text-[#1a1c1a]">SYNCED</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded bg-[#f4f3f1] px-2.5 py-1">
            <span className="text-[#5f5e5e]">[BLOCKS]</span>
            <span className="text-[#1a1c1a]">{todayBlocks.length} scheduled today</span>
            <span className="font-semibold text-[#ab3500]">ARMED</span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded bg-[#f4f3f1] px-2.5 py-1">
            <span className="text-[#5f5e5e]">[ALERTS]</span>
            <span className="text-[#1a1c1a]">{openLogs.length} unresolved</span>
            <span className="font-semibold text-[#1a1c1a]">WATCH</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
