import { Resend } from 'resend';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface EmailSendPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

export interface EmailSendResult {
  providerMessageId: string;
  accepted: boolean;
}

export interface EmailAdapter {
  isConfigured(): boolean;
  sendEmail(payload: EmailSendPayload): Promise<EmailSendResult>;
}

export class ResendEmailAdapter implements EmailAdapter {
  private readonly defaultFrom: string;

  constructor(
    private readonly apiKey: string | undefined = env.RESEND_API_KEY,
    defaultFrom: string = 'V3 Assistant <notifications@v3.local>'
  ) {
    this.defaultFrom = defaultFrom;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async sendEmail(payload: EmailSendPayload): Promise<EmailSendResult> {
    if (!this.apiKey) {
      throw new AppError(
        503,
        'Resend email adapter is not configured (missing RESEND_API_KEY)',
        'RESEND_NOT_CONFIGURED'
      );
    }

    const client = new Resend(this.apiKey);
    const response = await client.emails.send({
      from: payload.from ?? this.defaultFrom,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      ...(payload.html ? { html: payload.html } : {}),
    });

    if (response.error) {
      throw new AppError(
        502,
        `Resend delivery error: ${response.error.message}`,
        'RESEND_DELIVERY_FAILED'
      );
    }

    return {
      providerMessageId: response.data?.id ?? `resend-${Date.now()}`,
      accepted: true,
    };
  }
}
