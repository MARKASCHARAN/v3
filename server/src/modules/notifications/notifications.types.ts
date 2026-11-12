export type NotificationChannel = 'EMAIL' | 'TELEGRAM' | 'DISCORD' | 'WHATSAPP' | 'IN_APP' | 'PUSH';

export type NotificationDeliveryStatus =
  'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';

export interface NotificationPreferenceRecord {
  id: string;
  userId: string;
  channel: string;
  enabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  frequencyCap: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationDeliveryRecord {
  id: string;
  userId: string;
  channel: string;
  subject: string | null;
  body: string;
  providerMessageId: string | null;
  status: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  metadata: unknown;
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertNotificationPreferenceInput {
  channel: NotificationChannel;
  enabled?: boolean;
  quietStart?: string | null;
  quietEnd?: string | null;
  frequencyCap?: number;
}

export interface SendNotificationInput {
  channel: NotificationChannel;
  subject?: string;
  body: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  bypassQuietHours?: boolean;
}
