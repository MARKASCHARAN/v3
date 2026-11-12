export type IntegrationProvider =
  'TELEGRAM' | 'DISCORD' | 'WHATSAPP' | 'GOOGLE' | 'GITHUB' | 'BHASHINI';

export type IntegrationStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR';

export interface IntegrationAccountRecord {
  id: string;
  userId: string;
  provider: string;
  externalAccountId: string | null;
  encryptedCredentials: string;
  scopes: string[];
  status: string;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SanitizedIntegrationAccount {
  id: string;
  userId: string;
  provider: string;
  externalAccountId: string | null;
  scopes: string[];
  status: string;
  lastSyncedAt: Date | null;
  hasCredentials: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DecryptedCredentials {
  accessToken?: string;
  refreshToken?: string;
  botToken?: string;
  apiKey?: string;
  chatId?: string;
  channelId?: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  email?: string;
  expiresAt?: string;
  [key: string]: unknown;
}

export interface ConnectIntegrationInput {
  provider: IntegrationProvider;
  credentials: DecryptedCredentials;
  externalAccountId?: string;
  scopes?: string[];
}

export interface UpdateIntegrationInput {
  credentials?: DecryptedCredentials;
  externalAccountId?: string;
  scopes?: string[];
  status?: IntegrationStatus;
}
