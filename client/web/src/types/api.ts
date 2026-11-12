export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';
export type GoalTimeframe = 'YEARLY' | 'QUARTERLY' | 'MONTHLY' | 'WEEKLY' | 'CUSTOM';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export type TimeBlockCategory =
  | 'WORK'
  | 'DEEP_WORK'
  | 'MEETING'
  | 'PERSONAL'
  | 'HEALTH'
  | 'LEARNING'
  | 'BREAK';
export type TimeBlockStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'MISSED';
export type MemoryCategory =
  | 'GENERAL'
  | 'PREFERENCE'
  | 'PROJECT_CONTEXT'
  | 'GOAL_CONTEXT'
  | 'FACT';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export interface AuthSessionData {
  user: UserProfile | null;
  session: AuthTokens | null;
}

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  order: number;
  targetDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface GoalSummary {
  id: string;
  title: string;
  timeframe: GoalTimeframe;
  targetYear: number | null;
  status?: GoalStatus;
  progress?: number;
}

export interface Goal {
  id: string;
  userId: string;
  parentGoalId: string | null;
  title: string;
  description: string | null;
  category: string;
  timeframe: GoalTimeframe;
  targetYear: number | null;
  targetDate: string | null;
  status: GoalStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  milestones: Milestone[];
  subGoals: GoalSummary[];
  parentGoal: GoalSummary | null;
  tasks?: Task[];
}

export interface Task {
  id: string;
  userId: string;
  goalId: string | null;
  milestoneId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks?: Task[];
  goal?: { id: string; title: string; status: GoalStatus } | null;
  milestone?: { id: string; title: string; isCompleted: boolean } | null;
}

export interface TimeBlock {
  id: string;
  userId: string;
  taskId: string | null;
  goalId: string | null;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  category: TimeBlockCategory;
  status: TimeBlockStatus;
  isRecurring: boolean;
  recurrenceRule: string | null;
  task?: { id: string; title: string; priority: TaskPriority; status: TaskStatus } | null;
  goal?: { id: string; title: string; status: GoalStatus } | null;
}

