import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  ConversationQueryInput,
  CreateConversationMessageInput,
  CreateMemoryInput,
  MemoryQueryInput,
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
}
