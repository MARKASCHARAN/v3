'use client';

import { CheckCircle2, Sparkles, Trash2 } from 'lucide-react';
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
import { goalsApi, planningApi } from '@/lib/v3-api';
import { GoalTimeframe } from '@/types/api';

const timeframes: GoalTimeframe[] = ['YEARLY', 'QUARTERLY', 'MONTHLY', 'WEEKLY', 'CUSTOM'];

export function PlanningView() {
  const [goalId, setGoalId] = useState('');
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [timeframe, setTimeframe] = useState<GoalTimeframe>('QUARTERLY');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generating, setGenerating] = useState(false);

  const fetchPlanningData = useCallback(async () => {
    const [plans, goals] = await Promise.all([planningApi.listPlans(), goalsApi.list()]);
    return { plans, goals };
  }, []);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchPlanningData,
    'Failed to load plans'
  );
  const plans = data?.plans ?? [];
  const goals = data?.goals ?? [];

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    if (!goalId && !goalTitle.trim()) {
      setError('Select an existing goal or enter a goal title.');
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      await planningApi.generatePlan({
        goalId: goalId || undefined,
        goalTitle: goalTitle.trim() || undefined,
        goalDescription: goalDescription.trim() || undefined,
        timeframe,
        additionalContext: additionalContext.trim() || undefined,
      });
      setGoalTitle('');
      setGoalDescription('');
      setAdditionalContext('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'AI plan generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyPlan = async (planId: string) => {
    try {
      await planningApi.applyPlan(planId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to apply plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await planningApi.removePlan(planId);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete plan');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
          AI Goal Decomposition Studio
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Decompose goals into milestones and suggested tasks, then materialize them transactionally.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          <h2 className="text-base font-bold text-neutral-950">Generate AI Plan</h2>
        </div>
        <form onSubmit={handleGenerate} className="grid gap-3 md:grid-cols-2">
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className={inputClassName}
          >
            <option value="">Create from new goal title below</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                Existing Goal: {g.title}
              </option>
            ))}
          </select>

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
            type="text"
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            placeholder="Goal title (required if no existing goal selected)"
            className={inputClassName}
          />

          <input
            type="text"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Constraints or focus notes (optional)"
            className={inputClassName}
          />

          <textarea
            rows={2}
            value={goalDescription}
            onChange={(e) => setGoalDescription(e.target.value)}
            placeholder="Goal description (optional)"
            className={`${inputClassName} md:col-span-2`}
          />

          <div className="md:col-span-2">
            <Button type="submit" disabled={generating}>
              <Sparkles className="h-4 w-4" />
              {generating ? 'Generating plan...' : 'Generate Plan with AI'}
            </Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-neutral-500">Loading plans...</p>
        </Card>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No plans yet"
          description="Generate a plan above to see suggested milestones and tasks."
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-neutral-950">{plan.title}</h3>
                    <Badge tone={plan.status === 'APPLIED' ? 'green' : 'orange'}>
                      {plan.status}
                    </Badge>
                    {plan.model && <Badge tone="dark">{plan.model}</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{plan.summary}</p>
                </div>

                <div className="flex gap-2">
                  {plan.status !== 'APPLIED' && (
                    <Button onClick={() => handleApplyPlan(plan.id)}>
                      <CheckCircle2 className="h-4 w-4" />
                      Apply to Goals & Tasks
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => handleDeletePlan(plan.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Suggested Milestones ({plan.milestonesData.length})
                  </p>
                  {plan.milestonesData.map((m, idx) => (
                    <div
                      key={`${plan.id}-m-${idx}`}
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm"
                    >
                      <p className="font-semibold text-neutral-950">
                        {m.order + 1}. {m.title}
                      </p>
                      {m.description && (
                        <p className="text-xs text-neutral-500">{m.description}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Suggested Tasks ({plan.tasksData.length})
                  </p>
                  {plan.tasksData.map((t, idx) => (
                    <div
                      key={`${plan.id}-t-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm"
                    >
                      <span className="font-medium text-neutral-900">{t.title}</span>
                      <Badge tone="orange">{t.priority}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
