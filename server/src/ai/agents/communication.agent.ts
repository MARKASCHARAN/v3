import { createSpecialistAgent } from './specialist.factory';

export const communicationAgent = createSpecialistAgent({
  role: 'COMMUNICATION',
  name: 'CommunicationAgent',
  description:
    'Prepares briefings, reads Gmail/deliveries, syncs Google Calendar, and dispatches approval-gated notifications across Email, Telegram, Discord, and WhatsApp.',
  phase: 'PHASE_B',
  modelTier: 'ORCHESTRATION',
  promptKey: 'COMMUNICATION_AGENT',
});
