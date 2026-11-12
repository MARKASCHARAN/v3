# V3 Phase 2 — Hybrid Intelligence & Autonomous Agent Technical Specification

This specification translates V3's Phase 2 hybrid architecture into exact package choices, repository reconciliation, Prisma schema additions, LangGraph state and agent contracts, model routing, hybrid retrieval, background execution, cloud deployment, and milestone-by-milestone engineering tasks (`2.1`–`2.10`).

> **Scope Rule:** Deterministic Phase 1 and Phase 2 services own data integrity, business rules, permissions, and persistence. Autonomous agents manage reasoning, planning, dynamic delegation, and adaptation through validated tool boundaries.

---

## 1. Repository Audit & Reconciliation

### 1.1 Committed Baseline (`c80362f` on `origin/main`)

- **Phase 1 Backend (`server/`):** Express 5 modular monolith with TypeScript, Prisma `7.10.1` (`@prisma/adapter-pg`), Supabase Auth (`requireAuth`), Zod validation (`validateRequest`), Pino logging, OpenAPI/Swagger (`/api/docs`), Vitest + Supertest, and complete modules for `auth`, `goals` (hierarchy, yearly goals, milestones, progress), `planning`, `scheduling`, `tasks`, `accountability`, and `memory`.
- **Phase 1 Web (`client/web/`):** Next.js 16 App Router dashboard (`/login`, `/register`, `/dashboard`, `/dashboard/goals`, `/dashboard/tasks`, `/dashboard/schedule`, `/dashboard/planning`, `/dashboard/memory`).
- **Phase 1 Mobile (`client/mobile/`):** Expo template scaffold reserved for Phase 3.

### 1.2 Uncommitted Working Tree & Applied Supabase Migrations

Two migrations and initial Phase 2 A/B implementations already exist in the workspace:

- **Database migrations already applied to Supabase (`PostgreSQL 17.11` + `pgvector 0.8.2`):**
  1. `20261111233814_init` (with `CREATE EXTENSION IF NOT EXISTS "vector";`)
  2. `20261112001415_add_ai_executions_and_approvals` (`ai_executions`, `ai_tool_approvals`)
  3. `20261112002137_add_research_and_adaptive_accountability` (`research_items`, `AccountabilityLog.severity`, `AccountabilityLog.metadata`)
- **Deterministic services to KEEP & EXTEND (100% aligned with Phase 2 architecture):**
  - `server/src/modules/memory/` — `pgvector` embedding sync, cosine similarity search (`<=>`), keyword fallback, embedding backfill, personalization context.
  - `server/src/modules/accountability/` — deterministic procrastination scoring (`scoreProcrastinationSignals`), adaptive intervention generation, deduplicated alerts.
  - `server/src/modules/research/` — `ResearchItem` persistence, SSRF-safe page fetcher (`isSafePublicHttpUrl`), HTML stripping, promote-to-memory workflow.
  - `server/src/modules/automation/` — `AiExecution` and `AiToolApproval` persistence, `/api/v1/automation/approvals/:id/approve|reject` human-in-the-loop execution lifecycle.
- **Vercel AI SDK runtime migrated in Milestone `2.1` (Completed):**
  - `server/src/ai/providers/model-router.ts`, `server/src/ai/providers/embeddings.ts`, `server/src/ai/runtime/{state,checkpoints,graph-factory}.ts`, `server/src/ai/agents/assistant.agent.ts`, `server/src/ai/workflows/execution.workflow.ts`, `server/src/ai/tools/v3.tools.ts`, `server/src/modules/planning/planning.service.ts`, and `server/src/modules/research/research.service.ts` now run exclusively on **LangChain.js + LangGraph.js + LangSmith (`PostgresSaver` in `langgraph` schema)**, with `ai` and `@ai-sdk/google` removed.

---

## 2. Exact Phase 2 Package Choices

### 2.1 Core Agent & AI Stack (`server/package.json`)

