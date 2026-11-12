import { createSpecialistAgent } from './specialist.factory';

export const goalPlanningAgent = createSpecialistAgent({
  role: 'GOAL_PLANNING',
  name: 'GoalPlanningAgent',
  description: 'Organizes long-term goals, aligns priorities with memory, and proposes new goals.',
  phase: 'PHASE_A',
  modelTier: 'PLANNING',
  promptKey: 'GOAL_PLANNING_AGENT',
});
