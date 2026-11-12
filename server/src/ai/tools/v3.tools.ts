import { StructuredToolInterface, tool } from '@langchain/core/tools';
import { z } from 'zod';
import { AppError } from '../../middleware/error.middleware';
import { AccountabilityService } from '../../modules/accountability/accountability.service';
import {
  createGoalSchema,
  goalStatusSchema,
  goalTimeframeSchema,
  goalsQuerySchema,
} from '../../modules/goals/goals.schema';
import { GoalsService } from '../../modules/goals/goals.service';
import {
  createMemorySchema,
  memoryCategorySchema,
  memoryQuerySchema,
  semanticSearchQuerySchema,
} from '../../modules/memory/memory.schema';
import { MemoryService } from '../../modules/memory/memory.service';
import { ResearchService } from '../../modules/research/research.service';
import { conductResearchSchema } from '../../modules/research/research.schema';
import {
  createTimeBlockSchema,
  schedulingQuerySchema,
  timeBlockCategorySchema,
  timeBlockStatusSchema,
} from '../../modules/scheduling/scheduling.schema';
import { SchedulingService } from '../../modules/scheduling/scheduling.service';
import {
  createTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  tasksQuerySchema,
} from '../../modules/tasks/tasks.schema';
import { TasksService } from '../../modules/tasks/tasks.service';
import { PendingToolApprovalRequest, V3ToolDefinition } from './tool.types';

const goalsService = new GoalsService();
const tasksService = new TasksService();
const schedulingService = new SchedulingService();
const accountabilityService = new AccountabilityService();
const memoryService = new MemoryService();
const researchService = new ResearchService();

const defineTool = <TSchema extends z.ZodType>(
  definition: V3ToolDefinition<TSchema>
): V3ToolDefinition<z.ZodType> => definition as V3ToolDefinition<z.ZodType>;

const updateTaskStatusArgsSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  status: taskStatusSchema,
});

const emptyArgsSchema = z.object({});

const getScheduleToolSchema = z.object({
  from: z.string().describe('ISO 8601 start datetime filter').optional(),
  to: z.string().describe('ISO 8601 end datetime filter').optional(),
  category: timeBlockCategorySchema.optional(),
  status: timeBlockStatusSchema.optional(),
  taskId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
});

const createGoalToolSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(1).max(100).default('GENERAL'),
  timeframe: goalTimeframeSchema.default('YEARLY'),
  targetYear: z.number().int().min(2000).max(2100).optional(),
  parentGoalId: z.string().uuid().optional(),
  targetDate: z.string().describe('ISO 8601 target datetime').optional(),
  status: goalStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

const createTaskToolSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional(),
  priority: taskPrioritySchema.default('MEDIUM'),
  status: taskStatusSchema.default('TODO'),
  dueDate: z.string().describe('ISO 8601 due datetime').optional(),
  goalId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
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

const listGoalsToolSchema = z.object({
  timeframe: goalTimeframeSchema.optional(),
  targetYear: z.number().int().min(2000).max(2100).optional(),
  status: goalStatusSchema.optional(),
  parentGoalId: z.string().optional(),
});

