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
  facts: Array<{
    id: string;
    title: string | null;
    content: string;
    source: string;
    score: number;
  }>;
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
  consecutiveErrors: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  stopReason: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
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
