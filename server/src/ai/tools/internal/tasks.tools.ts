import { z } from 'zod';
import {
  createTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  tasksQuerySchema,
} from '../../../modules/tasks/tasks.schema';
import { TasksService } from '../../../modules/tasks/tasks.service';
import { V3ToolContract } from '../tool.types';

const tasksService = new TasksService();

const listTasksToolSchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  goalId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  parentTaskId: z.string().describe('Parent task UUID or "null" for top-level tasks').optional(),
  overdue: z.enum(['true', 'false']).optional(),
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

const updateTaskStatusArgsSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  status: taskStatusSchema,
});

const listTasksOutputSchema = z.array(z.record(z.string(), z.unknown()));
const taskMutationOutputSchema = z.object({ id: z.string() }).catchall(z.unknown());

export const TASKS_TOOLS: V3ToolContract[] = [
  {
    name: 'listTasks',
    domain: 'tasks',
    description: 'List user tasks with optional status, priority, goalId, or overdue filters.',
    riskLevel: 'READ',
    idempotent: true,
    inputSchema: tasksQuerySchema,
    outputSchema: listTasksOutputSchema,
    toolSchema: listTasksToolSchema,
    execute: (ctx, input) =>
      tasksService.getTasks(ctx.userId, input as z.infer<typeof tasksQuerySchema>),
  } as V3ToolContract,
  {
    name: 'createTask',
    domain: 'tasks',
    description: 'Create a new task or subtask with priority and optional deadline.',
    riskLevel: 'INTERNAL_WRITE',
    idempotent: false,
    inputSchema: createTaskSchema,
    outputSchema: taskMutationOutputSchema,
    toolSchema: createTaskToolSchema,
    execute: (ctx, input) =>
      tasksService.createTask(ctx.userId, input as z.infer<typeof createTaskSchema>),
  } as V3ToolContract,
  {
    name: 'updateTaskStatus',
    domain: 'tasks',
    description: 'Update the status of an existing task by ID.',
    riskLevel: 'INTERNAL_WRITE',
    idempotent: true,
    inputSchema: updateTaskStatusArgsSchema,
    outputSchema: taskMutationOutputSchema,
    execute: (ctx, input) => {
      const args = input as z.infer<typeof updateTaskStatusArgsSchema>;
      return tasksService.updateTask(args.taskId, ctx.userId, { status: args.status });
    },
  } as V3ToolContract,
];
