# V3 Development Roadmap

This document defines V3's target technology stack, repository scope, and three-phase engineering roadmap.

## Scope & Repository Model

- **Repository strategy:** Option B — one Git repository, ordinary `npm`, a modular monolithic backend (`server/`), and separate web (`client/web/`) and mobile (`client/mobile/`) clients. No pnpm, Nx, Turborepo, npm workspaces, or microservices.
- **Initial product scope:** The **12 original feature groups** remain V3's initial product scope.
- **Milestone ordering:** The three phases below are engineering milestones ordered by technical dependencies rather than assigning four arbitrary features per phase.
- **Out-of-scope expansions:** Additional researched features numbered 13 onwards (daily briefing, opportunity radar, career agent, travel assistant, etc.) remain outside these three initial phases and may be planned separately later.
- **Dependency discipline:** The stack below is the target architecture, not a requirement to install every library on day one.

## Full Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Main language | TypeScript | Backend, website, and mobile |
| Runtime | Node.js 24 LTS | Backend runtime |
| Backend framework | Express 5 | REST API |
| Backend architecture | Modular monolith | Feature-based modules |
| Web framework | Next.js App Router | Website and dashboard |
| Web UI | React + Tailwind CSS | Interface and styling |
| Mobile framework | React Native + Expo | Future iOS and Android app |
| Package manager | npm | Install dependencies independently |
| Database | PostgreSQL | Application data |
| Database hosting | Supabase | Managed PostgreSQL |
| ORM | Prisma | Database queries and migrations |
| Validation | Zod | Validate API requests and data |
| API documentation | OpenAPI / Swagger | Document REST endpoints |
| Authentication | Supabase Auth (proposed) | User authentication |
| AI integration | Vercel AI SDK + provider adapters | Model calls and tool integration |
| Agent orchestration | LangGraph.js (later, if needed) | Stateful, multi-step agent workflows |
| Memory search | PostgreSQL + pgvector | Semantic memory retrieval |
| Background jobs | Trigger.dev (proposed) | Scheduled and long-running tasks |
| File storage | Supabase Storage | Documents and attachments |
| Email | Resend | Email notifications |
| Voice and Indian languages | Bhashini | ASR, TTS, translation, and related services |
| Testing | Vitest + Supertest | Unit and API testing |
| Code quality | ESLint + Prettier | Linting and formatting |
| Version control | Git + GitHub | Source control |
| CI | GitHub Actions | Automated tests and builds |

### Key Technical References

- Next.js supports TypeScript natively and recommends App Router for new web applications.
- Expo supports TypeScript directly, enabling mobile development without changing backend languages.
- LangGraph.js provides persistent state, human approval checkpoints, and long-running agent workflows, deferred until agent workflows require stateful orchestration.
- Prisma provides TypeScript-first PostgreSQL modeling, queries, and migrations.

---

## Phase 1 — Foundation and Core Personal Management

**Objective:** Build the functioning V3 backend foundation and the essential goal and task management system.

### A. Project Initialization

- [x] Create GitHub repository `v3` (`MARKASCHARAN/v3` on `main`)
- [x] Create `server`, `client/web`, `client/mobile`, and `docs` directories
- [x] Initialize Express + TypeScript backend
- [x] Initialize Next.js website
- [x] Configure `npm` and TypeScript independently per application
- [x] Configure ESLint and Prettier (`server/eslint.config.mjs`, `server/.prettierrc`, `client/web/eslint.config.mjs`)
- [x] Configure environment variables (`server/.env.example`, `server/.env`, and Zod env validation)
- [x] Configure Git ignore rules (`.gitignore`)
- [x] Set up development and production configurations (`app.config.ts`)
- [x] Establish API versioning (`/api/v1`)

### B. Backend Foundation

- [x] Configure Express application (`helmet`, `cors`, JSON parsing, request logging)
- [x] Configure middleware and error handling (`AppError`, `errorHandler`)
- [x] Configure request validation using Zod (`validation.middleware.ts`)
- [x] Configure structured logging (`pino` / `pino-http`)
- [x] Configure CORS and security headers
- [x] Configure authentication (`auth.middleware.ts` `requireAuth` and `auth` module endpoints)
- [x] Connect PostgreSQL (`server/src/database/prisma.ts` verified against Supabase PostgreSQL 17.11 with `@prisma/adapter-pg`)
- [x] Set up Prisma and database migrations (`schema.prisma`, `prisma.config.ts`, `pgvector` extension, and initial migration `20261111233814_init` applied)
- [x] Establish database conventions
- [x] Create health-check endpoint (`GET /api/v1/health`)
- [x] Create API documentation (OpenAPI / Swagger at `/api/docs` and `docs/api.md`)
- [x] Establish testing conventions (`Vitest` + `Supertest`)

