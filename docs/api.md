# V3 API Reference

V3 exposes a versioned REST API built with Express 5 and TypeScript. All feature endpoints live under the `/api/v1` prefix configured in `server/src/config/app.config.ts`.

> **Implementation Status:** All Phase 1 backend modules, Phase 2 A AI/Automation (`/api/v1/automation`), and Phase 2 B modules (semantic `pgvector` memory, adaptive accountability, and web research under `/api/v1/research`) are implemented. Phase 2 C (`notifications`, `voice`) and Phase 3 modules remain pending.

## Base URL & Versioning

- **Local development server:** `http://localhost:5000`
- **API base prefix:** `/api/v1`
- **Interactive API documentation:** `http://localhost:5000/api/docs` (OpenAPI 3.0 via `swagger-ui-express` in `server/src/config/swagger.ts`)

## Response & Error Conventions

Responses follow a consistent JSON envelope defined in `server/src/routes/v1.router.ts` and `server/src/middleware/error.middleware.ts`:

Success envelope:

```json
{
  "success": true,
  "data": {}
}
```

Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

Validation errors (`ZodError`) return HTTP `400` with `code: "VALIDATION_ERROR"` and a `details` map from `err.flatten().fieldErrors`. Unmatched routes throw `AppError(404, ..., "NOT_FOUND")`. Unhandled exceptions return HTTP `500` with `code: "INTERNAL_SERVER_ERROR"` and mask internal error messages when `NODE_ENV=production`.

## Currently Implemented Endpoints

### `GET /`

Root check defined in `server/src/app.ts`.

Response `200 OK`:

```json
{
  "success": true,
  "message": "Welcome to V3 API. Please use /api/v1 endpoints or visit /api/docs for documentation."
}
```

### `GET /api/v1/health`

Health check defined in `server/src/routes/v1.router.ts`.

Response `200 OK`:

```json
{
  "success": true,
  "data": {
    "service": "v3-server-api",
    "version": "v1",
    "status": "operational",
    "timestamp": "2026-11-12T00:00:00.000Z"
  }
}
```

### `/api/v1/auth`

Defined in `server/src/modules/auth/auth.routes.ts` and mounted on `v1Router`:

- `POST /api/v1/auth/register` — Register user via Supabase Auth and upsert local `User` record
- `POST /api/v1/auth/login` — Sign in with email/password and return session tokens + user profile
- `POST /api/v1/auth/refresh` — Refresh session using a refresh token
- `POST /api/v1/auth/logout` — Sign out current session (`requireAuth`)
- `GET /api/v1/auth/me` — Get authenticated user profile (`requireAuth`)
- `PATCH /api/v1/auth/me` — Update authenticated user profile (`requireAuth`)

### `/api/v1/goals` (Protected — `requireAuth`)

Defined in `server/src/modules/goals/goals.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/goals` — Retrieve goals (supports `timeframe`, `targetYear`, `status`, `parentGoalId` query filters)
- `POST /api/v1/goals` — Create a goal (supports `YEARLY`/`QUARTERLY`/`MONTHLY`/`WEEKLY`/`CUSTOM` timeframe, `targetYear`, `parentGoalId`)
- `GET /api/v1/goals/:id` — Retrieve a single goal with `milestones`, `subGoals`, `parentGoal`, and `tasks`
- `PATCH /api/v1/goals/:id` — Update a goal (validates parent hierarchy against cycles and updates progress)
- `DELETE /api/v1/goals/:id` — Delete a goal and recalculate parent progress
- `POST /api/v1/goals/:id/milestones` — Add a milestone and recalculate goal progress
- `PATCH /api/v1/goals/:id/milestones/:milestoneId` — Update/toggle a milestone and recalculate goal progress
- `DELETE /api/v1/goals/:id/milestones/:milestoneId` — Delete a milestone and recalculate goal progress

### `/api/v1/planning` (Protected — `requireAuth`)

Defined in `server/src/modules/planning/planning.routes.ts` and mounted on `v1Router`:

