import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  ConversationQueryInput,
  CreateConversationMessageInput,
  CreateMemoryInput,
  MemoryQueryInput,
  SemanticMemoryMatch,
  UpdateMemoryInput,
  UpsertPreferenceInput,
} from './memory.types';

export class MemoryRepository {
  async createMemory(userId: string, data: CreateMemoryInput) {
    return prisma.memory.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags,
        importance: data.importance,
      },
    });
  }

  async findMemories(userId: string, filters: Partial<MemoryQueryInput> = {}) {
    return prisma.memory.findMany({
      where: {
        userId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {}),
        ...(filters.q
          ? {
              OR: [
                { title: { contains: filters.q, mode: 'insensitive' } },
                { content: { contains: filters.q, mode: 'insensitive' } },
                { tags: { has: filters.q } },
              ],
            }
          : {}),
      },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: filters.limit ?? 50,
    });
  }

  async findMemoryByIdAndUserId(id: string, userId: string) {
    return prisma.memory.findFirst({
      where: { id, userId },
    });
  }

  async updateMemory(id: string, data: UpdateMemoryInput) {
    return prisma.memory.update({
      where: { id },
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags,
        importance: data.importance,
      },
    });
  }

  async deleteMemory(id: string) {
    return prisma.memory.delete({
      where: { id },
    });
  }

  async upsertPreference(userId: string, data: UpsertPreferenceInput) {
    return prisma.userPreference.upsert({
      where: {
        userId_key: {
          userId,
          key: data.key,
        },
      },
      update: {
        value: data.value,
        category: data.category,
      },
      create: {
        userId,
        key: data.key,
        value: data.value,
        category: data.category,
      },
    });
  }

  async findPreferences(userId: string) {
    return prisma.userPreference.findMany({
      where: { userId },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findPreferenceByKey(userId: string, key: string) {
    return prisma.userPreference.findUnique({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
    });
  }

  async deletePreference(userId: string, key: string) {
    return prisma.userPreference.delete({
      where: {
        userId_key: {
          userId,
          key,
        },
      },
    });
  }

  async createConversationMessage(userId: string, data: CreateConversationMessageInput) {
    return prisma.conversationMessage.create({
      data: {
        userId,
        sessionId: data.sessionId,
        role: data.role,
        content: data.content,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findConversationMessages(userId: string, query: Partial<ConversationQueryInput> = {}) {
    return prisma.conversationMessage.findMany({
      where: {
        userId,
        sessionId: query.sessionId ?? 'default',
      },
      orderBy: { createdAt: 'asc' },
      take: query.limit ?? 50,
    });
  }

  async deleteConversationSession(userId: string, sessionId: string) {
    return prisma.conversationMessage.deleteMany({
      where: { userId, sessionId },
    });
  }

  async updateMemoryEmbedding(id: string, vectorLiteral: string) {
    return prisma.$executeRaw`
      UPDATE "memories"
      SET "embedding" = ${vectorLiteral}::vector
      WHERE "id" = ${id}
    `;
  }

  async findMemoriesWithoutEmbedding(userId: string, limit: number) {
    return prisma.$queryRaw<
      Array<{
        id: string;
        title: string | null;
        content: string;
        category: string;
        tags: string[];
      }>
    >`
      SELECT "id", "title", "content", "category", "tags"
      FROM "memories"
      WHERE "userId" = ${userId}
        AND "embedding" IS NULL
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
  }

  async findSimilarMemories(
    userId: string,
    vectorLiteral: string,
    options: { category?: string; limit: number; minSimilarity: number }
  ) {
    const categoryClause = options.category
      ? Prisma.sql`AND "category" = ${options.category}`
      : Prisma.empty;

    return prisma.$queryRaw<SemanticMemoryMatch[]>`
      SELECT
        "id",
        "userId",
        "title",
        "content",
        "category",
        "tags",
        "importance",
        "createdAt",
        "updatedAt",
        (1 - ("embedding" <=> ${vectorLiteral}::vector))::float AS "similarity"
      FROM "memories"
      WHERE "userId" = ${userId}
        AND "embedding" IS NOT NULL
        ${categoryClause}
        AND (1 - ("embedding" <=> ${vectorLiteral}::vector)) >= ${options.minSimilarity}
      ORDER BY "similarity" DESC, "importance" DESC
      LIMIT ${options.limit}
    `;
  }

  async findPersonalizationSignals(userId: string) {
    const [activeGoals, recentMemories] = await Promise.all([
      prisma.goal.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, title: true, category: true, timeframe: true, progress: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.memory.findMany({
        where: { userId },
        orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
        take: 10,
      }),
    ]);

    return { activeGoals, recentMemories };
  }
}
