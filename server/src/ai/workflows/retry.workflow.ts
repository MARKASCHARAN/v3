import { AppError } from '../../middleware/error.middleware';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
}

const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const extractStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  if (typeof record.statusCode === 'number') {
    return record.statusCode;
  }
  if (typeof record.status === 'number') {
    return record.status;
  }
  if (record.response && typeof record.response === 'object') {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.status === 'number') {
      return responseRecord.status;
    }
  }
  return undefined;
};

export const isTransientAiError = (error: unknown): boolean => {
  if (error instanceof AppError) {
    return error.statusCode >= 500 && error.code !== 'AI_PROVIDER_UNCONFIGURED';
  }

  const statusCode = extractStatusCode(error);
  if (statusCode !== undefined && TRANSIENT_STATUS_CODES.has(statusCode)) {
    return true;
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('rate limit') ||
      msg.includes('429') ||
      msg.includes('503') ||
      msg.includes('resource exhausted') ||
      msg.includes('overloaded') ||
      msg.includes('temporarily unavailable')
    );
  }

  return false;
};

const delay = (ms: number): Promise<void> =>
  ms <= 0 ? Promise.resolve() : new Promise((resolve) => setTimeout(resolve, ms));

export const withAiRetry = async <T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> => {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 250;
  const shouldRetry = options.shouldRetry ?? isTransientAiError;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation(attempt);
      return { result, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error)) {
        throw error;
      }
      await delay(baseDelayMs * Math.pow(2, attempt - 1));
    }
  }

  throw lastError;
};