- `POST /api/v1/planning/generate` — Decompose a goal (existing `goalId` or `goalTitle`) via Vercel AI SDK using user preferences/memories and store a draft plan
- `GET /api/v1/planning/plans` — List plans (supports `goalId`, `status` filters)
- `POST /api/v1/planning/plans` — Create a custom plan manually
- `GET /api/v1/planning/plans/:id` — Retrieve a single plan
- `PATCH /api/v1/planning/plans/:id` — Update a draft/stored plan
- `POST /api/v1/planning/plans/:id/apply` — Materialize a draft plan into goal milestones and tasks inside a transaction
- `DELETE /api/v1/planning/plans/:id` — Delete a plan

### `/api/v1/scheduling` (Protected — `requireAuth`)

Defined in `server/src/modules/scheduling/scheduling.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/scheduling/blocks` — Retrieve time blocks (supports `from`, `to`, `category`, `status`, `taskId`, `goalId` filters)
- `POST /api/v1/scheduling/blocks` — Create a time block with scheduling conflict detection (`allowOverlap` opt-out)
- `GET /api/v1/scheduling/blocks/:id` — Retrieve a single time block
- `PATCH /api/v1/scheduling/blocks/:id` — Update a time block with conflict checks
- `DELETE /api/v1/scheduling/blocks/:id` — Delete a time block
- `GET /api/v1/scheduling/slots` — Suggest free non-overlapping slots (`date`, `durationMinutes`, `dayStartHour`, `dayEndHour`)

### `/api/v1/tasks` (Protected — `requireAuth`)

Defined in `server/src/modules/tasks/tasks.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/tasks` — Retrieve tasks (supports `status`, `priority`, `goalId`, `milestoneId`, `parentTaskId`, `overdue=true` filters)
- `POST /api/v1/tasks` — Create a task or subtask (`parentTaskId`) with priority, status, deadline (`dueDate`), and optional `goalId`/`milestoneId`
- `GET /api/v1/tasks/:id` — Retrieve a single task with subtasks, goal, and milestone info
- `PATCH /api/v1/tasks/:id` — Update task fields and automatically set/clear `completedAt` on `DONE` transitions
- `DELETE /api/v1/tasks/:id` — Delete a task (cascading subtasks)

### `/api/v1/accountability` (Protected — `requireAuth`)

Defined in `server/src/modules/accountability/accountability.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/accountability/summary` — Progress summary across tasks, goals, pending reminders, and open alerts
- `GET /api/v1/accountability/missed-tasks` — List overdue/missed tasks
- `POST /api/v1/accountability/missed-tasks/scan` — Detect overdue tasks and record non-duplicate `MISSED_TASK` alerts
- `GET /api/v1/accountability/reminders` — List reminders (`status`, `dueOnly=true`)
- `POST /api/v1/accountability/reminders` — Schedule a reminder
- `PATCH /api/v1/accountability/reminders/:id` — Update reminder status or schedule
- `DELETE /api/v1/accountability/reminders/:id` — Delete a reminder
- `GET /api/v1/accountability/logs` — List accountability logs (`status`, `type`)
- `POST /api/v1/accountability/logs` — Create an accountability check-in or alert log
- `PATCH /api/v1/accountability/logs/:id` — Acknowledge or resolve an accountability log
- `GET /api/v1/accountability/procrastination` — Score procrastination risk signals across stale tasks, overdue priorities, and missed time blocks
- `POST /api/v1/accountability/interventions` — Generate adaptive intervention recommendations and optional alerts/reminders

### `/api/v1/memory` (Protected — `requireAuth`)