### C. Core Phase 1 Features

| Original Feature | Work to Implement | Status |
| --- | --- | --- |
| 01. Goal management | Goal hierarchy, yearly goals, milestones, and progress | Done (backend API + milestone progress sync + web UI) |
| 02. AI planning | Goal decomposition, plans, milestones, and task suggestions | Done (backend API + Vercel AI SDK Google provider + web UI) |
| 03. Scheduling | Calendar model, time blocks, and scheduling logic | Done (backend API + overlap detection & slot suggestions + web UI) |
| 04. Task management | Tasks, subtasks, priorities, deadlines, and statuses | Done (backend API + subtasks/deadlines + web UI) |
| 05. Accountability | Missed-task detection, reminders, and progress tracking | Done (backend API + missed-task scan, reminders, progress summary + web UI) |
| 08. Memory | User preferences, project context, conversation history, and memory retrieval | Done (backend API + preferences, context search, conversation history + web UI) |

### D. Website Foundation

- [x] Create basic website structure
- [x] Configure routing and layouts
- [x] Create authentication pages (`/login`, `/register`)
- [x] Create dashboard shell (`DashboardShell` in `/dashboard`)
- [x] Create API communication layer (`src/lib/api-client.ts`, `src/lib/v3-api.ts`, `src/lib/auth-storage.ts`)
- [x] Implement goals interface (`/dashboard/goals`)
- [x] Implement task-management interface (`/dashboard/tasks`)
- [x] Implement calendar and schedule interface (`/dashboard/schedule`)
- [x] Implement progress display (`/dashboard`, plus `/dashboard/planning` and `/dashboard/memory`)

### Phase 1 Deliverable

A functioning personal management system where users can create goals, convert them into tasks, organize schedules, track progress, and retain useful personal context, with initial AI planning working through the backend and accessible from the web dashboard.

---

## Phase 2 — Autonomous AI, Communication and Integrations

**Objective:** Transform V3 from a personal management application into an intelligent, continuously operating assistant that combines deterministic Phase 1/2 services with autonomous multi-agent reasoning.

> **Technical Specification:** See [`docs/phase-2-technical-spec.md`](phase-2-technical-spec.md) for exact packages, Prisma extensions, LangGraph state definitions, hybrid retrieval design, security rules, and Milestones `2.1`–`2.10`.

### A. AI Intelligence (Target Architecture: LangChain.js + LangGraph.js + LangSmith)