export interface AvailableSlot {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface Reminder {
  id: string;
  userId: string;
  taskId: string | null;
  goalId: string | null;
  title: string;
  message: string | null;
  remindAt: string;
  status: 'PENDING' | 'SENT' | 'DISMISSED' | 'ACKNOWLEDGED';
  channel: string;
}

export interface AccountabilityLog {
  id: string;
  userId: string;
  taskId: string | null;
  goalId: string | null;
  type: 'MISSED_TASK' | 'CHECK_IN' | 'STREAK_UPDATE' | 'PROGRESS_NUDGE';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  notes: string | null;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface AccountabilitySummary {
  tasks: {
    total: number;
    completed: number;
    overdue: number;
    completionRate: number;
  };
  goals: {
    total: number;
    active: number;
    averageProgress: number;
  };
  pendingReminders: number;
  openAlerts: number;
}

export interface MemoryItem {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  category: MemoryCategory;
  tags: string[];
  importance: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: string;
}

export interface SuggestedMilestone {
  title: string;
  description?: string;
  order: number;
  targetInDays?: number;
}

export interface SuggestedTask {
  title: string;
  description?: string;
  priority: TaskPriority;
  milestoneIndex?: number;
  estimatedMinutes?: number;
  dueInDays?: number;
}

export interface Plan {
  id: string;
  userId: string;
  goalId: string | null;
  title: string;
  summary: string;
  status: 'DRAFT' | 'APPLIED' | 'ARCHIVED';
  milestonesData: SuggestedMilestone[];
  tasksData: SuggestedTask[];
  provider: string | null;
  model: string | null;
  appliedAt: string | null;
  createdAt: string;
  goal?: GoalSummary | null;
}

export type MemoryType = 'CONVERSATION' | 'EPISODIC' | 'SEMANTIC' | 'PROCEDURAL' | 'PROJECT';
export type MemorySourceType = 'MANUAL' | 'CONVERSATION' | 'RESEARCH' | 'EMAIL' | 'GITHUB' | 'EVENT';

export interface HybridMemoryMatch {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  category: string;
  memoryType: string;
  sourceType: string;
  sourceId: string | null;
  tags: string[];
  importance: number;
  confidence: number;
  expiresAt: string | null;
  supersededById: string | null;
  rrfScore: number;
  similarity: number | null;
  keywordRank: number | null;
  vectorRankPosition: number | null;
  keywordRankPosition: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface HybridMemorySearchResult {
  mode: 'hybrid_rrf' | 'sql_and_fts';
  query: string;
  preferences: Array<{ key: string; value: string; category: string }>;
  structuredMetrics: {
    activeGoalsCount: number;
    openTasksCount: number;
    overdueTasksCount: number;
    pendingRemindersCount: number;
    upcomingTimeBlocksCount: number;
  };
  results: HybridMemoryMatch[];
}

export interface ProcrastinationSignal {
  type:
    | 'OVERDUE_HIGH_PRIORITY'
    | 'STALE_TASK'
    | 'UNSCHEDULED_URGENT_TASK'
    | 'MISSED_TIME_BLOCKS'
    | 'RECURRING_DEFERRALS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  points: number;
  taskId?: string;
  goalId?: string | null;
  message: string;
}

export interface ProcrastinationAnalysis {
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  signals: ProcrastinationSignal[];
  atRiskTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: string | null;
    daysStale: number;
  }>;
}

export interface InterventionRecommendation {
  action: 'DECOMPOSE_TASK' | 'SCHEDULE_MICRO_BLOCK' | 'REPRIORITIZE_OR_ARCHIVE' | 'DAILY_CHECK_IN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  taskId?: string;
  goalId?: string | null;
  title: string;
  rationale: string;
  suggestedSteps: string[];
}

export interface InterventionGenerationResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  interventions: InterventionRecommendation[];
  loggedAlertsCount: number;
  createdRemindersCount: number;
}

export type AgentRole =
  | 'MAIN_ORCHESTRATOR'
  | 'GOAL_PLANNING'
  | 'TASK_PROJECT'
  | 'RESEARCH'
  | 'MEMORY'
  | 'SCHEDULING'
  | 'ACCOUNTABILITY'
  | 'COMMUNICATION'
  | 'DEVELOPER'
  | 'AUTOMATION';

export type ToolRiskLevel =
  | 'READ'
  | 'INTERNAL_WRITE'
  | 'EXTERNAL_REVERSIBLE'
  | 'EXTERNAL_CONSEQUENTIAL'
  | 'RESTRICTED';

export type AiExecutionStatus =
  | 'RUNNING'
  | 'AWAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED';

export type AiApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXECUTED'
  | 'FAILED'
  | 'EXPIRED';

export interface AiToolMetadata {
  name: string;
  domain: string;
  description: string;
  riskLevel: ToolRiskLevel;
  idempotent: boolean;
  policy: 'AUTO_EXECUTE' | 'REQUIRE_APPROVAL';
}

export interface SpecialistAgentMetadata {
  role: AgentRole;
  name: string;
  description: string;
  phase: 'PHASE_A' | 'PHASE_B';
  modelTier: string;
  allowedReadDomains: string[];
  allowedTools: string[];
  autoApprovedRiskLevels: ToolRiskLevel[];
  maxIterations: number;
  maxTokenBudget: number;
}

export interface AiToolApproval {
  id: string;
  executionId: string;
  userId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  riskLevel: ToolRiskLevel;
  agentRole: string;
  status: AiApprovalStatus;
  decisionReason: string | null;
  resultData: unknown;
  errorMessage: string | null;
  expiresAt: string | null;
  decidedAt: string | null;
  executedAt: string | null;
  createdAt: string;
}

export interface ExecutionStepTrace {
  stepNumber: number;
  finishReason: string;
  text: string;
  toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    input: unknown;
  }>;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    output: unknown;
  }>;
}