| Responsibility | Package | Target Version | Notes |
| --- | --- | --- | --- |
| Core abstractions | `@langchain/core` | `^1.4.0` | Messages, runnables, structured tools, prompt templates |
| Orchestration runtime | `@langchain/langgraph` | `^1.7.3` | StateGraph, conditional routing, `interrupt()` / `Command`, subgraphs |
| Durable checkpoints | `@langchain/langgraph-checkpoint-postgres` | `^1.1.2` | PostgreSQL checkpoint persistence (`PostgresSaver`) |
| Google Gemini adapter | `@langchain/google-genai` | `^2.3.6` | Chat models, structured output, `gemini-embedding-001`, Google Search tool |
| High-level chains/agents | `langchain` | `^1.6.5` | Tool/agent helpers and middleware primitives |
| Selective deep harness | `deepagents` | `^1.16.4` | Selective adoption in Milestone `2.6` for long-running research/dev runs |
| Tracing & evaluation | `langsmith` | `^0.12.0` | Run tracing, token/latency metrics, eval datasets |
| Background jobs | `@trigger.dev/sdk` | `^4.8.4` | Durable scheduled, event-driven, and long-running background workers |
| External tool protocol | `@modelcontextprotocol/sdk` | `^1.32.2` | MCP client/server connectivity behind V3 permission checks |

### 2.2 Integration Packages (Added Incrementally in Milestone `2.8`)

- **Email:** `resend` (transactional email notifications) and `googleapis` (Gmail & Google Calendar OAuth sync).
- **Messaging:** `grammy` (Telegram Bot API), `discord.js` (Discord Bot), native `fetch` (WhatsApp Cloud API).
- **Developer:** `@octokit/rest` (GitHub API & webhook verification).
- **Voice & Telephony:** Native `fetch` adapters for Bhashini ASR/TTS/translation + dedicated telephony webhook adapter.

### 2.3 Packages to Remove After Milestone `2.1` Cutover

- Remove `ai` and `@ai-sdk/google` from `server/package.json` once `planning`, `research`, `memory` embeddings, and `AssistantOrchestrator` are ported to `@langchain/*` + `@langchain/langgraph`.

---

## 3. Target Backend & Docs Directory Structure

Phase 2 grows inside the existing `server/` modular monolith without introducing monorepo tools or microservices:

```text
server/
├── src/
│   ├── config/
│   │   ├── env.ts
│   │   ├── app.config.ts
│   │   ├── supabase.ts
│   │   ├── swagger.ts
│   │   └── ai.config.ts (planned M2.1)
│   ├── database/
│   │   └── prisma.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── permissions/
│   │   ├── risk-policy.ts (planned M2.2)
│   │   └── permission-guard.ts (planned M2.2)
│   ├── modules/
│   │   ├── auth/
│   │   ├── goals/
│   │   ├── planning/
│   │   ├── scheduling/
│   │   ├── tasks/
│   │   ├── accountability/
│   │   ├── memory/
│   │   ├── research/
│   │   ├── automation/
│   │   ├── notifications/ (planned M2.8)
│   │   ├── voice/ (planned M2.8)
│   │   ├── developer/ (planned Phase 3 / M2.8 prep)
│   │   ├── analytics/ (planned Phase 3)
│   │   ├── events/ (planned M2.7)
│   │   └── integrations/ (planned M2.8)
│   ├── ai/
│   │   ├── runtime/
│   │   │   ├── orchestrator.ts (planned M2.3)
│   │   │   ├── graph-factory.ts (planned M2.1)
│   │   │   ├── state.ts (planned M2.1)
│   │   │   ├── checkpoints.ts (planned M2.1)
│   │   │   └── execution-manager.ts (planned M2.1)
│   │   ├── agents/
│   │   │   ├── goal-planning.agent.ts (planned M2.4)
│   │   │   ├── task.agent.ts (planned M2.4)
│   │   │   ├── research.agent.ts (planned M2.4)
│   │   │   ├── memory.agent.ts (planned M2.4)
│   │   │   ├── scheduling.agent.ts (planned M2.4)
│   │   │   ├── accountability.agent.ts (planned M2.4)
│   │   │   ├── communication.agent.ts (planned M2.8)
│   │   │   └── developer.agent.ts (planned M2.8)
│   │   ├── tools/
│   │   │   ├── internal/
│   │   │   ├── external/
│   │   │   └── registry.ts
│   │   ├── providers/
│   │   │   ├── model-router.ts (planned M2.1)
│   │   │   └── embeddings.ts (planned M2.1)
│   │   ├── memory/
│   │   │   ├── hybrid-retrieval.ts (planned M2.5)
│   │   │   ├── extraction.ts (planned M2.5)
│   │   │   └── consolidation.ts (planned M2.5)
│   │   ├── prompts/
│   │   ├── guardrails/ (planned M2.9)
│   │   ├── evaluation/ (planned M2.9)
│   │   └── mcp/ (planned M2.8)
│   ├── jobs/
│   │   ├── trigger.client.ts (planned M2.7)
│   │   ├── agent-jobs/ (planned M2.7)
│   │   ├── scheduled-jobs/ (planned M2.7)
│   │   ├── event-jobs/ (planned M2.7)
│   │   └── recovery/ (planned M2.7)
│   ├── integrations/
│   │   ├── email/
│   │   ├── telegram/
│   │   ├── discord/
│   │   ├── whatsapp/
│   │   ├── google/
│   │   ├── github/
│   │   └── bhashini/
│   ├── routes/
│   │   └── v1.router.ts
│   ├── app.ts
│   └── server.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── tests/
```