Defined in `server/src/modules/memory/memory.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/memory/context` — Retrieve combined user preferences, relevant memories, and recent conversation messages
- `GET /api/v1/memory/semantic` — Semantic similarity retrieval using `pgvector` embeddings (with keyword fallback if unconfigured)
- `GET /api/v1/memory/hybrid` — Run parallel structured SQL metrics, PostgreSQL GIN full-text keyword search, and `pgvector` semantic search merged via Reciprocal Rank Fusion (RRF)
- `POST /api/v1/memory/propose` — Validate, deduplicate, and persist a candidate memory with automatic conflict detection and `supersededById` linking
- `POST /api/v1/memory/prune` — Delete expired ephemeral memories (`expiresAt <= now`) for the authenticated user
- `POST /api/v1/memory/embeddings/backfill` — Generate `pgvector` embeddings for existing memories missing vectors
- `GET /api/v1/memory/personalization` — Retrieve user preferences, active focus categories, and topic-relevant memories
- `GET /api/v1/memory/preferences` — List user preferences
- `PUT /api/v1/memory/preferences` — Upsert a user preference (`key`, `value`, `category`)
- `DELETE /api/v1/memory/preferences/:key` — Delete a user preference
- `GET /api/v1/memory/conversations` — Retrieve conversation history (`sessionId`, `limit`)
- `POST /api/v1/memory/conversations` — Append a conversation message (`USER`, `ASSISTANT`, `SYSTEM`)
- `DELETE /api/v1/memory/conversations` — Clear conversation history for a `sessionId`
- `GET /api/v1/memory` — Search/list memory items (`category`, `q`, `tag`, `limit`)
- `POST /api/v1/memory` — Create a memory item
- `GET /api/v1/memory/:id` — Get a single memory item
- `PATCH /api/v1/memory/:id` — Update a memory item
- `DELETE /api/v1/memory/:id` — Delete a memory item

### `/api/v1/automation` (Protected — `requireAuth`)

Defined in `server/src/modules/automation/automation.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/automation/tools` — List registered AI tools and risk policies (`READ`, `INTERNAL_WRITE`, etc.)
- `GET /api/v1/automation/agents` — List registered specialist AI agents, model tiers, and scoped `AgentPermissionProfile` metadata
- `GET /api/v1/automation/metrics` — Retrieve per-user AI execution counts, `totalTokensUsed`, `totalCostMicroUsd`, approval statuses, and LangSmith trace URLs
- `POST /api/v1/automation/run` — Run the central AI orchestrator or a targeted specialist (`agentRole`, optional `threadId`/`tokenBudget`) with multi-step tool calling, retries, and approval gating
- `GET /api/v1/automation/executions` — List AI execution history (`status`, `sessionId`, `limit` filters)
- `GET /api/v1/automation/executions/:id` — Retrieve a single AI execution with step traces and approvals
- `GET /api/v1/automation/approvals` — List tool approval requests (`status`, `executionId`, `limit` filters)
- `POST /api/v1/automation/approvals/:id/approve` — Approve and execute a pending AI tool call
- `POST /api/v1/automation/approvals/:id/reject` — Reject a pending AI tool call

### `/api/v1/research` (Protected — `requireAuth`)

Defined in `server/src/modules/research/research.routes.ts` and mounted on `v1Router`:

- `POST /api/v1/research/search` — Conduct grounded web research (Google Search + SSRF-safe URL excerpt fetching), synthesize findings, and optionally save to semantic memory
- `GET /api/v1/research` — Search and list stored research items (`q`, `goalId`, `status`, `limit`)
- `POST /api/v1/research` — Save a manual research summary and citations
- `GET /api/v1/research/:id` — Get a single research item
- `POST /api/v1/research/:id/save-to-memory` — Promote a stored research item into `pgvector` memory
- `DELETE /api/v1/research/:id` — Delete a research item

### `/api/v1/events` (Protected — `requireAuth`)

Defined in `server/src/modules/events/events.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/events/subscriptions` — List registered event-to-background-job subscription rules
- `GET /api/v1/events` — List ingested `DomainEvent` records (`status`, `eventType`, `limit` filters)
- `POST /api/v1/events/ingest` — Ingest a domain event with `idempotencyKey` deduplication and automatic subscription routing
- `GET /api/v1/events/:id` — Retrieve a single domain event
- `GET /api/v1/events/jobs` — List tracked `BackgroundJob` records (`status`, `jobType`, `limit` filters)
- `POST /api/v1/events/jobs/trigger` — Queue or execute a background job (`AGENT_RUN`, `DAILY_ACCOUNTABILITY_REVIEW`, `MISSED_TASK_SCAN`, `APPROVAL_EXPIRY_SWEEP`, `MEMORY_PRUNE`, etc.)
- `GET /api/v1/events/jobs/:id` — Retrieve a single background job
- `POST /api/v1/events/jobs/:id/retry` — Retry a failed or `DEAD_LETTER` background job
- `POST /api/v1/events/recovery/sweep` — Run stalled-job recovery, timed-out execution cleanup, expired approval sweep, and ephemeral memory pruning

