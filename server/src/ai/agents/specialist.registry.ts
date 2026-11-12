import { randomUUID } from 'node:crypto';
import { StructuredToolInterface, tool } from '@langchain/core/tools';
import { BaseCheckpointSaver } from '@langchain/langgraph';
import { z } from 'zod';
import { AppError } from '../../middleware/error.middleware';
import { RunnableChatModel } from '../runtime/graph-factory';
import { ContextLoaderFn } from '../runtime/orchestrator';
import { AgentRole } from '../runtime/state';
import { PendingToolApprovalRequest } from '../tools/tool.types';
import { accountabilityAgent } from './accountability.agent';
import { communicationAgent } from './communication.agent';
import { DeepHarnessPersistenceHooks, runDeepProjectHarness } from './deep-harness';
import { developerAgent } from './developer.agent';
import { goalPlanningAgent } from './goal-planning.agent';
import { memoryAgent } from './memory.agent';
import { researchAgent } from './research.agent';
import { schedulingAgent } from './scheduling.agent';
import { SpecialistAgentInstance } from './specialist.factory';
import { taskProjectAgent } from './task.agent';

export const DELEGATION_TOOL_NAME = 'delegateToSpecialist';
export const PARALLEL_DELEGATION_TOOL_NAME = 'delegateParallelSpecialists';
export const DEEP_EXECUTION_TOOL_NAME = 'runDeepProjectExecution';

export const SPECIALIST_AGENTS: SpecialistAgentInstance[] = [
  goalPlanningAgent,
  taskProjectAgent,
  schedulingAgent,
  researchAgent,
  memoryAgent,
  accountabilityAgent,
  communicationAgent,
  developerAgent,
];

export const SPECIALIST_AGENT_MAP: Partial<Record<AgentRole, SpecialistAgentInstance>> =
  Object.fromEntries(SPECIALIST_AGENTS.map((agent) => [agent.definition.role, agent]));

export type SpecialistRole =
  | 'GOAL_PLANNING'
  | 'TASK_PROJECT'
  | 'SCHEDULING'
  | 'RESEARCH'
  | 'MEMORY'
  | 'ACCOUNTABILITY'
  | 'COMMUNICATION'
  | 'DEVELOPER';

const specialistRoleSchema = z.enum([
  'GOAL_PLANNING',
  'TASK_PROJECT',
  'SCHEDULING',
  'RESEARCH',
  'MEMORY',
  'ACCOUNTABILITY',
  'COMMUNICATION',
  'DEVELOPER',
]);

export const isSpecialistRole = (role: string): role is SpecialistRole =>
  role in SPECIALIST_AGENT_MAP;

export const getSpecialistAgent = (role: AgentRole): SpecialistAgentInstance => {
  const agent = SPECIALIST_AGENT_MAP[role];
  if (!agent) {
    throw new AppError(400, `Unknown specialist agent role: ${role}`, 'UNKNOWN_SPECIALIST_AGENT');
  }
  return agent;
};

export const listSpecialistAgentsMetadata = () =>
  SPECIALIST_AGENTS.map((agent) => ({
    role: agent.definition.role,
    name: agent.definition.name,
    description: agent.definition.description,
    phase: agent.definition.phase,
    modelTier: agent.definition.modelTier,
    allowedReadDomains: agent.profile.allowedReadDomains,
    allowedTools: agent.profile.allowedTools,
    autoApprovedRiskLevels: agent.profile.autoApprovedRiskLevels,
    maxIterations: agent.profile.maxIterations,
    maxTokenBudget: agent.profile.maxTokenBudget,
  }));

export interface DelegationToolParams extends DeepHarnessPersistenceHooks {
  userId: string;
  executionId: string;
  parentThreadId: string;
  sessionId: string;
  allowAutoApproveWrites: boolean;
  onPendingApproval: (request: PendingToolApprovalRequest) => Promise<{ id: string }>;
  contextLoader?: ContextLoaderFn;
  checkpointer?: BaseCheckpointSaver;
  modelOverrideByRole?: Partial<Record<AgentRole, RunnableChatModel>>;
  onSpecialistInterrupted?: (approvalIds: string[]) => void;
  tokenBudget?: number;
}

