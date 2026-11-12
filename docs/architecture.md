# V3 System Architecture

## Architectural Overview

V3 follows **Option B**: a single Git repository containing a feature-modular Express monolith backend (`server/`), an independent Next.js web application (`client/web/`), and an independent React Native + Expo mobile application (`client/mobile/`).

```text
+-----------------------+       +-----------------------+
|   Web Client (Next)   |       |  Mobile Client (Expo) |
|  client/web (:3000)   |       |  client/mobile        |
+-----------+-----------+       +-----------+-----------+
            |                               |
            +---------------+---------------+
                            |
                     REST API (/api/v1)
                            |
            +---------------v---------------+
            |   Express 5 Modular Monolith  |
            |       server/ (:5000)         |
            |  - Middleware & Auth          |
            |  - 13 Feature Modules         |
            |  - AI Orchestration Layer     |
            +-------+---------------+-------+
                    |               |
        +-----------v---+       +---v-----------------------+
        | Supabase      |       | External Integrations     |
        | - PostgreSQL  |       | - AI Providers (Vercel AI)|
        | - pgvector    |       | - Bhashini (Voice/ASR/TTS)|
        | - Auth        |       | - Resend (Email)          |
        | - Storage     |       | - Telegram / Discord / WA |
        +---------------+       | - Trigger.dev / GitHub    |
                                +---------------------------+
```

## Dependency & Packaging Model

- Each application (`server`, `client/web`, `client/mobile`) owns its own `package.json`, `package-lock.json`, `tsconfig.json`, and `node_modules/`.
- The repository root intentionally has **no** `package.json` and uses **no** workspace orchestrator (no pnpm, Nx, Turborepo, or npm workspaces).
- Shared contracts are documented in `docs/api.md` and validated at runtime with Zod on the backend.

## Backend Architecture (`server/`)

### Entry Points & Configuration

Current scaffolded files:

- `server/src/server.ts` — Starts the HTTP server on `env.PORT` and handles `SIGINT`/`SIGTERM` graceful shutdown.
- `server/src/app.ts` — Configures `helmet`, `cors`, JSON body parsing (`1mb` limit), `pino-http` logging (disabled in `test` mode), mounts `v1Router` at `appConfig.apiPrefix` (`/api/v1`), exposes `GET /`, throws `AppError(404)` for unmatched routes, and attaches `errorHandler`.
- `server/src/config/env.ts` — Loads `.env` via `dotenv` and validates runtime environment variables at startup using Zod.
- `server/src/config/app.config.ts` — Exposes application flags, API prefix (`/api/v1`), CORS origin, security defaults, and rate-limit configuration.
- `server/src/middleware/error.middleware.ts` — Defines `AppError` and `errorHandler` for uniform JSON error formatting across `ZodError`, `AppError`, and unhandled errors.
- `server/src/middleware/auth.middleware.ts` — Empty placeholder reserved for Supabase Auth JWT verification middleware.
- `server/src/routes/v1.router.ts` — Root v1 API router currently serving `GET /api/v1/health`.

Planned foundation files:

- `server/src/config/database.ts` — Prisma client initialization and connection lifecycle management.
- `server/src/middleware/validation.middleware.ts` — Reusable Zod middleware for request body, query, and parameter validation.

### Feature Module Convention

All domain modules live under `server/src/modules/` (`auth`, `goals`, `planning`, `scheduling`, `tasks`, `accountability`, `notifications`, `voice`, `memory`, `research`, `developer`, `automation`, `analytics`). Each module directory is currently empty and will follow a standardized seven-file structure:

```text
<module>/
├── <module>.routes.ts
├── <module>.controller.ts
├── <module>.service.ts
├── <module>.repository.ts
├── <module>.schema.ts
├── <module>.types.ts
└── <module>.test.ts
```

Layer responsibilities:

