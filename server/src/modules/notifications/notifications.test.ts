import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../app';
import { IntegrationsService } from '../integrations/integrations.service';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService, isWithinQuietHours } from './notifications.service';
import { NotificationDeliveryRecord } from './notifications.types';

const makeDelivery = (
  overrides: Partial<NotificationDeliveryRecord> = {}
): NotificationDeliveryRecord => ({
  id: '33333333-3333-3333-3333-333333333333',
  userId: 'user-1',
  channel: 'TELEGRAM',
  subject: null,
  body: 'Daily briefing ready',
  providerMessageId: null,
  status: 'PENDING',
  attempts: 0,
  maxAttempts: 3,
  lastError: null,
  metadata: { recipient: 'chat-99' },
  sentAt: null,
  deliveredAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Notifications Module (M2.8)', () => {
  it('evaluates standard and midnight-wrapping UTC quiet hours accurately', () => {
    const afternoon = new Date('2026-11-12T14:30:00.000Z');
    const lateNight = new Date('2026-11-12T23:30:00.000Z');
    const earlyMorning = new Date('2026-11-13T05:30:00.000Z');

    expect(isWithinQuietHours('22:00', '07:00', lateNight)).toBe(true);
    expect(isWithinQuietHours('22:00', '07:00', earlyMorning)).toBe(true);
    expect(isWithinQuietHours('22:00', '07:00', afternoon)).toBe(false);
    expect(isWithinQuietHours('13:00', '15:00', afternoon)).toBe(true);
  });

  it('enforces channel disablement and daily frequency caps', async () => {
    const repoDisabled = {
      findPreference: vi.fn().mockResolvedValue({
        id: 'pref-1',
        userId: 'user-1',
        channel: 'DISCORD',
        enabled: false,
        quietStart: null,
        quietEnd: null,
        frequencyCap: 20,
      }),
    } as unknown as NotificationsRepository;

    const svcDisabled = new NotificationsService(repoDisabled);
    await expect(
      svcDisabled.sendNotification('user-1', { channel: 'DISCORD', body: 'Hello' })
    ).rejects.toThrow('Notifications for channel DISCORD are disabled');

    const repoCapped = {
      findPreference: vi.fn().mockResolvedValue({
        id: 'pref-2',
        userId: 'user-1',
        channel: 'EMAIL',
        enabled: true,
        quietStart: null,
        quietEnd: null,
        frequencyCap: 5,
      }),
      countRecentDeliveries: vi.fn().mockResolvedValue(5),
    } as unknown as NotificationsRepository;

    const svcCapped = new NotificationsService(repoCapped);
    await expect(
      svcCapped.sendNotification('user-1', { channel: 'EMAIL', body: 'Over cap' })
    ).rejects.toThrow('Daily frequency cap (5) reached');
  });

  it('dispatches across Email (Resend) and Telegram, and retries failed deliveries to DEAD_LETTER', async () => {
    const initial = makeDelivery({ channel: 'EMAIL', metadata: { recipient: 'u@example.com' } });
    const sent = makeDelivery({
      channel: 'EMAIL',
      status: 'SENT',
      providerMessageId: 're_123',
      attempts: 1,
    });

    const repo = {
      findPreference: vi.fn().mockResolvedValue(null),
      createDelivery: vi.fn().mockResolvedValue(initial),
      markDeliverySent: vi.fn().mockResolvedValue(sent),
      findDeliveryByIdAndUserId: vi
        .fn()
        .mockResolvedValue(makeDelivery({ status: 'FAILED', attempts: 2, maxAttempts: 3 })),
      markDeliveryFailedOrDeadLetter: vi
        .fn()
        .mockResolvedValue(makeDelivery({ status: 'DEAD_LETTER', attempts: 3, maxAttempts: 3 })),
    } as unknown as NotificationsRepository;

    const integrations = {
      getDecryptedCredentials: vi.fn().mockResolvedValue({ chatId: 'chat-99', botToken: 'tg-tok' }),
    } as unknown as IntegrationsService;

    const emailAdapter = {
      isConfigured: () => true,
      sendEmail: vi.fn().mockResolvedValue({ providerMessageId: 're_123', accepted: true }),
    };

    const telegramAdapter = {
      isConfigured: () => true,
      sendMessage: vi.fn().mockRejectedValue(new Error('Telegram gateway timeout')),
    };

    const service = new NotificationsService(repo, integrations, {
      email: emailAdapter,
      telegram: telegramAdapter,
    });

    const sentResult = await service.sendNotification('user-1', {
      channel: 'EMAIL',
      subject: 'Focus Report',
      body: 'All goals on track',
      recipient: 'u@example.com',
    });

    expect(sentResult.status).toBe('SENT');
    expect(emailAdapter.sendEmail).toHaveBeenCalledOnce();

    const retried = await service.retryDelivery(initial.id, 'user-1');
    expect(retried.status).toBe('DEAD_LETTER');
    expect(repo.markDeliveryFailedOrDeadLetter).toHaveBeenCalledWith(
      initial.id,
      'Telegram gateway timeout',
      3,
      3
    );
  });

  it('protects /api/v1/notifications endpoints with authentication', async () => {
    const res = await request(app).get('/api/v1/notifications/deliveries');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

