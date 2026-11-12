import {
  AccountabilityLog,
  AccountabilitySummary,
  AgentRole,
  AiApprovalStatus,
  AiExecution,
  AiExecutionStatus,
  AiObservabilityMetrics,
  AiToolApproval,
  AiToolMetadata,
  AuthSessionData,
  AvailableSlot,
  BackgroundJob,
  ConversationMessage,
  DomainEvent,
  EventSubscriptionRule,
  GithubIssueSummary,
  GithubPullRequestSummary,
  GithubRepoSummary,
  GmailMessageSummary,
  Goal,
  GoalStatus,
  GoalTimeframe,
  HybridMemorySearchResult,
  IntegrationProvider,
  InterventionGenerationResult,
  McpToolsSnapshot,
  MemoryCategory,
  MemoryItem,
  MemorySourceType,
  MemoryType,
  Milestone,
  NotificationChannel,
  NotificationDelivery,
  NotificationDeliveryStatus,
  NotificationPreference,
  Plan,
  ProcrastinationAnalysis,
  RecoverySweepResult,
  Reminder,
  ResearchItem,
  SanitizedIntegrationAccount,
  SpecialistAgentMetadata,
  Task,
  TaskPriority,
  TaskStatus,
  TimeBlock,
  TimeBlockCategory,
  TimeBlockStatus,
  UserPreference,
  UserProfile,
  VoiceCommandResult,
  VoiceSession,
} from '@/types/api';
import { apiRequest } from './api-client';

