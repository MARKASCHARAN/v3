export interface PlanningPromptInput {
  goalTitle: string;
  goalDescription?: string | null;
  timeframe?: string;
  targetYear?: number | null;
  additionalContext?: string;
  preferences: Array<{ key: string; value: string }>;
  memories: Array<{ title: string | null; content: string; category: string }>;
}

export const PLANNING_SYSTEM_PROMPT =
  'You are V3 AI Planner. Decompose personal or technical goals into realistic, sequential milestones and concrete, actionable tasks with priorities and time estimates.';

export const buildGoalDecompositionPrompt = (input: PlanningPromptInput): string => {
  const sections: string[] = [
    `Goal: ${input.goalTitle}`,
    input.goalDescription ? `Description: ${input.goalDescription}` : '',
    input.timeframe ? `Timeframe: ${input.timeframe}` : '',
    input.targetYear ? `Target Year: ${input.targetYear}` : '',
    input.additionalContext ? `Additional Context: ${input.additionalContext}` : '',
  ].filter(Boolean);

  if (input.preferences.length > 0) {
    const prefsText = input.preferences.map((p) => `- ${p.key}: ${p.value}`).join('\n');
    sections.push(`User Preferences:\n${prefsText}`);
  }

  if (input.memories.length > 0) {
    const memText = input.memories
      .map((m) => `- [${m.category}] ${m.title ? `${m.title}: ` : ''}${m.content}`)
      .join('\n');
    sections.push(`Relevant Context:\n${memText}`);
  }

  sections.push(
    'Return a clear plan title, concise summary, ordered milestones (index 0..N), and actionable tasks referencing milestoneIndex where applicable.'
  );

  return sections.join('\n\n');
};
