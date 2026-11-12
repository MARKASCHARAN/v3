import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3';
import { gmail_v1 } from 'googleapis/build/src/apis/gmail/v1';
import { OAuth2Client } from 'googleapis-common';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface GoogleCalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
  status?: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt?: string;
}

export interface GoogleAuthCredentials {
  accessToken?: string;
  refreshToken?: string;
}

export interface GoogleWorkspaceAdapter {
  listCalendarEvents(
    credentials: GoogleAuthCredentials,
    params: { timeMin?: string; timeMax?: string; maxResults?: number }
  ): Promise<GoogleCalendarEventItem[]>;
  createCalendarEvent(
    credentials: GoogleAuthCredentials,
    params: { summary: string; description?: string; startTime: string; endTime: string }
  ): Promise<GoogleCalendarEventItem>;
  listGmailMessages(
    credentials: GoogleAuthCredentials,
    params: { query?: string; maxResults?: number }
  ): Promise<GmailMessageSummary[]>;
  sendGmailMessage(
    credentials: GoogleAuthCredentials,
    params: { to: string; subject: string; body: string }
  ): Promise<{ id: string; threadId?: string }>;
}

const buildOAuthClient = (credentials: GoogleAuthCredentials): OAuth2Client => {
  if (!credentials.accessToken && !credentials.refreshToken) {
    throw new AppError(
      400,
      'Google OAuth credentials (accessToken or refreshToken) are required',
      'GOOGLE_CREDENTIALS_MISSING'
    );
  }

  const oauth2Client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);
  oauth2Client.setCredentials({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
  });
  return oauth2Client;
};

export class GoogleApisWorkspaceAdapter implements GoogleWorkspaceAdapter {
  async listCalendarEvents(
    credentials: GoogleAuthCredentials,
    params: { timeMin?: string; timeMax?: string; maxResults?: number }
  ): Promise<GoogleCalendarEventItem[]> {
    const auth = buildOAuthClient(credentials);
    const calendar = new calendar_v3.Calendar({ auth });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: params.timeMin ?? new Date().toISOString(),
      ...(params.timeMax ? { timeMax: params.timeMax } : {}),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: params.maxResults ?? 20,
    });

    const items = response.data.items ?? [];
    return items
      .filter((item) => item.id && (item.start?.dateTime || item.start?.date))
      .map((item) => ({
        id: item.id as string,
        summary: item.summary ?? 'Untitled Event',
        description: item.description ?? undefined,
        startTime: (item.start?.dateTime ?? item.start?.date) as string,
        endTime: (item.end?.dateTime ??
          item.end?.date ??
          item.start?.dateTime ??
          item.start?.date) as string,
        status: item.status ?? undefined,
      }));
  }

  async createCalendarEvent(
    credentials: GoogleAuthCredentials,
    params: { summary: string; description?: string; startTime: string; endTime: string }
  ): Promise<GoogleCalendarEventItem> {
    const auth = buildOAuthClient(credentials);
    const calendar = new calendar_v3.Calendar({ auth });
    const created = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: params.summary,
        description: params.description,
        start: { dateTime: params.startTime },
        end: { dateTime: params.endTime },
      },
    });

    return {
      id: created.data.id ?? `gcal-${Date.now()}`,
      summary: created.data.summary ?? params.summary,
      description: created.data.description ?? params.description,
      startTime: created.data.start?.dateTime ?? params.startTime,
      endTime: created.data.end?.dateTime ?? params.endTime,
      status: created.data.status ?? 'confirmed',
    };
  }

  async listGmailMessages(
    credentials: GoogleAuthCredentials,
    params: { query?: string; maxResults?: number }
  ): Promise<GmailMessageSummary[]> {
    const auth = buildOAuthClient(credentials);
    const gmail = new gmail_v1.Gmail({ auth });
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: params.query,
      maxResults: params.maxResults ?? 10,
    });

    const refs = listRes.data.messages ?? [];
    const results: GmailMessageSummary[] = [];

    for (const ref of refs.slice(0, params.maxResults ?? 10)) {
      if (!ref.id) continue;
      const msgRes = await gmail.users.messages.get({
        userId: 'me',
        id: ref.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });
      const headers = msgRes.data.payload?.headers ?? [];
      const findHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

      results.push({
        id: ref.id,
        threadId: msgRes.data.threadId ?? undefined,
        subject: findHeader('Subject') || '(No Subject)',
        from: findHeader('From') || 'unknown',
        snippet: msgRes.data.snippet ?? '',
        receivedAt: findHeader('Date') || undefined,
      });
    }

    return results;
  }

  async sendGmailMessage(
    credentials: GoogleAuthCredentials,
    params: { to: string; subject: string; body: string }
  ): Promise<{ id: string; threadId?: string }> {
    const auth = buildOAuthClient(credentials);
    const gmail = new gmail_v1.Gmail({ auth });
    const rawLines = [
      `To: ${params.to}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      `Subject: ${params.subject}`,
      '',
      params.body,
    ];
    const encoded = Buffer.from(rawLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const sent = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encoded },
    });

    return {
      id: sent.data.id ?? `gmail-${Date.now()}`,
      threadId: sent.data.threadId ?? undefined,
    };
  }
}
