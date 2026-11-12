'use client';

import { GitBranch, GitPullRequest, MessageSquarePlus, PlusCircle, RefreshCw } from 'lucide-react';
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
import { integrationsApi } from '@/lib/v3-api';
import { GithubIssueSummary, GithubPullRequestSummary } from '@/types/api';

export function DeveloperView() {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [issues, setIssues] = useState<GithubIssueSummary[] | null>(null);
  const [pulls, setPulls] = useState<GithubPullRequestSummary[] | null>(null);
  const [inspecting, setInspecting] = useState(false);

  const [issueTitle, setIssueTitle] = useState('');
  const [issueBody, setIssueBody] = useState('');
  const [commentIssueNumber, setCommentIssueNumber] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);

  const fetchRepos = useCallback(() => integrationsApi.listGithubRepos(), []);
  const { data: repos, loading, reload } = useAsyncResource(fetchRepos, 'GitHub not connected');

  const inspectRepository = async (targetOwner: string, targetRepo: string) => {
    setOwner(targetOwner);
    setRepo(targetRepo);
    setInspecting(true);
    setRepoError(null);
    try {
      const [issueList, prList] = await Promise.all([
        integrationsApi.listGithubIssues(targetOwner, targetRepo, 'open'),
        integrationsApi.listGithubPullRequests(targetOwner, targetRepo, 'open'),
      ]);
      setIssues(issueList);
      setPulls(prList);
    } catch (err) {
      setRepoError(err instanceof ApiClientError ? err.message : 'Failed to load repository data');
    } finally {
      setInspecting(false);
    }
  };

  const handleInspectSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!owner.trim() || !repo.trim()) return;
    await inspectRepository(owner.trim(), repo.trim());
  };

  const handleCreateIssue = async (event: FormEvent) => {
    event.preventDefault();
    if (!owner.trim() || !repo.trim() || !issueTitle.trim()) return;
    setRepoError(null);
    setNotice(null);
    try {
      const created = await integrationsApi.createGithubIssue({
        owner: owner.trim(),
        repo: repo.trim(),
        title: issueTitle.trim(),
        body: issueBody.trim() || undefined,
      });
      setIssueTitle('');
      setIssueBody('');
      setNotice(`Created GitHub issue #${created.number}.`);
      await inspectRepository(owner.trim(), repo.trim());
    } catch (err) {
      setRepoError(err instanceof ApiClientError ? err.message : 'Failed to create issue');
    }
  };

  const handleCreateComment = async (event: FormEvent) => {
    event.preventDefault();
    const issueNumber = Number(commentIssueNumber);
    if (!owner.trim() || !repo.trim() || !issueNumber || !commentBody.trim()) return;
    setRepoError(null);
    setNotice(null);
    try {
      await integrationsApi.createGithubComment({
        owner: owner.trim(),
        repo: repo.trim(),
        issueNumber,
        body: commentBody.trim(),
      });
      setCommentIssueNumber('');
      setCommentBody('');
      setNotice(`Commented on #${issueNumber}.`);
    } catch (err) {
      setRepoError(err instanceof ApiClientError ? err.message : 'Failed to post comment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            GitHub Developer Assistant
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Inspect connected repositories, open issues, pull requests, and create tracked GitHub issues.
          </p>
        </div>
        <Button variant="secondary" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
          Reload Repos
        </Button>
      </div>

      {repoError && <ErrorBanner message={repoError} />}
      {notice && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
          {notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">Repositories</h2>
          </div>

          {loading ? (
            <p className="text-sm text-neutral-500">Loading GitHub repositories...</p>
          ) : !repos || repos.length === 0 ? (
            <EmptyState
              title="No GitHub repositories loaded"
              description="Connect your GITHUB token on the Integrations & MCP page or configure GITHUB_TOKEN on the server."
            />
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {repos.map((r) => {
                const [rOwner = '', rName = ''] = r.fullName.split('/');
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-neutral-950">{r.fullName}</p>
                      <p className="text-neutral-500">{r.description || 'No description'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>Issues: {r.openIssuesCount}</Badge>
                      <Button
                        variant="dark"
                        onClick={() => inspectRepository(rOwner, rName)}
                        className="px-2.5 py-1 text-xs"
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="space-y-4">
          <h2 className="text-base font-bold text-neutral-950">Inspect Any Repository</h2>
          <form onSubmit={handleInspectSubmit} className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              required
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="Owner (e.g. vercel)"
              className={inputClassName}
            />
            <input
              type="text"
              required
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="Repo (e.g. next.js)"
              className={inputClassName}
            />
            <Button type="submit" disabled={inspecting}>
              {inspecting ? 'Loading...' : 'Load Issues & PRs'}
            </Button>
          </form>

          <form
            onSubmit={handleCreateIssue}
            className="space-y-2.5 border-t border-neutral-100 pt-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <PlusCircle className="h-3.5 w-3.5 text-orange-500" />
              Create Issue
            </div>
            <input
              type="text"
              required
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              placeholder="Issue title"
              className={inputClassName}
            />
            <textarea
              rows={2}
              value={issueBody}
              onChange={(e) => setIssueBody(e.target.value)}
              placeholder="Issue body (optional)"
              className={inputClassName}
            />
            <Button type="submit" variant="dark" disabled={!owner || !repo}>
              Create GitHub Issue
            </Button>
          </form>

          <form
            onSubmit={handleCreateComment}
            className="space-y-2.5 border-t border-neutral-100 pt-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
              <MessageSquarePlus className="h-3.5 w-3.5 text-orange-500" />
              Comment on Issue / PR
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                type="number"
                min={1}
                required
                value={commentIssueNumber}
                onChange={(e) => setCommentIssueNumber(e.target.value)}
                placeholder="Issue #"
                className={inputClassName}
              />
              <input
                type="text"
                required
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Comment body"
                className={`sm:col-span-2 ${inputClassName}`}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={!owner || !repo}>
              Post Comment
            </Button>
          </form>
        </Card>
      </div>

      {(issues || pulls) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="text-base font-bold text-neutral-950">Open Issues</h2>
            {(issues ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">No open issues found.</p>
            ) : (
              <div className="space-y-2">
                {(issues ?? []).map((issue) => (
                  <a
                    key={issue.id}
                    href={issue.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs transition hover:border-orange-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-950">
                        #{issue.number} {issue.title}
                      </span>
                      <Badge tone="orange">{issue.state}</Badge>
                    </div>
                    <p className="mt-1 text-neutral-500">by {issue.author}</p>
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card className="space-y-3">
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-orange-500" />
              <h2 className="text-base font-bold text-neutral-950">Open Pull Requests</h2>
            </div>
            {(pulls ?? []).length === 0 ? (
              <p className="text-sm text-neutral-500">No open pull requests found.</p>
            ) : (
              <div className="space-y-2">
                {(pulls ?? []).map((pr) => (
                  <a
                    key={pr.id}
                    href={pr.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs transition hover:border-orange-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-950">
                        #{pr.number} {pr.title}
                      </span>
                      <Badge tone={pr.draft ? 'neutral' : 'green'}>
                        {pr.draft ? 'DRAFT' : pr.state}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-neutral-500">
                      {pr.headBranch} → {pr.baseBranch}
                    </p>
                  </a>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