### `/api/v1/integrations` (Protected — `requireAuth`)

Defined in `server/src/modules/integrations/integrations.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/integrations` — List connected `IntegrationAccount` records with credentials redacted
- `POST /api/v1/integrations/connect` — Connect or update a provider (`TELEGRAM`, `DISCORD`, `WHATSAPP`, `GOOGLE`, `GITHUB`, `BHASHINI`) with AES-256-GCM encrypted credentials
- `GET /api/v1/integrations/:provider` — Get sanitized integration account metadata
- `PATCH /api/v1/integrations/:provider` — Update integration credentials, scopes, or status
- `DELETE /api/v1/integrations/:provider` — Disconnect and delete stored provider credentials
- `POST /api/v1/integrations/google/calendar/sync` — Fetch Google Calendar events and optionally import them into `TimeBlock`
- `GET /api/v1/integrations/google/gmail/messages` — Read Gmail message metadata summaries
- `GET /api/v1/integrations/github/repos` — List GitHub repositories via Octokit
- `GET /api/v1/integrations/github/repos/:owner/:repo/issues` — List issues for a repository
- `GET /api/v1/integrations/github/repos/:owner/:repo/pulls` — List pull requests for a repository
- `POST /api/v1/integrations/github/issues` — Create a GitHub issue
- `POST /api/v1/integrations/github/issues/comment` — Comment on a GitHub issue
- `GET /api/v1/integrations/mcp/tools` — List registered MCP servers and permissioned tools
- `POST /api/v1/integrations/mcp/invoke` — Invoke an MCP tool through `McpPermissionBridge` and `permission-guard.ts`

### `/api/v1/notifications` (Protected — `requireAuth`)

Defined in `server/src/modules/notifications/notifications.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/notifications/preferences` — List per-channel opt-ins, quiet hours, and 24h frequency caps
- `PUT /api/v1/notifications/preferences` — Upsert notification preferences for a channel
- `GET /api/v1/notifications/deliveries` — List notification delivery logs (`channel`, `status`, `limit`)
- `POST /api/v1/notifications/send` — Dispatch a notification via Resend Email, Telegram, Discord, WhatsApp Cloud API, IN_APP, or PUSH
- `POST /api/v1/notifications/deliveries/:id/retry` — Retry a `FAILED` notification delivery (transitions to `DEAD_LETTER` once `maxAttempts` exhausted)

### `/api/v1/voice` (Protected — `requireAuth`)

Defined in `server/src/modules/voice/voice.routes.ts` and mounted on `v1Router`:

- `GET /api/v1/voice/sessions` — List Bhashini voice and telephony sessions
- `POST /api/v1/voice/sessions` — Start a tracked `VoiceSession`
- `GET /api/v1/voice/sessions/:id` — Retrieve a voice session with a signed Supabase Storage URL when `ttsAudioKey` is present
- `POST /api/v1/voice/transcribe` — Transcribe base64 audio via Bhashini ASR
- `POST /api/v1/voice/translate` — Translate text across languages via Bhashini
- `POST /api/v1/voice/synthesize` — Synthesize speech via Bhashini TTS and archive WAV asset to Supabase Storage
- `POST /api/v1/voice/command` — Run ASR + translation + `AssistantOrchestrator` + optional localized TTS pipeline
- `POST /api/v1/voice/telephony/webhook` — Process normalized telephony webhook events (`INBOUND_CALL`, `SPEECH_CAPTURED`, `CALL_ENDED`) and return voice directives

