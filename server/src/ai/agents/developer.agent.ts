import { createSpecialistAgent } from './specialist.factory';

export const developerAgent = createSpecialistAgent({
  role: 'DEVELOPER',
  name: 'DeveloperAgent',
  description:
    'Handles engineering task breakdowns, technical web research, and developer workflow triage.',
  phase: 'PHASE_B',
  modelTier: 'CODE_ANALYSIS',
  promptKey: 'DEVELOPER_AGENT',
});
