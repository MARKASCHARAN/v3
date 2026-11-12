import { z } from 'zod';

export const integrationProviderSchema = z.enum([
  'TELEGRAM',
  'DISCORD',
  'WHATSAPP',
  'GOOGLE',
  'GITHUB',
  'BHASHINI',
]);

export const integrationStatusSchema = z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'ERROR']);

export const connectIntegrationSchema = z.object({
  provider: integrationProviderSchema,
  credentials: z.record(z.string(), z.unknown()).refine((obj) => Object.keys(obj).length > 0, {
    message: 'Credentials payload must contain at least one key',
  }),
  externalAccountId: z.string().trim().min(1).max(200).optional(),
  scopes: z.array(z.string().trim().min(1)).default([]),
});

export const updateIntegrationSchema = z.object({
  credentials: z.record(z.string(), z.unknown()).optional(),
  externalAccountId: z.string().trim().min(1).max(200).optional(),
  scopes: z.array(z.string().trim().min(1)).optional(),
  status: integrationStatusSchema.optional(),
});

export const integrationProviderParamSchema = z.object({
  provider: integrationProviderSchema,
});

export const googleCalendarSyncSchema = z.object({
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.number().int().min(1).max(50).default(20),
  importAsTimeBlocks: z.boolean().default(true),
});

export const gmailListQuerySchema = z.object({
  q: z.string().trim().max(300).optional(),
  maxResults: z.coerce.number().int().min(1).max(25).default(10),
});

export const githubRepoParamsSchema = z.object({
  owner: z.string().trim().min(1).max(120),
  repo: z.string().trim().min(1).max(120),
});

export const githubIssuesQuerySchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const createGithubIssueSchema = z.object({
  owner: z.string().trim().min(1).max(120),
  repo: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(250),
  body: z.string().max(10000).optional(),
  labels: z.array(z.string().trim().min(1)).optional(),
});

export const createGithubCommentSchema = z.object({
  owner: z.string().trim().min(1).max(120),
  repo: z.string().trim().min(1).max(120),
  issueNumber: z.number().int().positive(),
  body: z.string().trim().min(1).max(10000),
});

export const invokeMcpToolSchema = z.object({
  serverName: z.string().trim().min(1).max(100),
  toolName: z.string().trim().min(1).max(120),
  arguments: z.record(z.string(), z.unknown()).default({}),
  allowAutoApproveWrites: z.boolean().default(false),
});
