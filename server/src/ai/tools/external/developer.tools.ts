import { z } from 'zod';
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
    execute: (ctx, input) =>
      integrationsService.listGithubIssues(
        ctx.userId,
        input as z.infer<typeof listGithubIssuesArgsSchema>
      ),
  } as V3ToolContract,
  {
    name: 'listGithubPullRequests',
    domain: 'github',
    description: 'List pull requests for a GitHub repository (owner and repo).',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: listGithubPullRequestsArgsSchema,
    outputSchema: z.array(z.record(z.string(), z.unknown())),
    execute: (ctx, input) =>
      integrationsService.listGithubPullRequests(
        ctx.userId,
        input as z.infer<typeof listGithubPullRequestsArgsSchema>
      ),
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

