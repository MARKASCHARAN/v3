import { HumanMessage } from '@langchain/core/messages';
import { StructuredToolInterface } from '@langchain/core/tools';
import { BaseCheckpointSaver } from '@langchain/langgraph';
import { AgentPermissionProfile, getAgentPermissionProfile } from '../../permissions/risk-policy';
import { PromptKey, getPromptDefinition } from '../prompts/prompt.registry';
import { ModelTaskTier, resolveChatModel } from '../providers/model-router';
import { RunnableChatModel } from '../runtime/graph-factory';
import { ContextLoaderFn } from '../runtime/orchestrator';
import { AgentRole, ExecutionMode } from '../runtime/state';
import { buildLangChainTools } from '../tools/registry';
import { PendingToolApprovalRequest } from '../tools/tool.types';
import { MultiStepWorkflowOutput, runMultiStepToolWorkflow } from '../workflows/execution.workflow';

export interface SpecialistAgentDefinition {
  role: AgentRole;
  name: string;
  description: string;
  phase: 'PHASE_A' | 'PHASE_B';
  modelTier: ModelTaskTier;
  promptKey: PromptKey;
}

export interface SpecialistRunParams {
  userId: string;
  executionId: string;
  threadId: string;
  sessionId: string;
  objective: string;
  allowAutoApproveWrites: boolean;
  onPendingApproval: (request: PendingToolApprovalRequest) => Promise<{ id: string }>;
  contextLoader?: ContextLoaderFn;
  modelOverride?: RunnableChatModel;
  checkpointer?: BaseCheckpointSaver;
  maxStepsOverride?: number;
  tokenBudgetOverride?: number;
  mode?: ExecutionMode;
}

export interface SpecialistAgentInstance {
  definition: SpecialistAgentDefinition;
  profile: AgentPermissionProfile;
  systemPrompt: string;
  getTools(params: {
    userId: string;
    executionId: string;
    allowAutoApproveWrites: boolean;
    onPendingApproval: (request: PendingToolApprovalRequest) => Promise<string>;
  }): StructuredToolInterface[];
  run(params: SpecialistRunParams): Promise<MultiStepWorkflowOutput>;
}

export const createSpecialistAgent = (
  definition: SpecialistAgentDefinition
): SpecialistAgentInstance => {
  const profile = getAgentPermissionProfile(definition.role);
  const systemPrompt = getPromptDefinition(definition.promptKey).systemPrompt;

  return {
    definition,
    profile,
    systemPrompt,

    getTools(params) {
      return buildLangChainTools({
        userId: params.userId,
        executionId: params.executionId,
        agentRole: definition.role,
        allowAutoApproveWrites: params.allowAutoApproveWrites,
        onPendingApproval: params.onPendingApproval,
      });
    },

    async run(params) {
      const model = params.modelOverride ?? resolveChatModel({ tier: definition.modelTier }).model;

      const tools = this.getTools({
        userId: params.userId,
        executionId: params.executionId,
        allowAutoApproveWrites: params.allowAutoApproveWrites,
        onPendingApproval: async (req) => {
          const created = await params.onPendingApproval(req);
          return created.id;
        },
      });

      const maxSteps = Math.min(
        params.maxStepsOverride ?? profile.maxIterations,
        profile.maxIterations
      );
      const tokenBudget = Math.min(
        params.tokenBudgetOverride ?? profile.maxTokenBudget,
        profile.maxTokenBudget
      );

      return runMultiStepToolWorkflow({
        model,
        system: systemPrompt,
        messages: [new HumanMessage(params.objective)],
        tools,
        maxSteps,
        tokenBudget,
        threadId: params.threadId,
        executionId: params.executionId,
        userId: params.userId,
        sessionId: params.sessionId,
        objective: params.objective,
        agentRole: definition.role,
        mode: params.mode ?? 'SUBAGENT',
        checkpointNamespace: `specialist_${definition.role.toLowerCase()}`,
        checkpointer: params.checkpointer,
        contextLoader: params.contextLoader,
        approvalPolicy: {
          agentRole: definition.role,
          userId: params.userId,
          executionId: params.executionId,
          allowAutoApproveWrites: params.allowAutoApproveWrites,
          createPendingApproval: params.onPendingApproval,
        },
      });
    },
  };
};
