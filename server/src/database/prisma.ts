import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { appConfig } from '../config/app.config';
import { env } from '../config/env';

declare global {
  var prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma =
  global.prisma ||
  new PrismaClient({
    adapter,
    log: appConfig.isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  });

if (!appConfig.isProduction) {
  global.prisma = prisma;
}