const executeChildSpecialistTask = async (
  params: DelegationToolParams,
  input: {
    role: SpecialistRole;
    objective: string;
    subThreadSuffix: string;
    tokenBudgetOverride?: number;
  }
) => {
  const specialist = getSpecialistAgent(input.role);
  const subThreadId = `${params.parentThreadId}:sub:${input.role.toLowerCase()}:${input.subThreadSuffix}`;
  const childBudget = Math.min(
    input.tokenBudgetOverride ?? specialist.profile.maxTokenBudget,
    specialist.profile.maxTokenBudget
  );

  const childExecution = params.createSubagentExecution
    ? await params.createSubagentExecution({
        parentExecutionId: params.executionId,
        userId: params.userId,
        sessionId: params.sessionId,
        threadId: subThreadId,
        agentRole: input.role,
        prompt: input.objective,
        tokenBudget: childBudget,
      })
    : { id: `${params.executionId}:${input.subThreadSuffix}` };

  try {
    const result = await specialist.run({
      userId: params.userId,
      executionId: childExecution.id,
      threadId: subThreadId,
      sessionId: params.sessionId,
      objective: input.objective,
      allowAutoApproveWrites: params.allowAutoApproveWrites,
      onPendingApproval: params.onPendingApproval,
      contextLoader: params.contextLoader,
      checkpointer: params.checkpointer,
      tokenBudgetOverride: childBudget,
      modelOverride: params.modelOverrideByRole?.[input.role],
    });

    if (params.completeSubagentExecution) {
      await params.completeSubagentExecution(childExecution.id, {
        status: result.interrupted ? 'AWAITING_APPROVAL' : 'COMPLETED',
        responseText: result.text,
        tokensUsed: result.tokensUsed,
        stepsData: result.steps,
      });
    }

    if (result.interrupted && result.pendingApprovalIds.length > 0) {
      params.onSpecialistInterrupted?.(result.pendingApprovalIds);
      return {
        status: 'APPROVAL_REQUIRED' as const,
        delegatedAgent: input.role,
        childExecutionId: childExecution.id,
        threadId: subThreadId,
        pendingApprovalIds: result.pendingApprovalIds,
        summary: result.text,
      };
    }

    return {
      status: 'COMPLETED' as const,
      delegatedAgent: input.role,
      childExecutionId: childExecution.id,
      threadId: subThreadId,
      stopReason: result.stopReason,
      tokensUsed: result.tokensUsed,
      summary: result.text,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Specialist subagent execution failed';
    if (params.completeSubagentExecution) {
      await params.completeSubagentExecution(childExecution.id, {
        status: 'FAILED',
        errorMessage: message,
      });
    }
    return {
      status: 'FAILED' as const,
      delegatedAgent: input.role,
      childExecutionId: childExecution.id,
      threadId: subThreadId,
      error: message,
    };
  }
};

export const buildSpecialistDelegationTool = (
  params: DelegationToolParams
): StructuredToolInterface => {
  let delegationCounter = 0;

  return tool(
    async ({ role, objective }) => {
      delegationCounter += 1;
      const result = await executeChildSpecialistTask(params, {
        role,
        objective,
        subThreadSuffix: `${delegationCounter}-${randomUUID().slice(0, 6)}`,
      });
      return JSON.stringify(result);
    },
    {
      name: DELEGATION_TOOL_NAME,
      description:
        'Delegate a domain-focused sub-objective to a scoped V3 specialist agent (GOAL_PLANNING, TASK_PROJECT, SCHEDULING, RESEARCH, MEMORY, ACCOUNTABILITY, COMMUNICATION, or DEVELOPER).',
      schema: z.object({
        role: specialistRoleSchema,
        objective: z.string().trim().min(1).max(4000),
      }),
    }
  );
};

export const buildParallelDelegationTool = (
  params: DelegationToolParams
): StructuredToolInterface => {
  let batchCounter = 0;

  return tool(
    async ({ tasks }) => {
      batchCounter += 1;
      const parentBudget = params.tokenBudget ?? 40000;
      const sliceBudget = Math.max(4000, Math.floor(parentBudget / tasks.length));

      const results = await Promise.all(
        tasks.map((taskItem, idx) =>
          executeChildSpecialistTask(params, {
            role: taskItem.role,
            objective: taskItem.objective,
            subThreadSuffix: `p${batchCounter}-${idx + 1}-${randomUUID().slice(0, 6)}`,
            tokenBudgetOverride: sliceBudget,
          })
        )
      );

      const hasPendingApprovals = results.some((r) => r.status === 'APPROVAL_REQUIRED');
      const totalTokensUsed = results.reduce(
        (sum, r) =>
          sum + ('tokensUsed' in r && typeof r.tokensUsed === 'number' ? r.tokensUsed : 0),
        0
      );

      return JSON.stringify({
        status: hasPendingApprovals ? 'APPROVAL_REQUIRED' : 'COMPLETED',
        parallelCount: results.length,
        totalTokensUsed,
        results,
      });
    },
    {
      name: PARALLEL_DELEGATION_TOOL_NAME,
      description:
        'Execute 1 to 4 independent specialist sub-tasks in parallel across isolated subagent threads.',
      schema: z.object({
        tasks: z
          .array(
            z.object({
              role: specialistRoleSchema,
              objective: z.string().trim().min(1).max(4000),
            })
          )
          .min(1)
          .max(4),
      }),
    }
  );
};

export const buildDeepExecutionTool = (params: DelegationToolParams): StructuredToolInterface =>
  tool(
    async ({ objective }) => {
      const outcome = await runDeepProjectHarness({
        userId: params.userId,
        parentExecutionId: params.executionId,
        parentThreadId: params.parentThreadId,
        sessionId: params.sessionId,
        objective,
        allowAutoApproveWrites: params.allowAutoApproveWrites,
        onPendingApproval: params.onPendingApproval,
        contextLoader: params.contextLoader,
        checkpointer: params.checkpointer,
        tokenBudget: params.tokenBudget,
        persistence: {
          createSubagentExecution: params.createSubagentExecution,
          completeSubagentExecution: params.completeSubagentExecution,
        },
        modelOverrideByRole: params.modelOverrideByRole,
      });

      if (outcome.pendingApprovalIds.length > 0) {
        params.onSpecialistInterrupted?.(outcome.pendingApprovalIds);
      }

      return JSON.stringify(outcome);
    },
    {
      name: DEEP_EXECUTION_TOOL_NAME,
      description:
        'Run the multi-phase deep execution harness for complex research or multi-workstream project objectives.',
      schema: z.object({
        objective: z.string().trim().min(1).max(5000),
      }),
    }
  );
