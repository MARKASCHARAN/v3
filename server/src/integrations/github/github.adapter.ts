import { Octokit } from '@octokit/rest';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface GithubRepoSummary {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  openIssuesCount: number;
  htmlUrl: string;
  updatedAt: string | null;
}

export interface GithubIssueSummary {
  id: number;
  number: number;
  title: string;
  state: string;
  isPullRequest: boolean;
  author: string;
  htmlUrl: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GithubPullRequestSummary {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  author: string;
  headBranch: string;
  baseBranch: string;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GithubAdapter {
  isConfigured(tokenOverride?: string): boolean;
  listRepositories(
    tokenOverride?: string,
    params?: { limit?: number }
  ): Promise<GithubRepoSummary[]>;
  listIssues(
    params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; limit?: number },
    tokenOverride?: string
  ): Promise<GithubIssueSummary[]>;
  listPullRequests(
    params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; limit?: number },
    tokenOverride?: string
  ): Promise<GithubPullRequestSummary[]>;
  createIssue(
    params: { owner: string; repo: string; title: string; body?: string; labels?: string[] },
    tokenOverride?: string
  ): Promise<GithubIssueSummary>;
  createIssueComment(
    params: { owner: string; repo: string; issueNumber: number; body: string },
    tokenOverride?: string
  ): Promise<{ id: number; htmlUrl: string }>;
}

export class OctokitGithubAdapter implements GithubAdapter {
  constructor(private readonly defaultToken: string | undefined = env.GITHUB_TOKEN) {}

  isConfigured(tokenOverride?: string): boolean {
    const token = tokenOverride ?? this.defaultToken;
    return Boolean(token && token.trim().length > 0);
  }

  private getClient(tokenOverride?: string): Octokit {
    const token = tokenOverride ?? this.defaultToken;
    if (!token) {
      throw new AppError(
        503,
        'GitHub integration is not configured (connect GitHub account or set GITHUB_TOKEN)',
        'GITHUB_NOT_CONFIGURED'
      );
    }
    return new Octokit({ auth: token });
  }

  async listRepositories(
    tokenOverride?: string,
    params: { limit?: number } = {}
  ): Promise<GithubRepoSummary[]> {
    const octokit = this.getClient(tokenOverride);
    const response = await octokit.rest.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: params.limit ?? 20,
    });

    return response.data.map((repo) => ({
      id: repo.id,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      defaultBranch: repo.default_branch,
      openIssuesCount: repo.open_issues_count,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
    }));
  }

  async listIssues(
    params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; limit?: number },
    tokenOverride?: string
  ): Promise<GithubIssueSummary[]> {
    const octokit = this.getClient(tokenOverride);
    const response = await octokit.rest.issues.listForRepo({
      owner: params.owner,
      repo: params.repo,
      state: params.state ?? 'open',
      per_page: params.limit ?? 20,
    });

    return response.data.map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      isPullRequest: Boolean(issue.pull_request),
      author: issue.user?.login ?? 'unknown',
      htmlUrl: issue.html_url,
      body: issue.body ?? null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    }));
  }

  async listPullRequests(
    params: { owner: string; repo: string; state?: 'open' | 'closed' | 'all'; limit?: number },
    tokenOverride?: string
  ): Promise<GithubPullRequestSummary[]> {
    const octokit = this.getClient(tokenOverride);
    const response = await octokit.rest.pulls.list({
      owner: params.owner,
      repo: params.repo,
      state: params.state ?? 'open',
      per_page: params.limit ?? 20,
    });

    return response.data.map((pr) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      state: pr.state,
      draft: Boolean(pr.draft),
      author: pr.user?.login ?? 'unknown',
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      htmlUrl: pr.html_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
    }));
  }

  async createIssue(
    params: { owner: string; repo: string; title: string; body?: string; labels?: string[] },
    tokenOverride?: string
  ): Promise<GithubIssueSummary> {
    const octokit = this.getClient(tokenOverride);
    const response = await octokit.rest.issues.create({
      owner: params.owner,
      repo: params.repo,
      title: params.title,
      body: params.body,
      labels: params.labels,
    });

    const issue = response.data;
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state,
      isPullRequest: false,
      author: issue.user?.login ?? 'unknown',
      htmlUrl: issue.html_url,
      body: issue.body ?? null,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    };
  }

  async createIssueComment(
    params: { owner: string; repo: string; issueNumber: number; body: string },
    tokenOverride?: string
  ): Promise<{ id: number; htmlUrl: string }> {
    const octokit = this.getClient(tokenOverride);
    const response = await octokit.rest.issues.createComment({
      owner: params.owner,
      repo: params.repo,
      issue_number: params.issueNumber,
      body: params.body,
    });

    return {
      id: response.data.id,
      htmlUrl: response.data.html_url,
    };
  }
}
