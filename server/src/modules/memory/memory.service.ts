import { AppError } from '../../middleware/error.middleware';
import { MemoryRepository } from './memory.repository';
import {
  ContextQueryInput,
  ConversationQueryInput,
  CreateConversationMessageInput,
  CreateMemoryInput,
  MemoryQueryInput,
  UpdateMemoryInput,
  UpsertPreferenceInput,
} from './memory.types';

export class MemoryService {
  constructor(private readonly memoryRepository: MemoryRepository = new MemoryRepository()) {}

  async createMemory(userId: string, data: CreateMemoryInput) {
    return this.memoryRepository.createMemory(userId, data);
  }

  async getMemories(userId: string, filters: Partial<MemoryQueryInput> = {}) {
    return this.memoryRepository.findMemories(userId, filters);
  }

  async getMemoryById(id: string, userId: string) {
    const memory = await this.memoryRepository.findMemoryByIdAndUserId(id, userId);
    if (!memory) {
      throw new AppError(404, 'Memory not found', 'MEMORY_NOT_FOUND');
    }
    return memory;
  }

  async updateMemory(id: string, userId: string, data: UpdateMemoryInput) {
    await this.getMemoryById(id, userId);
    return this.memoryRepository.updateMemory(id, data);
  }

  async deleteMemory(id: string, userId: string) {
    await this.getMemoryById(id, userId);
    await this.memoryRepository.deleteMemory(id);
  }

  async upsertPreference(userId: string, data: UpsertPreferenceInput) {
    return this.memoryRepository.upsertPreference(userId, data);
  }

  async getPreferences(userId: string) {
    return this.memoryRepository.findPreferences(userId);
  }

  async deletePreference(userId: string, key: string) {
    const existing = await this.memoryRepository.findPreferenceByKey(userId, key);
    if (!existing) {
      throw new AppError(404, 'Preference not found', 'PREFERENCE_NOT_FOUND');
    }
    await this.memoryRepository.deletePreference(userId, key);
  }

  async appendMessage(userId: string, data: CreateConversationMessageInput) {
    return this.memoryRepository.createConversationMessage(userId, data);
  }

  async getConversationHistory(userId: string, query: Partial<ConversationQueryInput> = {}) {
    return this.memoryRepository.findConversationMessages(userId, query);
  }

  async clearConversationHistory(userId: string, sessionId: string) {
    return this.memoryRepository.deleteConversationSession(userId, sessionId);
  }

  async getContextBundle(userId: string, query: Partial<ContextQueryInput> = {}) {
    const [preferences, memories, recentMessages] = await Promise.all([
      this.memoryRepository.findPreferences(userId),
      this.memoryRepository.findMemories(userId, {
        q: query.q,
        limit: query.limit ?? 20,
      }),
      this.memoryRepository.findConversationMessages(userId, {
        sessionId: query.sessionId ?? 'default',
        limit: query.limit ?? 20,
      }),
    ]);

    return {
      preferences,
      memories,
      recentMessages,
    };
  }
}