## Authentication & Security Middleware

- **CORS:** Restricted to `WEB_ORIGIN` (`http://localhost:3000` by default) with `credentials: true`.
- **Security Headers:** Applied globally via `helmet`.
- **Authentication (`requireAuth`):** Implemented in `server/src/middleware/auth.middleware.ts`; verifies Supabase Auth bearer tokens (`Authorization: Bearer <token>`) and upserts user records via Prisma.
- **Validation Middleware (`validateRequest`):** Implemented in `server/src/middleware/validation.middleware.ts`; validates request `body`, `query`, and `params` against module Zod schemas.
- **Rate Limiting (`server/src/middleware/rate-limit.middleware.ts`):** Active per-user (authenticated `user.id` or fallback IP) and per-endpoint rate limiting across global API routes and tight limits on AI execution, web research, outbound notifications, and voice command pipelines (`429 RATE_LIMIT_EXCEEDED` with `X-RateLimit-*` and `Retry-After` headers).

## API Modules by Phase

### Phase 1 Modules

| Module | Base Path | Status & Scope |
| --- | --- | --- |
| `auth` | `/api/v1/auth` | Implemented — Registration, login, refresh, logout, profile endpoints + `requireAuth` |
| `goals` | `/api/v1/goals` | Implemented — Goal CRUD, hierarchy, yearly goals, milestones, automatic progress |
| `planning` | `/api/v1/planning` | Implemented — AI goal decomposition, draft/custom plans, transactional apply to milestones & tasks |
| `scheduling` | `/api/v1/scheduling` | Implemented — Time blocks, overlap conflict detection, free slot suggestions |
| `tasks` | `/api/v1/tasks` | Implemented — Task/subtask CRUD, priorities, deadlines, statuses, overdue filtering |
| `accountability` | `/api/v1/accountability` | Implemented — Missed-task detection/scanning, reminders, progress summary, check-in logs |
| `memory` | `/api/v1/memory` | Implemented — User preferences, project/goal context memories, conversation history, search/retrieval |

### Phase 2 Modules

| Module | Base Path | Scope |
| --- | --- | --- |
| `integrations` | `/api/v1/integrations` | Implemented (M2.8) — AES-256-GCM encrypted `IntegrationAccount` storage, Google Calendar/Gmail, GitHub, and guarded MCP |
| `notifications` | `/api/v1/notifications` | Implemented (M2.8) — Channel links (Resend Email, Telegram, Discord, WhatsApp), preferences, frequency caps, retries |
| `voice` | `/api/v1/voice` | Implemented (M2.8) — Bhashini ASR/TTS/translation, Supabase Storage audio assets, voice commands, telephony webhooks |
| `events` | `/api/v1/events` | Implemented (M2.7) — Idempotent `DomainEvent` ingestion, Trigger.dev job dispatch, retry/dead-letter recovery |
| `research` | `/api/v1/research` | Implemented (Phase 2 B) — Web research, summarization, SSRF-safe URL fetching, knowledge retrieval |
| `automation` | `/api/v1/automation` | Implemented (Phase 2 A) — AI orchestrator, multi-step tool execution, approval checkpoints, execution history |
| `accountability` (extended) | `/api/v1/accountability` | Implemented (Phase 2 B) — Adaptive accountability, procrastination detection, intelligent interventions |
| `memory` (extended) | `/api/v1/memory` | Implemented (Phase 2 B) — Long-term semantic memory retrieval via PostgreSQL + `pgvector` and personalization |

### Phase 3 Modules

| Module | Base Path (Planned) | Scope |
| --- | --- | --- |
| `developer` | `/api/v1/developer` | GitHub OAuth/app integration, repo monitoring, issues, PRs, CI summaries |
| `analytics` | `/api/v1/analytics` | Goal/task completion metrics, weekly/monthly reports, time insights |
| `research` (extended) | `/api/v1/research` | Continuous monitoring workflows |
| `automation` (extended) | `/api/v1/automation` | Stateful long-running workflows, pause/resume, duplicate-action prevention, audit logs |

