import { z } from 'zod';

export const notificationChannelSchema = z.enum([
  'EMAIL',
  'TELEGRAM',
  'DISCORD',
  'WHATSAPP',
  'IN_APP',
  'PUSH',
]);

export const notificationStatusSchema = z.enum([
  'PENDING',
  'SENT',
  'DELIVERED',
  'FAILED',
  'DEAD_LETTER',
]);

export const upsertNotificationPreferenceSchema = z.object({
  channel: notificationChannelSchema,
  enabled: z.boolean().optional(),
  quietStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Quiet hours must use HH:mm format')
    .nullable()
    .optional(),
  quietEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Quiet hours must use HH:mm format')
    .nullable()
    .optional(),
  frequencyCap: z.number().int().min(1).max(200).optional(),
});

export const sendNotificationSchema = z.object({
  channel: notificationChannelSchema,
  subject: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1).max(5000),
  recipient: z.string().trim().min(1).max(320).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  bypassQuietHours: z.boolean().default(false),
});

export const deliveriesQuerySchema = z.object({
  channel: notificationChannelSchema.optional(),
  status: notificationStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const deliveryIdParamSchema = z.object({
  id: z.string().uuid('Invalid delivery ID'),
});
