import { createSpecialistAgent } from './specialist.factory';

export const schedulingAgent = createSpecialistAgent({
  role: 'SCHEDULING',
  name: 'SchedulingAgent',
  description:
    'Reviews calendar time blocks and schedules focused work sessions around open tasks.',
  phase: 'PHASE_A',
  modelTier: 'ORCHESTRATION',
  promptKey: 'SCHEDULING_AGENT',
});
