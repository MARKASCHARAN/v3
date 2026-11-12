import { z } from 'zod';
import {
  backfillEmbeddingsSchema,
  contextQuerySchema,
  conversationQuerySchema,
  createConversationMessageSchema,
  createMemorySchema,
  hybridSearchQuerySchema,
  memoryCategorySchema,
  memoryQuerySchema,
  memorySourceTypeSchema,
  memoryTypeSchema,
  messageRoleSchema,
  personalizationQuerySchema,
  proposeMemorySchema,
  semanticSearchQuerySchema,
  updateMemorySchema,
  upsertPreferenceSchema,
} from './memory.schema';

export type MemoryCategory = z.infer<typeof memoryCategorySchema>;
export type MemoryType = z.infer<typeof memoryTypeSchema>;
export type MemorySourceType = z.infer<typeof memorySourceTypeSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type CreateMemoryInput = Omit<z.input<typeof createMemorySchema>, 'expiresAt'> & {
  expiresAt?: Date | string | null;
};
export type ProposeMemoryInput = Omit<z.input<typeof proposeMemorySchema>, 'expiresAt'> & {
  expiresAt?: Date | string | null;
};
export type UpdateMemoryInput = z.infer<typeof updateMemorySchema>;
export type MemoryQueryInput = z.infer<typeof memoryQuerySchema>;
export type UpsertPreferenceInput = z.infer<typeof upsertPreferenceSchema>;
export type CreateConversationMessageInput = z.infer<typeof createConversationMessageSchema>;
export type ConversationQueryInput = z.infer<typeof conversationQuerySchema>;
export type ContextQueryInput = z.infer<typeof contextQuerySchema>;
export type SemanticSearchQueryInput = z.infer<typeof semanticSearchQuerySchema>;
export type HybridSearchQueryInput = z.infer<typeof hybridSearchQuerySchema>;
export type PersonalizationQueryInput = z.infer<typeof personalizationQuerySchema>;
export type BackfillEmbeddingsInput = z.infer<typeof backfillEmbeddingsSchema>;

export interface MemoryRecordSummary {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  category: string;
  memoryType: string;
  sourceType: string;
  sourceId: string | null;
  tags: string[];
  importance: number;
  confidence: number;
  expiresAt: Date | null;
  supersededById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SemanticMemoryMatch extends MemoryRecordSummary {
  similarity: number;
}

export interface KeywordMemoryMatch extends MemoryRecordSummary {
  keywordRank: number;
}

export interface HybridMemoryMatch extends MemoryRecordSummary {
  rrfScore: number;
  similarity: number | null;
  keywordRank: number | null;
  vectorRankPosition: number | null;
  keywordRankPosition: number | null;
}

export interface StructuredWorkspaceMetrics {
  activeGoalsCount: number;
  openTasksCount: number;
  overdueTasksCount: number;
  pendingRemindersCount: number;
  upcomingTimeBlocksCount: number;
}

export interface EmbeddingGenerator {
  embedDocument(text: string): Promise<number[]>;
  embedQuery(text: string): Promise<number[]>;
}