export interface AiExecution {
  id: string;
  userId: string;
  parentExecutionId: string | null;
  sessionId: string;
  threadId: string;
  agentRole: string;
  triggerType: string;
  prompt: string;
  status: AiExecutionStatus;
  provider: string | null;
  model: string | null;
  tokenBudget: number | null;
  tokensUsed: number;
  costMicroUsd: number;
  langsmithTraceId: string | null;
  langsmithTraceUrl: string | null;
  responseText: string | null;
  errorMessage: string | null;
  attempts: number;
  stepsData: ExecutionStepTrace[] | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  approvals?: AiToolApproval[];
  subagentExecutions?: Array<{
    id: string;
    agentRole: string;
    triggerType: string;
    status: AiExecutionStatus;
    threadId: string;
    tokensUsed: number;
    responseText: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
}

export interface AiObservabilityMetrics {
  totalExecutions: number;
  totalTokensUsed: number;
  totalCostMicroUsd: number;
  approvalsByStatus: Record<string, number>;
  recentTraces: Array<{
    id: string;
    agentRole: string;
    status: AiExecutionStatus;
    model: string | null;
    tokensUsed: number;
    costMicroUsd: number;
    langsmithTraceId: string | null;
    langsmithTraceUrl: string | null;
    createdAt: string;
  }>;
}

export interface ResearchSource {
  title?: string;
  url: string;
  snippet?: string;
}

export interface ResearchItem {
  id: string;
  userId: string;
  goalId: string | null;
  query: string;
  title: string;
  summary: string;
  keyFindings: string[];
  sources: ResearchSource[];
  status: 'COMPLETED' | 'SAVED_TO_MEMORY' | 'ARCHIVED';
  provider: string | null;
  model: string | null;
  createdAt: string;
}

export type NotificationChannel = 'EMAIL' | 'TELEGRAM' | 'DISCORD' | 'WHATSAPP' | 'IN_APP' | 'PUSH';
export type NotificationDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';

export interface NotificationPreference {
  id: string;
  userId: string;
  channel: NotificationChannel;
  enabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  frequencyCap: number;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDelivery {
  id: string;
  userId: string;
  channel: NotificationChannel;
  subject: string | null;
  body: string;
  providerMessageId: string | null;
  status: NotificationDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface VoiceSession {
  id: string;
  userId: string;
  executionId: string | null;
  languageCode: string;
  asrTranscript: string | null;
  translatedText: string | null;
  ttsAudioKey: string | null;
  duration: number | null;
  status: string;
  createdAt: string;
}

export interface VoiceCommandResult {
  session: VoiceSession;
  transcript: string;
  translatedText: string;
  executionId: string | null;
  replyText: string;
  ttsAudioKey: string | null;
  signedUrl: string | null;
}

export type IntegrationProvider =
  | 'TELEGRAM'
  | 'DISCORD'
  | 'WHATSAPP'
  | 'GOOGLE'
  | 'GITHUB'
  | 'BHASHINI';

export interface SanitizedIntegrationAccount {
  id: string;
  userId: string;
  provider: IntegrationProvider;
  externalAccountId: string | null;
  scopes: string[];
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'ERROR';
  lastSyncedAt: string | null;
  hasCredentials: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt?: string;
}

export interface GithubRepoSummary {
  id: number;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  openIssuesCount: number;
  htmlUrl: string;
  updatedAt: string | null;
}

export interface GithubIssueSummary {
  id: number;
  number: number;
  title: string;
  state: string;
  isPullRequest: boolean;
  author: string;
  htmlUrl: string;
  body: string | null;
  createdAt: string;
}

export interface GithubPullRequestSummary {
  id: number;
  number: number;
  title: string;
  state: string;
  draft: boolean;
  author: string;
  headBranch: string;
  baseBranch: string;
  htmlUrl: string;
  createdAt: string;
}

export interface EventSubscriptionRule {
  eventType: string;
  jobType: string;
  description: string;
  autoEnqueue: boolean;
}

export interface ConversationMessage {
  id: string;
  userId: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export interface McpToolsSnapshot {
  servers: Array<{
    name: string;
    description: string;
    transport: string;
    defaultRiskLevel: ToolRiskLevel;
    enabled: boolean;
  }>;
  tools: Array<{
    serverName: string;
    name: string;
    description: string;
    riskLevel: ToolRiskLevel;
  }>;
}

export interface DomainEvent {
  id: string;
  userId: string;
  eventType: string;
  source: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'DEAD_LETTER';
  idempotencyKey: string | null;
  attempts: number;
  maxAttempts: number;
  processedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface BackgroundJob {
  id: string;
  userId: string;
  executionId: string | null;
  domainEventId: string | null;
  jobType: string;
  externalJobId: string | null;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'DEAD_LETTER';
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
}

export interface RecoverySweepResult {
  stalledJobsInspected: number;
  jobsRequeuedOrFailed: number;
  jobsDeadLettered: number;
  eventsDeadLettered: number;
  staleExecutionsFailed: number;
  expiredApprovals: number;
  prunedMemories: number;
}

