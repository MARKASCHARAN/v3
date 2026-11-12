import { NextFunction, Request, Response } from 'express';
import { appConfig } from '../config/app.config';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError } from './error.middleware';

export interface RateLimitOptions {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
  skipInTest?: boolean;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimitStore {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(
    key: string,
    windowMs: number,
    now: number = Date.now()
  ): {
    count: number;
    resetAt: number;
  } {
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      const created: RateLimitBucket = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.buckets.set(key, created);
      return created;
    }

    existing.count += 1;
    return existing;
  }

  clear(): void {
    this.buckets.clear();
  }
}

export const defaultRateLimitStore = new InMemoryRateLimitStore();

const resolveRateLimitActorKey = (req: Request): string => {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.id) {
    return `user:${authReq.user.id}`;
  }
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
};

export const createRateLimitMiddleware = (
  options: RateLimitOptions,
  store: InMemoryRateLimitStore = defaultRateLimitStore
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (options.skipInTest && appConfig.isTest) {
      next();
      return;
    }

    const now = Date.now();
    const actorKey = resolveRateLimitActorKey(req);
    const key = `${options.keyPrefix}:${actorKey}`;
    const bucket = store.consume(key, options.windowMs, now);
    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const resetSeconds = Math.ceil(Math.max(0, bucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.maxRequests) {
      res.setHeader('Retry-After', String(Math.max(1, resetSeconds)));
      throw new AppError(
        429,
        `Rate limit exceeded for ${options.keyPrefix}. Try again in ${Math.max(1, resetSeconds)}s.`,
        'RATE_LIMIT_EXCEEDED'
      );
    }

    next();
  };
};

export const globalApiRateLimiter = createRateLimitMiddleware({
  keyPrefix: 'api-global',
  windowMs: appConfig.rateLimit.windowMs,
  maxRequests: appConfig.rateLimit.max,
  skipInTest: true,
});

export const aiExecutionRateLimiter = createRateLimitMiddleware({
  keyPrefix: 'ai-execution',
  windowMs: 60 * 1000,
  maxRequests: appConfig.isProduction ? 20 : 120,
  skipInTest: true,
});

export const researchRateLimiter = createRateLimitMiddleware({
  keyPrefix: 'web-research',
  windowMs: 60 * 1000,
  maxRequests: appConfig.isProduction ? 15 : 100,
  skipInTest: true,
});

export const externalNotificationRateLimiter = createRateLimitMiddleware({
  keyPrefix: 'notification-send',
  windowMs: 60 * 1000,
  maxRequests: appConfig.isProduction ? 30 : 150,
  skipInTest: true,
});

export const voicePipelineRateLimiter = createRateLimitMiddleware({
  keyPrefix: 'voice-pipeline',
  windowMs: 60 * 1000,
  maxRequests: appConfig.isProduction ? 20 : 120,
  skipInTest: true,
});
