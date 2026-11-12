import { closeCheckpointerPool } from './ai/runtime/checkpoints';
import { app } from './app';
import { configureLangSmithRuntime } from './config/ai.config';
import { env } from './config/env';

configureLangSmithRuntime();

const server = app.listen(env.PORT, () => {
  console.log(`[V3 Server] Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`\n[${signal}] Shutting down V3 server gracefully...`);
  server.close(async () => {
    await closeCheckpointerPool();
    console.log('[V3 Server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
