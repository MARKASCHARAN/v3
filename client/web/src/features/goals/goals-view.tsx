'use client';

import { FormEvent, useCallback, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  ProgressBar,
  inlineInputClassName,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { goalsApi } from '@/lib/v3-api';
import { GoalStatus, GoalTimeframe } from '@/types/api';

const timeframes: GoalTimeframe[] = ['YEARLY', 'QUARTERLY', 'MONTHLY', 'WEEKLY', 'CUSTOM'];
const statuses: GoalStatus[] = ['ACTIVE', 'COMPLETED', 'PAUSED', 'ARCHIVED'];

export function GoalsView() {
  const [filterTimeframe, setFilterTimeframe] = useState<string>('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('CAREER');
  const [timeframe, setTimeframe] = useState<GoalTimeframe>('YEARLY');
  const [targetYear, setTargetYear] = useState('2026');
  const [parentGoalId, setParentGoalId] = useState('');
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
  const goals = data ?? [];

  const handleCreateGoal = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
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
    if (!milestoneTitle) {
      return;
    }
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goals & Milestones</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Organize yearly and hierarchical goals with milestone-driven progress calculation.
          </p>
        </div>

        <select
          value={filterTimeframe}
          onChange={(e) => setFilterTimeframe(e.target.value)}
          className={inlineInputClassName}
        >
          <option value="">All Timeframes</option>
          {timeframes.map((tf) => (
            <option key={tf} value={tf}>
              {tf}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <h2 className="mb-3 text-base font-semibold">New Goal</h2>
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
          <div className="md:col-span-6">
            <Button type="submit">Create Goal</Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading goals...</p>
        </Card>
      ) : goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Create your first yearly or quarterly goal above, or generate one in AI Planner."
        />
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => (
            <Card key={goal.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{goal.title}</h3>
                    <Badge tone="blue">{goal.timeframe}</Badge>
                    {goal.targetYear && <Badge>{goal.targetYear}</Badge>}
                    <Badge tone={goal.status === 'COMPLETED' ? 'green' : 'amber'}>
                      {goal.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Category: {goal.category}
                    {goal.parentGoal ? ` · Parent: ${goal.parentGoal.title}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={goal.status}
                    onChange={(e) => handleStatusChange(goal.id, e.target.value as GoalStatus)}
                    className={`${inlineInputClassName} py-1.5`}
                  >
                    {statuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <Button variant="danger" onClick={() => handleDeleteGoal(goal.id)}>
                    Delete
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                  <span>Progress</span>
                  <span>{goal.progress}%</span>
                </div>
                <ProgressBar value={goal.progress} />
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Milestones ({goal.milestones.length})
                </p>

                {goal.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
                  >
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                      <input
                        type="checkbox"
                        checked={m.isCompleted}
                        onChange={() => handleToggleMilestone(goal.id, m.id, m.isCompleted)}
                      />
                      <span className={m.isCompleted ? 'line-through opacity-60' : ''}>
                        {m.title}
                      </span>
                    </label>
                    <Button
                      variant="ghost"
                      onClick={() => handleDeleteMilestone(goal.id, m.id)}
                      className="px-2 py-1 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={milestoneInputs[goal.id] || ''}
                    onChange={(e) =>
                      setMilestoneInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))
                    }
                    placeholder="Add milestone..."
                    className={inputClassName}
                  />
                  <Button variant="secondary" onClick={() => handleAddMilestone(goal.id)}>
                    Add
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
