import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { CreateResearchInput, ResearchQueryInput, ResearchStatus } from './research.types';

const researchInclude = {
  goal: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
};

export class ResearchRepository {
  async create(
    userId: string,
    data: CreateResearchInput & { provider?: string; model?: string; status?: ResearchStatus }
  ) {
    return prisma.researchItem.create({
      data: {
        userId,
        goalId: data.goalId,
        query: data.query,
        title: data.title,
        summary: data.summary,
        keyFindings: data.keyFindings as unknown as Prisma.InputJsonValue,
        sources: data.sources as unknown as Prisma.InputJsonValue,
        status: data.status ?? 'COMPLETED',
        provider: data.provider,
        model: data.model,
      },
      include: researchInclude,
    });
  }

  async findAllByUserId(userId: string, filters: Partial<ResearchQueryInput> = {}) {
    return prisma.researchItem.findMany({
      where: {
        userId,
        ...(filters.goalId ? { goalId: filters.goalId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.q
          ? {
              OR: [
                { query: { contains: filters.q, mode: 'insensitive' } },
                { title: { contains: filters.q, mode: 'insensitive' } },
                { summary: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: researchInclude,
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 25,
    });
  }

  async findByIdAndUserId(id: string, userId: string) {
    return prisma.researchItem.findFirst({
      where: { id, userId },
      include: researchInclude,
    });
  }

  async findOwnedGoal(goalId: string, userId: string) {
    return prisma.goal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });
  }

  async updateStatus(id: string, status: ResearchStatus) {
    return prisma.researchItem.update({
      where: { id },
      data: { status },
      include: researchInclude,
    });
  }

  async delete(id: string) {
    return prisma.researchItem.delete({
      where: { id },
    });
  }
}
