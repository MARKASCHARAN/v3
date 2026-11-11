import { z } from 'zod';

export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required').max(200),
  description: z.string().trim().max(4000).optional(),
  priority: taskPrioritySchema.default('MEDIUM'),
  status: taskStatusSchema.default('TODO'),
  dueDate: z.coerce.date().optional(),
  goalId: z.string().uuid('Invalid goal ID').optional(),
  milestoneId: z.string().uuid('Invalid milestone ID').optional(),
  parentTaskId: z.string().uuid('Invalid parent task ID').optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Task title cannot be empty').max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  goalId: z.string().uuid('Invalid goal ID').nullable().optional(),
  milestoneId: z.string().uuid('Invalid milestone ID').nullable().optional(),
  parentTaskId: z.string().uuid('Invalid parent task ID').nullable().optional(),
});

export const tasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  goalId: z.string().uuid().optional(),
  milestoneId: z.string().uuid().optional(),
  parentTaskId: z.union([z.literal('null'), z.string().uuid()]).optional(),
  overdue: z.enum(['true', 'false']).optional(),
});

export const taskIdParamSchema = z.object({
  id: z.string().uuid('Invalid task ID'),
});
