import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import {
  NotificationChannel,
  NotificationDeliveryRecord,
  NotificationDeliveryStatus,
  NotificationPreferenceRecord,
  UpsertNotificationPreferenceInput,
} from './notifications.types';

export class NotificationsRepository {
  async findPreferencesByUserId(userId: string): Promise<NotificationPreferenceRecord[]> {
    return prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: { channel: 'asc' },
    });
  }

  async findPreference(
    userId: string,
    channel: NotificationChannel
  ): Promise<NotificationPreferenceRecord | null> {
    return prisma.notificationPreference.findUnique({
      where: {
        userId_channel: {
          userId,
          channel,
        },
      },
    });
  }

  async upsertPreference(
    userId: string,
    input: UpsertNotificationPreferenceInput
  ): Promise<NotificationPreferenceRecord> {
    return prisma.notificationPreference.upsert({
      where: {
        userId_channel: {
          userId,
          channel: input.channel,
        },
      },
      update: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.quietStart !== undefined ? { quietStart: input.quietStart } : {}),
        ...(input.quietEnd !== undefined ? { quietEnd: input.quietEnd } : {}),
        ...(input.frequencyCap !== undefined ? { frequencyCap: input.frequencyCap } : {}),
      },
      create: {
        userId,
        channel: input.channel,
        enabled: input.enabled ?? true,
        quietStart: input.quietStart ?? null,
        quietEnd: input.quietEnd ?? null,
        frequencyCap: input.frequencyCap ?? 20,
      },
    });
  }

  async countRecentDeliveries(
    userId: string,
    channel: NotificationChannel,
    since: Date
  ): Promise<number> {
    return prisma.notificationDelivery.count({
      where: {
        userId,
        channel,
        createdAt: { gte: since },
        status: { in: ['PENDING', 'SENT', 'DELIVERED'] },
      },
    });
  }

  async createDelivery(params: {
    userId: string;
    channel: NotificationChannel;
    subject?: string;
    body: string;
    metadata?: Record<string, unknown>;
    maxAttempts?: number;
  }): Promise<NotificationDeliveryRecord> {
    return prisma.notificationDelivery.create({
      data: {
        userId: params.userId,
        channel: params.channel,
        subject: params.subject,
        body: params.body,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: params.maxAttempts ?? 3,
      },
    });
  }

  async findDeliveriesByUserId(
    userId: string,
    filters: {
      channel?: NotificationChannel;
      status?: NotificationDeliveryStatus;
      limit?: number;
    } = {}
  ): Promise<NotificationDeliveryRecord[]> {
    return prisma.notificationDelivery.findMany({
      where: {
        userId,
        ...(filters.channel ? { channel: filters.channel } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 30,
    });
  }

  async findDeliveryByIdAndUserId(
    id: string,
    userId: string
  ): Promise<NotificationDeliveryRecord | null> {
    return prisma.notificationDelivery.findFirst({
      where: { id, userId },
    });
  }

  async findRetryableDeliveries(limit: number = 50): Promise<NotificationDeliveryRecord[]> {
    return prisma.notificationDelivery.findMany({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
  }

  async markDeliverySent(
    id: string,
    providerMessageId: string,
    attempts: number
  ): Promise<NotificationDeliveryRecord> {
    const now = new Date();
    return prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'SENT',
        providerMessageId,
        attempts,
        lastError: null,
        sentAt: now,
      },
    });
  }

  async markDeliveryDelivered(
    id: string,
    providerMessageId: string,
    attempts: number
  ): Promise<NotificationDeliveryRecord> {
    const now = new Date();
    return prisma.notificationDelivery.update({
      where: { id },
      data: {
        status: 'DELIVERED',
        providerMessageId,
        attempts,
        lastError: null,
        sentAt: now,
        deliveredAt: now,
      },
    });
  }

  async markDeliveryFailedOrDeadLetter(
    id: string,
    errorMessage: string,
    attempts: number,
    maxAttempts: number
  ): Promise<NotificationDeliveryRecord> {
    const status: NotificationDeliveryStatus = attempts >= maxAttempts ? 'DEAD_LETTER' : 'FAILED';
    return prisma.notificationDelivery.update({
      where: { id },
      data: {
        status,
        attempts,
        lastError: errorMessage,
      },
    });
  }

  async findUserEmail(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email ?? null;
  }
}

