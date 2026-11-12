import { DiscordAdapter, DiscordRestAdapter } from '../../integrations/discord/discord.adapter';
import { EmailAdapter, ResendEmailAdapter } from '../../integrations/email/resend.adapter';
import {
  GrammyTelegramAdapter,
  TelegramAdapter,
} from '../../integrations/telegram/telegram.adapter';
import {
  WhatsAppAdapter,
  WhatsAppCloudAdapter,
} from '../../integrations/whatsapp/whatsapp.adapter';
import { AppError } from '../../middleware/error.middleware';
import { IntegrationsService } from '../integrations/integrations.service';
import { DecryptedCredentials } from '../integrations/integrations.types';
import { NotificationsRepository } from './notifications.repository';
import {
  NotificationChannel,
  NotificationDeliveryRecord,
  NotificationDeliveryStatus,
  NotificationPreferenceRecord,
  SendNotificationInput,
  UpsertNotificationPreferenceInput,
} from './notifications.types';

const parseMinutes = (hhmm: string): number => {
  const [hoursStr = '0', minsStr = '0'] = hhmm.split(':');
  return Number.parseInt(hoursStr, 10) * 60 + Number.parseInt(minsStr, 10);
};

export const isWithinQuietHours = (
  quietStart: string | null,
  quietEnd: string | null,
  now: Date = new Date()
): boolean => {
  if (!quietStart || !quietEnd) {
    return false;
  }

  const start = parseMinutes(quietStart);
  const end = parseMinutes(quietEnd);
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();

  if (start === end) {
    return false;
  }

  if (start < end) {
    return current >= start && current < end;
  }

  return current >= start || current < end;
};

export interface NotificationAdapters {
  email: EmailAdapter;
  telegram: TelegramAdapter;
  discord: DiscordAdapter;
  whatsapp: WhatsAppAdapter;
}

export class NotificationsService {
  private readonly adapters: NotificationAdapters;

  constructor(
    private readonly repo: NotificationsRepository = new NotificationsRepository(),
    private readonly integrationsService: IntegrationsService = new IntegrationsService(),
    adapters?: Partial<NotificationAdapters>
  ) {
    this.adapters = {
      email: adapters?.email ?? new ResendEmailAdapter(),
      telegram: adapters?.telegram ?? new GrammyTelegramAdapter(),
      discord: adapters?.discord ?? new DiscordRestAdapter(),
      whatsapp: adapters?.whatsapp ?? new WhatsAppCloudAdapter(),
    };
  }

  listPreferences(userId: string): Promise<NotificationPreferenceRecord[]> {
    return this.repo.findPreferencesByUserId(userId);
  }

  upsertPreference(
    userId: string,
    input: UpsertNotificationPreferenceInput
  ): Promise<NotificationPreferenceRecord> {
    return this.repo.upsertPreference(userId, input);
  }

  listDeliveries(
    userId: string,
    filters: {
      channel?: NotificationChannel;
      status?: NotificationDeliveryStatus;
      limit?: number;
    } = {}
  ): Promise<NotificationDeliveryRecord[]> {
    return this.repo.findDeliveriesByUserId(userId, filters);
  }

  private async getChannelCredentials(
    userId: string,
    channel: NotificationChannel
  ): Promise<DecryptedCredentials | null> {
    if (channel === 'TELEGRAM' || channel === 'DISCORD' || channel === 'WHATSAPP') {
      return this.integrationsService.getDecryptedCredentials(userId, channel);
    }
    return null;
  }

  private async dispatchViaChannel(
    userId: string,
    delivery: NotificationDeliveryRecord,
    recipientOverride?: string
  ): Promise<{ providerMessageId: string; finalStatus: 'SENT' | 'DELIVERED' }> {
    const channel = delivery.channel as NotificationChannel;
    const metadata = (delivery.metadata ?? {}) as Record<string, unknown>;
    const recipient =
      recipientOverride ??
      (typeof metadata.recipient === 'string' ? metadata.recipient : undefined);

    if (channel === 'IN_APP' || channel === 'PUSH') {
      return {
        providerMessageId: `${channel.toLowerCase()}-${delivery.id}`,
        finalStatus: 'DELIVERED',
      };
    }

    if (channel === 'EMAIL') {
      const toAddress = recipient ?? (await this.repo.findUserEmail(userId));
      if (!toAddress) {
        throw new AppError(400, 'Recipient email address is required', 'EMAIL_RECIPIENT_MISSING');
      }
      const res = await this.adapters.email.sendEmail({
        to: toAddress,
        subject: delivery.subject ?? 'V3 Notification',
        text: delivery.body,
      });
      return { providerMessageId: res.providerMessageId, finalStatus: 'SENT' };
    }

    const creds = await this.getChannelCredentials(userId, channel);

    if (channel === 'TELEGRAM') {
      const chatId = recipient ?? creds?.chatId;
      if (!chatId) {
        throw new AppError(400, 'Telegram chatId is required', 'TELEGRAM_CHAT_ID_MISSING');
      }
      const res = await this.adapters.telegram.sendMessage({
        chatId,
        text: delivery.body,
        botTokenOverride: creds?.botToken,
      });
      return { providerMessageId: res.providerMessageId, finalStatus: 'SENT' };
    }

    if (channel === 'DISCORD') {
      const channelId = recipient ?? creds?.channelId;
      if (!channelId) {
        throw new AppError(400, 'Discord channelId is required', 'DISCORD_CHANNEL_ID_MISSING');
      }
      const res = await this.adapters.discord.sendMessage({
        channelId,
        content: delivery.body,
        botTokenOverride: creds?.botToken,
      });
      return { providerMessageId: res.providerMessageId, finalStatus: 'SENT' };
    }

    if (channel === 'WHATSAPP') {
      const phone = recipient ?? creds?.phoneNumber;
      if (!phone) {
        throw new AppError(400, 'WhatsApp phoneNumber is required', 'WHATSAPP_PHONE_MISSING');
      }
      const res = await this.adapters.whatsapp.sendTextMessage({
        toPhoneNumber: phone,
        text: delivery.body,
        accessTokenOverride: creds?.accessToken,
        phoneNumberIdOverride: creds?.phoneNumberId,
      });
      return { providerMessageId: res.providerMessageId, finalStatus: 'SENT' };
    }

    throw new AppError(400, `Unsupported notification channel: ${channel}`, 'UNSUPPORTED_CHANNEL');
  }

