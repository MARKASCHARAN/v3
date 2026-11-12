import {
  AccountabilityLog,
  AccountabilitySummary,
  AuthSessionData,
  AvailableSlot,
  Goal,
  GoalStatus,
  GoalTimeframe,
  MemoryCategory,
  MemoryItem,
  Milestone,
  Plan,
  Reminder,
  Task,
  TaskPriority,
  TaskStatus,
  TimeBlock,
  TimeBlockCategory,
  TimeBlockStatus,
  UserPreference,
  UserProfile,
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

