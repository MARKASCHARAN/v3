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