  async sendNotification(
    userId: string,
    input: SendNotificationInput
  ): Promise<NotificationDeliveryRecord> {
    const pref = await this.repo.findPreference(userId, input.channel);
    if (pref && !pref.enabled) {
      throw new AppError(
        403,
        `Notifications for channel ${input.channel} are disabled in preferences`,
        'CHANNEL_DISABLED'
      );
    }

    if (pref && !input.bypassQuietHours && isWithinQuietHours(pref.quietStart, pref.quietEnd)) {
      throw new AppError(
        409,
        `Channel ${input.channel} is currently in quiet hours (${pref.quietStart} - ${pref.quietEnd} UTC)`,
        'QUIET_HOURS_ACTIVE'
      );
    }

    if (pref) {
      const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sentCount = await this.repo.countRecentDeliveries(userId, input.channel, windowStart);
      if (sentCount >= pref.frequencyCap) {
        throw new AppError(
          429,
          `Daily frequency cap (${pref.frequencyCap}) reached for ${input.channel}`,
          'FREQUENCY_CAP_EXCEEDED'
        );
      }
    }

    const mergedMetadata: Record<string, unknown> = {
      ...(input.metadata ?? {}),
      ...(input.recipient ? { recipient: input.recipient } : {}),
    };

    const created = await this.repo.createDelivery({
      userId,
      channel: input.channel,
      subject: input.subject,
      body: input.body,
      metadata: mergedMetadata,
    });

    return this.executeDeliveryAttempt(userId, created, input.recipient);
  }

  private async executeDeliveryAttempt(
    userId: string,
    delivery: NotificationDeliveryRecord,
    recipientOverride?: string
  ): Promise<NotificationDeliveryRecord> {
    const nextAttempt = delivery.attempts + 1;
    try {
      const result = await this.dispatchViaChannel(userId, delivery, recipientOverride);
      if (result.finalStatus === 'DELIVERED') {
        return this.repo.markDeliveryDelivered(delivery.id, result.providerMessageId, nextAttempt);
      }
      return this.repo.markDeliverySent(delivery.id, result.providerMessageId, nextAttempt);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Notification dispatch failed';
      return this.repo.markDeliveryFailedOrDeadLetter(
        delivery.id,
        message,
        nextAttempt,
        delivery.maxAttempts
      );
    }
  }

  async retryDelivery(deliveryId: string, userId: string): Promise<NotificationDeliveryRecord> {
    const existing = await this.repo.findDeliveryByIdAndUserId(deliveryId, userId);
    if (!existing) {
      throw new AppError(404, 'Notification delivery not found', 'NOT_FOUND');
    }

    if (existing.status === 'DELIVERED' || existing.status === 'SENT') {
      return existing;
    }

    if (existing.status === 'DEAD_LETTER') {
      throw new AppError(
        409,
        'Notification delivery reached DEAD_LETTER after exhausting maxAttempts',
        'DELIVERY_DEAD_LETTER'
      );
    }

    return this.executeDeliveryAttempt(userId, existing);
  }

  async retryPendingFailures(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const retryable = await this.repo.findRetryableDeliveries(50);
    let succeeded = 0;
    let failed = 0;

    for (const delivery of retryable) {
      const updated = await this.executeDeliveryAttempt(delivery.userId, delivery);
      if (updated.status === 'SENT' || updated.status === 'DELIVERED') {
        succeeded += 1;
      } else {
        failed += 1;
      }
    }

    return {
      processed: retryable.length,
      succeeded,
      failed,
    };
  }
}
