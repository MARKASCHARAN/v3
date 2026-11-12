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
import { developerAgent } from './developer.agent';
import { goalPlanningAgent } from './goal-planning.agent';
import { memoryAgent } from './memory.agent';
import { researchAgent } from './research.agent';
import { schedulingAgent } from './scheduling.agent';
import { SpecialistAgentInstance } from './specialist.factory';
import { taskProjectAgent } from './task.agent';

export const DELEGATION_TOOL_NAME = 'delegateToSpecialist';

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

export const buildSpecialistDelegationTool = (params: {
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
}): StructuredToolInterface => {
  let delegationCounter = 0;

  return tool(
    async ({ role, objective }) => {
      delegationCounter += 1;
      const specialist = getSpecialistAgent(role);
      const subThreadId = `${params.parentThreadId}:sub:${role.toLowerCase()}:${delegationCounter}`;

      const result = await specialist.run({
        userId: params.userId,
        executionId: params.executionId,
        threadId: subThreadId,
        sessionId: params.sessionId,
        objective,
        allowAutoApproveWrites: params.allowAutoApproveWrites,
        onPendingApproval: params.onPendingApproval,
        contextLoader: params.contextLoader,
        checkpointer: params.checkpointer,
        modelOverride: params.modelOverrideByRole?.[role],
      });

      if (result.interrupted && result.pendingApprovalIds.length > 0) {
        params.onSpecialistInterrupted?.(result.pendingApprovalIds);
        return JSON.stringify({
          status: 'APPROVAL_REQUIRED',
          delegatedAgent: role,
          pendingApprovalIds: result.pendingApprovalIds,
          summary: result.text,
        });
      }

      return JSON.stringify({
        status: 'COMPLETED',
        delegatedAgent: role,
        stopReason: result.stopReason,
        tokensUsed: result.tokensUsed,
        summary: result.text,
      });
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
