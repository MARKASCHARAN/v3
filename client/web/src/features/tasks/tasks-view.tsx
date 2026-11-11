'use client';

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
import { goalsApi, tasksApi } from '@/lib/v3-api';
import { TaskPriority, TaskStatus } from '@/types/api';

const priorities: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const statuses: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED'];

const priorityTone = (priority: TaskPriority) => {
  if (priority === 'URGENT') return 'red';
  if (priority === 'HIGH') return 'amber';
  if (priority === 'MEDIUM') return 'blue';
  return 'neutral';
};

export function TasksView() {
  const [filterStatus, setFilterStatus] = useState('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [goalId, setGoalId] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');

  const fetchTasksData = useCallback(async () => {
    const [tasks, goals] = await Promise.all([
      tasksApi.list({
        ...(filterStatus ? { status: filterStatus as TaskStatus } : {}),
        ...(onlyOverdue ? { overdue: 'true' } : {}),
      }),
      goalsApi.list(),
    ]);
    return { tasks, goals };
  }, [filterStatus, onlyOverdue]);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchTasksData,
    'Failed to load tasks'
  );
  const tasks = data?.tasks ?? [];
  const goals = data?.goals ?? [];

  const handleCreateTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      return;
    }
    try {
      await tasksApi.create({
        title: title.trim(),
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        goalId: goalId || undefined,
        parentTaskId: parentTaskId || undefined,
      });
      setTitle('');
      setDueDate('');
      setParentTaskId('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create task');
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
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete task');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks & Subtasks</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage priorities, deadlines, goal links, subtasks, and completion statuses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyOverdue}
              onChange={(e) => setOnlyOverdue(e.target.checked)}
            />
            Overdue only
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`${inputClassName} w-auto`}
          >
            <option value="">All Statuses</option>
            {statuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <h2 className="mb-3 text-base font-semibold">New Task</h2>
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
          <div className="md:col-span-6">
            <Button type="submit">Create Task</Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <Card>
          <p className="text-sm text-slate-500">Loading tasks...</p>
        </Card>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="No tasks match current filters"
          description="Create a task above or clear your filters."
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Card key={task.id} className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      task.status === 'DONE' ? 'line-through opacity-60' : ''
                    }`}
                  >
                    {task.title}
                  </span>
                  <Badge tone={priorityTone(task.priority)}>{task.priority}</Badge>
                  <Badge tone={task.status === 'DONE' ? 'green' : 'neutral'}>{task.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">
                  {task.goal ? `Goal: ${task.goal.title} · ` : ''}
                  {task.dueDate
                    ? `Due: ${new Date(task.dueDate).toLocaleString()}`
                    : 'No deadline'}
                  {task.subtasks && task.subtasks.length > 0
                    ? ` · ${task.subtasks.length} subtask(s)`
                    : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={task.priority}
                  onChange={(e) => handleUpdatePriority(task.id, e.target.value as TaskPriority)}
                  className={`${inputClassName} w-auto py-1.5`}
                >
                  {priorities.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <select
                  value={task.status}
                  onChange={(e) => handleUpdateStatus(task.id, e.target.value as TaskStatus)}
                  className={`${inputClassName} w-auto py-1.5`}
                >
                  {statuses.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <Button variant="danger" onClick={() => handleDeleteTask(task.id)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
