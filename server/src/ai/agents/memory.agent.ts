import { createSpecialistAgent } from './specialist.factory';

export const memoryAgent = createSpecialistAgent({
  role: 'MEMORY',
  name: 'MemoryAgent',
  description:
    'Retrieves semantic and keyword personal memories and proposes high-value memory additions.',
  phase: 'PHASE_A',
  modelTier: 'ORCHESTRATION',
  promptKey: 'MEMORY_AGENT',
});
