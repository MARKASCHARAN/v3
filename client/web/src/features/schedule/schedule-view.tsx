'use client';

import { Calendar, Clock, Trash2 } from 'lucide-react';
import { FormEvent, useCallback, useState, useSyncExternalStore } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  inlineInputClassName,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { goalsApi, schedulingApi, tasksApi } from '@/lib/v3-api';
import { AvailableSlot, TimeBlockCategory, TimeBlockStatus } from '@/types/api';

const categories: TimeBlockCategory[] = [
  'WORK',
  'DEEP_WORK',
  'MEETING',
  'PERSONAL',
  'HEALTH',
  'LEARNING',
  'BREAK',
];

const blockStatuses: TimeBlockStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'MISSED'];

const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalDayBounds = (dateValue: string) => {
  const [year = 1970, month = 1, day = 1] = dateValue.split('-').map(Number);
  return {
    dayStart: new Date(year, month - 1, day, 0, 0, 0, 0),
    dayEnd: new Date(year, month - 1, day, 23, 59, 59, 999),
  };
};

const toLocalDatetimeInput = (iso: string): string => {
  const date = new Date(iso);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const subscribeNoop = () => () => {};

const useLocalToday = (): string => {
  return useSyncExternalStore(
    subscribeNoop,
    () => toDateInputValue(new Date()),
    () => ''
  );
};

export function ScheduleView() {
  const clientToday = useLocalToday();
  const [selectedDateOverride, setSelectedDateOverride] = useState('');
  const selectedDate = selectedDateOverride || clientToday;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TimeBlockCategory>('DEEP_WORK');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [taskId, setTaskId] = useState('');
  const [goalId, setGoalId] = useState('');
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(60);

  const fetchSchedule = useCallback(async () => {
    if (!selectedDate) {
      return { blocks: [], slots: [], tasks: [], goals: [] };
    }
    const { dayStart, dayEnd } = toLocalDayBounds(selectedDate);

    const [blocks, slots, tasks, goals] = await Promise.all([
      schedulingApi.listBlocks({
        from: dayStart.toISOString(),
        to: dayEnd.toISOString(),
      }),
      schedulingApi.suggestSlots({
        date: selectedDate,
        durationMinutes,
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      }),
      tasksApi.list(),
      goalsApi.list(),
    ]);

    return { blocks, slots, tasks, goals };
  }, [selectedDate, durationMinutes]);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchSchedule,
    'Failed to load schedule'
  );
  const blocks = data?.blocks ?? [];
  const slots = data?.slots ?? [];
  const tasks = data?.tasks ?? [];
  const goals = data?.goals ?? [];

  const handleCreateBlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !startTime || !endTime) {
      return;
    }
    try {
      await schedulingApi.createBlock({
        title: title.trim(),
        category,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        taskId: taskId || undefined,
        goalId: goalId || undefined,
        allowOverlap,
      });
      setTitle('');
      setStartTime('');
      setEndTime('');
      setTaskId('');
      setGoalId('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create time block');
    }
  };

  const handleStatusChange = async (id: string, status: TimeBlockStatus) => {
    try {
      await schedulingApi.updateBlock(id, { status });
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to update block status');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    try {
      await schedulingApi.removeBlock(id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete time block');
    }
  };

  const handleUseSlot = (slot: AvailableSlot) => {
    setStartTime(toLocalDatetimeInput(slot.startTime));
    const endCap = new Date(
      Math.min(
        new Date(slot.endTime).getTime(),
        new Date(slot.startTime).getTime() + durationMinutes * 60000
      )
    );
    setEndTime(toLocalDatetimeInput(endCap.toISOString()));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Calendar & Time Blocks
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Schedule focused time blocks with automatic overlap checks and free-slot discovery.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDateOverride(e.target.value)}
            className={`w-full sm:w-auto ${inlineInputClassName}`}
          />
          <select
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
            className={`w-full sm:w-auto ${inlineInputClassName}`}
          >
            <option value={30}>30 min slots</option>
            <option value={60}>60 min slots</option>
            <option value={90}>90 min slots</option>
            <option value={120}>120 min slots</option>
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-orange-500" />
          <h2 className="text-base font-bold text-neutral-950">New Time Block</h2>
        </div>
        <form onSubmit={handleCreateBlock} className="grid gap-3 md:grid-cols-6">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Block title"
            className={`${inputClassName} md:col-span-2`}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TimeBlockCategory)}
            className={inputClassName}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={inputClassName}
          />
          <input
            type="datetime-local"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={inputClassName}
          />
          <select
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            className={inputClassName}
          >
            <option value="">Optional Task</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                Task: {t.title}
              </option>
            ))}
          </select>
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            className={`${inputClassName} md:col-span-2`}
          >
            <option value="">Optional Goal</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                Goal: {g.title}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 md:col-span-2">
            <input
              type="checkbox"
              checked={allowOverlap}
              onChange={(e) => setAllowOverlap(e.target.checked)}
              className="accent-orange-500"
            />
            Allow overlap with existing blocks
          </label>
          <div className="md:col-span-2">
            <Button type="submit" className="w-full">
              Schedule Block
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-bold text-neutral-950">
            Scheduled Blocks ({selectedDate})
          </h2>
          {loading ? (
            <Card>
              <p className="text-sm text-neutral-500">Loading schedule...</p>
            </Card>
          ) : blocks.length === 0 ? (
            <EmptyState
              title="No blocks on this date"
              description="Pick a free slot on the right or add a time block above."
            />
          ) : (
            blocks.map((block) => (
              <Card key={block.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-neutral-950">{block.title}</span>
                    <Badge tone="orange">{block.category}</Badge>
                    <Badge tone={block.status === 'COMPLETED' ? 'green' : 'dark'}>
                      {block.status}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-neutral-500 tabular-nums">
                    {new Date(block.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    –{' '}
                    {new Date(block.endTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {block.task ? ` • Task: ${block.task.title}` : ''}
                    {block.goal ? ` • Goal: ${block.goal.title}` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={block.status}
                    onChange={(e) =>
                      handleStatusChange(block.id, e.target.value as TimeBlockStatus)
                    }
                    className={`${inlineInputClassName} py-1.5`}
                  >
                    {blockStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <Button variant="danger" onClick={() => handleDeleteBlock(block.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">Suggested Free Slots</h2>
          </div>
          {slots.length === 0 ? (
            <EmptyState
              title="No matching free slots"
              description="Try lowering the slot duration or checking another date."
            />
          ) : (
            <div className="space-y-2.5">
              {slots.map((slot, index) => (
                <Card
                  key={`${slot.startTime}-${index}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-mono text-sm font-semibold text-neutral-950 tabular-nums">
                      {new Date(slot.startTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      –{' '}
                      {new Date(slot.endTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-xs text-neutral-500">{slot.durationMinutes} min open</p>
                  </div>
                  <Button variant="dark" onClick={() => handleUseSlot(slot)}>
                    Use
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
