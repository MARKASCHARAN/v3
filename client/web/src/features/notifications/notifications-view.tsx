'use client';

import { Bell, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { FormEvent, useCallback, useState } from 'react';
import {
  MotionInteractiveSurface,
  MotionStaggerGrid,
  MotionStaggerItem,
} from '@/components/ui/motion';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { notificationsApi } from '@/lib/v3-api';
import { NotificationChannel, NotificationDeliveryStatus } from '@/types/api';

const channels: NotificationChannel[] = ['IN_APP', 'EMAIL', 'TELEGRAM', 'DISCORD', 'WHATSAPP', 'PUSH'];

const deliveryTone = (status: NotificationDeliveryStatus): 'green' | 'orange' | 'red' => {
  if (status === 'DELIVERED' || status === 'SENT') return 'green';
  if (status === 'PENDING') return 'orange';
  return 'red';
};

export function NotificationsView() {
  const [channel, setChannel] = useState<NotificationChannel>('IN_APP');
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bypassQuietHours, setBypassQuietHours] = useState(false);
  const [sending, setSending] = useState(false);

  const [prefChannel, setPrefChannel] = useState<NotificationChannel>('EMAIL');
  const [prefEnabled, setPrefEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState('');
  const [quietEnd, setQuietEnd] = useState('');
  const [frequencyCap, setFrequencyCap] = useState(20);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    const [preferences, deliveries] = await Promise.all([
      notificationsApi.listPreferences(),
      notificationsApi.listDeliveries({ limit: 30 }),
    ]);
    return { preferences, deliveries };
  }, []);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchNotifications,
    'Failed to load notifications workspace'
  );

  const preferences = data?.preferences ?? [];
  const deliveries = data?.deliveries ?? [];
  const failedCount = deliveries.filter(
    (d) => d.status === 'FAILED' || d.status === 'DEAD_LETTER'
  ).length;

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setNotice(null);
    try {
      const delivery = await notificationsApi.send({
        channel,
        subject: subject.trim() || undefined,
        body: body.trim(),
        recipient: recipient.trim() || undefined,
        bypassQuietHours,
      });
      setBody('');
      setSubject('');
      setNotice(`Dispatched on ${channel} with status ${delivery.status}.`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Notification dispatch failed');
    } finally {
      setSending(false);
    }
  };

  const handleSavePreference = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    try {
      await notificationsApi.upsertPreference({
        channel: prefChannel,
        enabled: prefEnabled,
        quietStart: quietStart.trim() || null,
        quietEnd: quietEnd.trim() || null,
        frequencyCap,
      });
      setNotice(`Saved ${prefChannel} channel rule.`);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to save channel rule');
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await notificationsApi.retryDelivery(id);
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Delivery retry failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-950">
            Multi-Channel Notifications
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Resend Email, Telegram, Discord, WhatsApp Cloud API, IN_APP, and PUSH with quiet hours and retry tracking.
          </p>
        </div>
        <Button variant="secondary" onClick={reload}>
          <RefreshCw className="h-4 w-4" />
          Refresh Logs
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {notice && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-900">
          {notice}
        </div>
      )}

      <MotionStaggerGrid className="grid gap-4 sm:grid-cols-3">
        <MotionStaggerItem>
          <MotionInteractiveSurface>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Tracked Deliveries
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-950">
                {deliveries.length}
              </p>
            </Card>
          </MotionInteractiveSurface>
        </MotionStaggerItem>
        <MotionStaggerItem>
          <MotionInteractiveSurface>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Configured Rules
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-neutral-950">
                {preferences.length}
              </p>
            </Card>
          </MotionInteractiveSurface>
        </MotionStaggerItem>
        <MotionStaggerItem>
          <MotionInteractiveSurface>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Failed / Dead-Letter
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-orange-600">{failedCount}</p>
            </Card>
          </MotionInteractiveSurface>
        </MotionStaggerItem>
      </MotionStaggerGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">Compose & Dispatch</h2>
          </div>
          <form onSubmit={handleSend} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as NotificationChannel)}
                className={inputClassName}
              >
                {channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Recipient override (optional)"
                className={inputClassName}
              />
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (used for Email)"
              className={inputClassName}
            />
            <textarea
              rows={3}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your notification message..."
              className={inputClassName}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                <input
                  type="checkbox"
                  checked={bypassQuietHours}
                  onChange={(e) => setBypassQuietHours(e.target.checked)}
                  className="accent-orange-500"
                />
                Bypass UTC quiet hours
              </label>
              <Button type="submit" disabled={sending}>
                {sending ? 'Dispatching...' : 'Send Notification'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-orange-500" />
            <h2 className="text-base font-bold text-neutral-950">
              Channel Preferences & Quiet Hours
            </h2>
          </div>
          <form onSubmit={handleSavePreference} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                value={prefChannel}
                onChange={(e) => setPrefChannel(e.target.value as NotificationChannel)}
                className={inputClassName}
              >
                {channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                max={200}
                value={frequencyCap}
                onChange={(e) => setFrequencyCap(Number(e.target.value))}
                placeholder="24h Frequency Cap"
                className={inputClassName}
              />
              <input
                type="text"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                placeholder="Quiet start HH:mm (UTC)"
                className={inputClassName}
              />
              <input
                type="text"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                placeholder="Quiet end HH:mm (UTC)"
                className={inputClassName}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
                <input
                  type="checkbox"
                  checked={prefEnabled}
                  onChange={(e) => setPrefEnabled(e.target.checked)}
                  className="accent-orange-500"
                />
                Channel enabled
              </label>
              <Button type="submit" variant="dark">
                Save Rule
              </Button>
            </div>
          </form>

          {preferences.length > 0 && (
            <div className="space-y-2 border-t border-neutral-100 pt-3">
              {preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs"
                >
                  <span className="font-bold text-neutral-950">{pref.channel}</span>
                  <span className="text-neutral-600 tabular-nums">
                    Cap {pref.frequencyCap}/day • Quiet{' '}
                    {pref.quietStart && pref.quietEnd
                      ? `${pref.quietStart}–${pref.quietEnd} UTC`
                      : 'Off'}
                  </span>
                  <Badge tone={pref.enabled ? 'green' : 'red'}>
                    {pref.enabled ? 'ENABLED' : 'DISABLED'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-950">Delivery Audit Log</h2>
          <Badge tone="dark">{deliveries.length} records</Badge>
        </div>
        {loading ? (
          <p className="text-sm text-neutral-500">Loading delivery logs...</p>
        ) : deliveries.length === 0 ? (
          <EmptyState
            title="No notification deliveries yet"
            description="Messages dispatched through Resend, Telegram, Discord, WhatsApp, or IN_APP will log here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {deliveries.map((deliv) => (
              <div
                key={deliv.id}
                className="space-y-2 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="dark">{deliv.channel}</Badge>
                  <div className="flex items-center gap-2">
                    <Badge tone={deliveryTone(deliv.status)}>{deliv.status}</Badge>
                    <span className="font-mono text-neutral-500 tabular-nums">
                      {deliv.attempts}/{deliv.maxAttempts}
                    </span>
                  </div>
                </div>
                {deliv.subject && <p className="font-semibold text-neutral-900">{deliv.subject}</p>}
                <p className="text-sm text-neutral-700">{deliv.body}</p>
                {deliv.lastError && (
                  <p className="flex items-center gap-1 text-rose-700">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {deliv.lastError}
                  </p>
                )}
                {deliv.status === 'FAILED' && (
                  <Button
                    variant="secondary"
                    onClick={() => handleRetry(deliv.id)}
                    className="py-1 text-xs"
                  >
                    Retry Delivery
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

