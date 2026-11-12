'use client';

import { BookmarkCheck, ExternalLink, Globe, Search, Trash2 } from 'lucide-react';
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
import { goalsApi, researchApi } from '@/lib/v3-api';

export function ResearchView() {
  const [query, setQuery] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [goalId, setGoalId] = useState('');
  const [saveToMemory, setSaveToMemory] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchResearch = useCallback(async () => {
    const [items, goals] = await Promise.all([
      researchApi.list(filterText.trim() ? { q: filterText.trim(), limit: 25 } : { limit: 25 }),
      goalsApi.list({ status: 'ACTIVE' }),
    ]);
    return { items, goals };
  }, [filterText]);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchResearch,
    'Failed to load research items'
  );
  const items = data?.items ?? [];
  const goals = data?.goals ?? [];

  const handleConductResearch = async (event: FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setNotice(null);
    try {
      const urls = urlsText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      await researchApi.search({
        query: query.trim(),
        urls: urls.length > 0 ? urls : undefined,
        goalId: goalId || undefined,
        saveToMemory,
      });
      setQuery('');
      setUrlsText('');
      setNotice('Web research completed and synthesized safely.');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Research execution failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSaveToMemory = async (id: string) => {
    try {
      await researchApi.saveToMemory(id);
      setNotice('Research findings promoted to pgvector semantic memory.');
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to promote research to memory');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await researchApi.remove(id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to delete research item');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Grounded Web Research
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            SSRF-safe search with prompt-injection boundaries and semantic memory promotion.
          </p>
        </div>

        <input
          type="search"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filter saved research..."
          className={`w-full sm:w-64 ${baseFieldClassName}`}
        />
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
          {notice}
        </div>
      )}

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-orange-500" />
          <h2 className="text-base font-bold text-neutral-950">Conduct New Research</h2>
        </div>
        <form onSubmit={handleConductResearch} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="text"
              required
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Research question or topic..."
              className={`md:col-span-2 ${inputClassName}`}
            />
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className={inputClassName}
            >
              <option value="">Link to goal (optional)</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={2}
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            placeholder="Optional public source URLs (one per line, max 5)"
            className={inputClassName}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
              <input
                type="checkbox"
                checked={saveToMemory}
                onChange={(e) => setSaveToMemory(e.target.checked)}
                className="accent-orange-500"
              />
              Auto-save summary into long-term pgvector memory
            </label>
            <Button type="submit" disabled={searching}>
              <Search className="h-4 w-4" />
              {searching ? 'Researching...' : 'Run Grounded Search'}
            </Button>
          </div>
        </form>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-bold text-neutral-950">Saved Research Library</h2>
        {loading ? (
          <Card>
            <p className="text-sm text-neutral-500">Loading research library...</p>
          </Card>
        ) : items.length === 0 ? (
          <EmptyState
            title="No research items stored"
            description="Run a grounded query above to synthesize cited research findings."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((item) => (
              <Card key={item.id} className="flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-neutral-950">{item.title}</h3>
                      <p className="text-xs text-neutral-500">Query: {item.query}</p>
                    </div>
                    <Badge tone={item.status === 'SAVED_TO_MEMORY' ? 'green' : 'orange'}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-700">{item.summary}</p>
                  {item.keyFindings.length > 0 && (
                    <ul className="list-disc space-y-1 pl-4 text-xs text-neutral-600">
                      {item.keyFindings.slice(0, 5).map((finding, idx) => (
                        <li key={idx}>{finding}</li>
                      ))}
                    </ul>
                  )}
                  {item.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.sources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-orange-600 underline hover:border-orange-300"
                        >
                          {src.title || src.url}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  {item.status !== 'SAVED_TO_MEMORY' && (
                    <Button variant="dark" onClick={() => handleSaveToMemory(item.id)}>
                      <BookmarkCheck className="h-4 w-4 text-orange-400" />
                      Save to Memory
                    </Button>
                  )}
                  <Button variant="danger" onClick={() => handleDelete(item.id)}>
                    <Trash2 className="h-4 w-4" />
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
