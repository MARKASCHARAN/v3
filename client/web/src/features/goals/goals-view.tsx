'use client';

import {
  Check,
  ChevronDown,
  ChevronRight,
  Flag,
  GitBranch,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorBanner,
  inlineInputClassName,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { goalsApi } from '@/lib/v3-api';
import { Goal, GoalStatus, GoalTimeframe } from '@/types/api';

const timeframes: GoalTimeframe[] = ['YEARLY', 'QUARTERLY', 'MONTHLY', 'WEEKLY', 'CUSTOM'];
const statuses: GoalStatus[] = ['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED'];

export function GoalsView() {
  const [filterTimeframe, setFilterTimeframe] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<GoalStatus | 'ALL'>('ACTIVE');
  const [composerOpen, setComposerOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CAREER');
  const [timeframe, setTimeframe] = useState<GoalTimeframe>('YEARLY');
  const [targetYear, setTargetYear] = useState('2026');
  const [parentGoalId, setParentGoalId] = useState('');

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [milestoneInputs, setMilestoneInputs] = useState<Record<string, string>>({});

  const fetchGoals = useCallback(
    () =>
      goalsApi.list(
        filterTimeframe ? { timeframe: filterTimeframe as GoalTimeframe } : undefined
      ),
    [filterTimeframe]
  );

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchGoals,
    'Failed to load goals'
  );
  const goals = useMemo(() => data ?? [], [data]);

  const filteredGoals = useMemo(() => {
    if (filterStatus === 'ALL') return goals;
    return goals.filter((g) => g.status === filterStatus);
  }, [goals, filterStatus]);

  const inspectedGoal: Goal | null = useMemo(() => {
    if (filteredGoals.length === 0) return goals[0] ?? null;
    if (selectedGoalId) {
      const found = filteredGoals.find((g) => g.id === selectedGoalId);
      if (found) return found;
    }
    return filteredGoals[0];
  }, [filteredGoals, goals, selectedGoalId]);

  const metrics = useMemo(() => {
    const activeCount = goals.filter((g) => g.status === 'ACTIVE').length;
    const completedCount = goals.filter((g) => g.status === 'COMPLETED').length;
    const pausedCount = goals.filter((g) => g.status === 'PAUSED' || g.status === 'ARCHIVED').length;
    const totalMilestones = goals.reduce((acc, g) => acc + g.milestones.length, 0);
    const doneMilestones = goals.reduce(
      (acc, g) => acc + g.milestones.filter((m) => m.isCompleted).length,
      0
    );
    const milestoneRate =
      totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : 0;
    const avgProgress =
      goals.length > 0
        ? Math.round(goals.reduce((acc, g) => acc + g.progress, 0) / goals.length)
        : 0;
    return {
      activeCount,
      completedCount,
      pausedCount,
      totalMilestones,
      doneMilestones,
      milestoneRate,
      avgProgress,
    };
  }, [goals]);

  const toggleExpanded = (goalId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [goalId]: prev[goalId] === false,
    }));
  };

  const handleCreateGoal = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await goalsApi.create({
        title: title.trim(),
        category: category.trim() || 'GENERAL',
        timeframe,
        targetYear: targetYear ? Number(targetYear) : undefined,
        parentGoalId: parentGoalId || undefined,
      });
      setTitle('');
      setParentGoalId('');
      setComposerOpen(false);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create goal');
    }
  };

  const handleStatusChange = async (goalId: string, status: GoalStatus) => {
    try {
      await goalsApi.update(goalId, { status });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update goal status');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await goalsApi.remove(goalId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete goal');
    }
  };

  const handleAddMilestone = async (goalId: string) => {
    const milestoneTitle = (milestoneInputs[goalId] || '').trim();
    if (!milestoneTitle) return;
    try {
      await goalsApi.addMilestone(goalId, { title: milestoneTitle });
      setMilestoneInputs((prev) => ({ ...prev, [goalId]: '' }));
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to add milestone');
    }
  };

  const handleToggleMilestone = async (
    goalId: string,
    milestoneId: string,
    isCompleted: boolean
  ) => {
    try {
      await goalsApi.updateMilestone(goalId, milestoneId, { isCompleted: !isCompleted });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update milestone');
    }
  };

  const handleDeleteMilestone = async (goalId: string, milestoneId: string) => {
    try {
      await goalsApi.removeMilestone(goalId, milestoneId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete milestone');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
              <span className="font-semibold text-[#ab3500]">Strategic Decomposition</span>
              <span className="h-1 w-1 rounded-full bg-[#e3e2e0]" />
              <span className="text-[#5f5e5e]">Cycle Hierarchical Mesh</span>
            </div>
            <h1 className="text-2xl font-medium tracking-tight text-[#1a1c1a] sm:text-4xl">
              Strategic Goals &amp; Ambitions
            </h1>
            <p className="max-w-3xl text-sm text-[#594139]">
              Deconstruct multi-year visions into verified quarterly milestones and deterministic
              agent tasks with automatic progress rollup.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-xl bg-[#f4f3f1] p-1">
              {[
                { key: 'ACTIVE' as const, label: `Active (${metrics.activeCount})` },
                { key: 'COMPLETED' as const, label: `Complete (${metrics.completedCount})` },
                { key: 'PAUSED' as const, label: `Paused (${metrics.pausedCount})` },
                { key: 'ALL' as const, label: `All (${goals.length})` },
              ].map((tab) => {
                const active = filterStatus === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setFilterStatus(tab.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      active
                        ? 'bg-[#2f312f] text-[#ffffff] shadow-xs'
                        : 'text-[#5f5e5e] hover:text-[#1a1c1a]'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setComposerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#efeeeb] px-4 py-2 text-sm font-semibold text-[#1a1c1a] shadow-2xs transition-colors hover:bg-[#e9e8e5]"
            >
              <Plus className="h-4 w-4" />
              <span>{composerOpen ? 'Close Composer' : 'New Parent Goal'}</span>
            </button>

            <Link
              href="/dashboard/planning"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-[#ffffff] shadow-sm transition-opacity hover:opacity-95"
            >
              <Sparkles className="h-4 w-4" />
              <span>Decompose with AI Planner</span>
            </Link>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#e9e8e5] pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
              Horizon:
            </span>
            <button
              type="button"
              onClick={() => setFilterTimeframe('')}
              className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                filterTimeframe === ''
                  ? 'bg-[#ff6b35] text-[#ffffff] shadow-xs'
                  : 'text-[#5f5e5e] hover:bg-[#efeeeb] hover:text-[#1a1c1a]'
              }`}
            >
              ALL HORIZONS
            </button>
            {timeframes.map((tf) => {
              const selected = filterTimeframe === tf;
              return (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setFilterTimeframe(tf)}
                  className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                    selected
                      ? 'bg-[#ff6b35] text-[#ffffff] shadow-xs'
                      : 'text-[#5f5e5e] hover:bg-[#efeeeb] hover:text-[#1a1c1a]'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          <div className="hidden items-center gap-4 font-mono text-[11px] text-[#5f5e5e] md:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff6b35]" />
              Planner Sync: Deterministic Mesh
            </span>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {composerOpen && (
        <div className="rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <Target className="h-4 w-4 text-[#ab3500]" />
            <h2 className="text-base font-bold text-[#1a1c1a]">Create Strategic Goal</h2>
          </div>
          <form onSubmit={handleCreateGoal} className="grid gap-3 md:grid-cols-6">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Goal title"
              className={`${inputClassName} md:col-span-2`}
            />
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className={inputClassName}
            />
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as GoalTimeframe)}
              className={inputClassName}
            >
              {timeframes.map((tf) => (
                <option key={tf} value={tf}>
                  {tf}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={2000}
              max={2100}
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              placeholder="Year"
              className={inputClassName}
            />
            <select
              value={parentGoalId}
              onChange={(e) => setParentGoalId(e.target.value)}
              className={inputClassName}
            >
              <option value="">No Parent Goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  Parent: {g.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2 md:col-span-6">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Save Strategic Goal
              </Button>
              <Button type="button" variant="ghost" onClick={() => setComposerOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#ffffff] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#5f5e5e]">
            <span className="font-mono text-[11px] uppercase tracking-wider">Active Ambitions</span>
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-5xl font-semibold leading-none text-[#1a1c1a] tabular-nums">
              {String(metrics.activeCount).padStart(2, '0')}
            </span>
            <span className="font-mono text-[11px] font-semibold text-[#ab3500]">
              {goals.length} total
            </span>
          </div>
          <p className="mt-3 text-xs text-[#5f5e5e]">Tracked across active horizons</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#efeeeb]">
            <div className="h-full w-full bg-[#2f312f]" />
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#ffffff] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#5f5e5e]">
            <span className="font-mono text-[11px] uppercase tracking-wider">
              Milestone Execution Rate
            </span>
            <Check className="h-4 w-4 text-[#ab3500]" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-5xl font-semibold leading-none text-[#1a1c1a] tabular-nums">
              {metrics.milestoneRate}%
            </span>
          </div>
          <p className="mt-3 text-xs text-[#5f5e5e]">
            {metrics.doneMilestones} of {metrics.totalMilestones} milestones complete
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#efeeeb]">
            <div
              className="h-full bg-[#ff6b35]"
              style={{ width: `${metrics.milestoneRate}%` }}
            />
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#ffffff] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#5f5e5e]">
            <span className="font-mono text-[11px] uppercase tracking-wider">
              Mean Goal Progress
            </span>
            <Flag className="h-4 w-4 text-[#ab3500]" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-5xl font-semibold leading-none text-[#ab3500] tabular-nums">
              {metrics.avgProgress}%
            </span>
          </div>
          <p className="mt-3 text-xs text-[#5f5e5e]">Automatic milestone progress rollup</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#efeeeb]">
            <div className="h-full bg-[#ff6b35]" style={{ width: `${metrics.avgProgress}%` }} />
          </div>
        </div>

        <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-[#ffffff] p-5 shadow-xs">
          <div className="flex items-center justify-between text-[#5f5e5e]">
            <span className="font-mono text-[11px] uppercase tracking-wider">
              Completed Archive
            </span>
            <Target className="h-4 w-4" />
          </div>
          <div className="mt-4 flex items-baseline gap-2.5">
            <span className="text-5xl font-semibold leading-none text-[#1a1c1a] tabular-nums">
              {String(metrics.completedCount).padStart(2, '0')}
            </span>
            <span className="font-mono text-[11px] text-[#5f5e5e]">Finished</span>
          </div>
          <p className="mt-3 text-xs text-[#5f5e5e]">Ready for post-goal synthesis</p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#efeeeb]">
            <div className="h-full w-4/5 bg-[#2f312f]" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl bg-[#ffffff] p-6 shadow-xs">
          <p className="text-sm text-[#5f5e5e]">Loading strategic goal hierarchy...</p>
        </div>
      ) : filteredGoals.length === 0 ? (
        <EmptyState
          title="No goals match this filter"
          description="Create a new parent goal above or switch status filters to view completed goals."
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="flex flex-col gap-4 xl:col-span-8">
            {filteredGoals.map((goal) => {
              const isExpanded = expandedIds[goal.id] !== false;
              const isSelected = inspectedGoal?.id === goal.id;
              const doneCount = goal.milestones.filter((m) => m.isCompleted).length;

              return (
                <div
                  key={goal.id}
                  onClick={() => setSelectedGoalId(goal.id)}
                  className={`cursor-pointer overflow-hidden rounded-xl bg-[#ffffff] p-5 shadow-xs transition-all sm:p-6 ${
                    isSelected ? 'ring-1 ring-[#ff6b35]' : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(goal.id);
                        }}
                        className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f4f3f1] text-[#1a1c1a] hover:bg-[#efeeeb]"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-[#ff6b35] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#ffffff]">
                            {goal.timeframe}
                          </span>
                          <span className="rounded bg-[#efeeeb] px-2 py-0.5 font-mono text-[10px] text-[#594139]">
                            {goal.category}
                          </span>
                          {goal.targetYear && (
                            <span className="font-mono text-[11px] text-[#5f5e5e]">
                              Target: {goal.targetYear}
                            </span>
                          )}
                          {goal.parentGoal && (
                            <span className="font-mono text-[11px] text-[#ab3500]">
                              Parent: {goal.parentGoal.title}
                            </span>
                          )}
                        </div>
                        <h2 className="text-lg font-semibold text-[#1a1c1a]">{goal.title}</h2>
                        {goal.description && (
                          <p className="text-xs text-[#594139]">{goal.description}</p>
                        )}
                      </div>
                    </div>

                    <div
                      className="flex min-w-[140px] flex-row items-center justify-between gap-2 md:flex-col md:items-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-right">
                        <div className="text-lg font-semibold text-[#ab3500] tabular-nums">
                          {goal.progress}%
                        </div>
                        <div className="font-mono text-[11px] text-[#5f5e5e]">
                          {doneCount}/{goal.milestones.length} Milestones
                        </div>
                      </div>
                      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-[#efeeeb]">
                        <div
                          className="h-full rounded-full bg-[#ff6b35]"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div
                      className="mt-4 space-y-3 border-t border-[#e9e8e5] pt-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f4f3f1] px-3 py-2">
                        <span className="font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                          Milestones ({goal.milestones.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={goal.status}
                            onChange={(e) =>
                              handleStatusChange(goal.id, e.target.value as GoalStatus)
                            }
                            className={`${inlineInputClassName} py-1 text-xs`}
                          >
                            {statuses.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#ffdad6] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#93000a] hover:opacity-90"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {goal.milestones.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 rounded-lg bg-[#f4f3f1] px-3 py-2.5 transition-colors hover:bg-[#efeeeb]"
                          >
                            <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm text-[#1a1c1a]">
                              <input
                                type="checkbox"
                                checked={m.isCompleted}
                                onChange={() =>
                                  handleToggleMilestone(goal.id, m.id, m.isCompleted)
                                }
                                className="accent-[#ff6b35]"
                              />
                              <span className={m.isCompleted ? 'line-through opacity-60' : 'font-medium'}>
                                {m.title}
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleDeleteMilestone(goal.id, m.id)}
                              className="font-mono text-[11px] text-[#5f5e5e] hover:text-[#ba1a1a]"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={milestoneInputs[goal.id] || ''}
                          onChange={(e) =>
                            setMilestoneInputs((prev) => ({
                              ...prev,
                              [goal.id]: e.target.value,
                            }))
                          }
                          placeholder="Add concrete milestone..."
                          className={inputClassName}
                        />
                        <Button variant="dark" onClick={() => handleAddMilestone(goal.id)}>
                          Add
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <aside className="sticky top-20 flex flex-col gap-4 xl:col-span-4">
            {inspectedGoal && (
              <div className="flex flex-col gap-4 rounded-xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-[#ff6b35]" />
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#1a1c1a]">
                      Target Telemetry Inspector
                    </span>
                  </div>
                  <span className="rounded bg-[#efeeeb] px-2 py-0.5 font-mono text-[10px] text-[#5f5e5e]">
                    {inspectedGoal.timeframe}
                  </span>
                </div>

                <div className="space-y-1 rounded-lg bg-[#f4f3f1] p-3">
                  <span className="block font-mono text-[10px] uppercase text-[#5f5e5e]">
                    Currently Inspected
                  </span>
                  <span className="block text-sm font-semibold text-[#1a1c1a]">
                    {inspectedGoal.title}
                  </span>
                  <div className="flex items-center justify-between pt-1 font-mono text-[11px] text-[#5f5e5e]">
                    <span>Status: {inspectedGoal.status}</span>
                    <span className="font-semibold text-[#ab3500]">
                      {inspectedGoal.progress}% Progress
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-xl bg-[#ff6b35]/10 p-4">
                  <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#ab3500]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>AI Strategic Recommendation</span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#1a1c1a]">
                    Generate structured multi-step milestones and linked execution tasks for this
                    objective inside Strategic Planning.
                  </p>
                  <div className="pt-1">
                    <Link
                      href="/dashboard/planning"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff6b35] px-3 py-1.5 text-xs font-semibold text-[#ffffff] shadow-xs hover:bg-[#ab3500]"
                    >
                      <span>Open AI Planner</span>
                    </Link>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-[#5f5e5e]">
                    <span>Milestone Execution DAG</span>
                    <span className="text-[#ab3500]">
                      {inspectedGoal.milestones.length} Nodes
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#f4f3f1] p-3">
                    {inspectedGoal.milestones.length === 0 ? (
                      <p className="py-4 text-center font-mono text-xs text-[#5f5e5e]">
                        Add milestones to inspect dependency flow.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {inspectedGoal.milestones.slice(0, 4).map((m, idx) => (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 font-mono text-[11px] ${
                              m.isCompleted
                                ? 'bg-[#ffffff] text-[#5f5e5e]'
                                : 'bg-[#ffffff] ring-1 ring-[#ff6b35]/50 text-[#1a1c1a]'
                            }`}
                          >
                            <span className="truncate pr-2">
                              M{idx + 1}: {m.title}
                            </span>
                            <span className={m.isCompleted ? 'text-[#5f5e5e]' : 'font-semibold text-[#ab3500]'}>
                              {m.isCompleted ? 'DONE' : 'ACTIVE'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#e9e8e5] pt-3 font-mono text-[11px] text-[#5f5e5e]">
                  <span>{inspectedGoal.subGoals.length} linked sub-goals</span>
                  <button
                    type="button"
                    onClick={reload}
                    className="inline-flex items-center gap-1 hover:text-[#1a1c1a]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
