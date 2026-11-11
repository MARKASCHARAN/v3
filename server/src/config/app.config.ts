import { env } from './env';

export const appConfig = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  corsOrigin: env.WEB_ORIGIN,
  apiPrefix: '/api/v1',
  security: {
    bcryptRounds: 12,
    jwtExpiresIn: '7d',
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: env.NODE_ENV === 'production' ? 100 : 1000,
  },
};
