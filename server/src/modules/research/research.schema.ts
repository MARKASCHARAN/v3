import { z } from 'zod';

export const researchStatusSchema = z.enum(['COMPLETED', 'SAVED_TO_MEMORY', 'ARCHIVED']);

export const researchSourceSchema = z.object({
  title: z.string().trim().max(300).optional(),
  url: z.string().url(),
  snippet: z.string().trim().max(1000).optional(),
});

export const synthesizedResearchOutputSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().min(1).max(10000),
  keyFindings: z.array(z.string().trim().min(1)).min(1),
});

export const conductResearchSchema = z.object({
  query: z.string().trim().min(2, 'Research query is required').max(1000),
  urls: z.array(z.string().url('Invalid URL')).max(5).default([]),
  goalId: z.string().uuid('Invalid goal ID').optional(),
  saveToMemory: z.boolean().default(false),
});

export const createResearchSchema = z.object({
  goalId: z.string().uuid('Invalid goal ID').optional(),
  query: z.string().trim().min(1).max(1000),
  title: z.string().trim().min(1, 'Title is required').max(300),
  summary: z.string().trim().min(1, 'Summary is required').max(10000),
  keyFindings: z.array(z.string().trim().min(1)).default([]),
  sources: z.array(researchSourceSchema).default([]),
});

export const researchQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  goalId: z.string().uuid().optional(),
  status: researchStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const researchIdParamSchema = z.object({
  id: z.string().uuid('Invalid research ID'),
});