---

## 4. Database Schema Additions & Extensions (`server/prisma/schema.prisma`)

### 4.1 Existing Tables Reused Without Duplication

- `users`, `goals`, `milestones`, `tasks`, `time_blocks`, `reminders`, `accountability_logs`, `memories`, `user_preferences`, `conversation_messages`, `plans`, `ai_executions`, `ai_tool_approvals`, `research_items`.

### 4.2 Planned Prisma Schema Extensions

1. **Extend `AiExecution` (`ai_executions`) for LangGraph & Observability (M2.1 / M2.6 / M2.9):**
   - `threadId String @default(uuid())` — LangGraph checkpoint `thread_id`
   - `parentExecutionId String?` — Self-relation for subagent delegations
   - `agentRole String @default("MAIN_ORCHESTRATOR")` — Logical specialist role
   - `triggerType String @default("REQUEST")` — `REQUEST | EVENT | SCHEDULED | SUBAGENT`
   - `idempotencyKey String? @unique` — Prevents duplicate background or webhook runs
   - `tokenBudget Int?` / `tokensUsed Int @default(0)` / `costMicroUsd Int @default(0)`
   - `langsmithTraceId String?`
   - `checkpointNamespace String?`
   - `timeoutAt DateTime?`

2. **Extend `AiToolApproval` (`ai_tool_approvals`) for Risk Governance (M2.2 / M2.9):**
   - `riskLevel String @default("INTERNAL_WRITE")` — `READ | INTERNAL_WRITE | EXTERNAL_REVERSIBLE | EXTERNAL_CONSEQUENTIAL | RESTRICTED`
   - `agentRole String @default("MAIN_ORCHESTRATOR")`
   - `idempotencyKey String? @unique`
   - `expiresAt DateTime?`
   - `decisionReason String?`

3. **Extend `Memory` (`memories`) for Six-Category Hybrid Lifecycle (M2.5):**
   - `memoryType String @default("SEMANTIC")` — `CONVERSATION | EPISODIC | SEMANTIC | PROCEDURAL | PROJECT`
   - `sourceType String @default("MANUAL")` — `MANUAL | CONVERSATION | RESEARCH | EMAIL | GITHUB | EVENT`
   - `sourceId String?`
   - `confidence Float @default(1.0)`
   - `expiresAt DateTime?`
   - `supersededById String?`
   - **Fixed-dimension index migration:** Narrow `embedding` to `vector(768)` and add an HNSW cosine index (`CREATE INDEX memories_embedding_hnsw_idx ON memories USING hnsw (embedding vector_cosine_ops);`) plus GIN full-text index (`to_tsvector('english', coalesce(title,'') || ' ' || content)`).

