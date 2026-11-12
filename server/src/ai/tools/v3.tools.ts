import { ToolSet, tool } from 'ai';
import { z } from 'zod';
import { AppError } from '../../middleware/error.middleware';
import { AccountabilityService } from '../../modules/accountability/accountability.service';
import { GoalsService } from '../../modules/goals/goals.service';
import { createGoalSchema, goalsQuerySchema } from '../../modules/goals/goals.schema';
import { MemoryService } from '../../modules/memory/memory.service';
import {
  createMemorySchema,
  memoryQuerySchema,
  semanticSearchQuerySchema,
} from '../../modules/memory/memory.schema';
import { ResearchService } from '../../modules/research/research.service';
import { conductResearchSchema } from '../../modules/research/research.schema';
import { SchedulingService } from '../../modules/scheduling/scheduling.service';
import {
  createTimeBlockSchema,
  schedulingQuerySchema,
} from '../../modules/scheduling/scheduling.schema';
import { TasksService } from '../../modules/tasks/tasks.service';
import {
  createTaskSchema,
  taskStatusSchema,
  tasksQuerySchema,
} from '../../modules/tasks/tasks.schema';
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

export const V3_TOOL_REGISTRY: Record<string, V3ToolDefinition<z.ZodType>> = {
  listGoals: defineTool({
    description: 'List user goals with optional timeframe, targetYear, or status filters.',
    policy: 'AUTO_EXECUTE',
    inputSchema: goalsQuerySchema,
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
    execute: (userId, args) => memoryService.getMemories(userId, args),
  }),
  semanticSearchMemory: defineTool({
    description: 'Semantically search long-term memories using pgvector similarity.',
    policy: 'AUTO_EXECUTE',
    inputSchema: semanticSearchQuerySchema,
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
    execute: (userId, args) => goalsService.createGoal(userId, args),
  }),
  createTask: defineTool({
    description: 'Create a new task or subtask with priority and optional deadline.',
    policy: 'REQUIRE_APPROVAL',
    inputSchema: createTaskSchema,
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

export const buildAiSdkToolSet = (params: {
  userId: string;
  allowAutoApproveWrites: boolean;
  onPendingApproval: (request: PendingToolApprovalRequest) => Promise<string>;
}): ToolSet => {
  const tools: ToolSet = {};

  for (const [toolName, definition] of Object.entries(V3_TOOL_REGISTRY)) {
    tools[toolName] = tool({
      description: definition.description,
      inputSchema: definition.inputSchema,
      execute: async (rawArgs) => {
        const parsedArgs = definition.inputSchema.parse(rawArgs);

        if (definition.policy === 'REQUIRE_APPROVAL' && !params.allowAutoApproveWrites) {
          const approvalId = await params.onPendingApproval({
            toolName,
            toolArgs: parsedArgs as Record<string, unknown>,
          });
          return {
            status: 'APPROVAL_REQUIRED',
            approvalId,
            toolName,
            message: `Action "${toolName}" requires human approval before execution.`,
          };
        }

        const result = await definition.execute(params.userId, parsedArgs);
        return {
          status: 'EXECUTED',
          toolName,
          data: result,
        };
      },
    });
  }

  return tools;
};
