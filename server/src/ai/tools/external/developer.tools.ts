import { z } from 'zod';
import { wrapUntrustedExternalData } from '../../guardrails/prompt-injection.guard';
import {
  createGithubIssueSchema,
  githubIssuesQuerySchema,
  githubRepoParamsSchema,
} from '../../../modules/integrations/integrations.schema';
import { IntegrationsService } from '../../../modules/integrations/integrations.service';
import { V3ToolContract } from '../tool.types';

const integrationsService = new IntegrationsService();

const listGithubReposArgsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
});

const listGithubIssuesArgsSchema = githubRepoParamsSchema.merge(githubIssuesQuerySchema);

const listGithubPullRequestsArgsSchema = githubRepoParamsSchema.merge(githubIssuesQuerySchema);

const listMcpToolsArgsSchema = z.object({});

export const DEVELOPER_EXTERNAL_TOOLS: V3ToolContract[] = [
  {
    name: 'listGithubRepos',
    domain: 'github',
    description: 'List authenticated user GitHub repositories ordered by recent activity.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: listGithubReposArgsSchema,
    outputSchema: z.array(z.record(z.string(), z.unknown())),
    execute: (ctx, input) =>
      integrationsService.listGithubRepositories(
        ctx.userId,
        (input as z.infer<typeof listGithubReposArgsSchema>).limit
      ),
  } as V3ToolContract,
  {
    name: 'listGithubIssues',
    domain: 'github',
    description: 'List issues for a GitHub repository (owner and repo).',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: listGithubIssuesArgsSchema,
    outputSchema: z.array(z.record(z.string(), z.unknown())),
    execute: async (ctx, input) => {
      const parsed = input as z.infer<typeof listGithubIssuesArgsSchema>;
      const issues = await integrationsService.listGithubIssues(ctx.userId, parsed);
      return issues.map((issue) => ({
        id: issue.id,
        number: issue.number,
        state: issue.state,
        isPullRequest: issue.isPullRequest,
        author: issue.author,
        htmlUrl: issue.htmlUrl,
        wrappedContent: wrapUntrustedExternalData({
          sourceType: 'GITHUB_ISSUE',
          sourceId: `${parsed.owner}/${parsed.repo}#${issue.number}`,
          origin: issue.htmlUrl,
          content: `Title: ${issue.title}\n\n${issue.body ?? ''}`,
        }),
      }));
    },
  } as V3ToolContract,
  {
    name: 'listGithubPullRequests',
    domain: 'github',
    description: 'List pull requests for a GitHub repository (owner and repo).',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: listGithubPullRequestsArgsSchema,
    outputSchema: z.array(z.record(z.string(), z.unknown())),
    execute: async (ctx, input) => {
      const parsed = input as z.infer<typeof listGithubPullRequestsArgsSchema>;
      const pulls = await integrationsService.listGithubPullRequests(ctx.userId, parsed);
      return pulls.map((pr) => ({
        id: pr.id,
        number: pr.number,
        state: pr.state,
        draft: pr.draft,
        author: pr.author,
        headBranch: pr.headBranch,
        baseBranch: pr.baseBranch,
        htmlUrl: pr.htmlUrl,
        wrappedContent: wrapUntrustedExternalData({
          sourceType: 'GITHUB_PR',
          sourceId: `${parsed.owner}/${parsed.repo}#${pr.number}`,
          origin: pr.htmlUrl,
          content: `PR Title: ${pr.title}`,
        }),
      }));
    },
  } as V3ToolContract,
  {
    name: 'createGithubIssue',
    domain: 'github',
    description: 'Create a new issue in a connected GitHub repository.',
    riskLevel: 'EXTERNAL_CONSEQUENTIAL',
    idempotent: false,
    inputSchema: createGithubIssueSchema,
    outputSchema: z.object({ id: z.number() }).catchall(z.unknown()),
    execute: (ctx, input) =>
      integrationsService.createGithubIssue(
        ctx.userId,
        input as z.infer<typeof createGithubIssueSchema>
      ),
  } as V3ToolContract,
  {
    name: 'listMcpTools',
    domain: 'mcp',
    description: 'List registered Model Context Protocol (MCP) servers and permissioned tools.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: listMcpToolsArgsSchema,
    outputSchema: z.record(z.string(), z.unknown()),
    execute: (ctx) => integrationsService.listMcpServersAndTools(ctx.userId),
  } as V3ToolContract,
];
