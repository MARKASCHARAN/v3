import { Bot } from 'grammy';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface TelegramSendPayload {
  chatId: string | number;
  text: string;
  botTokenOverride?: string;
}

export interface TelegramSendResult {
  providerMessageId: string;
  chatId: string;
}

export interface TelegramAdapter {
  isConfigured(botTokenOverride?: string): boolean;
  sendMessage(payload: TelegramSendPayload): Promise<TelegramSendResult>;
}

export class GrammyTelegramAdapter implements TelegramAdapter {
  constructor(private readonly defaultBotToken: string | undefined = env.TELEGRAM_BOT_TOKEN) {}

  isConfigured(botTokenOverride?: string): boolean {
    const token = botTokenOverride ?? this.defaultBotToken;
    return Boolean(token && token.trim().length > 0);
  }

  async sendMessage(payload: TelegramSendPayload): Promise<TelegramSendResult> {
    const token = payload.botTokenOverride ?? this.defaultBotToken;
    if (!token) {
      throw new AppError(
        503,
        'Telegram adapter is not configured (missing TELEGRAM_BOT_TOKEN)',
        'TELEGRAM_NOT_CONFIGURED'
      );
    }

    const bot = new Bot(token);
    const sent = await bot.api.sendMessage(payload.chatId, payload.text);
    return {
      providerMessageId: String(sent.message_id),
      chatId: String(sent.chat.id),
    };
  }
}

