import { AgentRole } from '../ai/runtime/state';

export type ToolRiskLevel =
  'READ' | 'INTERNAL_WRITE' | 'EXTERNAL_REVERSIBLE' | 'EXTERNAL_CONSEQUENTIAL' | 'RESTRICTED';

export interface AgentPermissionProfile {
  role: AgentRole;
  allowedReadDomains: string[];
  allowedTools: string[];
  autoApprovedRiskLevels: ToolRiskLevel[];
  maxIterations: number;
  maxTokenBudget: number;
}

export type PermissionDecision = 'ALLOW' | 'REQUIRE_APPROVAL' | 'DENY';

export interface PermissionEvaluationInput {
  role: AgentRole;
  toolName: string;
  riskLevel: ToolRiskLevel;
  allowAutoApproveWrites?: boolean;
}

export interface PermissionEvaluationResult {
  decision: PermissionDecision;
  reason: string;
}

export const AGENT_PERMISSION_PROFILES: Record<AgentRole, AgentPermissionProfile> = {
  MAIN_ORCHESTRATOR: {
    role: 'MAIN_ORCHESTRATOR',
    allowedReadDomains: ['goals', 'tasks', 'scheduling', 'accountability', 'memory', 'research'],
    allowedTools: ['*'],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 8,
    maxTokenBudget: 60000,
  },
  GOAL_PLANNING: {
    role: 'GOAL_PLANNING',
    allowedReadDomains: ['goals', 'memory', 'accountability'],
    allowedTools: ['listGoals', 'createGoal', 'searchMemory', 'semanticSearchMemory'],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 6,
    maxTokenBudget: 35000,
  },
  TASK_PROJECT: {
    role: 'TASK_PROJECT',
    allowedReadDomains: ['tasks', 'goals', 'memory'],
    allowedTools: ['listTasks', 'createTask', 'updateTaskStatus', 'listGoals', 'searchMemory'],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 6,
    maxTokenBudget: 30000,
  },
  RESEARCH: {
    role: 'RESEARCH',
    allowedReadDomains: ['research', 'memory', 'goals'],
    allowedTools: [
      'webResearch',
      'searchMemory',
      'semanticSearchMemory',
      'saveMemory',
      'listGoals',
    ],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 6,
    maxTokenBudget: 40000,
  },
  MEMORY: {
    role: 'MEMORY',
    allowedReadDomains: ['memory'],
    allowedTools: ['searchMemory', 'semanticSearchMemory', 'saveMemory'],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 5,
    maxTokenBudget: 25000,
  },
  SCHEDULING: {
    role: 'SCHEDULING',
    allowedReadDomains: ['scheduling', 'tasks', 'goals'],
    allowedTools: ['getSchedule', 'createTimeBlock', 'listTasks', 'listGoals'],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 6,
    maxTokenBudget: 30000,
  },
  ACCOUNTABILITY: {
    role: 'ACCOUNTABILITY',
    allowedReadDomains: ['accountability', 'tasks', 'goals', 'scheduling'],
    allowedTools: [
      'getAccountabilitySummary',
      'analyzeProcrastination',
      'listTasks',
      'listGoals',
      'getSchedule',
    ],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 6,
    maxTokenBudget: 30000,
  },
  COMMUNICATION: {
    role: 'COMMUNICATION',
    allowedReadDomains: ['memory', 'tasks', 'scheduling', 'accountability'],
    allowedTools: ['listTasks', 'getSchedule', 'getAccountabilitySummary', 'searchMemory'],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 5,
    maxTokenBudget: 25000,
  },
  DEVELOPER: {
    role: 'DEVELOPER',
    allowedReadDomains: ['tasks', 'goals', 'memory', 'research'],
    allowedTools: [
      'listTasks',
      'createTask',
      'updateTaskStatus',
      'listGoals',
      'searchMemory',
      'webResearch',
    ],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 6,
    maxTokenBudget: 45000,
  },
  AUTOMATION: {
    role: 'AUTOMATION',
    allowedReadDomains: ['goals', 'tasks', 'scheduling', 'accountability', 'memory', 'research'],
    allowedTools: ['*'],
    autoApprovedRiskLevels: ['READ'],
    maxIterations: 8,
    maxTokenBudget: 60000,
  },
};

export const getAgentPermissionProfile = (role: AgentRole): AgentPermissionProfile =>
  AGENT_PERMISSION_PROFILES[role];

export const isRiskLevelWriteProtected = (riskLevel: ToolRiskLevel): boolean =>
  riskLevel !== 'READ';

export const deriveToolPolicyLabel = (
  riskLevel: ToolRiskLevel
): 'AUTO_EXECUTE' | 'REQUIRE_APPROVAL' =>
  riskLevel === 'READ' ? 'AUTO_EXECUTE' : 'REQUIRE_APPROVAL';

export const evaluateToolPermission = (
  input: PermissionEvaluationInput
): PermissionEvaluationResult => {
  if (input.riskLevel === 'RESTRICTED') {
    return {
      decision: 'DENY',
      reason: `Tool "${input.toolName}" has RESTRICTED risk level and cannot execute autonomously.`,
    };
  }

  const profile = getAgentPermissionProfile(input.role);
  const isToolAllowedForRole =
    profile.allowedTools.includes('*') || profile.allowedTools.includes(input.toolName);

  if (!isToolAllowedForRole) {
    return {
      decision: 'DENY',
      reason: `Agent role "${input.role}" is not permitted to invoke tool "${input.toolName}".`,
    };
  }

  if (profile.autoApprovedRiskLevels.includes(input.riskLevel)) {
    return {
      decision: 'ALLOW',
      reason: `Risk level ${input.riskLevel} is auto-approved for ${input.role}.`,
    };
  }

  if (input.riskLevel === 'INTERNAL_WRITE' && input.allowAutoApproveWrites) {
    return {
      decision: 'ALLOW',
      reason: 'Internal write auto-approved for this execution request.',
    };
  }

  return {
    decision: 'REQUIRE_APPROVAL',
    reason: `Tool "${input.toolName}" (${input.riskLevel}) requires human approval before execution.`,
  };
};
