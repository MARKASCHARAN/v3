import { createSpecialistAgent } from './specialist.factory';

export const accountabilityAgent = createSpecialistAgent({
  role: 'ACCOUNTABILITY',
  name: 'AccountabilityAgent',
  description:
    'Evaluates completion metrics, overdue tasks, and procrastination signals with adaptive check-ins.',
  phase: 'PHASE_A',
  modelTier: 'ORCHESTRATION',
  promptKey: 'ACCOUNTABILITY_AGENT',
});
