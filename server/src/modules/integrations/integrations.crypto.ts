import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const PAYLOAD_VERSION = 'v1';

const deriveEncryptionKey = (rawKey?: string): Buffer => {
  const configured = rawKey ?? env.INTEGRATION_ENCRYPTION_KEY;
  if (configured && configured.trim().length > 0) {
    return createHash('sha256').update(configured.trim(), 'utf8').digest();
  }

  if (env.NODE_ENV === 'production') {
    throw new AppError(
      500,
      'INTEGRATION_ENCRYPTION_KEY is required in production for credential encryption',
      'ENCRYPTION_KEY_MISSING'
    );
  }

  const fallbackSeed = env.SUPABASE_SERVICE_ROLE_KEY || 'v3-local-integration-key';
  return createHash('sha256').update(`v3-dev-aes:${fallbackSeed}`, 'utf8').digest();
};

export const encryptIntegrationCredentials = (
  credentials: Record<string, unknown>,
  rawKey?: string
): string => {
  const key = deriveEncryptionKey(rawKey);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });

  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
};

export const decryptIntegrationCredentials = <T = Record<string, unknown>>(
  encryptedPayload: string,
  rawKey?: string
): T => {
  const [version, ivB64, authTagB64, ciphertextB64, ...rest] = encryptedPayload.split('.');
  if (rest.length > 0 || version !== PAYLOAD_VERSION || !ivB64 || !authTagB64 || !ciphertextB64) {
    throw new AppError(500, 'Malformed encrypted integration payload', 'CREDENTIAL_DECRYPT_ERROR');
  }

  try {
    const key = deriveEncryptionKey(rawKey);
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const ciphertext = Buffer.from(ciphertextB64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8'
    );
    return JSON.parse(decrypted) as T;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      500,
      'Failed to decrypt integration credentials',
      'CREDENTIAL_DECRYPT_ERROR'
    );
  }
};
