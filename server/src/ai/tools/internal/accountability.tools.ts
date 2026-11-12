import { z } from 'zod';
import { AccountabilityService } from '../../../modules/accountability/accountability.service';
import { V3ToolContract } from '../tool.types';

const accountabilityService = new AccountabilityService();

const emptyArgsSchema = z.object({});
const recordOutputSchema = z.record(z.string(), z.unknown());

export const ACCOUNTABILITY_TOOLS: V3ToolContract[] = [
  {
    name: 'getAccountabilitySummary',
    domain: 'accountability',
    description: 'Get task completion rate, goal progress, overdue tasks, and pending reminders.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: emptyArgsSchema,
    outputSchema: recordOutputSchema,
    execute: (ctx) => accountabilityService.getProgressSummary(ctx.userId),
  } as V3ToolContract,
  {
    name: 'analyzeProcrastination',
    domain: 'accountability',
    description: 'Analyze procrastination signals, stale tasks, and overdue risk score.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: emptyArgsSchema,
    outputSchema: recordOutputSchema,
    execute: (ctx) => accountabilityService.analyzeProcrastination(ctx.userId),
  } as V3ToolContract,
];

