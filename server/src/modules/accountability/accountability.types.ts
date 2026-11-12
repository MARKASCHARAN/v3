import { z } from 'zod';
import {
  accountabilityLogsQuerySchema,
  accountabilityLogStatusSchema,
  accountabilityLogTypeSchema,
  accountabilitySeveritySchema,
  createAccountabilityLogSchema,
  createReminderSchema,
  generateInterventionsSchema,
  reminderChannelSchema,
  reminderStatusSchema,
  remindersQuerySchema,
  updateAccountabilityLogSchema,
  updateReminderSchema,
} from './accountability.schema';

export type ReminderStatus = z.infer<typeof reminderStatusSchema>;
export type ReminderChannel = z.infer<typeof reminderChannelSchema>;
export type AccountabilityLogType = z.infer<typeof accountabilityLogTypeSchema>;
export type AccountabilityLogStatus = z.infer<typeof accountabilityLogStatusSchema>;
export type AccountabilitySeverity = z.infer<typeof accountabilitySeveritySchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type RemindersQueryInput = z.infer<typeof remindersQuerySchema>;
export type CreateAccountabilityLogInput = z.infer<typeof createAccountabilityLogSchema>;
export type UpdateAccountabilityLogInput = z.infer<typeof updateAccountabilityLogSchema>;
export type AccountabilityLogsQueryInput = z.infer<typeof accountabilityLogsQuerySchema>;
export type GenerateInterventionsInput = z.infer<typeof generateInterventionsSchema>;

export type ProcrastinationSignalType =
  | 'OVERDUE_HIGH_PRIORITY'
  | 'STALE_TASK'
  | 'UNSCHEDULED_URGENT_TASK'
  | 'MISSED_TIME_BLOCKS'
  | 'RECURRING_DEFERRALS';

export type ProcrastinationRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface ProcrastinationSignal {
  type: ProcrastinationSignalType;
  severity: AccountabilitySeverity;
  points: number;
  taskId?: string;
  goalId?: string | null;
  message: string;
}

export interface ProcrastinationAnalysis {
  riskScore: number;
  riskLevel: ProcrastinationRiskLevel;
  signals: ProcrastinationSignal[];
  atRiskTasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: Date | null;
    daysStale: number;
  }>;
}

export interface InterventionRecommendation {
  action: 'DECOMPOSE_TASK' | 'SCHEDULE_MICRO_BLOCK' | 'REPRIORITIZE_OR_ARCHIVE' | 'DAILY_CHECK_IN';
  severity: AccountabilitySeverity;
  taskId?: string;
  goalId?: string | null;
  title: string;
  rationale: string;
  suggestedSteps: string[];
}
