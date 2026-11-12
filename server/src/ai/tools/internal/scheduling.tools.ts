import { z } from 'zod';
import {
  createTimeBlockSchema,
  schedulingQuerySchema,
  timeBlockCategorySchema,
  timeBlockStatusSchema,
} from '../../../modules/scheduling/scheduling.schema';
import { SchedulingService } from '../../../modules/scheduling/scheduling.service';
import { V3ToolContract } from '../tool.types';

const schedulingService = new SchedulingService();

const getScheduleToolSchema = z.object({
  from: z.string().describe('ISO 8601 start datetime filter').optional(),
  to: z.string().describe('ISO 8601 end datetime filter').optional(),
  category: timeBlockCategorySchema.optional(),
  status: timeBlockStatusSchema.optional(),
  taskId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
});

const createTimeBlockToolSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  startTime: z.string().describe('ISO 8601 start datetime'),
  endTime: z.string().describe('ISO 8601 end datetime'),
  category: timeBlockCategorySchema.default('WORK'),
  status: timeBlockStatusSchema.default('SCHEDULED'),
  taskId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceRule: z.string().trim().max(200).optional(),
  allowOverlap: z.boolean().default(false),
});

const listBlocksOutputSchema = z.array(z.record(z.string(), z.unknown()));
const createBlockOutputSchema = z.object({ id: z.string() }).catchall(z.unknown());

export const SCHEDULING_TOOLS: V3ToolContract[] = [
  {
    name: 'getSchedule',
    domain: 'scheduling',
    description: 'Retrieve user calendar time blocks within an optional date range.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: schedulingQuerySchema,
    outputSchema: listBlocksOutputSchema,
    toolSchema: getScheduleToolSchema,
    execute: (ctx, input) =>
      schedulingService.getTimeBlocks(ctx.userId, input as z.infer<typeof schedulingQuerySchema>),
  } as V3ToolContract,
  {
    name: 'createTimeBlock',
    domain: 'scheduling',
    description: 'Schedule a calendar time block for focused work or an event.',
    riskLevel: 'INTERNAL_WRITE',
    idempotent: false,
    inputSchema: createTimeBlockSchema,
    outputSchema: createBlockOutputSchema,
    toolSchema: createTimeBlockToolSchema,
    execute: (ctx, input) =>
      schedulingService.createTimeBlock(ctx.userId, input as z.infer<typeof createTimeBlockSchema>),
  } as V3ToolContract,
];

