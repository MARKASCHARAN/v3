import { z } from 'zod';
import {
  createMemorySchema,
  memoryCategorySchema,
  memoryQuerySchema,
  semanticSearchQuerySchema,
} from '../../../modules/memory/memory.schema';
import { MemoryService } from '../../../modules/memory/memory.service';
import { V3ToolContract } from '../tool.types';

const memoryService = new MemoryService();

const searchMemoryToolSchema = z.object({
  category: memoryCategorySchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const semanticSearchMemoryToolSchema = z.object({
  q: z.string().trim().min(1).max(1000),
  category: memoryCategorySchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.3),
});

const memoryListOutputSchema = z.array(z.record(z.string(), z.unknown()));
const semanticResultOutputSchema = z.record(z.string(), z.unknown());
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
    outputSchema: semanticResultOutputSchema,
    toolSchema: semanticSearchMemoryToolSchema,
    execute: (ctx, input) =>
      memoryService.semanticSearch(ctx.userId, input as z.infer<typeof semanticSearchQuerySchema>),
  } as V3ToolContract,
  {
    name: 'saveMemory',
    domain: 'memory',
    description: 'Persist a memory or project context note for future personalization.',
    riskLevel: 'INTERNAL_WRITE',
    idempotent: false,
    inputSchema: createMemorySchema,
    outputSchema: createMemoryOutputSchema,
    execute: (ctx, input) =>
      memoryService.createMemory(ctx.userId, input as z.infer<typeof createMemorySchema>),
  } as V3ToolContract,
];
