import { app } from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`[V3 Server] Running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`);
});

const shutdown = (signal: string) => {
  console.log(`\n[${signal}] Shutting down V3 server gracefully...`);
  server.close(() => {
    console.log('[V3 Server] HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
