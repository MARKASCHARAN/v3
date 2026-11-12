import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  ConversationQueryInput,
  CreateConversationMessageInput,
  CreateMemoryInput,
  KeywordMemoryMatch,
  MemoryQueryInput,
  MemoryRecordSummary,
  SemanticMemoryMatch,
  StructuredWorkspaceMetrics,
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
        category: data.category ?? 'GENERAL',
        memoryType: data.memoryType ?? 'SEMANTIC',
        sourceType: data.sourceType ?? 'MANUAL',
        sourceId: data.sourceId,
        tags: data.tags ?? [],
        importance: data.importance ?? 1,
        confidence: data.confidence ?? 1.0,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findMemories(userId: string, filters: Partial<MemoryQueryInput> = {}) {
    const now = new Date();
    const includeExpired = filters.includeExpired === 'true';
    const includeSuperseded = filters.includeSuperseded === 'true';

    return prisma.memory.findMany({
      where: {
        userId,
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.memoryType ? { memoryType: filters.memoryType } : {}),
        ...(filters.tag ? { tags: { has: filters.tag } } : {}),
        ...(!includeSuperseded ? { supersededById: null } : {}),
        ...(!includeExpired
          ? {
              OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            }
          : {}),
        ...(filters.q
          ? {
              AND: [
                {
                  OR: [
                    { title: { contains: filters.q, mode: 'insensitive' } },
                    { content: { contains: filters.q, mode: 'insensitive' } },
                    { tags: { has: filters.q } },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: filters.limit ?? 50,
    });
  }

  async findActiveMemoriesForValidation(
    userId: string,
    limit: number = 100
  ): Promise<MemoryRecordSummary[]> {
    const now = new Date();
    return prisma.memory.findMany({
      where: {
        userId,
        supersededById: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
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
        memoryType: data.memoryType,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        tags: data.tags,
        importance: data.importance,
        confidence: data.confidence,
        expiresAt: data.expiresAt,
        supersededById: data.supersededById,
      },
    });
  }

  async markMemoriesSuperseded(oldMemoryIds: string[], supersededById: string) {
    if (oldMemoryIds.length === 0) {
      return { count: 0 };
    }
    return prisma.memory.updateMany({
      where: { id: { in: oldMemoryIds } },
      data: { supersededById },
    });
  }

  async deleteMemory(id: string) {
    return prisma.memory.delete({
      where: { id },
    });
  }

  async deleteExpiredMemories(userId?: string): Promise<number> {
    const result = await prisma.memory.deleteMany({
      where: {
        ...(userId ? { userId } : {}),
        expiresAt: { lte: new Date() },
      },
    });
    return result.count;
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
      SET "embedding" = ${vectorLiteral}::vector(768)
      WHERE "id" = ${id}
    `;
  }

  async findMemoriesWithoutEmbedding(userId: string, limit: number) {
    const now = new Date();
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
        AND "supersededById" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
      ORDER BY "createdAt" DESC
      LIMIT ${limit}
    `;
  }

  async findSimilarMemories(
    userId: string,
    vectorLiteral: string,
    options: { category?: string; memoryType?: string; limit: number; minSimilarity: number }
  ) {
    const now = new Date();
    const categoryClause = options.category
      ? Prisma.sql`AND "category" = ${options.category}`
      : Prisma.empty;
    const memoryTypeClause = options.memoryType
      ? Prisma.sql`AND "memoryType" = ${options.memoryType}`
      : Prisma.empty;

    return prisma.$queryRaw<SemanticMemoryMatch[]>`
      SELECT
        "id",
        "userId",
        "title",
        "content",
        "category",
        "memoryType",
        "sourceType",
        "sourceId",
        "tags",
        "importance",
        "confidence",
        "expiresAt",
        "supersededById",
        "createdAt",
        "updatedAt",
        (1 - ("embedding" <=> ${vectorLiteral}::vector(768)))::float AS "similarity"
      FROM "memories"
      WHERE "userId" = ${userId}
        AND "embedding" IS NOT NULL
        AND "supersededById" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
        ${categoryClause}
        ${memoryTypeClause}
        AND (1 - ("embedding" <=> ${vectorLiteral}::vector(768))) >= ${options.minSimilarity}
      ORDER BY "similarity" DESC, "importance" DESC
      LIMIT ${options.limit}
    `;
  }

  async findFullTextMemories(
    userId: string,
    queryText: string,
    options: { category?: string; memoryType?: string; limit: number }
  ): Promise<KeywordMemoryMatch[]> {
    const now = new Date();
    const likePattern = `%${queryText}%`;
    const categoryClause = options.category
      ? Prisma.sql`AND "category" = ${options.category}`
      : Prisma.empty;
    const memoryTypeClause = options.memoryType
      ? Prisma.sql`AND "memoryType" = ${options.memoryType}`
      : Prisma.empty;

    return prisma.$queryRaw<KeywordMemoryMatch[]>`
      SELECT
        "id",
        "userId",
        "title",
        "content",
        "category",
        "memoryType",
        "sourceType",
        "sourceId",
        "tags",
        "importance",
        "confidence",
        "expiresAt",
        "supersededById",
        "createdAt",
        "updatedAt",
        GREATEST(
          ts_rank_cd(
            to_tsvector('english', coalesce("title", '') || ' ' || "content"),
            plainto_tsquery('english', ${queryText})
          ),
          CASE
            WHEN coalesce("title", '') ILIKE ${likePattern} OR "content" ILIKE ${likePattern}
              THEN 0.05
            ELSE 0.0
          END
        )::float AS "keywordRank"
      FROM "memories"
      WHERE "userId" = ${userId}
        AND "supersededById" IS NULL
        AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
        ${categoryClause}
        ${memoryTypeClause}
        AND (
          to_tsvector('english', coalesce("title", '') || ' ' || "content") @@ plainto_tsquery('english', ${queryText})
          OR coalesce("title", '') ILIKE ${likePattern}
          OR "content" ILIKE ${likePattern}
        )
      ORDER BY "keywordRank" DESC, "importance" DESC, "updatedAt" DESC
      LIMIT ${options.limit}
    `;
  }

  async findStructuredWorkspaceMetrics(userId: string): Promise<StructuredWorkspaceMetrics> {
    const now = new Date();
    const [
      activeGoalsCount,
      openTasksCount,
      overdueTasksCount,
      pendingRemindersCount,
      upcomingTimeBlocksCount,
    ] = await Promise.all([
      prisma.goal.count({
        where: { userId, status: 'ACTIVE' },
      }),
      prisma.task.count({
        where: { userId, status: { notIn: ['DONE', 'CANCELLED'] } },
      }),
      prisma.task.count({
        where: {
          userId,
          dueDate: { lt: now },
          status: { notIn: ['DONE', 'CANCELLED'] },
        },
      }),
      prisma.reminder.count({
        where: { userId, status: 'PENDING' },
      }),
      prisma.timeBlock.count({
        where: { userId, status: 'SCHEDULED', startTime: { gte: now } },
      }),
    ]);

    return {
      activeGoalsCount,
      openTasksCount,
      overdueTasksCount,
      pendingRemindersCount,
      upcomingTimeBlocksCount,
    };
  }

  async findPersonalizationSignals(userId: string) {
    const now = new Date();
    const [activeGoals, recentMemories] = await Promise.all([
      prisma.goal.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true, title: true, category: true, timeframe: true, progress: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
      prisma.memory.findMany({
        where: {
          userId,
          supersededById: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
        take: 10,
      }),
    ]);

    return { activeGoals, recentMemories };
  }
}
