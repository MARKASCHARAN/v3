import { z } from 'zod';
import {
  accountabilityLogsQuerySchema,
  accountabilityLogStatusSchema,
  accountabilityLogTypeSchema,
  createAccountabilityLogSchema,
  createReminderSchema,
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
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type RemindersQueryInput = z.infer<typeof remindersQuerySchema>;
export type CreateAccountabilityLogInput = z.infer<typeof createAccountabilityLogSchema>;
export type UpdateAccountabilityLogInput = z.infer<typeof updateAccountabilityLogSchema>;
export type AccountabilityLogsQueryInput = z.infer<typeof accountabilityLogsQuerySchema>;