- [x] Integrate primary AI model (`@langchain/google-genai`, migrated from initial `@ai-sdk/google` in M2.1)
- [x] Build provider abstraction (`server/src/ai/providers/model-router.ts` & `embeddings.ts`)
- [x] Implement LangGraph `PostgresSaver` runtime foundation (`server/src/ai/runtime/{state,checkpoints,graph-factory,orchestrator}.ts`, `AssistantOrchestrator` 8-step adaptive loop in M2.1–M2.3)
- [x] Implement agent/tool execution framework (`server/src/ai/tools/registry.ts`, `server/src/ai/tools/internal/`, and 5-level `risk-policy.ts` + `permission-guard.ts` in M2.2)
- [x] Implement prompt management (`server/src/ai/prompts/prompt.registry.ts` with versioned orchestrator and specialist prompts, `assistant.prompt.ts`, `planning.prompt.ts`)
- [x] Implement conversation context (hybrid SQL + PostgreSQL FTS + `pgvector` RRF retrieval in `ai/memory/hybrid-retrieval.ts`, preferences, memories, workspace metrics, and `ConversationMessage` history)
- [x] Implement memory lifecycle & consolidation (`memoryType`, `sourceType`, `confidence`, `expiresAt`, `supersededById`, HNSW/GIN indexes, `proposeMemory`, and candidate validation)
- [x] Implement structured tool calling (`V3_TOOL_REGISTRY` `V3ToolContract` entries with Zod input/output schemas and Gemini-safe `toolSchema` wrappers)
- [x] Implement multi-step workflows (`server/src/ai/workflows/execution.workflow.ts` running checkpointed LangGraph `orchestrator.ts` + `interrupt()`/`Command({ resume })`)
- [x] Implement specialist agents & dynamic delegation (`server/src/ai/agents/{goal-planning,task,scheduling,research,memory,accountability,communication,developer}.agent.ts`, `delegateToSpecialist`, `GET /api/v1/automation/agents`)
- [x] Implement autonomous delegation & replanning (`delegateParallelSpecialists`, `parentExecutionId` child executions, selective [`deep-harness.ts`](file:///Users/markasaicharan/PROJECTS/v3/server/src/ai/agents/deep-harness.ts), and `orchestrator.ts` stuck-detection + `replan` edge in M2.6)
- [x] Implement execution history (`AiExecution` persistence with `threadId`, `parentExecutionId`, `agentRole`, `tokenBudget`, `tokensUsed`, `langsmithTraceId`)
- [x] Implement human approval and permission checks (5-level risk policy, `AiToolApproval` with `idempotencyKey`/`expiresAt`, `/api/v1/automation/approvals/:id/approve|reject`)
- [x] Implement AI failure handling and retry logic (`server/src/ai/workflows/retry.workflow.ts` exponential backoff, token budget guard, stuck-loop replanning, and circuit breaker)
- [x] Implement background autonomy & event routing (`DomainEvent` & `BackgroundJob` Prisma models, `server/src/modules/events/`, Trigger.dev jobs under `server/src/jobs/` for daily accountability review, missed-task scans, approval expiry sweeps, background agent runs, and dead-letter recovery in M2.7)
- [x] Implement external integrations, multi-channel notifications, voice & MCP (`IntegrationAccount` with AES-256-GCM encryption, `notifications` via Resend/Telegram/Discord/WhatsApp, `voice` via Bhashini ASR/TTS/translation + Supabase Storage + telephony, Google Calendar/Gmail & GitHub adapters, and permission-guarded `server/src/ai/mcp/` in M2.8)
- [x] Implement safety guardrails, observability, rate limits & evaluation datasets (`<untrusted_external_data>` boundaries, secret redaction, `costMicroUsd` + LangSmith trace URLs on `AiExecution`, `GET /api/v1/automation/metrics`, per-user/endpoint rate limiters, `server/src/ai/evaluation/`, and adversarial tests in M2.9)
- [ ] Complete Milestone `2.10` (GitHub Actions CI/CD, production deployment/backup verification, and 5 end-to-end autonomous acceptance scenarios)

### B. Original Features Continued

| Original Feature | Work to Implement | Status |
| --- | --- | --- |
| 05. Accountability | Adaptive accountability, procrastination detection, and intelligent interventions | Done (`/api/v1/accountability/procrastination`, `/api/v1/accountability/interventions`) |
| 08. Memory | Long-term memory, hybrid SQL/FTS/`pgvector` RRF retrieval, lifecycle supersession, and personalization | Done (`/api/v1/memory/hybrid`, `/api/v1/memory/semantic`, `/api/v1/memory/propose`, `/api/v1/memory/prune`, `/api/v1/memory/embeddings/backfill`, `/api/v1/memory/personalization`) |
| 09. Research | Web research, summarization, and knowledge retrieval | Done (`/api/v1/research`, `/api/v1/research/search`, `/api/v1/research/:id/save-to-memory`) |
| 11. Automation | Multi-step workflows and autonomous tool execution | Done (AI orchestrator, tool execution, approval checkpoints & history under `/api/v1/automation`) |

### C. Communications and Voice

| Original Feature | Work to Implement | Status |
| --- | --- | --- |
| 06. Notifications | Telegram, email (Resend), Discord, and WhatsApp integrations, preferences, quiet hours, frequency caps, and retry/dead-letter tracking | Done (`/api/v1/notifications/*`, `/api/v1/integrations/*`) |
| 07. Voice and calling | Speech input (Bhashini ASR), speech output (TTS + Supabase Storage), translation, voice commands, and telephony webhook adapter | Done (`/api/v1/voice/*`) |

Additional communication and voice deliverables:

- Telegram bot
- Email notification service (Resend)
- Discord bot
- WhatsApp Cloud API integration
- Bhashini ASR integration
- Bhashini TTS integration
- Bhashini translation integration
- Voice conversation workflow
- Scheduled reminders
- Notification preferences and frequency controls
- Background job execution (Trigger.dev or equivalent)
- Delivery tracking and retry handling

### D. Cloud Infrastructure

- Configure backend deployment
- Configure database production environment
- Configure scheduled jobs
- Configure cloud file storage (Supabase Storage)
- Configure secrets management
- Configure CI/CD (GitHub Actions)
- Implement backup and recovery procedures

### Phase 2 Deliverable

V3 can understand requests, remember useful information, plan work, communicate through connected messaging channels, interact via voice, send proactive reminders, and execute approved workflows.

---

## Phase 3 — Advanced Autonomy, Developer Operations and Complete Product

**Objective:** Complete the remaining initial feature scope, strengthen reliability, and deliver the mobile application.

### A. Remaining Original Feature Groups

| Original Feature | Work to Implement |
| --- | --- |
| 09. Research | Advanced research workflows and continuous monitoring |
| 10. Developer assistant | GitHub integration, repository monitoring, issues, and pull requests |
| 11. Autonomous execution | Advanced multi-step workflows, scheduling, and recovery |
| 12. Analytics | Productivity reports, goal analytics, and personal insights |

### B. Advanced Agent Capabilities

- Introduce LangGraph.js if workflow complexity justifies it
- Implement specialist agents
- Implement agent delegation
- Implement stateful workflow execution
- Implement long-running tasks
- Implement approval checkpoints
- Implement workflow interruption and resumption
- Implement scheduled autonomous routines
- Implement agent activity audit logs
- Implement safe retries and duplicate-action prevention

### C. Developer and GitHub Assistant

- GitHub OAuth / application integration
- Repository monitoring
- Issue and pull-request tracking
- CI / build failure notifications
- Commit and activity summaries
- Development task tracking
- AI-assisted code and repository research

### D. Analytics and Reporting

- Goal-completion analytics
- Task-completion analytics
- Weekly and monthly reports
- Time allocation insights
- Productivity trends
- Missed-deadline analysis
- AI-generated improvement recommendations

### E. Mobile Application

- Initialize and configure React Native + Expo (`client/mobile/` base scaffold present)
- Connect mobile app to Express API
- Implement authentication
- Implement dashboard
- Implement goals and task management
- Implement push notifications
- Implement voice interactions
- Implement mobile-specific permissions
- Test Android and iOS
- Prepare mobile deployment

### F. Production Readiness

- Security review
- API rate limiting
- Database performance optimization
- Integration tests
- End-to-end tests
- Error monitoring
- Usage and cost monitoring
- Deployment automation
- Documentation updates
- Production backup and recovery testing

### Phase 3 Deliverable

A complete V3 ecosystem featuring web and mobile clients, developer assistant, analytics, reliable autonomous workflows, and integrated communication channels.

---

## Overall Roadmap Summary

1. **Phase 1 — Foundation and Core Management:** Repository setup, Express API foundation, PostgreSQL + Prisma, authentication, core modules (goals, AI planning, scheduling, tasks, initial accountability and memory), and Next.js web dashboard.
2. **Phase 2 — Intelligence and Communication:** AI agents, semantic memory, adaptive accountability, research, voice (Bhashini), multi-channel notifications, background jobs, cloud infra, and automation workflows.
3. **Phase 3 — Advanced Autonomy and Mobile:** GitHub developer assistant, advanced stateful agent workflows, analytics, Expo mobile application, testing, security, and production hardening.

## Finalized Phase 2 Architecture Decisions

| Decision Area | Confirmed Selection |
| --- | --- |
| Database | Supabase PostgreSQL |
| ORM | Prisma |
| Authentication | Supabase Auth |
| AI integration & tools | LangChain.js + `@langchain/google-genai` (replacing initial `ai` prototype in M2.1) |
| Agent runtime | LangGraph.js + `PostgresSaver` checkpoints (`Deep Agents` selectively in M2.6) |
| Agent observability | LangSmith |
| External tool protocol | Model Context Protocol (MCP) behind V3 permissions |
| Background jobs | Trigger.dev |
| API | REST with OpenAPI |
| Memory | PostgreSQL + `pgvector` (hybrid SQL + keyword + vector search) |
| Mobile | Expo + React Native (Phase 3) |
| Deployment | Managed cloud hosting |

## Next Phase 2 Engineering Step

Milestone `2.9` (Safety & Observability) is complete. Proceed to **Milestone `2.10` (End-to-End Autonomous System & CI/CD)** in [`docs/phase-2-technical-spec.md`](phase-2-technical-spec.md).

