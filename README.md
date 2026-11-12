# V3

V3 is a modular personal management and autonomous AI assistant platform built with TypeScript across a monolithic Express backend, a Next.js web dashboard, and an Expo mobile client.

> **Repository Status:** Documentation and initial repository scaffold only. Feature modules, database schemas, and application business logic have not been implemented yet.

## Repository Strategy (Option B)

V3 uses **one Git repository** with **independent `npm` packages** per application:

- **No** pnpm, Nx, Turborepo, npm workspaces, or microservices.
- **Root** contains only repository-level documentation and Git configuration (no root `package.json`).
- **Backend** is a feature-based modular monolith (`server/`).
- **Clients** are independent applications (`client/web/` and `client/mobile/`).

## Scope & Feature Overview

V3's initial product scope covers the **12 original feature groups** delivered across three dependency-ordered engineering phases:

1. **01. Goal management** — Goal hierarchy, yearly goals, milestones, and progress tracking
2. **02. AI planning** — Goal decomposition, plans, milestones, and task suggestions
3. **03. Scheduling** — Calendar model, time blocks, and scheduling logic
4. **04. Task management** — Tasks, subtasks, priorities, deadlines, and statuses
5. **05. Accountability** — Missed-task detection, reminders, progress tracking, and adaptive interventions
6. **06. Notifications** — Telegram, email (Resend), Discord, and WhatsApp Cloud API integrations
7. **07. Voice and calling** — Speech input/output, voice commands, telephony, and Bhashini ASR/TTS/translation
8. **08. Memory** — User preferences, project context, conversation history, and pgvector semantic retrieval
9. **09. Research** — Web research, summarization, knowledge retrieval, and continuous monitoring
10. **10. Developer assistant** — GitHub integration, repository monitoring, issues, and pull requests
11. **11. Automation / Autonomous execution** — Multi-step workflows, autonomous tool execution, and recovery
12. **12. Analytics** — Productivity reports, goal analytics, and personal insights

Additional ideas numbered 13+ (daily briefing, opportunity radar, career agent, travel assistant, etc.) remain outside this initial three-phase scope for later expansion.

## Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Main language | TypeScript | Backend, website, and mobile |
| Runtime | Node.js 24 LTS | Backend runtime |
| Backend framework | Express 5 | REST API |
| Backend architecture | Modular monolith | Feature-based modules |
| Web framework | Next.js App Router | Website and dashboard |
| Web UI | React + Tailwind CSS | Interface and styling |
| Mobile framework | React Native + Expo | iOS and Android app |
| Package manager | npm | Independent dependency management per app |
| Database | PostgreSQL | Application data |
| Database hosting | Supabase | Managed PostgreSQL |
| ORM | Prisma | Database queries and migrations |
| Validation | Zod | API request and data validation |
| API documentation | OpenAPI / Swagger | REST endpoint documentation |
| Authentication | Supabase Auth | User authentication |
| AI integration | LangChain.js (migrating from initial Vercel AI SDK in M2.1) | Model routing, prompts, and structured tools |
| Agent orchestration | LangGraph.js + Deep Agents (selective) + LangSmith | Stateful agent runtime, checkpoints, and tracing |
| External tool protocol | Model Context Protocol (MCP) | Standardized external tool connectivity |
| Memory search | PostgreSQL + pgvector | Hybrid SQL, keyword, and semantic retrieval |
| Background jobs | Trigger.dev | Scheduled, event-driven, and long-running runs |
| File storage | Supabase Storage | Documents and attachments |
| Email | Resend | Email notifications |
| Voice and Indian languages | Bhashini | ASR, TTS, translation, and related services |
| Testing | Vitest + Supertest | Unit and API testing |
| Code quality | ESLint + Prettier | Linting and formatting |
| Version control | Git + GitHub | Source control |
| CI | GitHub Actions | Automated tests and builds |

## Repository Structure

```text
v3/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.ts
│   │   │   ├── app.config.ts
│   │   │   └── database.ts (planned)
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── validation.middleware.ts (planned)
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── goals/
│   │   │   ├── planning/
│   │   │   ├── scheduling/
│   │   │   ├── tasks/
│   │   │   ├── accountability/
│   │   │   ├── notifications/
│   │   │   ├── voice/
│   │   │   ├── memory/
│   │   │   ├── research/
│   │   │   ├── developer/
│   │   │   ├── automation/
│   │   │   └── analytics/
│   │   ├── ai/
│   │   │   ├── agents/
│   │   │   ├── providers/
│   │   │   ├── tools/
│   │   │   ├── prompts/
│   │   │   └── workflows/
│   │   ├── routes/
│   │   │   └── v1.router.ts
│   │   ├── database/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma (planned)
│   │   └── migrations/ (planned)
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── client/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   ├── public/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── mobile/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── constants/
│       │   └── hooks/
│       ├── assets/
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── architecture.md
│   ├── api.md
│   ├── database.md
│   └── development-roadmap.md
├── .gitignore
└── README.md
```

## Development Ports & Local Setup

| Application | Local Address |
| --- | --- |
| Express backend | `http://localhost:5000` |
| Next.js website | `http://localhost:3000` |
| PostgreSQL | Managed Supabase database |
| Mobile app | Expo development environment |

### Environment Variables

Copy `server/.env.example` to `server/.env` and populate required secrets before starting the backend:

- Required by `server/src/config/env.ts`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Optional / defaults provided: `NODE_ENV` (`development`), `PORT` (`5000`), `WEB_ORIGIN` (`http://localhost:3000`), `DIRECT_URL`, `GEMINI_API_KEY`, `BHASHINI_UDYAT_KEY`, `BHASHINI_INFERENCE_KEY`, `RESEND_API_KEY`

Never commit `.env` files or API credentials. Service-role keys and AI provider keys must remain strictly server-side.

### Application Commands

Install dependencies and run scripts independently inside each app directory:

- **Backend (`server/`)**: `npm install`, `npm run dev`, `npm run build`, `npm start`, `npm test`, `npm run db:generate`, `npm run db:migrate`, `npm run db:studio`
- **Web (`client/web/`)**: `npm install`, `npm run dev`, `npm run build`, `npm start`, `npm run lint`
- **Mobile (`client/mobile/`)**: `npm install`, `npm start`, `npm run android`, `npm run ios`, `npm run web`, `npm run lint`

## Engineering Conventions

- **Zero Code Comments Policy:** Never write comments in source code (`//`, `/* */`, JSDoc, or inline comments) — now or in future development. Write clear, self-explanatory symbols, types, and modular functions instead.
- **Standard Feature Module Layout:** Every backend module in `server/src/modules/<feature>/` follows the convention: `<feature>.routes.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.repository.ts`, `<feature>.schema.ts`, `<feature>.types.ts`, and `<feature>.test.ts`.

## Documentation

- [Development Roadmap](docs/development-roadmap.md) — Full 3-phase development plan, feature scope, and milestones
- [Phase 2 Technical Specification](docs/phase-2-technical-spec.md) — Hybrid intelligence architecture, LangGraph state/agent contracts, packages, and Milestones `2.1`–`2.10`
- [Architecture](docs/architecture.md) — Modular monolith design, backend/frontend structure, AI layer, and coding standards
- [API Reference](docs/api.md) — Versioning, error envelope, current endpoints, and planned module endpoints
- [Database Guide](docs/database.md) — Supabase PostgreSQL, Prisma setup, pgvector strategy, and domain entities

