'use client';

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Flag,
  Lock,
  Plus,
  Search,
  SplitSquareVertical,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  inlineInputClassName,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { goalsApi, tasksApi } from '@/lib/v3-api';
import { Task, TaskPriority, TaskStatus } from '@/types/api';

const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];

const priorityTone = (priority: TaskPriority): 'red' | 'orange' | 'dark' | 'neutral' => {
  if (priority === 'URGENT') return 'red';
  if (priority === 'HIGH') return 'orange';
  if (priority === 'MEDIUM') return 'dark';
  return 'neutral';
};

export function TasksView() {
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [goalId, setGoalId] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const fetchTasksData = useCallback(async () => {
    const [tasks, goals] = await Promise.all([
      tasksApi.list({
        ...(onlyOverdue ? { overdue: 'true' } : {}),
      }),
      goalsApi.list(),
    ]);
    return { tasks, goals };
  }, [onlyOverdue]);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchTasksData,
    'Failed to load tasks'
  );
  const tasks = useMemo(() => data?.tasks ?? [], [data?.tasks]);
  const goals = useMemo(() => data?.goals ?? [], [data?.goals]);

  const counts = useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let blocked = 0;
    let done = 0;
    tasks.forEach((t) => {
      if (t.status === 'TODO') todo += 1;
      else if (t.status === 'IN_PROGRESS') inProgress += 1;
      else if (t.status === 'BLOCKED') blocked += 1;
      else if (t.status === 'DONE') done += 1;
    });
    const doneRate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;
    return {
      ALL: tasks.length,
      TODO: todo,
      IN_PROGRESS: inProgress,
      BLOCKED: blocked,
      DONE: done,
      doneRate,
    };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterStatus && t.status !== filterStatus) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (
        searchQuery.trim() &&
        !t.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, filterStatus, filterPriority, searchQuery]);

  const inspectedTask: Task | null = useMemo(() => {
    if (visibleTasks.length === 0) return tasks[0] ?? null;
    if (selectedTaskId) {
      const found = visibleTasks.find((t) => t.id === selectedTaskId);
      if (found) return found;
    }
    return visibleTasks[0];
  }, [visibleTasks, tasks, selectedTaskId]);

  const groupedSections: Array<{ status: TaskStatus; label: string; items: Task[] }> = useMemo(() => {
    const order: Array<{ status: TaskStatus; label: string }> = [
      { status: 'BLOCKED', label: 'BLOCKED' },
      { status: 'IN_PROGRESS', label: 'IN_PROGRESS' },
      { status: 'TODO', label: 'TODO' },
      { status: 'DONE', label: 'DONE' },
      { status: 'CANCELLED', label: 'CANCELLED' },
    ];
    return order
      .map((s) => ({
        status: s.status,
        label: s.label,
        items: visibleTasks.filter((t) => t.status === s.status),
      }))
      .filter((s) => s.items.length > 0);
  }, [visibleTasks]);

  const handleCreateTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      const created = await tasksApi.create({
        title: title.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        goalId: goalId || undefined,
        parentTaskId: parentTaskId || undefined,
      });
      setTitle('');
      setDueDate('');
      setParentTaskId('');
      setComposerOpen(false);
      setSelectedTaskId(created.id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create task');
    }
  };

  const handleAddSubtask = async (event: FormEvent) => {
    event.preventDefault();
    if (!inspectedTask || !newSubtaskTitle.trim()) return;
    try {
      await tasksApi.create({
        title: newSubtaskTitle.trim(),
        priority: inspectedTask.priority,
        parentTaskId: inspectedTask.id,
        goalId: inspectedTask.goalId || undefined,
      });
      setNewSubtaskTitle('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create subtask');
    }
  };

  const handleUpdateStatus = async (taskId: string, status: TaskStatus) => {
    try {
      await tasksApi.update(taskId, { status });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update task');
    }
  };

  const handleUpdatePriority = async (taskId: string, nextPriority: TaskPriority) => {
    try {
      await tasksApi.update(taskId, { priority: nextPriority });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update priority');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await tasksApi.remove(taskId);
      if (selectedTaskId === taskId) setSelectedTaskId(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete task');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase text-[#5f5e5e]">
                <span>Execution Core</span>
                <span>/</span>
                <span className="font-semibold text-[#ab3500]">Sprint Matrix</span>
              </div>
              <h1 className="text-2xl font-medium tracking-tight text-[#1a1c1a]">
                Execution Board
              </h1>
            </div>
            <div className="hidden h-8 w-px bg-[#e9e8e5] sm:block" />
            <div className="hidden items-center gap-2 rounded-full bg-[#f4f3f1] px-3 py-1 sm:flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff6b35]" />
              <span className="font-mono text-[11px] font-medium text-[#1a1c1a]">
                Auto-Sync Active
              </span>
              <span className="font-mono text-[11px] text-[#5f5e5e]">
                | {counts.IN_PROGRESS} active
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5f5e5e]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter tasks or subtasks..."
                className="w-full rounded-lg bg-[#f4f3f1] py-1.5 pl-9 pr-3 text-sm text-[#1a1c1a] placeholder:text-[#5f5e5e] focus:bg-[#ffffff] focus:outline-none focus:ring-1 focus:ring-[#1a1c1a]"
              />
            </div>

            <button
              type="button"
              onClick={() => setComposerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-[#ffffff] shadow-xs transition-colors hover:bg-[#ab3500]"
            >
              <Plus className="h-4 w-4" />
              <span>{composerOpen ? 'Close Composer' : 'Create Task'}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { key: '', label: 'All', count: counts.ALL },
              { key: 'TODO', label: 'TODO', count: counts.TODO },
              { key: 'IN_PROGRESS', label: 'IN_PROGRESS', count: counts.IN_PROGRESS },
              { key: 'BLOCKED', label: 'BLOCKED', count: counts.BLOCKED },
              { key: 'DONE', label: 'DONE', count: counts.DONE },
            ].map((pill) => {
              const active = filterStatus === pill.key;
              return (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setFilterStatus(pill.key)}
                  className={`rounded px-2.5 py-1 font-mono text-[11px] font-medium transition-colors ${
                    active
                      ? 'bg-[#2f312f] text-[#ffffff]'
                      : 'bg-[#f4f3f1] text-[#594139] hover:bg-[#efeeeb]'
                  }`}
                >
                  {pill.label} <span className="ml-1 opacity-75">{pill.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-[#f4f3f1] p-0.5">
              {(['', ...priorities] as const).map((p) => {
                const active = filterPriority === p;
                return (
                  <button
                    key={p || 'ALL_PRI'}
                    type="button"
                    onClick={() => setFilterPriority(p)}
                    className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-[#ffffff] text-[#ab3500] shadow-2xs'
                        : 'text-[#5f5e5e] hover:text-[#1a1c1a]'
                    }`}
                  >
                    {p || 'ALL PRI'}
                  </button>
                );
              })}
            </div>

            <label className="flex cursor-pointer select-none items-center gap-2 font-mono text-[11px] font-medium text-[#594139]">
              <input
                type="checkbox"
                checked={onlyOverdue}
                onChange={(e) => setOnlyOverdue(e.target.checked)}
                className="accent-[#ff6b35]"
              />
              <span>Overdue Only</span>
            </label>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-y-2 rounded-xl bg-[#f4f3f1] px-5 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase text-[#5f5e5e]">Sprint Load:</span>
            <span className="font-mono text-xs font-semibold text-[#1a1c1a]">
              {tasks.length} Tasks Tracked
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e9e8e5]">
              <div
                className="h-full rounded-full bg-[#ff6b35]"
                style={{ width: `${counts.doneRate}%` }}
              />
            </div>
            <span className="font-mono text-xs font-medium text-[#ab3500]">
              {counts.doneRate}% Completed
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] text-[#5f5e5e]">
          <span>Blocked: {counts.BLOCKED}</span>
          <span>•</span>
          <span>Goal Links: {goals.length}</span>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      {composerOpen && (
        <div className="rounded-2xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
          <div className="mb-3 flex items-center gap-2">
            <SplitSquareVertical className="h-4 w-4 text-[#ab3500]" />
            <h2 className="text-base font-bold text-[#1a1c1a]">Create Execution Task</h2>
          </div>
          <form onSubmit={handleCreateTask} className="grid gap-3 md:grid-cols-6">
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className={`${inputClassName} md:col-span-2`}
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className={inputClassName}
            >
              {priorities.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClassName}
            />
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className={inputClassName}
            >
              <option value="">No Goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  Goal: {g.title}
                </option>
              ))}
            </select>
            <select
              value={parentTaskId}
              onChange={(e) => setParentTaskId(e.target.value)}
              className={inputClassName}
            >
              <option value="">Top-level Task</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  Subtask of: {t.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2 md:col-span-6">
              <Button type="submit">
                <Plus className="h-4 w-4" />
                Save Task
              </Button>
              <Button type="button" variant="ghost" onClick={() => setComposerOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-[#ffffff] p-6 shadow-xs">
          <p className="text-sm text-[#5f5e5e]">Loading execution board...</p>
        </div>
      ) : visibleTasks.length === 0 ? (
        <EmptyState
          title="No tasks match current filters"
          description="Create a task above or clear your status/priority filters."
        />
      ) : (
        <div className="flex w-full flex-col items-start gap-5 xl:flex-row">
          <div className="flex w-full min-w-0 flex-1 flex-col gap-5">
            {groupedSections.map((section) => {
              const isBlocked = section.status === 'BLOCKED';
              const isInProgress = section.status === 'IN_PROGRESS';

              return (
                <div
                  key={section.status}
                  className="overflow-hidden rounded-xl bg-[#ffffff] shadow-xs"
                >
                  <div
                    className={`flex items-center justify-between px-4 py-3 ${
                      isBlocked
                        ? 'bg-[#ffdad6]/40'
                        : isInProgress
                          ? 'bg-[#ff6b35]/10'
                          : 'bg-[#f4f3f1]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isBlocked ? (
                        <AlertTriangle className="h-4 w-4 text-[#ba1a1a]" />
                      ) : isInProgress ? (
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff6b35]" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-[#5f5e5e]" />
                      )}
                      <span className="text-sm font-semibold tracking-tight text-[#1a1c1a]">
                        {section.label}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                          isBlocked
                            ? 'bg-[#ba1a1a] text-[#ffffff]'
                            : isInProgress
                              ? 'bg-[#ff6b35] text-[#ffffff]'
                              : 'bg-[#e3e2e0] text-[#594139]'
                        }`}
                      >
                        {section.items.length}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-[#e9e8e5]">
                    {section.items.map((task) => {
                      const selected = inspectedTask?.id === task.id;
                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`flex cursor-pointer flex-col justify-between gap-3 p-4 transition-colors sm:flex-row sm:items-center ${
                            selected ? 'bg-[#ffdbd0]/25' : 'hover:bg-[#f4f3f1]/60'
                          }`}
                        >
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            {isBlocked ? (
                              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#ba1a1a]" />
                            ) : (
                              <input
                                type="checkbox"
                                checked={task.status === 'DONE'}
                                onClick={(e) => e.stopPropagation()}
                                onChange={() =>
                                  handleUpdateStatus(
                                    task.id,
                                    task.status === 'DONE' ? 'TODO' : 'DONE'
                                  )
                                }
                                className="mt-1 h-4 w-4 cursor-pointer accent-[#ff6b35]"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                                <span
                                  className={`truncate text-sm font-semibold text-[#1a1c1a] ${
                                    task.status === 'DONE' ? 'line-through opacity-55' : ''
                                  }`}
                                >
                                  {task.title}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#5f5e5e]">
                                {task.goal && (
                                  <span className="text-[#ab3500]">Goal: {task.goal.title}</span>
                                )}
                                {task.dueDate && (
                                  <span>
                                    Due: {new Date(task.dueDate).toLocaleString()}
                                  </span>
                                )}
                                {task.subtasks && task.subtasks.length > 0 && (
                                  <span>{task.subtasks.length} subtask(s)</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex flex-wrap items-center gap-2 self-end sm:self-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleUpdateStatus(task.id, e.target.value as TaskStatus)
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
                              onClick={() => handleDeleteTask(task.id)}
                              title="Delete task"
                              className="rounded-lg p-1.5 text-[#5f5e5e] transition-colors hover:bg-[#ffdad6] hover:text-[#ba1a1a]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="sticky top-20 flex w-full shrink-0 flex-col gap-4 rounded-xl bg-[#ffffff] p-5 shadow-md xl:w-[420px]">
            {inspectedTask && (
              <>
                <div className="flex items-center justify-between border-b border-[#e9e8e5] pb-3">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="rounded bg-[#ff6b35] px-2 py-0.5 font-semibold text-[#ffffff]">
                      ACTIVE INSPECTOR
                    </span>
                    <span className="text-[#5f5e5e]">#{inspectedTask.id.slice(0, 8)}</span>
                  </div>
                  <Badge tone={priorityTone(inspectedTask.priority)}>
                    {inspectedTask.priority}
                  </Badge>
                </div>

                <div>
                  <h2 className="text-lg font-semibold leading-snug tracking-tight text-[#1a1c1a]">
                    {inspectedTask.title}
                  </h2>
                  {inspectedTask.description && (
                    <p className="mt-1 text-xs text-[#594139]">{inspectedTask.description}</p>
                  )}

                  {inspectedTask.goal && (
                    <div className="mt-3 flex items-center gap-2.5 rounded-lg bg-[#f4f3f1] p-2.5">
                      <Flag className="h-4 w-4 shrink-0 text-[#ab3500]" />
                      <div className="min-w-0">
                        <span className="block font-mono text-[10px] text-[#5f5e5e]">
                          Linked Strategic Goal
                        </span>
                        <span className="block truncate text-xs font-semibold text-[#1a1c1a]">
                          {inspectedTask.goal.title}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-lg bg-[#f4f3f1] p-3">
                    <span className="font-mono text-[10px] uppercase text-[#5f5e5e]">Status</span>
                    <select
                      value={inspectedTask.status}
                      onChange={(e) =>
                        handleUpdateStatus(inspectedTask.id, e.target.value as TaskStatus)
                      }
                      className="mt-1 w-full rounded bg-[#ffffff] px-2 py-1 font-mono text-xs font-semibold text-[#1a1c1a]"
                    >
                      {statuses.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg bg-[#f4f3f1] p-3">
                    <span className="font-mono text-[10px] uppercase text-[#5f5e5e]">Priority</span>
                    <select
                      value={inspectedTask.priority}
                      onChange={(e) =>
                        handleUpdatePriority(inspectedTask.id, e.target.value as TaskPriority)
                      }
                      className="mt-1 w-full rounded bg-[#ffffff] px-2 py-1 font-mono text-xs font-semibold text-[#ab3500]"
                    >
                      {priorities.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg bg-[#ff6b35]/10 p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff6b35] text-[#ffffff]">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-[#1a1c1a]">
                        Delegate to AI Specialist
                      </span>
                      <span className="font-mono text-[10px] text-[#594139]">
                        Run inside AI Command Center
                      </span>
                    </div>
                  </div>
                  <Link
                    href="/dashboard/assistant"
                    className="rounded-lg bg-[#2f312f] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#ffffff] hover:bg-[#1a1c1a]"
                  >
                    Open
                  </Link>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase text-[#5f5e5e]">
                    <span>Subtasks ({inspectedTask.subtasks?.length ?? 0})</span>
                    {inspectedTask.dueDate && (
                      <span className="inline-flex items-center gap-1 text-[#ab3500]">
                        <Clock className="h-3 w-3" />
                        {new Date(inspectedTask.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {inspectedTask.subtasks && inspectedTask.subtasks.length > 0 && (
                    <div className="space-y-1.5">
                      {inspectedTask.subtasks.map((sub) => (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between rounded-lg bg-[#f4f3f1] px-3 py-2 text-xs"
                        >
                          <label className="flex flex-1 cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={sub.status === 'DONE'}
                              onChange={() =>
                                handleUpdateStatus(sub.id, sub.status === 'DONE' ? 'TODO' : 'DONE')
                              }
                              className="accent-[#ff6b35]"
                            />
                            <span
                              className={
                                sub.status === 'DONE'
                                  ? 'text-[#5f5e5e] line-through'
                                  : 'text-[#1a1c1a]'
                              }
                            >
                              {sub.title}
                            </span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleAddSubtask} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add child subtask..."
                      className={inputClassName}
                    />
                    <Button type="submit" variant="dark">
                      Add
                    </Button>
                  </form>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