1. **Routes** — Express router definitions and middleware wiring (auth, validation).
2. **Controller** — Extracts validated HTTP inputs, invokes services, and formats HTTP responses.
3. **Service** — Encapsulates business rules, cross-module coordination, and AI orchestration calls.
4. **Repository** — Performs database queries via Prisma without HTTP concerns.
5. **Schema** — Zod schemas for request and payload validation.
6. **Types** — Module-specific TypeScript interfaces and DTOs.
7. **Test** — Vitest + Supertest module unit and endpoint tests.

### AI Orchestration Layer (`server/src/ai/`)

The `server/src/ai/` directory separates autonomous reasoning from deterministic HTTP routing and database transactions (see [`docs/phase-2-technical-spec.md`](phase-2-technical-spec.md) for the Phase 2 hybrid architecture):

- `providers/` — Model routing (`model-router.ts`) and vector embeddings (`embeddings.ts`) backed by LangChain.js + `@langchain/google-genai`.
- `runtime/` — 8-step adaptive orchestrator (`orchestrator.ts`), LangGraph.js graph helpers (`graph-factory.ts`), shared state (`state.ts`), and PostgreSQL checkpoints (`checkpoints.ts` via `PostgresSaver` in `langgraph` schema).
- `agents/` — Central orchestrator (`assistant.agent.ts`), shared specialist runner (`specialist.factory.ts`, `specialist.registry.ts` with single/parallel delegation), selective deep project harness (`deep-harness.ts`), and scoped specialist modules (`goal-planning`, `task`, `scheduling`, `research`, `memory`, `accountability`, `communication`, `developer`).
- `tools/` — Domain-split internal/external `V3ToolContract` definitions (`internal/`, `external/`, `registry.ts`) enforced by deterministic permission guards (`risk-policy.ts`, `permission-guard.ts` covering `READ`, `INTERNAL_WRITE`, `EXTERNAL_REVERSIBLE`, `EXTERNAL_CONSEQUENTIAL`, `RESTRICTED`).
- `memory/` — Hybrid SQL + PostgreSQL FTS + `pgvector` RRF retrieval (`hybrid-retrieval.ts`), candidate validation/extraction (`extraction.ts`), and lifecycle consolidation (`consolidation.ts`).
- `prompts/` — Central prompt registry (`prompt.registry.ts`) and system context builders.
- `workflows/` — Retry handling (`retry.workflow.ts`) and multi-step execution pipelines.
- `mcp/` & `evaluation/` (planned M2.8–M2.9) — Model Context Protocol connectivity and LangSmith evaluation datasets.

## Client Architecture

### Web Client (`client/web/`)

Built with Next.js App Router, React, TypeScript, and Tailwind CSS:

- `src/app/` — App Router pages and layouts.
- `src/components/` — Reusable UI primitives and layout shells.
- `src/features/` — Domain-aligned UI views (goals, tasks, scheduling, accountability, analytics).
- `src/hooks/` — Custom client hooks.
- `src/lib/` — API client utilities, auth helpers, and formatting functions.
- `src/types/` — Shared frontend TypeScript definitions.

### Mobile Client (`client/mobile/`)

Built with React Native + Expo (`expo-router`, TypeScript). A base Expo template scaffold exists in `client/mobile/`; API integration and mobile product screens are scheduled for Phase 3.

## Security & Operational Guidelines

- **Server-side secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `BHASHINI_*`, and `RESEND_API_KEY` remain strictly on the backend and are never exposed to web or mobile clients.
- **Transport & headers:** `helmet` secures HTTP headers; `cors` restricts origins to `WEB_ORIGIN` (`http://localhost:3000` in development) with credentials enabled.
- **Validation:** Every API payload is validated via Zod before reaching service or repository layers.
- **Error handling:** Route handlers throw `AppError` instances or `ZodError`, handled centrally by `errorHandler` without leaking production stack details.

## Strict Code Style Convention

- **Zero Comments in Source Code:** Never write comments (`//`, `/* */`, JSDoc, or inline comments) anywhere in source code files — now or in future implementations. Clarity must come from descriptive identifiers, small single-purpose functions, explicit types, and modular architecture.

