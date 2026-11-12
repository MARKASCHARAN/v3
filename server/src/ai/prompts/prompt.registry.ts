import { ASSISTANT_SYSTEM_PROMPT } from './assistant.prompt';
import { PLANNING_SYSTEM_PROMPT } from './planning.prompt';

export type PromptKey = 'PLANNING_DECOMPOSITION' | 'ASSISTANT_ORCHESTRATOR';

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
};

export const getPromptDefinition = (key: PromptKey): PromptDefinition => PROMPT_REGISTRY[key];
