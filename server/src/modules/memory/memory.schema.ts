import { z } from 'zod';

export const memoryCategorySchema = z.enum([
  'GENERAL',
  'PREFERENCE',
  'PROJECT_CONTEXT',
  'GOAL_CONTEXT',
  'FACT',
]);

export const memoryTypeSchema = z.enum([
  'CONVERSATION',
  'EPISODIC',
  'SEMANTIC',
  'PROCEDURAL',
  'PROJECT',
]);

export const memorySourceTypeSchema = z.enum([
  'MANUAL',
  'CONVERSATION',
  'RESEARCH',
  'EMAIL',
  'GITHUB',
  'EVENT',
]);

export const messageRoleSchema = z.enum(['USER', 'ASSISTANT', 'SYSTEM']);

export const createMemorySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1, 'Memory content is required').max(10000),
  category: memoryCategorySchema.default('GENERAL'),
  memoryType: memoryTypeSchema.default('SEMANTIC'),
  sourceType: memorySourceTypeSchema.default('MANUAL'),
  sourceId: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  importance: z.number().int().min(1).max(5).default(1),
  confidence: z.number().min(0).max(1).default(1.0),
  expiresAt: z.coerce.date().optional(),
});

export const proposeMemorySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1, 'Memory content is required').max(10000),
  category: memoryCategorySchema.default('FACT'),
  memoryType: memoryTypeSchema.default('SEMANTIC'),
  sourceType: memorySourceTypeSchema.default('CONVERSATION'),
  sourceId: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  importance: z.number().int().min(1).max(5).default(2),
  confidence: z.number().min(0).max(1).default(0.85),
  expiresAt: z.coerce.date().optional(),
  autoSupersedeOnConflict: z.boolean().default(true),
});

export const updateMemorySchema = z.object({
  title: z.string().trim().min(1).max(200).nullable().optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  category: memoryCategorySchema.optional(),
  memoryType: memoryTypeSchema.optional(),
  sourceType: memorySourceTypeSchema.optional(),
  sourceId: z.string().trim().min(1).max(200).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  importance: z.number().int().min(1).max(5).optional(),
  confidence: z.number().min(0).max(1).optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  supersededById: z.string().uuid().nullable().optional(),
});

export const memoryQuerySchema = z.object({
  category: memoryCategorySchema.optional(),
  memoryType: memoryTypeSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  includeExpired: z.enum(['true', 'false']).optional(),
  includeSuperseded: z.enum(['true', 'false']).optional(),
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
  memoryType: memoryTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  minSimilarity: z.coerce.number().min(0).max(1).default(0.3),
});

export const hybridSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(1000),
  category: memoryCategorySchema.optional(),
  memoryType: memoryTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  minSimilarity: z.coerce.number().min(0).max(1).default(0.25),
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