4. **New Phase 2 Domain Tables:**
   - **`DomainEvent` (`domain_events`) (M2.7):** `id`, `userId`, `eventType`, `source`, `payload` (`Json`), `status` (`PENDING | PROCESSED | FAILED | DEAD_LETTER`), `idempotencyKey` (`@unique`), `processedAt`, `errorMessage`, `createdAt`.
   - **`BackgroundJob` (`background_jobs`) (M2.7):** `id`, `userId`, `executionId?`, `jobType`, `externalJobId?`, `status` (`QUEUED | RUNNING | COMPLETED | FAILED | CANCELLED | DEAD_LETTER`), `attempts`, `maxAttempts`, `scheduledFor`, `startedAt`, `finishedAt`, `lastError`.
   - **`IntegrationAccount` (`integration_accounts`) (M2.8):** `id`, `userId`, `provider` (`TELEGRAM | DISCORD | WHATSAPP | GOOGLE | GITHUB | BHASHINI`), `externalAccountId`, `encryptedCredentials` (AES-256-GCM server-encrypted JSON, never sent to LLMs), `scopes` (`String[]`), `status`, `lastSyncedAt`.
   - **`NotificationPreference` (`notification_preferences`) & `NotificationDelivery` (`notification_deliveries`) (M2.8):** Per-channel opt-ins, quiet hours, frequency caps, retry counts, provider message IDs, and delivery status.
   - **`VoiceSession` (`voice_sessions`) (M2.8):** Language code, ASR transcript, translated text, TTS audio object key (Supabase Storage), linked `AiExecution` ID, and call/telephony metadata.

