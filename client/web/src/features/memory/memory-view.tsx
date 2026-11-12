'use client';

import { FormEvent, useCallback, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  baseFieldClassName,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { memoryApi } from '@/lib/v3-api';
import { MemoryCategory } from '@/types/api';

const memoryCategories: MemoryCategory[] = [
  'GENERAL',
  'PREFERENCE',
  'PROJECT_CONTEXT',
  'GOAL_CONTEXT',
  'FACT',
];

export function MemoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [memTitle, setMemTitle] = useState('');
  const [memContent, setMemContent] = useState('');
  const [memCategory, setMemCategory] = useState<MemoryCategory>('PROJECT_CONTEXT');
  const [memImportance, setMemImportance] = useState(3);
  const [prefKey, setPrefKey] = useState('');
  const [prefValue, setPrefValue] = useState('');

  const fetchMemoryData = useCallback(async () => {
    const [memories, preferences] = await Promise.all([
      memoryApi.list(searchQuery.trim() ? { q: searchQuery.trim() } : undefined),
      memoryApi.listPreferences(),
    ]);
    return { memories, preferences };
  }, [searchQuery]);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchMemoryData,
    'Failed to load memory context'
  );
  const memories = data?.memories ?? [];
  const preferences = data?.preferences ?? [];

  const handleCreateMemory = async (event: FormEvent) => {
    event.preventDefault();
    if (!memContent.trim()) {
      return;
    }
    try {
      await memoryApi.create({
        title: memTitle.trim() || undefined,
        content: memContent.trim(),
        category: memCategory,
        importance: memImportance,
      });
      setMemTitle('');
      setMemContent('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save memory');
    }
  };

  const handleUpsertPreference = async (event: FormEvent) => {
    event.preventDefault();
    if (!prefKey.trim() || !prefValue.trim()) {
      return;
    }
    try {
      await memoryApi.upsertPreference({
        key: prefKey.trim(),
        value: prefValue.trim(),
      });
      setPrefKey('');
      setPrefValue('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save preference');
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await memoryApi.remove(id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete memory');
    }
  };

  const handleDeletePreference = async (key: string) => {
    try {
      await memoryApi.removePreference(key);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete preference');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Memory & Preferences</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Store personal preferences and project context used across V3 planning workflows.
          </p>
        </div>

        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search memories..."
          className={`w-full sm:w-64 ${baseFieldClassName}`}
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-base font-semibold">Add Memory / Context</h2>
          <form onSubmit={handleCreateMemory} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={memTitle}
                onChange={(e) => setMemTitle(e.target.value)}
                placeholder="Title (optional)"
                className={inputClassName}
              />
              <select
                value={memCategory}
                onChange={(e) => setMemCategory(e.target.value as MemoryCategory)}
                className={inputClassName}
              >
                {memoryCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <select
                value={memImportance}
                onChange={(e) => setMemImportance(Number(e.target.value))}
                className={inputClassName}
              >
                {[1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={level}>
                    Importance: {level}
                  </option>
                ))}
              </select>
            </div>
            <textarea
              rows={3}
              required
              value={memContent}
              onChange={(e) => setMemContent(e.target.value)}
              placeholder="Write project context, constraint, or personal note..."
              className={inputClassName}
            />
            <Button type="submit">Save Memory</Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-base font-semibold">User Preferences</h2>
          <form onSubmit={handleUpsertPreference} className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              required
              value={prefKey}
              onChange={(e) => setPrefKey(e.target.value)}
              placeholder="Key (e.g. timezone)"
              className={inputClassName}
            />
            <input
              type="text"
              required
              value={prefValue}
              onChange={(e) => setPrefValue(e.target.value)}
              placeholder="Value (e.g. Asia/Kolkata)"
              className={inputClassName}
            />
            <Button type="submit">Save Preference</Button>
          </form>

          {preferences.length === 0 ? (
            <EmptyState
              title="No preferences stored"
              description="Save preferences like working hours, timezone, or planning cadence."
            />
          ) : (
            <div className="space-y-2">
              {preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <div>
                    <span className="font-mono text-xs font-semibold">{pref.key}</span>
                    <span className="mx-2 text-slate-400">=</span>
                    <span>{pref.value}</span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => handleDeletePreference(pref.key)}
                    className="px-2 py-1 text-xs"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-semibold">Stored Memories</h2>
        {loading ? (
          <Card>
            <p className="text-sm text-slate-500">Loading memories...</p>
          </Card>
        ) : memories.length === 0 ? (
          <EmptyState
            title="No memories found"
            description="Add a project context note or adjust your search query."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {memories.map((mem) => (
              <Card key={mem.id} className="flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold">{mem.title || 'Context Note'}</h3>
                    <div className="flex gap-1.5">
                      <Badge tone="blue">{mem.category}</Badge>
                      <Badge>P{mem.importance}</Badge>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{mem.content}</p>
                </div>
                <div className="flex justify-end">
                  <Button variant="danger" onClick={() => handleDeleteMemory(mem.id)}>
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