const searchMemoryToolSchema = z.object({
  category: memoryCategorySchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

const semanticSearchMemoryToolSchema = z.object({
  q: z.string().trim().min(1).max(1000),
  category: memoryCategorySchema.optional(),
  limit: z.number().int().min(1).max(50).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.3),
});

export const V3_TOOL_REGISTRY: Record<string, V3ToolDefinition<z.ZodType>> = {
  listGoals: defineTool({
    description: 'List user goals with optional timeframe, targetYear, or status filters.',
    policy: 'AUTO_EXECUTE',
    inputSchema: goalsQuerySchema,
    toolSchema: listGoalsToolSchema,
    execute: (userId, args) => goalsService.getGoals(userId, args),
  }),
  listTasks: defineTool({
    description: 'List user tasks with optional status, priority, goalId, or overdue filters.',
    policy: 'AUTO_EXECUTE',
    inputSchema: tasksQuerySchema,
    execute: (userId, args) => tasksService.getTasks(userId, args),
  }),
  getSchedule: defineTool({
    description: 'Retrieve user calendar time blocks within an optional date range.',
    policy: 'AUTO_EXECUTE',
    inputSchema: schedulingQuerySchema,
    toolSchema: getScheduleToolSchema,
    execute: (userId, args) => schedulingService.getTimeBlocks(userId, args),
  }),
  getAccountabilitySummary: defineTool({
    description: 'Get task completion rate, goal progress, overdue tasks, and pending reminders.',
    policy: 'AUTO_EXECUTE',
    inputSchema: emptyArgsSchema,
    execute: (userId) => accountabilityService.getProgressSummary(userId),
  }),
  searchMemory: defineTool({
    description: 'Search stored memories and project context notes by query or category.',
    policy: 'AUTO_EXECUTE',
    inputSchema: memoryQuerySchema,
    toolSchema: searchMemoryToolSchema,
    execute: (userId, args) => memoryService.getMemories(userId, args),
  }),
  semanticSearchMemory: defineTool({
    description: 'Semantically search long-term memories using pgvector similarity.',
    policy: 'AUTO_EXECUTE',
    inputSchema: semanticSearchQuerySchema,
    toolSchema: semanticSearchMemoryToolSchema,
    execute: (userId, args) => memoryService.semanticSearch(userId, args),
  }),
  analyzeProcrastination: defineTool({
    description: 'Analyze procrastination signals, stale tasks, and overdue risk score.',
    policy: 'AUTO_EXECUTE',
    inputSchema: emptyArgsSchema,
    execute: (userId) => accountabilityService.analyzeProcrastination(userId),
  }),
  webResearch: defineTool({
    description: 'Conduct grounded web research and summarize findings for a query.',
    policy: 'AUTO_EXECUTE',
    inputSchema: conductResearchSchema,
    execute: (userId, args) => researchService.conductResearch(userId, args),
  }),
  createGoal: defineTool({
    description: 'Create a new personal or yearly goal for the user.',
    policy: 'REQUIRE_APPROVAL',
    inputSchema: createGoalSchema,
    toolSchema: createGoalToolSchema,
    execute: (userId, args) => goalsService.createGoal(userId, args),
  }),
  createTask: defineTool({
    description: 'Create a new task or subtask with priority and optional deadline.',
    policy: 'REQUIRE_APPROVAL',
    inputSchema: createTaskSchema,
    toolSchema: createTaskToolSchema,
    execute: (userId, args) => tasksService.createTask(userId, args),
  }),
  updateTaskStatus: defineTool({
    description: 'Update the status of an existing task by ID.',
    policy: 'REQUIRE_APPROVAL',
    inputSchema: updateTaskStatusArgsSchema,
    execute: (userId, args) =>
      tasksService.updateTask(args.taskId, userId, { status: args.status }),
  }),
  createTimeBlock: defineTool({
    description: 'Schedule a calendar time block for focused work or an event.',
    policy: 'REQUIRE_APPROVAL',
    inputSchema: createTimeBlockSchema,
    toolSchema: createTimeBlockToolSchema,
    execute: (userId, args) => schedulingService.createTimeBlock(userId, args),
  }),
  saveMemory: defineTool({
    description: 'Persist a memory or project context note for future personalization.',
    policy: 'REQUIRE_APPROVAL',
    inputSchema: createMemorySchema,
    execute: (userId, args) => memoryService.createMemory(userId, args),
  }),
};

export const getRegisteredTool = (toolName: string): V3ToolDefinition<z.ZodType> => {
  const entry = V3_TOOL_REGISTRY[toolName];
  if (!entry) {
    throw new AppError(400, `Unknown AI tool: ${toolName}`, 'UNKNOWN_TOOL');
  }
  return entry;
};

export const executeRegisteredTool = async (
  toolName: string,
  rawArgs: unknown,
  userId: string
): Promise<unknown> => {
  const entry = getRegisteredTool(toolName);
  const parsedArgs = entry.inputSchema.parse(rawArgs);
  return entry.execute(userId, parsedArgs);
};

export const buildLangChainTools = (params: {
  userId: string;
  allowAutoApproveWrites: boolean;
  onPendingApproval: (request: PendingToolApprovalRequest) => Promise<string>;
}): StructuredToolInterface[] => {
  const tools: StructuredToolInterface[] = [];

  for (const [toolName, definition] of Object.entries(V3_TOOL_REGISTRY)) {
    const schema = definition.toolSchema ?? definition.inputSchema;
    const lcTool = tool(
      async (rawArgs) => {
        const parsedArgs = definition.inputSchema.parse(rawArgs);

        if (definition.policy === 'REQUIRE_APPROVAL' && !params.allowAutoApproveWrites) {
          const approvalId = await params.onPendingApproval({
            toolName,
            toolArgs: parsedArgs as Record<string, unknown>,
          });
          return JSON.stringify({
            status: 'APPROVAL_REQUIRED',
            approvalId,
            toolName,
            message: `Action "${toolName}" requires human approval before execution.`,
          });
        }

        const result = await definition.execute(params.userId, parsedArgs);
        return JSON.stringify({
          status: 'EXECUTED',
          toolName,
          data: result,
        });
      },
      {
        name: toolName,
        description: definition.description,
        schema: schema as z.ZodObject<z.ZodRawShape>,
      }
    );

    tools.push(lcTool);
  }

  return tools;
};
