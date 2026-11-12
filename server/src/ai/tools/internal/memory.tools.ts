import { z } from 'zod';
import {
  createMemorySchema,
  hybridSearchQuerySchema,
  memoryCategorySchema,
  memoryQuerySchema,
  memorySourceTypeSchema,
  memoryTypeSchema,
  proposeMemorySchema,
  semanticSearchQuerySchema,
} from '../../../modules/memory/memory.schema';
import { MemoryService } from '../../../modules/memory/memory.service';
import { V3ToolContract } from '../tool.types';

const memoryService = new MemoryService();

const searchMemoryToolSchema = z.object({
  category: memoryCategorySchema.optional(),
  memoryType: memoryTypeSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const semanticSearchMemoryToolSchema = z.object({
  q: z.string().trim().min(1).max(1000),
  category: memoryCategorySchema.optional(),
  memoryType: memoryTypeSchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.3),
});

const hybridSearchMemoryToolSchema = z.object({
  q: z.string().trim().min(1).max(1000),
  category: memoryCategorySchema.optional(),
  memoryType: memoryTypeSchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.25),
});

const saveMemoryToolSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(10000),
  category: memoryCategorySchema.default('GENERAL'),
  memoryType: memoryTypeSchema.default('SEMANTIC'),
  sourceType: memorySourceTypeSchema.default('MANUAL'),
  sourceId: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  importance: z.number().int().min(1).max(5).default(1),
  confidence: z.number().min(0).max(1).default(1.0),
  expiresAt: z.string().describe('ISO 8601 expiration datetime').optional(),
});

const proposeMemoryToolSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(8).max(10000),
  category: memoryCategorySchema.default('FACT'),
  memoryType: memoryTypeSchema.default('SEMANTIC'),
  sourceType: memorySourceTypeSchema.default('CONVERSATION'),
  sourceId: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  importance: z.number().int().min(1).max(5).default(2),
  confidence: z.number().min(0).max(1).default(0.85),
  expiresAt: z.string().describe('ISO 8601 expiration datetime').optional(),
  autoSupersedeOnConflict: z.boolean().default(true),
});

const memoryListOutputSchema = z.array(z.record(z.string(), z.unknown()));
const recordOutputSchema = z.record(z.string(), z.unknown());
const createMemoryOutputSchema = z.object({ id: z.string() }).catchall(z.unknown());

export const MEMORY_TOOLS: V3ToolContract[] = [
  {
    name: 'searchMemory',
    domain: 'memory',
    description: 'Search stored memories and project context notes by query or category.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: memoryQuerySchema,
    outputSchema: memoryListOutputSchema,
    toolSchema: searchMemoryToolSchema,
    execute: (ctx, input) =>
      memoryService.getMemories(ctx.userId, input as z.infer<typeof memoryQuerySchema>),
  } as V3ToolContract,
  {
    name: 'semanticSearchMemory',
    domain: 'memory',
    description: 'Semantically search long-term memories using pgvector similarity.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: semanticSearchQuerySchema,
    outputSchema: recordOutputSchema,
    toolSchema: semanticSearchMemoryToolSchema,
    execute: (ctx, input) =>
      memoryService.semanticSearch(ctx.userId, input as z.infer<typeof semanticSearchQuerySchema>),
  } as V3ToolContract,
  {
    name: 'hybridSearchMemory',
    domain: 'memory',
    description:
      'Run hybrid SQL, PostgreSQL full-text keyword, and pgvector semantic search with RRF ranking.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: hybridSearchQuerySchema,
    outputSchema: recordOutputSchema,
    toolSchema: hybridSearchMemoryToolSchema,
    execute: (ctx, input) =>
      memoryService.hybridSearch(ctx.userId, input as z.infer<typeof hybridSearchQuerySchema>),
  } as V3ToolContract,
  {
    name: 'proposeMemory',
    domain: 'memory',
    description:
      'Validate, deduplicate, and propose a candidate memory with conflict detection and supersession.',
    riskLevel: 'INTERNAL_WRITE',
    idempotent: true,
    inputSchema: proposeMemorySchema,
    outputSchema: recordOutputSchema,
    toolSchema: proposeMemoryToolSchema,
    execute: (ctx, input) =>
      memoryService.proposeMemory(ctx.userId, input as z.infer<typeof proposeMemorySchema>),
  } as V3ToolContract,
  {
    name: 'saveMemory',
    domain: 'memory',
    description: 'Persist a memory or project context note for future personalization.',
    riskLevel: 'INTERNAL_WRITE',
    idempotent: false,
    inputSchema: createMemorySchema,
    outputSchema: createMemoryOutputSchema,
    toolSchema: saveMemoryToolSchema,
    execute: (ctx, input) =>
      memoryService.createMemory(ctx.userId, input as z.infer<typeof createMemorySchema>),
  } as V3ToolContract,
];
