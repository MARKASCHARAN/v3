import { prisma } from '../../database/prisma';
import {
  IntegrationAccountRecord,
  IntegrationProvider,
  IntegrationStatus,
} from './integrations.types';

export class IntegrationsRepository {
  async upsertAccount(params: {
    userId: string;
    provider: IntegrationProvider;
    encryptedCredentials: string;
    externalAccountId?: string;
    scopes?: string[];
  }): Promise<IntegrationAccountRecord> {
    return prisma.integrationAccount.upsert({
      where: {
        userId_provider: {
          userId: params.userId,
          provider: params.provider,
        },
      },
      update: {
        encryptedCredentials: params.encryptedCredentials,
        ...(params.externalAccountId !== undefined
          ? { externalAccountId: params.externalAccountId }
          : {}),
        ...(params.scopes !== undefined ? { scopes: params.scopes } : {}),
        status: 'ACTIVE',
      },
      create: {
        userId: params.userId,
        provider: params.provider,
        encryptedCredentials: params.encryptedCredentials,
        externalAccountId: params.externalAccountId,
        scopes: params.scopes ?? [],
        status: 'ACTIVE',
      },
    });
  }

  async findByUserId(userId: string): Promise<IntegrationAccountRecord[]> {
    return prisma.integrationAccount.findMany({
      where: { userId },
      orderBy: { provider: 'asc' },
    });
  }

  async findByUserIdAndProvider(
    userId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationAccountRecord | null> {
    return prisma.integrationAccount.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
  }

  async updateAccount(
    userId: string,
    provider: IntegrationProvider,
    data: {
      encryptedCredentials?: string;
      externalAccountId?: string;
      scopes?: string[];
      status?: IntegrationStatus;
      lastSyncedAt?: Date;
    }
  ): Promise<IntegrationAccountRecord> {
    return prisma.integrationAccount.update({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      data,
    });
  }

  async deleteAccount(userId: string, provider: IntegrationProvider): Promise<void> {
    await prisma.integrationAccount.delete({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });
  }
}
