import { StructuredToolInterface, tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AppError } from '../../middleware/error.middleware';
import {
  assertNoCrossUserPayload,
  assertValidToolUserContext,
  executeGuardedTool,
} from '../../permissions/permission-guard';
import {
  deriveToolPolicyLabel,
  evaluateToolPermission,
  getAgentPermissionProfile,
} from '../../permissions/risk-policy';
import { AgentRole } from '../runtime/state';
import { EXTERNAL_TOOLS } from './external';
import { ACCOUNTABILITY_TOOLS } from './internal/accountability.tools';
import { GOALS_TOOLS } from './internal/goals.tools';
import { MEMORY_TOOLS } from './internal/memory.tools';
import { RESEARCH_TOOLS } from './internal/research.tools';
import { SCHEDULING_TOOLS } from './internal/scheduling.tools';
import { TASKS_TOOLS } from './internal/tasks.tools';
import { PendingToolApprovalRequest, ToolExecutionContext, V3ToolContract } from './tool.types';

export const ALL_V3_TOOLS: V3ToolContract[] = [
  ...GOALS_TOOLS,
  ...TASKS_TOOLS,
  ...SCHEDULING_TOOLS,
  ...ACCOUNTABILITY_TOOLS,
  ...MEMORY_TOOLS,
  ...RESEARCH_TOOLS,
  ...EXTERNAL_TOOLS,
];

export const V3_TOOL_REGISTRY: Record<string, V3ToolContract> = Object.fromEntries(
  ALL_V3_TOOLS.map((contract) => [contract.name, contract])
);

export const getRegisteredTool = (toolName: string): V3ToolContract => {
  const entry = V3_TOOL_REGISTRY[toolName];
  if (!entry) {
    throw new AppError(400, `Unknown AI tool: ${toolName}`, 'UNKNOWN_TOOL');
  }
  return entry;
};

export const tryGetRegisteredTool = (toolName: string): V3ToolContract | undefined =>
  V3_TOOL_REGISTRY[toolName];

export const getToolsForRole = (role: AgentRole): V3ToolContract[] => {
  const profile = getAgentPermissionProfile(role);
  return ALL_V3_TOOLS.filter((contract) => {
    if (contract.riskLevel === 'RESTRICTED') {
      return false;
    }
    return profile.allowedTools.includes('*') || profile.allowedTools.includes(contract.name);
  });
};

export const listRegisteredToolsMetadata = () =>
  ALL_V3_TOOLS.map((contract) => ({
    name: contract.name,
    domain: contract.domain,
    description: contract.description,
    riskLevel: contract.riskLevel,
    idempotent: contract.idempotent,
    policy: deriveToolPolicyLabel(contract.riskLevel),
  }));

export const executeRegisteredTool = async (
  toolName: string,
  rawArgs: unknown,
  userId: string,
  contextOverrides: Partial<ToolExecutionContext> & {
    allowAutoApproveWrites?: boolean;
    bypassApprovalCheck?: boolean;
  } = {}
): Promise<unknown> => {
  const contract = getRegisteredTool(toolName);
  const ctx: ToolExecutionContext = {
    userId,
    executionId: contextOverrides.executionId ?? 'manual-approval',
    agentRole: contextOverrides.agentRole ?? 'MAIN_ORCHESTRATOR',
    idempotencyKey: contextOverrides.idempotencyKey,
  };

  return executeGuardedTool(contract, rawArgs, ctx, {
    allowAutoApproveWrites: contextOverrides.allowAutoApproveWrites,
    bypassApprovalCheck: contextOverrides.bypassApprovalCheck ?? true,
  });
};

export const buildLangChainTools = (params: {
  userId: string;
  executionId?: string;
  agentRole?: AgentRole;
  allowAutoApproveWrites: boolean;
  onPendingApproval: (request: PendingToolApprovalRequest) => Promise<string>;
}): StructuredToolInterface[] => {
  const agentRole: AgentRole = params.agentRole ?? 'MAIN_ORCHESTRATOR';
  const executionId = params.executionId ?? 'orchestrator';
  const allowedContracts = getToolsForRole(agentRole);
  const tools: StructuredToolInterface[] = [];

  for (const contract of allowedContracts) {
    const schema = contract.toolSchema ?? contract.inputSchema;
    const lcTool = tool(
      async (rawArgs) => {
        assertValidToolUserContext(params.userId);
        assertNoCrossUserPayload(rawArgs, params.userId);
        const parsedArgs = contract.inputSchema.parse(rawArgs);

        const permission = evaluateToolPermission({
          role: agentRole,
          toolName: contract.name,
          riskLevel: contract.riskLevel,
          allowAutoApproveWrites: params.allowAutoApproveWrites,
        });

        if (permission.decision === 'DENY') {
          return JSON.stringify({
            status: 'DENIED',
            toolName: contract.name,
            reason: permission.reason,
          });
        }

        if (permission.decision === 'REQUIRE_APPROVAL') {
          const approvalId = await params.onPendingApproval({
            toolName: contract.name,
            toolArgs: parsedArgs as Record<string, unknown>,
            riskLevel: contract.riskLevel,
            agentRole,
          });
          return JSON.stringify({
            status: 'APPROVAL_REQUIRED',
            approvalId,
            toolName: contract.name,
            riskLevel: contract.riskLevel,
            message: permission.reason,
          });
        }

        const result = await executeGuardedTool(
          contract,
          parsedArgs,
          {
            userId: params.userId,
            executionId,
            agentRole,
          },
          { allowAutoApproveWrites: params.allowAutoApproveWrites }
        );

        return JSON.stringify({
          status: 'EXECUTED',
          toolName: contract.name,
          data: result,
        });
      },
      {
        name: contract.name,
        description: contract.description,
        schema: schema as z.ZodObject<z.ZodRawShape>,
      }
    );

    tools.push(lcTool);
  }

  return tools;
};
