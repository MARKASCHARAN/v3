import { REST } from 'discord.js';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface DiscordSendPayload {
  channelId: string;
  content: string;
  botTokenOverride?: string;
}

export interface DiscordSendResult {
  providerMessageId: string;
  channelId: string;
}

export interface DiscordAdapter {
  isConfigured(botTokenOverride?: string): boolean;
  sendMessage(payload: DiscordSendPayload): Promise<DiscordSendResult>;
}

export class DiscordRestAdapter implements DiscordAdapter {
  constructor(private readonly defaultBotToken: string | undefined = env.DISCORD_BOT_TOKEN) {}

  isConfigured(botTokenOverride?: string): boolean {
    const token = botTokenOverride ?? this.defaultBotToken;
    return Boolean(token && token.trim().length > 0);
  }

  async sendMessage(payload: DiscordSendPayload): Promise<DiscordSendResult> {
    const token = payload.botTokenOverride ?? this.defaultBotToken;
    if (!token) {
      throw new AppError(
        503,
        'Discord adapter is not configured (missing DISCORD_BOT_TOKEN)',
        'DISCORD_NOT_CONFIGURED'
      );
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const response = (await rest.post(
      `/channels/${encodeURIComponent(payload.channelId)}/messages`,
      {
        body: { content: payload.content },
      }
    )) as { id?: string; channel_id?: string };

    return {
      providerMessageId: response.id ?? `discord-${Date.now()}`,
      channelId: response.channel_id ?? payload.channelId,
    };
  }
}
