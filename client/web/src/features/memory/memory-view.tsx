'use client';

import { Brain, Database, MessageSquare, Search, Sparkles, Trash2 } from 'lucide-react';
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
import { HybridMemorySearchResult, MemoryCategory, MemoryType } from '@/types/api';

const memoryCategories: MemoryCategory[] = [
  'GENERAL',
  'PREFERENCE',
  'PROJECT_CONTEXT',
  'GOAL_CONTEXT',
  'FACT',
];

const memoryTypes: MemoryType[] = [
  'SEMANTIC',
  'EPISODIC',
  'PROCEDURAL',
  'PROJECT',
  'CONVERSATION',
];

export function MemoryView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [hybridQuery, setHybridQuery] = useState('');
  const [hybridResult, setHybridResult] = useState<HybridMemorySearchResult | null>(null);
  const [hybridLoading, setHybridLoading] = useState(false);
  const [lifecycleStatus, setLifecycleStatus] = useState<string | null>(null);

  const [memTitle, setMemTitle] = useState('');
  const [memContent, setMemContent] = useState('');
  const [memCategory, setMemCategory] = useState<MemoryCategory>('PROJECT_CONTEXT');
  const [memType, setMemType] = useState<MemoryType>('SEMANTIC');
  const [memImportance, setMemImportance] = useState(3);
  const [proposeMode, setProposeMode] = useState(false);
  const [prefKey, setPrefKey] = useState('');
  const [prefValue, setPrefValue] = useState('');

  const fetchMemoryData = useCallback(async () => {
    const [memories, preferences, conversations] = await Promise.all([
      memoryApi.list(searchQuery.trim() ? { q: searchQuery.trim() } : undefined),
      memoryApi.listPreferences(),
      memoryApi.listConversations('default', 12),
    ]);
    return { memories, preferences, conversations };
  }, [searchQuery]);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchMemoryData,
    'Failed to load memory context'
  );
  const memories = data?.memories ?? [];
  const preferences = data?.preferences ?? [];
  const conversations = data?.conversations ?? [];

  const handleHybridSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!hybridQuery.trim()) {
      setHybridResult(null);
      return;
    }
    setHybridLoading(true);
    try {
      const res = await memoryApi.hybridSearch({ q: hybridQuery.trim(), limit: 8 });
      setHybridResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Hybrid memory search failed');
    } finally {
      setHybridLoading(false);
    }
  };

  const handleCreateMemory = async (event: FormEvent) => {
    event.preventDefault();
    if (!memContent.trim()) {
      return;
    }
    try {
      if (proposeMode) {
        const res = await memoryApi.propose({
          title: memTitle.trim() || undefined,
          content: memContent.trim(),
          category: memCategory,
          memoryType: memType,
          importance: memImportance,
          confidence: 0.9,
          autoSupersedeOnConflict: true,
        });
        setLifecycleStatus(
          res.supersededMemoryId
            ? `Proposed memory saved (superseded ${res.supersededMemoryId})`
            : res.reason || 'Proposed memory validated and persisted'
        );
      } else {
        await memoryApi.create({
          title: memTitle.trim() || undefined,
          content: memContent.trim(),
          category: memCategory,
          importance: memImportance,
        });
        setLifecycleStatus('Memory entry saved');
      }
      setMemTitle('');
      setMemContent('');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save memory');
    }
  };

  const handleBackfill = async () => {
    try {
      const res = await memoryApi.backfillEmbeddings(25);
      setLifecycleStatus(
        `Embeddings backfill: updated ${res.updatedCount} of ${res.processedCount} processed.`
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to backfill embeddings');
    }
  };

  const handlePrune = async () => {
    try {
      const res = await memoryApi.prune();
      setLifecycleStatus(`Pruned ${res.deletedCount} expired memory record(s).`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to prune expired memories');
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
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Hybrid Memory & Preferences
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            SQL + PostgreSQL GIN FTS + pgvector RRF retrieval, supersession lifecycle, and conversation log.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="dark" onClick={handleBackfill}>
            <Database className="h-4 w-4 text-orange-400" />
            Backfill Vectors
          </Button>
          <Button variant="secondary" onClick={handlePrune}>
            Prune Expired
          </Button>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter stored memories..."
            className={`w-full sm:w-52 ${baseFieldClassName}`}
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {lifecycleStatus && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
          {lifecycleStatus}
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-orange-500" />
            <div>
              <h2 className="text-base font-bold text-neutral-950">
                Hybrid RRF Semantic + Keyword Search
              </h2>
              <p className="text-xs text-neutral-500">
                Parallel PostgreSQL FTS rank, pgvector cosine distance, and live SQL workspace metrics.
              </p>
            </div>
          </div>
          {hybridResult && <Badge tone="orange">Mode: {hybridResult.mode}</Badge>}
        </div>

        <form onSubmit={handleHybridSearch} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={hybridQuery}
            onChange={(e) => setHybridQuery(e.target.value)}
            placeholder="Ask or search semantically across project & goal memory..."
            className={`flex-1 ${baseFieldClassName}`}
          />
          <Button type="submit" disabled={hybridLoading}>
            {hybridLoading ? 'Searching...' : 'Hybrid Search'}
          </Button>
        </form>

        {hybridResult && (
          <div className="space-y-3 border-t border-neutral-100 pt-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="dark">Goals: {hybridResult.structuredMetrics.activeGoalsCount}</Badge>
              <Badge>Open Tasks: {hybridResult.structuredMetrics.openTasksCount}</Badge>
              <Badge tone={hybridResult.structuredMetrics.overdueTasksCount > 0 ? 'red' : 'green'}>
                Overdue: {hybridResult.structuredMetrics.overdueTasksCount}
              </Badge>
              <Badge>Upcoming Blocks: {hybridResult.structuredMetrics.upcomingTimeBlocksCount}</Badge>
            </div>
            {hybridResult.results.length === 0 ? (
              <p className="text-sm text-neutral-500">No hybrid matches found for this query.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {hybridResult.results.map((hit) => (
                  <div
                    key={hit.id}
                    className="rounded-xl border border-neutral-200 bg-neutral-50 p-3.5 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-950">{hit.title || 'Memory Hit'}</span>
                      <div className="flex gap-1">
                        <Badge tone="dark">{hit.memoryType}</Badge>
                        <Badge tone="orange">RRF {hit.rrfScore.toFixed(4)}</Badge>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-700">{hit.content}</p>
                    <p className="mt-1.5 font-mono text-[11px] text-neutral-400">
                      Similarity: {hit.similarity !== null ? hit.similarity.toFixed(3) : 'N/A'} •
                      FTS Rank: {hit.keywordRank !== null ? hit.keywordRank.toFixed(3) : 'N/A'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-orange-500" />
              <h2 className="text-base font-bold text-neutral-950">Add or Propose Memory</h2>
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <input
                type="checkbox"
                checked={proposeMode}
                onChange={(e) => setProposeMode(e.target.checked)}
                className="accent-orange-500"
              />
              Supersession Mode
            </label>
          </div>
          <form onSubmit={handleCreateMemory} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
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
                value={memType}
                onChange={(e) => setMemType(e.target.value as MemoryType)}
                className={inputClassName}
              >
                {memoryTypes.map((t) => (
                  <option key={t} value={t}>
                    Type: {t}
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
            <Button type="submit">
              <Sparkles className="h-4 w-4" />
              {proposeMode ? 'Propose Candidate Memory' : 'Save Memory'}
            </Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-base font-bold text-neutral-950">User Preferences</h2>
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
            <Button type="submit" variant="dark">
              Save Preference
            </Button>
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
                  className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2 text-sm"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-neutral-950">{pref.key}</span>
                    <span className="mx-2 text-neutral-400">=</span>
                    <span className="text-neutral-700">{pref.value}</span>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-base font-bold text-neutral-950">Stored Memories</h2>
          {loading ? (
            <Card>
              <p className="text-sm text-neutral-500">Loading memories...</p>
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-neutral-950">
                        {mem.title || 'Context Note'}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="orange">{mem.category}</Badge>
                        <Badge tone="dark">P{mem.importance}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600">{mem.content}</p>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="danger"
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="px-2.5 py-1 text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">Recent Conversation Log</h2>
          </div>
          {conversations.length === 0 ? (
            <p className="text-xs text-neutral-500">No messages recorded in default session.</p>
          ) : (
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {conversations.map((msg) => (
                <div
                  key={msg.id}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-xs"
                >
                  <Badge tone={msg.role === 'ASSISTANT' ? 'orange' : 'dark'}>{msg.role}</Badge>
                  <p className="mt-1.5 line-clamp-4 text-neutral-700">{msg.content}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
