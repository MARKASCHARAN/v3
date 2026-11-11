import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'V3 Personal Management API',
    version: '1.0.0',
    description:
      'API documentation for V3 backend services, goals, tasks, scheduling, memory, and AI planning.',
  },
  servers: [
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Local Development Server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Health check endpoint',
        responses: {
          '200': {
            description: 'Server is operational',
          },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register a new user account',
        responses: {
          '201': { description: 'User registered' },
          '400': { description: 'Validation or registration error' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Sign in with email and password',
        responses: {
          '200': { description: 'Authenticated session returned' },
          '401': { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Refresh an expired access session',
        responses: {
          '200': { description: 'Refreshed session returned' },
          '401': { description: 'Invalid refresh token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Sign out current session',
        responses: {
          '200': { description: 'Logged out successfully' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get authenticated user profile',
        responses: {
          '200': { description: 'User profile retrieved' },
        },
      },
      patch: {
        summary: 'Update authenticated user profile',
        responses: {
          '200': { description: 'User profile updated' },
        },
      },
    },
    '/goals': {
      get: {
        summary: 'Retrieve goals for authenticated user with optional hierarchy/year filters',
        responses: {
          '200': { description: 'List of goals retrieved successfully' },
        },
      },
      post: {
        summary: 'Create a new goal (supports yearly goals and parentGoalId hierarchy)',
        responses: {
          '201': { description: 'Goal created successfully' },
        },
      },
    },
    '/goals/{id}': {
      get: {
        summary: 'Retrieve a single goal by ID with milestones, subGoals, and tasks',
        responses: {
          '200': { description: 'Goal retrieved successfully' },
          '404': { description: 'Goal not found' },
        },
      },
      patch: {
        summary: 'Update a goal by ID',
        responses: {
          '200': { description: 'Goal updated successfully' },
          '404': { description: 'Goal not found' },
        },
      },
      delete: {
        summary: 'Delete a goal by ID',
        responses: {
          '200': { description: 'Goal deleted successfully' },
          '404': { description: 'Goal not found' },
        },
      },
    },
    '/goals/{id}/milestones': {
      post: {
        summary: 'Add a milestone to a goal and recalculate progress',
        responses: {
          '201': { description: 'Milestone created successfully' },
        },
      },
    },
    '/goals/{id}/milestones/{milestoneId}': {
      patch: {
        summary: 'Update or toggle completion of a milestone and recalculate progress',
        responses: {
          '200': { description: 'Milestone updated successfully' },
        },
      },
      delete: {
        summary: 'Delete a milestone and recalculate progress',
        responses: {
          '200': { description: 'Milestone deleted successfully' },
        },
      },
    },
    '/planning/generate': {
      post: {
        summary: 'Generate an AI goal decomposition plan with milestones and task suggestions',
        responses: {
          '201': { description: 'AI plan generated and saved as draft' },
          '503': { description: 'AI provider API key not configured' },
        },
      },
    },
    '/planning/plans': {
      get: {
        summary: 'List saved plans for authenticated user',
        responses: {
          '200': { description: 'List of plans retrieved' },
        },
      },
      post: {
        summary: 'Create a custom plan manually',
        responses: {
          '201': { description: 'Plan created' },
        },
      },
    },
    '/planning/plans/{id}': {
      get: {
        summary: 'Get a single plan by ID',
        responses: {
          '200': { description: 'Plan retrieved' },
          '404': { description: 'Plan not found' },
        },
      },
      patch: {
        summary: 'Update a plan',
        responses: {
          '200': { description: 'Plan updated' },
        },
      },
      delete: {
        summary: 'Delete a plan',
        responses: {
          '200': { description: 'Plan deleted' },
        },
      },
    },
    '/planning/plans/{id}/apply': {
      post: {
        summary: 'Apply a draft plan to materialize milestones and tasks',
        responses: {
          '200': { description: 'Plan applied' },
          '409': { description: 'Plan already applied' },
        },
      },
    },
    '/scheduling/blocks': {
      get: {
        summary: 'List calendar time blocks with optional date/category/status filters',
        responses: {
          '200': { description: 'Time blocks retrieved' },
        },
      },
      post: {
        summary: 'Create a scheduled time block with conflict detection',
        responses: {
          '201': { description: 'Time block created' },
          '409': { description: 'Scheduling conflict detected' },
        },
      },
    },
    '/scheduling/blocks/{id}': {
      get: {
        summary: 'Get a single time block by ID',
        responses: {
          '200': { description: 'Time block retrieved' },
        },
      },
      patch: {
        summary: 'Update a time block',
        responses: {
          '200': { description: 'Time block updated' },
        },
      },
      delete: {
        summary: 'Delete a time block',
        responses: {
          '200': { description: 'Time block deleted' },
        },
      },
    },
    '/scheduling/slots': {
      get: {
        summary: 'Suggest available non-overlapping time slots for a target date',
        responses: {
          '200': { description: 'Available time slots returned' },
        },
      },
    },
    '/tasks': {
      get: {
        summary: 'Retrieve tasks for authenticated user with status/priority/overdue filters',
        responses: {
          '200': { description: 'List of tasks retrieved successfully' },
        },
      },
      post: {
        summary: 'Create a new task or subtask',
        responses: {
          '201': { description: 'Task created successfully' },
        },
      },
    },
    '/tasks/{id}': {
      get: {
        summary: 'Retrieve a single task with subtasks by ID',
        responses: {
          '200': { description: 'Task retrieved successfully' },
          '404': { description: 'Task not found' },
        },
      },
      patch: {
        summary: 'Update a task, status, priority, deadline, or relations',
        responses: {
          '200': { description: 'Task updated successfully' },
          '404': { description: 'Task not found' },
        },
      },
      delete: {
        summary: 'Delete a task by ID',
        responses: {
          '200': { description: 'Task deleted successfully' },
          '404': { description: 'Task not found' },
        },
      },
    },
    '/accountability/summary': {
      get: {
        summary: 'Retrieve overall task, goal, reminder, and alert progress summary',
        responses: {
          '200': { description: 'Progress summary returned' },
        },
      },
    },
    '/accountability/missed-tasks': {
      get: {
        summary: 'List overdue/missed tasks',
        responses: {
          '200': { description: 'Missed tasks returned' },
        },
      },
    },
    '/accountability/missed-tasks/scan': {
      post: {
        summary: 'Detect missed tasks and record non-duplicate accountability logs',
        responses: {
          '200': { description: 'Scan completed' },
        },
      },
    },
    '/accountability/reminders': {
      get: {
        summary: 'List reminders',
        responses: {
          '200': { description: 'Reminders returned' },
        },
      },
      post: {
        summary: 'Create a scheduled reminder',
        responses: {
          '201': { description: 'Reminder created' },
        },
      },
    },
    '/accountability/reminders/{id}': {
      patch: {
        summary: 'Update reminder status or schedule',
        responses: {
          '200': { description: 'Reminder updated' },
        },
      },
      delete: {
        summary: 'Delete a reminder',
        responses: {
          '200': { description: 'Reminder deleted' },
        },
      },
    },
    '/accountability/logs': {
      get: {
        summary: 'List accountability check-in and missed-task logs',
        responses: {
          '200': { description: 'Logs returned' },
        },
      },
      post: {
        summary: 'Create a manual accountability check-in log',
        responses: {
          '201': { description: 'Log created' },
        },
      },
    },
    '/accountability/logs/{id}': {
      patch: {
        summary: 'Acknowledge or resolve an accountability log',
        responses: {
          '200': { description: 'Log updated' },
        },
      },
    },
    '/memory': {
      get: {
        summary: 'Retrieve and search user memory entries by category, tag, or query',
        responses: {
          '200': { description: 'Memories retrieved' },
        },
      },
      post: {
        summary: 'Store a memory item or project context note',
        responses: {
          '201': { description: 'Memory created' },
        },
      },
    },
    '/memory/{id}': {
      get: {
        summary: 'Get a single memory entry',
        responses: {
          '200': { description: 'Memory retrieved' },
        },
      },
      patch: {
        summary: 'Update a memory entry',
        responses: {
          '200': { description: 'Memory updated' },
        },
      },
      delete: {
        summary: 'Delete a memory entry',
        responses: {
          '200': { description: 'Memory deleted' },
        },
      },
    },
    '/memory/context': {
      get: {
        summary: 'Retrieve combined preferences, memories, and recent conversation history',
        responses: {
          '200': { description: 'Context bundle returned' },
        },
      },
    },
    '/memory/preferences': {
      get: {
        summary: 'List user preferences',
        responses: {
          '200': { description: 'Preferences returned' },
        },
      },
      put: {
        summary: 'Upsert a user preference key-value pair',
        responses: {
          '200': { description: 'Preference upserted' },
        },
      },
    },
    '/memory/preferences/{key}': {
      delete: {
        summary: 'Delete a user preference by key',
        responses: {
          '200': { description: 'Preference deleted' },
        },
      },
    },
    '/memory/conversations': {
      get: {
        summary: 'Retrieve conversation history for a session',
        responses: {
          '200': { description: 'Conversation messages returned' },
        },
      },
      post: {
        summary: 'Append a conversation message',
        responses: {
          '201': { description: 'Message recorded' },
        },
      },
      delete: {
        summary: 'Clear conversation history for a session',
        responses: {
          '200': { description: 'Conversation history cleared' },
        },
      },
    },
  },
};

export const setupSwagger = (app: Express): void => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