export const authApi = {
  register: (payload: { email: string; password: string; name?: string }) =>
    apiRequest<AuthSessionData>('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (payload: { email: string; password: string }) =>
    apiRequest<AuthSessionData>('/auth/login', { method: 'POST', body: payload, auth: false }),
  logout: () => apiRequest<{ message: string }>('/auth/logout', { method: 'POST' }),
  me: () => apiRequest<UserProfile>('/auth/me'),
  updateMe: (payload: { name: string }) =>
    apiRequest<UserProfile>('/auth/me', { method: 'PATCH', body: payload }),
};

export const goalsApi = {
  list: (filters?: {
    timeframe?: GoalTimeframe;
    targetYear?: number;
    status?: GoalStatus;
    parentGoalId?: string;
  }) => apiRequest<Goal[]>('/goals', { query: filters }),
  create: (payload: {
    title: string;
    description?: string;
    category?: string;
    timeframe?: GoalTimeframe;
    targetYear?: number;
    parentGoalId?: string;
    targetDate?: string;
  }) => apiRequest<Goal>('/goals', { method: 'POST', body: payload }),
  update: (
    id: string,
    payload: {
      title?: string;
      description?: string | null;
      status?: GoalStatus;
      timeframe?: GoalTimeframe;
      targetYear?: number | null;
      parentGoalId?: string | null;
      progress?: number;
    }
  ) => apiRequest<Goal>(`/goals/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => apiRequest<{ message: string }>(`/goals/${id}`, { method: 'DELETE' }),
  addMilestone: (goalId: string, payload: { title: string; description?: string; order?: number }) =>
    apiRequest<Milestone>(`/goals/${goalId}/milestones`, { method: 'POST', body: payload }),
  updateMilestone: (
    goalId: string,
    milestoneId: string,
    payload: { title?: string; isCompleted?: boolean }
  ) =>
    apiRequest<Milestone>(`/goals/${goalId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: payload,
    }),
  removeMilestone: (goalId: string, milestoneId: string) =>
    apiRequest<{ message: string }>(`/goals/${goalId}/milestones/${milestoneId}`, {
      method: 'DELETE',
    }),
};

export const tasksApi = {
  list: (filters?: {
    status?: TaskStatus;
    priority?: TaskPriority;
    goalId?: string;
    overdue?: 'true' | 'false';
  }) => apiRequest<Task[]>('/tasks', { query: filters }),
  create: (payload: {
    title: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string;
    goalId?: string;
    parentTaskId?: string;
  }) => apiRequest<Task>('/tasks', { method: 'POST', body: payload }),
  update: (
    id: string,
    payload: {
      title?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      dueDate?: string | null;
      goalId?: string | null;
    }
  ) => apiRequest<Task>(`/tasks/${id}`, { method: 'PATCH', body: payload }),
  remove: (id: string) => apiRequest<{ message: string }>(`/tasks/${id}`, { method: 'DELETE' }),
};

export const schedulingApi = {
  listBlocks: (filters?: {
    from?: string;
    to?: string;
    category?: TimeBlockCategory;
    status?: TimeBlockStatus;
  }) => apiRequest<TimeBlock[]>('/scheduling/blocks', { query: filters }),
  createBlock: (payload: {
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    category?: TimeBlockCategory;
    taskId?: string;
    goalId?: string;
    allowOverlap?: boolean;
  }) => apiRequest<TimeBlock>('/scheduling/blocks', { method: 'POST', body: payload }),
  updateBlock: (
    id: string,
    payload: {
      title?: string;
      status?: TimeBlockStatus;
      startTime?: string;
      endTime?: string;
      allowOverlap?: boolean;
    }
  ) => apiRequest<TimeBlock>(`/scheduling/blocks/${id}`, { method: 'PATCH', body: payload }),
  removeBlock: (id: string) =>
    apiRequest<{ message: string }>(`/scheduling/blocks/${id}`, { method: 'DELETE' }),
  suggestSlots: (query: {
    date: string;
    durationMinutes?: number;
    dayStartHour?: number;
    dayEndHour?: number;
    tzOffsetMinutes?: number;
  }) => apiRequest<AvailableSlot[]>('/scheduling/slots', { query }),
};

export const accountabilityApi = {
  getSummary: () => apiRequest<AccountabilitySummary>('/accountability/summary'),
  getMissedTasks: () => apiRequest<Task[]>('/accountability/missed-tasks'),
  scanMissedTasks: () =>
    apiRequest<{
      missedTasksCount: number;
      newlyLoggedCount: number;
      missedTasks: Task[];
      newLogs: AccountabilityLog[];
    }>('/accountability/missed-tasks/scan', { method: 'POST' }),
  listReminders: () => apiRequest<Reminder[]>('/accountability/reminders'),
  createReminder: (payload: { title: string; remindAt: string; message?: string }) =>
    apiRequest<Reminder>('/accountability/reminders', { method: 'POST', body: payload }),
  updateReminder: (id: string, payload: { status: Reminder['status'] }) =>
    apiRequest<Reminder>(`/accountability/reminders/${id}`, { method: 'PATCH', body: payload }),
  listLogs: () => apiRequest<AccountabilityLog[]>('/accountability/logs'),
  updateLog: (id: string, payload: { status: AccountabilityLog['status'] }) =>
    apiRequest<AccountabilityLog>(`/accountability/logs/${id}`, { method: 'PATCH', body: payload }),
  getProcrastination: () => apiRequest<ProcrastinationAnalysis>('/accountability/procrastination'),
  generateInterventions: (payload?: {
    maxInterventions?: number;
    createReminders?: boolean;
    logAlerts?: boolean;
  }) =>
    apiRequest<InterventionGenerationResult>('/accountability/interventions', {
      method: 'POST',
      body: payload ?? { maxInterventions: 5, createReminders: false, logAlerts: true },
    }),
};

export const memoryApi = {
  list: (query?: { category?: MemoryCategory; q?: string; limit?: number }) =>
    apiRequest<MemoryItem[]>('/memory', { query }),
  create: (payload: {
    title?: string;
    content: string;
    category?: MemoryCategory;
    tags?: string[];
    importance?: number;
  }) => apiRequest<MemoryItem>('/memory', { method: 'POST', body: payload }),
  remove: (id: string) => apiRequest<{ message: string }>(`/memory/${id}`, { method: 'DELETE' }),
  listPreferences: () => apiRequest<UserPreference[]>('/memory/preferences'),
  upsertPreference: (payload: { key: string; value: string; category?: string }) =>
    apiRequest<UserPreference>('/memory/preferences', { method: 'PUT', body: payload }),
  removePreference: (key: string) =>
    apiRequest<{ message: string }>(`/memory/preferences/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    }),
  hybridSearch: (query: {
    q: string;
    category?: MemoryCategory;
    memoryType?: MemoryType;
    limit?: number;
    minSimilarity?: number;
  }) => apiRequest<HybridMemorySearchResult>('/memory/hybrid', { query }),
  propose: (payload: {
    title?: string;
    content: string;
    category?: MemoryCategory;
    memoryType?: MemoryType;
    sourceType?: MemorySourceType;
    importance?: number;
    confidence?: number;
    autoSupersedeOnConflict?: boolean;
  }) =>
    apiRequest<{
      created: boolean;
      memory: MemoryItem;
      supersededMemoryId?: string | null;
      reason?: string;
    }>('/memory/propose', { method: 'POST', body: payload }),
  prune: () => apiRequest<{ deletedCount: number }>('/memory/prune', { method: 'POST' }),
  backfillEmbeddings: (limit: number = 25) =>
    apiRequest<{ processedCount: number; updatedCount: number }>('/memory/embeddings/backfill', {
      method: 'POST',
      body: { limit },
    }),
  listConversations: (sessionId: string = 'default', limit: number = 20) =>
    apiRequest<ConversationMessage[]>('/memory/conversations', { query: { sessionId, limit } }),
};

export const automationApi = {
  listTools: () => apiRequest<AiToolMetadata[]>('/automation/tools'),
  listAgents: () => apiRequest<SpecialistAgentMetadata[]>('/automation/agents'),
  getMetrics: () => apiRequest<AiObservabilityMetrics>('/automation/metrics'),
  run: (payload: {
    prompt: string;
    sessionId?: string;
    threadId?: string;
    agentRole?: AgentRole;
    maxSteps?: number;
    allowAutoApproveWrites?: boolean;
  }) => apiRequest<AiExecution>('/automation/run', { method: 'POST', body: payload }),
  listExecutions: (query?: { status?: AiExecutionStatus; sessionId?: string; limit?: number }) =>
    apiRequest<AiExecution[]>('/automation/executions', { query }),
  getExecution: (id: string) => apiRequest<AiExecution>(`/automation/executions/${id}`),
  listApprovals: (query?: { status?: AiApprovalStatus; executionId?: string; limit?: number }) =>
    apiRequest<AiToolApproval[]>('/automation/approvals', { query }),
  approve: (id: string, reason?: string) =>
    apiRequest<AiToolApproval>(`/automation/approvals/${id}/approve`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),
  reject: (id: string, reason?: string) =>
    apiRequest<AiToolApproval>(`/automation/approvals/${id}/reject`, {
      method: 'POST',
      body: reason ? { reason } : {},
    }),
};

export const researchApi = {
  list: (query?: { q?: string; goalId?: string; limit?: number }) =>
    apiRequest<ResearchItem[]>('/research', { query }),
  search: (payload: { query: string; urls?: string[]; goalId?: string; saveToMemory?: boolean }) =>
    apiRequest<ResearchItem>('/research/search', { method: 'POST', body: payload }),
  saveToMemory: (id: string) =>
    apiRequest<{ research: ResearchItem; memory: MemoryItem }>(`/research/${id}/save-to-memory`, {
      method: 'POST',
    }),
  remove: (id: string) =>
    apiRequest<{ message: string }>(`/research/${id}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  listPreferences: () => apiRequest<NotificationPreference[]>('/notifications/preferences'),
  upsertPreference: (payload: {
    channel: NotificationChannel;
    enabled?: boolean;
    quietStart?: string | null;
    quietEnd?: string | null;
    frequencyCap?: number;
  }) => apiRequest<NotificationPreference>('/notifications/preferences', { method: 'PUT', body: payload }),
  listDeliveries: (query?: {
    channel?: NotificationChannel;
    status?: NotificationDeliveryStatus;
    limit?: number;
  }) => apiRequest<NotificationDelivery[]>('/notifications/deliveries', { query }),
  send: (payload: {
    channel: NotificationChannel;
    subject?: string;
    body: string;
    recipient?: string;
    bypassQuietHours?: boolean;
  }) => apiRequest<NotificationDelivery>('/notifications/send', { method: 'POST', body: payload }),
  retryDelivery: (id: string) =>
    apiRequest<NotificationDelivery>(`/notifications/deliveries/${id}/retry`, { method: 'POST' }),
};

export const voiceApi = {
  listSessions: (limit: number = 20) =>
    apiRequest<VoiceSession[]>('/voice/sessions', { query: { limit } }),
  transcribe: (payload: {
    audioBase64: string;
    sourceLanguage: string;
    audioFormat?: 'wav' | 'mp3' | 'flac' | 'webm';
  }) =>
    apiRequest<{ transcript: string; sourceLanguage: string }>('/voice/transcribe', {
      method: 'POST',
      body: payload,
    }),
  translate: (payload: { text: string; sourceLanguage: string; targetLanguage: string }) =>
    apiRequest<{ translatedText: string; sourceLanguage: string; targetLanguage: string }>(
      '/voice/translate',
      { method: 'POST', body: payload }
    ),
  synthesize: (payload: { text: string; languageCode: string; gender?: 'male' | 'female' }) =>
    apiRequest<{
      audioBase64: string;
      audioFormat: string;
      ttsAudioKey: string | null;
      signedUrl: string | null;
    }>('/voice/synthesize', { method: 'POST', body: payload }),
  processCommand: (payload: {
    transcriptText: string;
    sourceLanguage: string;
    targetLanguage?: string;
    executeCommand?: boolean;
    synthesizeReply?: boolean;
  }) => apiRequest<VoiceCommandResult>('/voice/command', { method: 'POST', body: payload }),
};

export const integrationsApi = {
  list: () => apiRequest<SanitizedIntegrationAccount[]>('/integrations'),
  connect: (payload: {
    provider: IntegrationProvider;
    credentials: Record<string, unknown>;
    externalAccountId?: string;
    scopes?: string[];
  }) =>
    apiRequest<SanitizedIntegrationAccount>('/integrations/connect', {
      method: 'POST',
      body: payload,
    }),
  disconnect: (provider: IntegrationProvider) =>
    apiRequest<{ disconnected: boolean; provider: string }>(`/integrations/${provider}`, {
      method: 'DELETE',
    }),
  syncGoogleCalendar: () =>
    apiRequest<{
      syncedCount: number;
      importedTimeBlocks: number;
      skippedTimeBlocks: number;
    }>('/integrations/google/calendar/sync', {
      method: 'POST',
      body: { maxResults: 20, importAsTimeBlocks: true },
    }),
  listGmailMessages: (q?: string) =>
    apiRequest<GmailMessageSummary[]>('/integrations/google/gmail/messages', {
      query: { q, maxResults: 10 },
    }),
  listGithubRepos: () => apiRequest<GithubRepoSummary[]>('/integrations/github/repos'),
  listGithubIssues: (owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') =>
    apiRequest<GithubIssueSummary[]>(
      `/integrations/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
      { query: { state } }
    ),
  listGithubPullRequests: (
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ) =>
    apiRequest<GithubPullRequestSummary[]>(
      `/integrations/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`,
      { query: { state } }
    ),
  createGithubIssue: (payload: {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    labels?: string[];
  }) =>
    apiRequest<GithubIssueSummary>('/integrations/github/issues', {
      method: 'POST',
      body: payload,
    }),
  createGithubComment: (payload: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }) =>
    apiRequest<{ id: number; htmlUrl: string }>('/integrations/github/issues/comment', {
      method: 'POST',
      body: payload,
    }),
  listMcpTools: () => apiRequest<McpToolsSnapshot>('/integrations/mcp/tools'),
  invokeMcpTool: (payload: {
    serverName: string;
    toolName: string;
    arguments?: Record<string, unknown>;
    allowAutoApproveWrites?: boolean;
  }) =>
    apiRequest<unknown>('/integrations/mcp/invoke', {
      method: 'POST',
      body: payload,
    }),
};

export const eventsApi = {
  listSubscriptions: () => apiRequest<EventSubscriptionRule[]>('/events/subscriptions'),
  ingestEvent: (payload: {
    eventType: string;
    source: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
    dispatchImmediately?: boolean;
  }) =>
    apiRequest<{ event: DomainEvent; deduplicated: boolean; jobs: BackgroundJob[] }>(
      '/events/ingest',
      { method: 'POST', body: payload }
    ),
  listEvents: (limit: number = 20) => apiRequest<DomainEvent[]>('/events', { query: { limit } }),
  listJobs: (limit: number = 20) =>
    apiRequest<BackgroundJob[]>('/events/jobs', { query: { limit } }),
  retryJob: (id: string) => apiRequest<BackgroundJob>(`/events/jobs/${id}/retry`, { method: 'POST' }),
  runRecoverySweep: () =>
    apiRequest<RecoverySweepResult>('/events/recovery/sweep', {
      method: 'POST',
      body: { staleMinutes: 30, includeApprovalExpiry: true, includeMemoryPrune: true },
    }),
};

export const planningApi = {
  listPlans: () => apiRequest<Plan[]>('/planning/plans'),
  generatePlan: (payload: {
    goalId?: string;
    goalTitle?: string;
    goalDescription?: string;
    timeframe?: GoalTimeframe;
    targetYear?: number;
    additionalContext?: string;
  }) => apiRequest<Plan>('/planning/generate', { method: 'POST', body: payload }),
  applyPlan: (id: string, goalId?: string) =>
    apiRequest<{ plan: Plan; goalId: string }>(`/planning/plans/${id}/apply`, {
      method: 'POST',
      body: goalId ? { goalId } : {},
    }),
  removePlan: (id: string) =>
    apiRequest<{ message: string }>(`/planning/plans/${id}`, { method: 'DELETE' }),
};

