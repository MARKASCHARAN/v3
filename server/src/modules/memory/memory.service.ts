import { generateTextEmbedding } from '../../ai/providers/embeddings';
import { AppError } from '../../middleware/error.middleware';
import { MemoryRepository } from './memory.repository';
import {
  ContextQueryInput,
  ConversationQueryInput,
  CreateConversationMessageInput,
  CreateMemoryInput,
  EmbeddingGenerator,
  MemoryQueryInput,
  PersonalizationQueryInput,
  SemanticSearchQueryInput,
  UpdateMemoryInput,
  UpsertPreferenceInput,
} from './memory.types';

export const formatVectorLiteral = (embedding: number[]): string => `[${embedding.join(',')}]`;

export const buildMemoryEmbeddingText = (memory: {
  title?: string | null;
  category: string;
  tags?: string[];
  content: string;
}): string => {
  const parts = [
    `[${memory.category}]`,
    memory.title ?? '',
    memory.tags && memory.tags.length > 0 ? `Tags: ${memory.tags.join(', ')}` : '',
    memory.content,
  ].filter(Boolean);
  return parts.join(' ');
};

const defaultEmbeddingGenerator: EmbeddingGenerator = {
  embedDocument: (text) => generateTextEmbedding(text, 'RETRIEVAL_DOCUMENT'),
  embedQuery: (text) => generateTextEmbedding(text, 'RETRIEVAL_QUERY'),
};

export class MemoryService {
  constructor(
    private readonly memoryRepository: MemoryRepository = new MemoryRepository(),
    private readonly embeddingGenerator: EmbeddingGenerator = defaultEmbeddingGenerator
  ) {}

  private async trySyncMemoryEmbedding(memory: {
    id: string;
    title: string | null;
    category: string;
    tags: string[];
    content: string;
  }): Promise<boolean> {
    try {
      const text = buildMemoryEmbeddingText(memory);
      const vector = await this.embeddingGenerator.embedDocument(text);
      await this.memoryRepository.updateMemoryEmbedding(memory.id, formatVectorLiteral(vector));
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_PROVIDER_UNCONFIGURED') {
        return false;
      }
      return false;
    }
  }

  async createMemory(userId: string, data: CreateMemoryInput) {
    const memory = await this.memoryRepository.createMemory(userId, data);
    await this.trySyncMemoryEmbedding(memory);
    return memory;
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
    const updated = await this.memoryRepository.updateMemory(id, data);
    await this.trySyncMemoryEmbedding(updated);
    return updated;
  }

  async deleteMemory(id: string, userId: string) {
    await this.getMemoryById(id, userId);
    await this.memoryRepository.deleteMemory(id);
  }

  async semanticSearch(userId: string, query: SemanticSearchQueryInput) {
    try {
      const vector = await this.embeddingGenerator.embedQuery(query.q);
      const results = await this.memoryRepository.findSimilarMemories(
        userId,
        formatVectorLiteral(vector),
        {
          category: query.category,
          limit: query.limit,
          minSimilarity: query.minSimilarity,
        }
      );

      if (results.length > 0) {
        return {
          mode: 'pgvector' as const,
          query: query.q,
          results,
        };
      }

      const keywordMatches = await this.memoryRepository.findMemories(userId, {
        q: query.q,
        category: query.category,
        limit: query.limit,
      });

      return {
        mode: 'pgvector_with_keyword_fallback' as const,
        query: query.q,
        results: keywordMatches.map((item) => ({ ...item, similarity: null })),
      };
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_PROVIDER_UNCONFIGURED') {
        const keywordMatches = await this.memoryRepository.findMemories(userId, {
          q: query.q,
          category: query.category,
          limit: query.limit,
        });
        return {
          mode: 'keyword_fallback' as const,
          query: query.q,
          results: keywordMatches.map((item) => ({ ...item, similarity: null })),
        };
      }
      throw error;
    }
  }

  async backfillEmbeddings(userId: string, limit: number = 25) {
    const missing = await this.memoryRepository.findMemoriesWithoutEmbedding(userId, limit);
    let updatedCount = 0;

    for (const item of missing) {
      const synced = await this.trySyncMemoryEmbedding(item);
      if (synced) {
        updatedCount += 1;
      }
    }

    return {
      processedCount: missing.length,
      updatedCount,
    };
  }

  async getPersonalizationContext(userId: string, query: Partial<PersonalizationQueryInput> = {}) {
    const [preferences, signals] = await Promise.all([
      this.memoryRepository.findPreferences(userId),
      this.memoryRepository.findPersonalizationSignals(userId),
    ]);

    const relevantMemories = query.topic
      ? (
          await this.semanticSearch(userId, {
            q: query.topic,
            limit: query.limit ?? 10,
            minSimilarity: 0.25,
          })
        ).results
      : signals.recentMemories;

    const categoryCounts = new Map<string, number>();
    for (const goal of signals.activeGoals) {
      categoryCounts.set(goal.category, (categoryCounts.get(goal.category) ?? 0) + 1);
    }

    const focusCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, activeGoalsCount: count }));

    return {
      preferences,
      focusCategories,
      activeGoals: signals.activeGoals,
      relevantMemories,
    };
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
      query.q
        ? this.semanticSearch(userId, {
            q: query.q,
            limit: query.limit ?? 20,
            minSimilarity: 0.25,
          }).then((res) => res.results)
        : this.memoryRepository.findMemories(userId, { limit: query.limit ?? 20 }),
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
