# V3 Production Deployment & Recovery Guide

## Architecture Topology

V3 deploys as cloud-only services sharing managed Supabase infrastructure:

1. **Express 5 API Service (`server/`)** — Containerized via [`server/Dockerfile`](../server/Dockerfile) and declared in [`render.yaml`](../render.yaml). Handles synchronous REST traffic, auth validation, webhooks, rate limiting, and enqueues Trigger.dev runs.
2. **Next.js Web Client (`client/web/`)** — Deployed alongside the backend API via [`render.yaml`](../render.yaml) with `NEXT_PUBLIC_API_URL` pointing to the production Express `/api/v1` base URL.
3. **Trigger.dev Background Worker (`server/src/jobs/`)** — Shares the `server/` codebase and Prisma schema; executes scheduled routines (`daily-accountability-review`, `missed-task-scanner`, `approval-expiry-sweeper`, `dead-letter-recovery`) and async event/agent runs.
4. **Managed Supabase** — Hosts PostgreSQL (`public` + `langgraph` checkpointer schema), `pgvector` HNSW + GIN indexes on `memories`, Supabase Auth, and Supabase Storage (`voice-assets`).

## CI/CD Pipeline (`.github/workflows/ci.yml`)

Every push and pull request targeting `main` runs two GitHub Actions jobs:

- **`server-ci`** — `npx prisma validate`, `npx prisma generate`, zero-comments check, `npm run format:check`, `npm run build` (`tsc`), `npm run lint` (`eslint .`), and `npm test` (unit, adversarial security, evaluation regression, and E2E acceptance suites).
- **`web-ci`** — `npm run lint` and `npm run build` (`next build`).

## Required Production Secrets

Configure secrets exclusively in the cloud provider's secret manager (never commit `.env` files):

- **Database & Supabase:** `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **AI & Observability:** `GEMINI_API_KEY`, `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`
- **Background Jobs:** `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_ID`
- **Security & Integrations:** `INTEGRATION_ENCRYPTION_KEY` (required in production for AES-256-GCM credentials), `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_TOKEN`, `BHASHINI_INFERENCE_KEY`

## Deployment Commands

```bash
cd server
npx prisma migrate deploy
npx prisma generate
npm run db:verify-recovery
npx trigger.dev@latest deploy
```

## Backup & Recovery Verification

1. **Automated Backups:** Enable Supabase daily backups and Point-in-Time Recovery (PITR) for PostgreSQL (`public` and `langgraph` schemas).
2. **Post-Restore Verification:** After any migration or database restore, run:
   ```bash
   cd server && npm run db:verify-recovery
   ```
   [`verify-backup-recovery.ts`](../server/src/scripts/verify-backup-recovery.ts) verifies database connectivity, all 20 required `public` application tables, all 4 `langgraph` checkpoint tables, custom `memories_embedding_hnsw_idx` (HNSW) and `memories_fts_gin_idx` (GIN) indexes, and applied `_prisma_migrations` count.
3. **Background Job & Approval Recovery:** Trigger `/api/v1/events/recovery/sweep` or let the `dead-letter-recovery` scheduled job expire stale approvals, mark stuck running jobs failed/dead-lettered, and prune expired ephemeral memories.

