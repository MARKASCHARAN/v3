import { createSpecialistAgent } from './specialist.factory';

export const communicationAgent = createSpecialistAgent({
  role: 'COMMUNICATION',
  name: 'CommunicationAgent',
  description:
    'Prepares concise briefings and outbound message drafts grounded in tasks, schedule, and memory.',
  phase: 'PHASE_B',
  modelTier: 'ORCHESTRATION',
  promptKey: 'COMMUNICATION_AGENT',
});
