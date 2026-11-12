import { z } from 'zod';
import { wrapUntrustedExternalData } from '../../guardrails/prompt-injection.guard';
import { IntegrationsService } from '../../../modules/integrations/integrations.service';
import {
  deliveriesQuerySchema,
  notificationChannelSchema,
} from '../../../modules/notifications/notifications.schema';
import { NotificationsService } from '../../../modules/notifications/notifications.service';
import { V3ToolContract } from '../tool.types';

const notificationsService = new NotificationsService();
const integrationsService = new IntegrationsService();

const sendNotificationArgsSchema = z.object({
  channel: notificationChannelSchema,
  subject: z.string().trim().max(500).optional(),
  body: z.string().trim().min(1).max(5000),
  recipient: z.string().trim().min(1).max(320).optional(),
  bypassQuietHours: z.boolean().default(false),
});

const sendNotificationToolSchema = z.object({
  channel: notificationChannelSchema,
  subject: z.string().optional(),
  body: z.string().min(1).max(5000),
  recipient: z.string().optional(),
});

const listDeliveriesToolSchema = z.object({
  channel: notificationChannelSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const syncCalendarArgsSchema = z.object({
  timeMin: z.string().datetime().optional(),
  timeMax: z.string().datetime().optional(),
  maxResults: z.number().int().min(1).max(50).default(20),
  importAsTimeBlocks: z.boolean().default(true),
});

const syncCalendarToolSchema = z.object({
  timeMin: z.string().describe('ISO 8601 start datetime').optional(),
  timeMax: z.string().describe('ISO 8601 end datetime').optional(),
  maxResults: z.number().int().min(1).max(50).optional(),
  importAsTimeBlocks: z.boolean().optional(),
});

const listGmailArgsSchema = z.object({
  q: z.string().trim().max(300).optional(),
  maxResults: z.number().int().min(1).max(25).default(10),
});

const listGmailToolSchema = z.object({
  q: z.string().optional(),
  maxResults: z.number().int().min(1).max(25).optional(),
});

export const COMMUNICATION_EXTERNAL_TOOLS: V3ToolContract[] = [
  {
    name: 'sendNotification',
    domain: 'notifications',
    description:
      'Send an outbound notification or message via EMAIL (Resend), TELEGRAM, DISCORD, WHATSAPP, IN_APP, or PUSH.',
    riskLevel: 'EXTERNAL_CONSEQUENTIAL',
    idempotent: false,
    inputSchema: sendNotificationArgsSchema,
    outputSchema: z.object({ id: z.string() }).catchall(z.unknown()),
    toolSchema: sendNotificationToolSchema,
    execute: (ctx, input) =>
      notificationsService.sendNotification(
        ctx.userId,
        input as z.infer<typeof sendNotificationArgsSchema>
      ),
  } as V3ToolContract,
  {
    name: 'listNotificationDeliveries',
    domain: 'notifications',
    description: 'List recent notification delivery attempts and statuses for the user.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: deliveriesQuerySchema,
    outputSchema: z.array(z.record(z.string(), z.unknown())),
    toolSchema: listDeliveriesToolSchema,
    execute: (ctx, input) =>
      notificationsService.listDeliveries(
        ctx.userId,
        input as z.infer<typeof deliveriesQuerySchema>
      ),
  } as V3ToolContract,
  {
    name: 'syncGoogleCalendar',
    domain: 'integrations',
    description:
      'Fetch upcoming Google Calendar events and optionally import them as V3 calendar time blocks.',
    riskLevel: 'EXTERNAL_REVERSIBLE',
    idempotent: true,
    inputSchema: syncCalendarArgsSchema,
    outputSchema: z.record(z.string(), z.unknown()),
    toolSchema: syncCalendarToolSchema,
    execute: (ctx, input) =>
      integrationsService.syncGoogleCalendar(
        ctx.userId,
        input as z.infer<typeof syncCalendarArgsSchema>
      ),
  } as V3ToolContract,
  {
    name: 'listGmailMessages',
    domain: 'integrations',
    description: 'Read recent Gmail message summaries matching an optional search query.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: listGmailArgsSchema,
    outputSchema: z.array(z.record(z.string(), z.unknown())),
    toolSchema: listGmailToolSchema,
    execute: async (ctx, input) => {
      const messages = await integrationsService.listGmailMessages(
        ctx.userId,
        input as z.infer<typeof listGmailArgsSchema>
      );
      return messages.map((msg) => ({
        id: msg.id,
        threadId: msg.threadId,
        receivedAt: msg.receivedAt,
        from: msg.from,
        wrappedContent: wrapUntrustedExternalData({
          sourceType: 'EMAIL',
          sourceId: msg.id,
          origin: msg.from,
          content: `Subject: ${msg.subject}\n\n${msg.snippet}`,
        }),
      }));
    },
  } as V3ToolContract,
];
