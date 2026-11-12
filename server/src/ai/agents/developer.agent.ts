import { createSpecialistAgent } from './specialist.factory';

export const developerAgent = createSpecialistAgent({
  role: 'DEVELOPER',
  name: 'DeveloperAgent',
  description:
    'Handles GitHub repository/issue/PR inspection, MCP tooling discovery, engineering task breakdowns, and technical web research.',
  phase: 'PHASE_B',
  modelTier: 'CODE_ANALYSIS',
  promptKey: 'DEVELOPER_AGENT',
});
