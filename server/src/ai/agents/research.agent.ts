import { createSpecialistAgent } from './specialist.factory';

export const researchAgent = createSpecialistAgent({
  role: 'RESEARCH',
  name: 'ResearchAgent',
  description:
    'Conducts grounded web research, synthesizes key findings, and saves important facts to memory.',
  phase: 'PHASE_A',
  modelTier: 'RESEARCH',
  promptKey: 'RESEARCH_AGENT',
});
