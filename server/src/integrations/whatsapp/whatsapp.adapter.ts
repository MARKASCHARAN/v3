import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface WhatsAppSendPayload {
  toPhoneNumber: string;
  text: string;
  accessTokenOverride?: string;
  phoneNumberIdOverride?: string;
}

export interface WhatsAppSendResult {
  providerMessageId: string;
  recipient: string;
}

export interface WhatsAppAdapter {
  isConfigured(accessTokenOverride?: string, phoneNumberIdOverride?: string): boolean;
  sendTextMessage(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult>;
}

export class WhatsAppCloudAdapter implements WhatsAppAdapter {
  constructor(
    private readonly defaultAccessToken: string | undefined = env.WHATSAPP_ACCESS_TOKEN,
    private readonly defaultPhoneNumberId: string | undefined = env.WHATSAPP_PHONE_NUMBER_ID
  ) {}

  isConfigured(accessTokenOverride?: string, phoneNumberIdOverride?: string): boolean {
    const token = accessTokenOverride ?? this.defaultAccessToken;
    const phoneId = phoneNumberIdOverride ?? this.defaultPhoneNumberId;
    return Boolean(token && token.trim().length > 0 && phoneId && phoneId.trim().length > 0);
  }

  async sendTextMessage(payload: WhatsAppSendPayload): Promise<WhatsAppSendResult> {
    const token = payload.accessTokenOverride ?? this.defaultAccessToken;
    const phoneId = payload.phoneNumberIdOverride ?? this.defaultPhoneNumberId;
    if (!token || !phoneId) {
      throw new AppError(
        503,
        'WhatsApp Cloud API adapter is not configured',
        'WHATSAPP_NOT_CONFIGURED'
      );
    }

    const endpoint = `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneId)}/messages`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: payload.toPhoneNumber,
        type: 'text',
        text: { body: payload.text },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(
        502,
        `WhatsApp Cloud API error (${response.status}): ${errorText.slice(0, 300)}`,
        'WHATSAPP_DELIVERY_FAILED'
      );
    }

    const data = (await response.json()) as {
      messages?: Array<{ id?: string }>;
    };

    return {
      providerMessageId: data.messages?.[0]?.id ?? `wa-${Date.now()}`,
      recipient: payload.toPhoneNumber,
    };
  }
}

