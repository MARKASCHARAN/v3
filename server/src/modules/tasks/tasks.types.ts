import { z } from 'zod';
import {
  createTaskSchema,
  taskPrioritySchema,
  taskStatusSchema,
  tasksQuerySchema,
  updateTaskSchema,
} from './tasks.schema';

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TasksQueryInput = z.infer<typeof tasksQuerySchema>;
