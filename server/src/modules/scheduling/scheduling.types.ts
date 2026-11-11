import { z } from 'zod';
import {
  createTimeBlockSchema,
  schedulingQuerySchema,
  suggestSlotsQuerySchema,
  timeBlockCategorySchema,
  timeBlockStatusSchema,
  updateTimeBlockSchema,
} from './scheduling.schema';

export type TimeBlockCategory = z.infer<typeof timeBlockCategorySchema>;
export type TimeBlockStatus = z.infer<typeof timeBlockStatusSchema>;
export type CreateTimeBlockInput = z.infer<typeof createTimeBlockSchema>;
export type UpdateTimeBlockInput = z.infer<typeof updateTimeBlockSchema>;
export type SchedulingQueryInput = z.infer<typeof schedulingQuerySchema>;
export type SuggestSlotsQueryInput = z.infer<typeof suggestSlotsQuerySchema>;

export interface AvailableSlot {
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
}
