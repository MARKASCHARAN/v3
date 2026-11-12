import { z } from 'zod';

export const memoryCategorySchema = z.enum([
  'GENERAL',
  'PREFERENCE',
  'PROJECT_CONTEXT',
  'GOAL_CONTEXT',
  'FACT',
]);

export const messageRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);

export const createMemorySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1, 'Memory content is required').max(10000),
  category: memoryCategorySchema.default('GENERAL'),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  importance: z.number().int().min(1).max(5).default(1),
});

export const updateMemorySchema = z.object({
  title: z.string().trim().min(1).max(200).nullable().optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  category: memoryCategorySchema.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  importance: z.number().int().min(1).max(5).optional(),
});

export const memoryQuerySchema = z.object({
  category: memoryCategorySchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const upsertPreferenceSchema = z.object({
  key: z.string().trim().min(1, 'Preference key is required').max(100),
  value: z.string().trim().min(1, 'Preference value is required').max(1000),
  category: z.string().trim().min(1).max(100).default('GENERAL'),
});

export const createConversationMessageSchema = z.object({
  sessionId: z.string().trim().min(1).max(100).default('default'),
  role: messageRoleSchema,
  content: z.string().trim().min(1, 'Message content is required').max(10000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const conversationQuerySchema = z.object({
  sessionId: z.string().trim().min(1).max(100).default('default'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const contextQuerySchema = z.object({
  sessionId: z.string().trim().min(1).max(100).default('default'),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const semanticSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(1000),
  category: memoryCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  minSimilarity: z.coerce.number().min(0).max(1).default(0.3),
});

export const personalizationQuerySchema = z.object({
  topic: z.string().trim().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export const backfillEmbeddingsSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .default({ limit: 25 });

export const memoryIdParamSchema = z.object({
  id: z.string().uuid('Invalid memory ID'),
});

export const preferenceKeyParamSchema = z.object({
  key: z.string().trim().min(1, 'Preference key is required').max(100),
});
