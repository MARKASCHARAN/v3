import { z } from 'zod';
import {
  backfillEmbeddingsSchema,
  contextQuerySchema,
  conversationQuerySchema,
  createConversationMessageSchema,
  createMemorySchema,
  memoryCategorySchema,
  memoryQuerySchema,
  messageRoleSchema,
  personalizationQuerySchema,
  semanticSearchQuerySchema,
  updateMemorySchema,
  upsertPreferenceSchema,
} from './memory.schema';

export type MemoryCategory = z.infer<typeof memoryCategorySchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type CreateMemoryInput = z.infer<typeof createMemorySchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type MemoryQueryInput = z.infer<typeof memoryQuerySchema>;
export type UpsertPreferenceInput = z.infer<typeof upsertPreferenceSchema>;
export type CreateConversationMessageInput = z.infer<typeof createConversationMessageSchema>;
export type ConversationQueryInput = z.infer<typeof conversationQuerySchema>;
export type ContextQueryInput = z.infer<typeof contextQuerySchema>;
export type SemanticSearchQueryInput = z.infer<typeof semanticSearchQuerySchema>;
export type PersonalizationQueryInput = z.infer<typeof personalizationQuerySchema>;
export type BackfillEmbeddingsInput = z.infer<typeof backfillEmbeddingsSchema>;

export interface SemanticMemoryMatch {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  category: string;
  tags: string[];
  importance: number;
  createdAt: Date;
  updatedAt: Date;
  similarity: number;
}

export interface EmbeddingGenerator {
  embedDocument(text: string): Promise<number[]>;
  embedQuery(text: string): Promise<number[]>;
}