5. **LangGraph PostgreSQL Checkpointer Tables (M2.1):**
   - Created and managed by `@langchain/langgraph-checkpoint-postgres` (`PostgresSaver.fromConnString(env.DIRECT_URL)` + `await checkpointer.setup()`) in a dedicated `langgraph` PostgreSQL schema (`schema: 'langgraph'`) so Prisma migrations in `public` never collide with LangGraph internal tables (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`).

---

## 5. LangGraph State Definitions & Agent Interfaces

### 5.1 Root LangGraph State (`server/src/ai/runtime/state.ts`)

```ts
import { BaseMessage } from '@langchain/core/messages';
import { Annotation, messagesStateReducer } from '@langchain/langgraph';

export type AgentRole =
  | 'MAIN_ORCHESTRATOR'
  | 'GOAL_PLANNING'
  | 'TASK_PROJECT'
  | 'RESEARCH'
  | 'MEMORY'
  | 'SCHEDULING'
  | 'ACCOUNTABILITY'
  | 'COMMUNICATION'
  | 'DEVELOPER'
  | 'AUTOMATION';

export type ExecutionMode = 'REQUEST' | 'EVENT' | 'SCHEDULED' | 'SUBAGENT';

export interface RetrievedContextSlice {
  preferences: Array<{ key: string; value: string }>;
  facts: Array<{ id: string; title: string | null; content: string; source: string; score: number }>;
  structuredMetrics: Record<string, unknown>;
}

export interface PlanStepItem {
  id: string;
  assignedAgent: AgentRole;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  resultSummary?: string;
}

export const V3AgentStateAnnotation = Annotation.Root({
  userId: Annotation<string>(),
  executionId: Annotation<string>(),
  threadId: Annotation<string>(),
  sessionId: Annotation<string>(),
  mode: Annotation<ExecutionMode>(),
  objective: Annotation<string>(),
  activeAgent: Annotation<AgentRole>(),
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  retrievedContext: Annotation<RetrievedContextSlice | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  planSteps: Annotation<PlanStepItem[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  observations: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  pendingApprovalIds: Annotation<string[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  iterationCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  maxIterations: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 8,
  }),
  tokensUsed: Annotation<number>({
    reducer: (prev, next) => prev + next,
    default: () => 0,
  }),
  tokenBudget: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 60000,
  }),
  finalResponse: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type V3AgentState = typeof V3AgentStateAnnotation.State;
```

### 5.2 Agent & Tool Permission Contracts (`server/src/permissions/` & `server/src/ai/tools/`)

```ts
import { z } from 'zod';
import { AgentRole } from '../ai/runtime/state';

export type ToolRiskLevel =
  | 'READ'
  | 'INTERNAL_WRITE'
  | 'EXTERNAL_REVERSIBLE'
  | 'EXTERNAL_CONSEQUENTIAL'
  | 'RESTRICTED';

export interface AgentPermissionProfile {
  role: AgentRole;
  allowedReadDomains: string[];
  allowedTools: string[];
  autoApprovedRiskLevels: ToolRiskLevel[];
  maxIterations: number;
  maxTokenBudget: number;
}

export interface V3ToolContract<TInput extends z.ZodType, TOutput extends z.ZodType> {
  name: string;
  domain: string;
  description: string;
  riskLevel: ToolRiskLevel;
  idempotent: boolean;
  inputSchema: TInput;
  outputSchema: TOutput;
  execute: (
    ctx: { userId: string; executionId: string; agentRole: AgentRole; idempotencyKey?: string },
    input: z.infer<TInput>
  ) => Promise<z.infer<TOutput>>;
}
```

### 5.3 LangGraph Orchestrator Graph Topology

```text
START
  │
  ▼
contextLoaderNode (Hybrid SQL + Keyword + pgvector context assembly)
  │
  ▼
orchestratorReasonNode (Main Orchestrator LLM with role-scoped tools & delegation)
  │
  ├──[budget/iteration limit exceeded]──▶ fallbackSummaryNode ──▶ END
  │
  ├──[tool call requires approval]──────▶ approvalGateNode (LangGraph interrupt() + AiToolApproval)
  │                                            │ (resumed via Command({ resume }) after /approve or /reject)
  │                                            ▼
  ├──[safe/approved tool call]──────────▶ toolExecutionNode (Permission guard + Zod + Service call)
  │                                            │
  │                                            ▼
  ├──[delegate to specialist]───────────▶ specialistSubgraphNode (Goal/Task/Schedule/Research/Memory/Accountability)
  │                                            │
  │                                            └──▶ orchestratorReasonNode (Observe & adapt loop)
  │
  └──[objective satisfied]──────────────▶ persistenceAndMemoryNode (Save ConversationMessage, episodic log, memory proposal)
                                               │
                                               ▼
                                              END
```

---

## 6. Model-Provider Configuration & Routing (`server/src/ai/providers/`)

### 6.1 Task-Based Model Router

Hardwiring one model to every step creates latency and cost waste. `model-router.ts` maps logical workloads (`ModelTaskTier`) to concrete provider adapters:

| Workload Tier | Primary Model (Google) | Purpose |
| --- | --- | --- |
| `ORCHESTRATION` | `gemini-2.5-flash` | Main loop tool calling, delegation, multi-step adaptation |
| `PLANNING` | `gemini-2.5-pro` (or `gemini-2.5-flash`) | Complex goal decomposition and multi-quarter replanning |
| `RESEARCH` | `gemini-2.5-flash` | Grounded web search + citation synthesis |
| `CLASSIFICATION` | `gemini-2.5-flash-lite` | Cheap event filtering, intent triage, memory extraction |
| `EXTRACTION` | `gemini-2.5-flash` | Structured Zod extraction from emails, docs, transcripts |
| `CODE_ANALYSIS` | `gemini-2.5-pro` | Repository inspection, PR review, bug diagnosis |
| `EMBEDDING` | `gemini-embedding-001` (`768` dims) | `pgvector` indexing and query vectors |

### 6.2 Environment Variables to Add (`server/.env.example`)

```env
LANGSMITH_TRACING=false
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=v3-backend
LANGSMITH_ENDPOINT=https://api.smith.langchain.com

TRIGGER_SECRET_KEY=
TRIGGER_PROJECT_ID=

INTEGRATION_ENCRYPTION_KEY=

TELEGRAM_BOT_TOKEN=
DISCORD_BOT_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_WEBHOOK_SECRET=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## 7. Hybrid Data & Six-Memory Retrieval Pipeline

### 7.1 Hybrid Retrieval Formula (SQL + Keyword + Vector)

For user queries spanning facts, timelines, and context, `hybrid-retrieval.ts` runs three parallel queries scoped by `userId`:

1. **Structured SQL Query (Prisma):** Exact dates, statuses, completed durations, deadlines, and metrics (never replaced by vector search).
2. **Full-Text Keyword Search (`PostgreSQL ts_rank_cd` / `ILIKE`):** Exact project names, identifiers, and tags.
3. **Semantic Vector Search (`pgvector` `<=>` cosine distance):** Meaning-based retrieval across `Memory` (`embedding IS NOT NULL`).

Results from keyword and vector search are merged using **Reciprocal Rank Fusion (RRF)**:

$$\text{RRF}(d) = \frac{w_{\text{vec}}}{k + r_{\text{vec}}(d)} + \frac{w_{\text{kw}}}{k + r_{\text{kw}}(d)} + \text{importanceBoost}(d)$$

with $k = 60$, user-scoped filtering enforced in SQL before fusion, and strict separation in the assembled prompt between **Measured Database Facts** and **Retrieved Contextual Memories**.

### 7.2 Memory Lifecycle Rules

- Agents propose candidate memories through `propose_memory` rather than overwriting `UserPreference` or high-importance `Memory` rows silently.
- Conflicting memories link via `supersededById` so history remains auditable.
- Ephemeral context sets `expiresAt` and is pruned by a scheduled background job.

---

## 8. Background Execution, Event Processing & Deployment Architecture

### 8.1 Cloud-Only Topology

```text
+--------------------+     HTTPS      +-----------------------------+
| Next.js Web /      | ─────────────▶ | Express 5 API Service       |
| Expo Mobile /      |                | (server/dist/server.js)     |
| Webhooks (TG/WA/GH)|                | - REST API & Auth           |
+--------------------+                | - Webhook ingestion         |
                                      | - Enqueue Trigger.dev jobs  |
                                      +--------------+--------------+
                                                     │
                       +─────────────────────────────┼─────────────────────────────+
                       ▼                             ▼                             ▼
        +------------------------------+  +--------------------+  +-----------------------------+
        | Managed Supabase             |  | Trigger.dev Worker |  | External Platforms          |
        | - PostgreSQL 17 + pgvector   |  | (shared server/    |  | - Gemini / LangSmith        |
        | - langgraph schema (checks)  |  |  codebase)         |  | - Resend / TG / WA / Discord|
        | - Auth + Supabase Storage    |  | - Agent runs       |  | - GitHub / Google / Bhashini|
        +------------------------------+  | - Cron & recovery  |  +-----------------------------+
                                          +--------------------+
```

- **Express API Process:** Handles synchronous requests, webhooks, fast read queries, and triggers background runs (`runs.trigger(...)`). Never blocks HTTP connections for long multi-minute research or coding runs.
- **Trigger.dev Worker Process:** Shares `server/src/` services, Prisma client, and LangGraph runtime; runs scheduled routines (daily accountability review, missed-task scans, memory consolidation, expired approval cleanup), event-triggered agent runs, and stalled-run recovery.
- **Reliability Guarantees:** Every background run carries an `idempotencyKey`, `maxDuration`, `tokenBudget`, and dead-letter transition after `maxAttempts` failures.

---

## 9. Milestone-by-Milestone Implementation Roadmap (`2.1`–`2.10`)

### Milestone `2.1` — Agent Runtime Foundation (Completed)
- [x] Install `@langchain/core`, `@langchain/langgraph`, `@langchain/langgraph-checkpoint-postgres`, `@langchain/google-genai`, `langchain`, `langsmith`.
- [x] Implement `server/src/ai/providers/model-router.ts` and `embeddings.ts` replacing `ai` / `@ai-sdk/google`.
- [x] Implement `server/src/ai/runtime/state.ts` (`V3AgentStateAnnotation`), `checkpoints.ts` (`PostgresSaver` in `langgraph` schema), and `graph-factory.ts`.
- [x] Add LangGraph `threadId`, `agentRole`, `triggerType`, `tokenBudget`, `tokensUsed`, `langsmithTraceId`, `checkpointNamespace` columns to `AiExecution` via Prisma migration (`20261112004243_add_langgraph_execution_fields`).
- [x] Port `planning.service.ts`, `research.service.ts`, `memory.service.ts`, and `AssistantOrchestrator` to `@langchain/google-genai` + `@langchain/langgraph`, removing `ai` and `@ai-sdk/google`.
- [x] Verify end-to-end LangGraph `PostgresSaver` checkpointed run against Supabase PostgreSQL + Gemini + Vitest suite.

### Milestone `2.2` — Tool & Permission Framework (Completed)
- [x] Implement `server/src/permissions/risk-policy.ts` and `permission-guard.ts` enforcing the 5 risk levels (`READ`, `INTERNAL_WRITE`, `EXTERNAL_REVERSIBLE`, `EXTERNAL_CONSEQUENTIAL`, `RESTRICTED`).
- [x] Refactor `server/src/ai/tools/` into `internal/`, `external/`, and `registry.ts` using `V3ToolContract` with strict Zod input/output schemas, Gemini-compatible `toolSchema` wrappers, and idempotency keys.
- [x] Wire LangGraph `interrupt()` and `Command({ resume })` into `approvalGateNode` and `/api/v1/automation/approvals/:id/approve|reject` with `expiresAt` expiry support (`20261112005424_extend_tool_approvals_for_risk_and_idempotency`).
- [x] Test invalid payloads, cross-user isolation, duplicate idempotency keys, expiry rejection, and live `PostgresSaver` approval pause/resume.

### Milestone `2.3` — Main Orchestrator (Completed)
- [x] Build `server/src/ai/runtime/orchestrator.ts` implementing the 8-step adaptive loop (Receive → Context → Reason/Plan → Select Agents/Tools → Execute → Observe → Evaluate → Adapt).
- [x] Integrate `AssistantOrchestrator` HTTP interface (`/api/v1/automation/run`) cleanly with `orchestrator.ts`, optional thread continuation, and checkpoint resume.
- [x] Add token budget guard (`BUDGET_EXCEEDED`), max-iteration/consecutive-error circuit breaker (`CIRCUIT_BREAKER`), and fallback summary generation.

### Milestone `2.4` — Specialist Agents (Completed)
- [x] Implement subgraph/specialist modules in `server/src/ai/agents/` via [`specialist.factory.ts`](file:///Users/markasaicharan/PROJECTS/v3/server/src/ai/agents/specialist.factory.ts) and [`specialist.registry.ts`](file:///Users/markasaicharan/PROJECTS/v3/server/src/ai/agents/specialist.registry.ts):
  - Phase A core specialists: `goal-planning`, `task`, `scheduling`, `research`, `memory`, `accountability`.
  - Phase B specialists: `communication`, `developer` (with `AUTOMATION` handled by `AssistantOrchestrator` / `AGENT_PERMISSION_PROFILES`).
- [x] Assign each specialist a scoped `AgentPermissionProfile` and distinct prompt template in [`prompt.registry.ts`](file:///Users/markasaicharan/PROJECTS/v3/server/src/ai/prompts/prompt.registry.ts), plus `delegateToSpecialist` orchestration tool and `GET /api/v1/automation/agents`.

### Milestone `2.5` — Hybrid Data & Memory (Completed)
- [x] Narrow `memories.embedding` to `vector(768)` and add HNSW cosine (`memories_embedding_hnsw_idx`) + PostgreSQL GIN full-text (`memories_fts_gin_idx`) indexes via Prisma SQL migration (`20261112102033_add_hybrid_memory_lifecycle_and_indexes`).
- [x] Implement `server/src/ai/memory/hybrid-retrieval.ts` (SQL + FTS + `pgvector` RRF fusion), `extraction.ts`, and `consolidation.ts`.
- [x] Add memory lifecycle fields (`memoryType`, `sourceType`, `sourceId`, `confidence`, `expiresAt`, `supersededById`), candidate memory validation/supersession rules, `/api/v1/memory/{hybrid,propose,prune}`, and `hybridSearchMemory`/`proposeMemory` tools.

### Milestone `2.6` — Autonomous Delegation (Completed)
- [x] Implement parallel subagent execution (`delegateParallelSpecialists`) and isolated subagent threads with `parentExecutionId` self-relation on `AiExecution` (`20261112112246_add_parent_execution_relation` + `20261112112350_restore_memories_hnsw_index`).
- [x] Evaluate `deepagents` (`1.16.4`) — recorded peer dependency conflict against `@langchain/core@1.4.0` (`langsmith@0.12.0` vs `langsmith <0.10.0`) — and implemented the selective native LangGraph deep execution harness ([`deep-harness.ts`](file:///Users/markasaicharan/PROJECTS/v3/server/src/ai/agents/deep-harness.ts) / `runDeepProjectExecution`) preserving V3 permission guards and `PostgresSaver` checkpoints.
- [x] Add stuck-detection heuristics (`lastToolSignatures` / `STUCK_LOOP`) and orchestrator replanning edges (`observe` -> `replan` -> `reason`) in [`orchestrator.ts`](file:///Users/markasaicharan/PROJECTS/v3/server/src/ai/runtime/orchestrator.ts).

### Milestone `2.7` — Background Autonomy (Completed)
- [x] Install `@trigger.dev/sdk` (`^4.8.5`), add `trigger.config.ts`, configure `TRIGGER_SECRET_KEY` / `TRIGGER_PROJECT_ID`, and add `DomainEvent` + `BackgroundJob` + `AiExecution.idempotencyKey`/`timeoutAt` Prisma models (`20261112170500_add_domain_events_and_background_jobs`).
- [x] Implement `server/src/modules/events/` (idempotent event ingestion, subscription routing, background job tracking, retry backoff, dead-letter transitions, and recovery sweep endpoints under `/api/v1/events`) and `TASK_COMPLETED` emission hook from `TasksService`.
- [x] Implement `server/src/jobs/` (`trigger.client.ts`, `autonomous-agent.job.ts`, `missed-task-event.job.ts`, `event-router.job.ts`, `daily-accountability-review.job.ts`, `missed-task-scanner.job.ts`, `approval-expiry-sweeper.job.ts`, and `dead-letter-recovery.job.ts`).

### Milestone `2.8` — External Integrations
- Implement `server/src/modules/integrations/` with AES-256-GCM encrypted token storage (`IntegrationAccount`).
- Implement `notifications` module (`Resend`, `Telegram`, `Discord`, `WhatsApp Cloud API`) with `NotificationPreference` and `NotificationDelivery` retries.
- Implement `voice` module (`Bhashini` ASR/TTS/translation + Supabase Storage audio assets + telephony adapter).
- Implement Google Calendar / Gmail sync, GitHub read/issue/PR adapters, and `server/src/ai/mcp/` MCP client/server wrapper gated by `permission-guard.ts`.

### Milestone `2.9` — Safety & Observability
- Add prompt-injection boundary wrappers (`<untrusted_external_data>` sanitization) for emails, web pages, and GitHub issues.
- Integrate LangSmith trace links on `AiExecution`, token/cost accounting (`costMicroUsd`), rate limits per user/endpoint, and agent evaluation regression datasets in `server/src/ai/evaluation/`.
- Run adversarial security tests (prompt injection, unauthorized tool access, secret redaction, infinite loop termination).

### Milestone `2.10` — End-to-End Autonomous System & CI/CD
- Add GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`), production cloud deployment config, backup/recovery verification, and end-to-end tests covering all 5 acceptance scenarios (Productivity, Research, Communication, Developer Assistance, Continuous Autonomy).

---

## 10. Immediate Next Action Checklist

1. Begin **Milestone `2.8` (External Integrations)** by adding `server/src/modules/integrations/` (AES-256-GCM encrypted `IntegrationAccount`), `notifications` (`Resend`, `Telegram`, `Discord`, `WhatsApp Cloud API`), `voice` (`Bhashini` ASR/TTS/translation + Supabase Storage), Google/GitHub adapters, and `server/src/ai/mcp/`.

