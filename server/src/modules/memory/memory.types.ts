import { z } from 'zod';
import {
  contextQuerySchema,
  conversationQuerySchema,
  createConversationMessageSchema,
  createMemorySchema,
  memoryCategorySchema,
  memoryQuerySchema,
  messageRoleSchema,
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
