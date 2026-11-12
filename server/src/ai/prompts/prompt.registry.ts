import { ASSISTANT_SYSTEM_PROMPT } from './assistant.prompt';
import { PLANNING_SYSTEM_PROMPT } from './planning.prompt';

export type PromptKey =
  | 'PLANNING_DECOMPOSITION'
  | 'ASSISTANT_ORCHESTRATOR'
  | 'GOAL_PLANNING_AGENT'
  | 'TASK_PROJECT_AGENT'
  | 'SCHEDULING_AGENT'
  | 'RESEARCH_AGENT'
  | 'MEMORY_AGENT'
  | 'ACCOUNTABILITY_AGENT'
  | 'COMMUNICATION_AGENT'
  | 'DEVELOPER_AGENT'
  | 'AUTOMATION_AGENT';

export interface PromptDefinition {
  key: PromptKey;
  version: string;
  systemPrompt: string;
}

export const PROMPT_REGISTRY: Record<PromptKey, PromptDefinition> = {
  PLANNING_DECOMPOSITION: {
    key: 'PLANNING_DECOMPOSITION',
    version: '1.0.0',
    systemPrompt: PLANNING_SYSTEM_PROMPT,
  },
  ASSISTANT_ORCHESTRATOR: {
    key: 'ASSISTANT_ORCHESTRATOR',
    version: '1.0.0',
    systemPrompt: ASSISTANT_SYSTEM_PROMPT,
  },
  GOAL_PLANNING_AGENT: {
    key: 'GOAL_PLANNING_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Goal & Planning Specialist. Inspect existing goals and relevant memories before proposing realistic goals, milestones, and strategic sequences.',
  },
  TASK_PROJECT_AGENT: {
    key: 'TASK_PROJECT_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Task & Project Specialist. Review existing tasks and goals, break ambiguous objectives into concrete tasks, prioritize clearly, and update statuses accurately.',
  },
  SCHEDULING_AGENT: {
    key: 'SCHEDULING_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Scheduling Specialist. Inspect existing calendar time blocks and open tasks before proposing realistic, conflict-free time blocks with ISO 8601 timestamps.',
  },
  RESEARCH_AGENT: {
    key: 'RESEARCH_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Research Specialist. Gather grounded facts via webResearch and cross-reference stored memories to return concise, cited insights.',
  },
  MEMORY_AGENT: {
    key: 'MEMORY_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Memory Specialist. Search existing semantic and keyword memories carefully and propose high-signal personal or project context notes without duplicating facts.',
  },
  ACCOUNTABILITY_AGENT: {
    key: 'ACCOUNTABILITY_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Accountability Specialist. Diagnose overdue tasks, procrastination signals, and schedule slippage, then recommend supportive, actionable adjustments.',
  },
  COMMUNICATION_AGENT: {
    key: 'COMMUNICATION_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Communication Specialist. Summarize user tasks, schedule, and accountability status into clear, concise updates and draft messages ready for outbound channels.',
  },
  DEVELOPER_AGENT: {
    key: 'DEVELOPER_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Developer Specialist. Organize engineering tasks, research technical documentation, and synthesize actionable implementation steps.',
  },
  AUTOMATION_AGENT: {
    key: 'AUTOMATION_AGENT',
    version: '1.0.0',
    systemPrompt:
      'You are V3 Automation Specialist. Coordinate safe multi-step tool execution while strictly honoring permission risk policies and approval boundaries.',
  },
};

export const getPromptDefinition = (key: PromptKey): PromptDefinition => PROMPT_REGISTRY[key];
