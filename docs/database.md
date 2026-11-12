# V3 Database Guide

V3 uses **PostgreSQL** hosted on **Supabase**, accessed through **Prisma ORM** from the Express backend (`server/`).

> **Implementation Status:** `server/prisma/schema.prisma`, `server/prisma.config.ts`, and `server/src/database/prisma.ts` (using Prisma `7.10.1` + `@prisma/adapter-pg`) are active. The `vector` (`pgvector`) extension is enabled, migrations `20261111233814_init`, `20261112001415_add_ai_executions_and_approvals`, and `20261112002137_add_research_and_adaptive_accountability` are applied (`server/prisma/migrations/`), and live `PrismaClient` queries are verified against Supabase PostgreSQL 17.11.

## Connection & Environment Configuration

`server/.env.example` and `server/src/config/env.ts` define two PostgreSQL connection variables:

- `DATABASE_URL` — Pooled connection URL used at runtime by `PrismaPg` (`@prisma/adapter-pg`) in `server/src/database/prisma.ts`.
- `DIRECT_URL` — Direct PostgreSQL connection URL configured in `server/prisma.config.ts` for Prisma CLI migrations (`prisma migrate dev`), falling back to `DATABASE_URL` during offline generation.

Related Supabase services configured in `env.ts`:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Authentication, Storage, and server-side administrative access.

## Prisma Scripts

`server/package.json` defines the following database commands:

- `npm run db:generate` — Runs `prisma generate`
- `npm run db:migrate` — Runs `prisma migrate dev`
- `npm run db:studio` — Launches `prisma studio`

## Current Schema Models (`server/prisma/schema.prisma`)

- `User` (`users`) — UUID primary key, unique email, optional name, timestamps, and relations to all user-owned Phase 1 tables.
- `Goal` (`goals`) — User-owned hierarchical goal (`parentGoalId` self-relation), `timeframe` (`YEARLY` default), optional `targetYear`, `progress` (`0–100`), `ACTIVE` default status, milestones, tasks, time blocks, plans, reminders, and accountability logs.
- `Milestone` (`milestones`) — Goal-linked milestone with title, optional description, `order`, optional target date, `isCompleted` flag, `completedAt` timestamp, and tasks.
- `Task` (`tasks`) — User-owned task with optional `goalId`, `milestoneId`, and `parentTaskId` (subtask self-relation), `MEDIUM` default priority, `TODO` default status, optional `dueDate`, and `completedAt` timestamp.
- `TimeBlock` (`time_blocks`) — Scheduled user calendar block with optional `taskId`/`goalId`, `startTime`, `endTime`, `category`, `status`, and recurrence metadata.
- `Reminder` (`reminders`) — Scheduled reminder with optional `taskId`/`goalId`, `remindAt`, `status`, `channel`, and `triggeredAt`.
- `AccountabilityLog` (`accountability_logs`) — Missed-task alerts, procrastination signals, interventions, and check-in records (`type`, `severity`, `status`, `notes`, `metadata`, `detectedAt`, `resolvedAt`).
- `Memory` (`memories`) — User memory entry with optional `title`, `content`, `category`, `tags`, `importance`, and `Unsupported("vector")?` embedding column reserved for `pgvector`.
- `UserPreference` (`user_preferences`) — Key-value user preference scoped uniquely per `(userId, key)`.
- `ConversationMessage` (`conversation_messages`) — Session-grouped conversation turn (`sessionId`, `role`, `content`, `metadata`).
- `Plan` (`plans`) — AI-generated or manual goal decomposition storing `summary`, `status`, `milestonesData`, `tasksData`, `provider`, `model`, and `appliedAt`.
- `AiExecution` (`ai_executions`) — AI orchestrator run tracking `sessionId`, `prompt`, `status`, `provider`, `model`, `responseText`, `errorMessage`, `attempts`, `stepsData`, and timestamps.
- `AiToolApproval` (`ai_tool_approvals`) — Human approval queue linked to `AiExecution`, storing `toolName`, `toolArgs`, `status`, `resultData`, `errorMessage`, `decidedAt`, and `executedAt`.
- `ResearchItem` (`research_items`) — Web research query, synthesized `title`, `summary`, `keyFindings`, `sources`, `status`, `provider`, and `model`.

## Storage & Vector Search Strategy

- **Relational data:** Managed in PostgreSQL via Prisma models with UUID primary keys, explicit foreign keys, and `createdAt` / `updatedAt` timestamps.
- **Semantic memory (`pgvector`):** Planned for Phase 2 to store and query vector embeddings for long-term memory, conversation context, and research retrieval.
- **Binary attachments & audio:** Stored in **Supabase Storage**, with metadata and object paths referenced in PostgreSQL.

## Planned Domain Entities by Phase

### Phase 1 — Core Personal Management

- **User / Profile:** Maps authenticated Supabase Auth identities to V3 user preferences, timezone, and account metadata.
- **Goal & Milestone:** Hierarchical goals (yearly/long-term goals down to milestones), target dates, status, and calculated progress.
- **Plan:** AI-generated goal decompositions linking structured milestones and suggested tasks back to goals.
- **Task & Subtask:** Actionable items with priorities, statuses, deadlines, and optional goal/milestone/plan links.
- **Schedule / TimeBlock:** Calendar time allocations linked to tasks or focus sessions.
- **AccountabilityLog / Reminder:** Missed-task detections, check-ins, and scheduled reminder states.
- **MemoryItem & ConversationHistory:** Explicit user preferences, project context records, and conversation turns.

### Phase 2 — Intelligence, Memory & Communications

- **SemanticMemoryEmbedding:** Vector-indexed memory entries using `pgvector` for similarity search and personalization.
- **NotificationPreference & DeliveryLog:** Per-channel settings (Telegram, Email via Resend, Discord, WhatsApp), frequency rules, retry states, and delivery audit logs.
- **VoiceSession:** Transcripts, language metadata (Bhashini ASR/TTS/translation), and voice command traces.
- **ResearchItem:** Captured web research queries, synthesized summaries, and source references.
- **Workflow & ExecutionLog:** Multi-step automation definitions, tool call records, retry status, and human-approval audit entries.

### Phase 3 — Developer Ops, Stateful Agents & Analytics

- **RepositoryMonitor & DevEvent:** Connected GitHub repositories, tracked issues, pull requests, commit digests, and CI/build failure alerts.
- **AgentCheckpoint & AuditLog:** Persistent workflow state for pause/resume execution, idempotency keys, and agent action auditing.
- **AnalyticsSnapshot / ProductivityReport:** Aggregated weekly/monthly goal completion, task velocity, time allocation, and missed-deadline insights.

## Backup & Reliability Plan

- Rely on managed Supabase PostgreSQL backups for initial environments.
- Phase 2 and Phase 3 cloud readiness tasks include formalizing production backup policies and running end-to-end backup and recovery tests before full production release.

