import { createSpecialistAgent } from './specialist.factory';

export const taskProjectAgent = createSpecialistAgent({
  role: 'TASK_PROJECT',
  name: 'TaskProjectAgent',
  description:
    'Inspects task backlogs, breaks objectives into actionable tasks, and updates task statuses.',
  phase: 'PHASE_A',
  modelTier: 'ORCHESTRATION',
  promptKey: 'TASK_PROJECT_AGENT',
});
