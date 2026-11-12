import { defineConfig } from '@trigger.dev/sdk';

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_ID || 'v3-backend',
  runtime: 'node',
  logLevel: 'info',
  maxDuration: 300,
  dirs: ['./src/jobs'],
});

