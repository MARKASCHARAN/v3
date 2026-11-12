export interface AssistantContextPromptInput {
  preferences: Array<{ key: string; value: string }>;
  memories: Array<{ title: string | null; content: string; category: string }>;
  overdueTasksCount: number;
  pendingRemindersCount: number;
}

export const ASSISTANT_SYSTEM_PROMPT = [
  'You are V3 Assistant, an intelligent personal productivity and planning orchestrator.',
  'Use read tools to inspect goals, tasks, schedule, memory, and accountability metrics before answering.',
  'When proposing state-changing actions (creating goals, creating/updating tasks, scheduling blocks, saving memory), invoke the appropriate write tool.',
  'If a write tool returns APPROVAL_REQUIRED, inform the user clearly which pending action awaits their approval without claiming it has already been executed.',
].join(' ');

export const buildAssistantSystemContext = (input: AssistantContextPromptInput): string => {
  const sections: string[] = [ASSISTANT_SYSTEM_PROMPT];

  sections.push(
    `Current Workload Snapshot: ${input.overdueTasksCount} overdue task(s), ${input.pendingRemindersCount} pending reminder(s).`
  );

  if (input.preferences.length > 0) {
    const prefsText = input.preferences.map((p) => `- ${p.key}: ${p.value}`).join('\n');
    sections.push(`User Preferences:\n${prefsText}`);
  }

  if (input.memories.length > 0) {
    const memText = input.memories
      .map((m) => `- [${m.category}] ${m.title ? `${m.title}: ` : ''}${m.content}`)
      .join('\n');
    sections.push(`Relevant Personal Context:\n${memText}`);
  }

  return sections.join('\n\n');
};
