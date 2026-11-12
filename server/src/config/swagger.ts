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
    '/accountability/procrastination': {
      get: {
        summary: 'Analyze procrastination signals and compute risk score',
        responses: {
          '200': { description: 'Procrastination analysis returned' },
        },
      },
    },
    '/accountability/interventions': {
      post: {
        summary: 'Generate adaptive accountability interventions and optional reminders',
        responses: {
          '200': { description: 'Interventions generated' },
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
    '/memory/semantic': {
      get: {
        summary: 'Semantic memory retrieval via pgvector similarity search',
        responses: {
          '200': { description: 'Semantically matched memories returned' },
        },
      },
    },
    '/memory/hybrid': {
      get: {
        summary: 'Hybrid SQL, full-text keyword, and pgvector RRF memory search',
        responses: {
          '200': { description: 'Hybrid ranked memories and metrics returned' },
        },
      },
    },
    '/memory/propose': {
      post: {
        summary: 'Validate, deduplicate, and propose a candidate memory with supersession tracking',
        responses: {
          '201': { description: 'Candidate memory persisted or superseded existing entry' },
        },
      },
    },
    '/memory/prune': {
      post: {
        summary: 'Prune expired ephemeral memory records',
        responses: {
          '200': { description: 'Expired memories pruned' },
        },
      },
    },
    '/memory/embeddings/backfill': {
      post: {
        summary: 'Generate pgvector embeddings for existing memories missing vectors',
        responses: {
          '200': { description: 'Backfill summary returned' },
        },
      },
    },
    '/memory/personalization': {
      get: {
        summary: 'Retrieve personalized user profile, focus categories, and relevant memories',
        responses: {
          '200': { description: 'Personalization context returned' },
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
    '/automation/tools': {
      get: {
        summary: 'List registered AI tools and permission policies',
        responses: {
          '200': { description: 'Tools list returned' },
        },
      },
    },
    '/automation/run': {
      post: {
        summary: 'Run the central AI orchestrator with multi-step tool calling and approval gating',
        responses: {
          '200': { description: 'AI execution completed or awaiting approval' },
        },
      },
    },
    '/automation/executions': {
      get: {
        summary: 'List AI execution history and step traces',
        responses: {
          '200': { description: 'Executions returned' },
        },
      },
    },
    '/automation/executions/{id}': {
      get: {
        summary: 'Get a single AI execution with approval records',
        responses: {
          '200': { description: 'Execution returned' },
        },
      },
    },
    '/automation/approvals': {
      get: {
        summary: 'List tool execution approval requests',
        responses: {
          '200': { description: 'Approvals returned' },
        },
      },
    },
    '/automation/agents': {
      get: {
        summary: 'List registered specialist AI agents and their scoped permission profiles',
        responses: {
          '200': { description: 'Specialist agents returned' },
        },
      },
    },
    '/automation/metrics': {
      get: {
        summary:
          'Retrieve per-user AI observability metrics (token totals, costMicroUsd, approvals, LangSmith traces)',
        responses: {
          '200': { description: 'Observability metrics returned' },
        },
      },
    },
    '/automation/approvals/{id}/approve': {
      post: {
        summary: 'Approve and execute a pending AI tool call',
        responses: {
          '200': { description: 'Tool executed' },
        },
      },
    },
    '/automation/approvals/{id}/reject': {
      post: {
        summary: 'Reject a pending AI tool call',
        responses: {
          '200': { description: 'Approval rejected' },
        },
      },
    },
    '/research/search': {
      post: {
        summary:
          'Conduct grounded web research, synthesize summary & key findings, and store result',
        responses: {
          '201': { description: 'Research completed and stored' },
        },
      },
    },
    '/research': {
      get: {
        summary: 'Retrieve stored research summaries and knowledge items',
        responses: {
          '200': { description: 'Research items returned' },
        },
      },
      post: {
        summary: 'Save a manual research summary and sources',
        responses: {
          '201': { description: 'Research item created' },
        },
      },
    },
    '/research/{id}': {
      get: {
        summary: 'Get a single research item by ID',
        responses: {
          '200': { description: 'Research item returned' },
        },
      },
      delete: {
        summary: 'Delete a research item by ID',
        responses: {
          '200': { description: 'Research item deleted' },
        },
      },
    },
    '/research/{id}/save-to-memory': {
      post: {
        summary: 'Promote a research item into long-term semantic memory',
        responses: {
          '200': { description: 'Research saved to memory' },
        },
      },
    },
    '/events': {
      get: {
        summary: 'List ingested domain events for the authenticated user',
        responses: {
          '200': { description: 'Domain events returned' },
        },
      },
    },
    '/events/subscriptions': {
      get: {
        summary: 'List registered event subscription routing rules',
        responses: {
          '200': { description: 'Subscription rules returned' },
        },
      },
    },
    '/events/ingest': {
      post: {
        summary: 'Ingest a domain event with idempotency deduplication and background routing',
        responses: {
          '201': { description: 'Domain event ingested and routed' },
          '200': { description: 'Duplicate domain event ignored via idempotency key' },
        },
      },
    },
    '/events/jobs': {
      get: {
        summary: 'List background jobs tracked for the authenticated user',
        responses: {
          '200': { description: 'Background jobs returned' },
        },
      },
    },
    '/events/jobs/trigger': {
      post: {
        summary: 'Dispatch a background autonomy job via Trigger.dev or local worker execution',
        responses: {
          '202': { description: 'Background job queued or executed' },
        },
      },
    },
    '/events/jobs/{id}/retry': {
      post: {
        summary: 'Retry a failed or dead-letter background job',
        responses: {
          '200': { description: 'Background job retried' },
        },
      },
    },
    '/events/recovery/sweep': {
      post: {
        summary:
          'Run stalled-job recovery, approval expiry sweep, and dead-letter transition sweep',
        responses: {
          '200': { description: 'Recovery telemetry returned' },
        },
      },
    },
    '/integrations': {
      get: {
        summary: 'List connected external integrations (credentials redacted)',
        responses: {
          '200': { description: 'Connected integrations returned' },
        },
      },
    },
    '/integrations/connect': {
      post: {
        summary: 'Connect or update an external provider using AES-256-GCM encrypted credentials',
        responses: {
          '201': { description: 'Integration connected' },
        },
      },
    },
    '/integrations/google/calendar/sync': {
      post: {
        summary: 'Sync Google Calendar events and optionally import them as V3 time blocks',
        responses: {
          '200': { description: 'Calendar sync completed' },
        },
      },
    },
    '/integrations/google/gmail/messages': {
      get: {
        summary: 'Read recent Gmail message metadata summaries',
        responses: {
          '200': { description: 'Gmail messages returned' },
        },
      },
    },
    '/integrations/github/repos': {
      get: {
        summary: 'List authenticated user GitHub repositories',
        responses: {
          '200': { description: 'Repositories returned' },
        },
      },
    },
    '/integrations/github/repos/{owner}/{repo}/issues': {
      get: {
        summary: 'List issues for a GitHub repository',
        responses: {
          '200': { description: 'Issues returned' },
        },
      },
    },
    '/integrations/github/repos/{owner}/{repo}/pulls': {
      get: {
        summary: 'List pull requests for a GitHub repository',
        responses: {
          '200': { description: 'Pull requests returned' },
        },
      },
    },
    '/integrations/github/issues': {
      post: {
        summary: 'Create an issue in a GitHub repository',
        responses: {
          '201': { description: 'GitHub issue created' },
        },
      },
    },
    '/integrations/mcp/tools': {
      get: {
        summary: 'List registered MCP servers and permissioned tools',
        responses: {
          '200': { description: 'MCP tools returned' },
        },
      },
    },
    '/integrations/mcp/invoke': {
      post: {
        summary: 'Invoke an MCP tool through the V3 permission guard',
        responses: {
          '200': { description: 'MCP tool executed' },
        },
      },
    },
    '/notifications/preferences': {
      get: {
        summary: 'List per-channel notification preferences (opt-in, quiet hours, frequency caps)',
        responses: {
          '200': { description: 'Preferences returned' },
        },
      },
      put: {
        summary: 'Upsert notification preferences for a channel',
        responses: {
          '200': { description: 'Preference saved' },
        },
      },
    },
    '/notifications/deliveries': {
      get: {
        summary: 'List notification delivery logs and statuses',
        responses: {
          '200': { description: 'Deliveries returned' },
        },
      },
    },
    '/notifications/send': {
      post: {
        summary: 'Dispatch a notification via Resend Email, Telegram, Discord, WhatsApp, or IN_APP',
        responses: {
          '201': { description: 'Notification sent or delivered' },
        },
      },
    },
    '/notifications/deliveries/{id}/retry': {
      post: {
        summary: 'Retry a failed notification delivery',
        responses: {
          '200': { description: 'Retry attempted' },
        },
      },
    },
    '/voice/sessions': {
      get: {
        summary: 'List Bhashini voice and telephony sessions',
        responses: {
          '200': { description: 'Voice sessions returned' },
        },
      },
      post: {
        summary: 'Start a new voice session',
        responses: {
          '201': { description: 'Voice session created' },
        },
      },
    },
    '/voice/transcribe': {
      post: {
        summary: 'Transcribe base64 audio using Bhashini ASR',
        responses: {
          '200': { description: 'Transcript returned' },
        },
      },
    },
    '/voice/translate': {
      post: {
        summary: 'Translate text across languages via Bhashini',
        responses: {
          '200': { description: 'Translated text returned' },
        },
      },
    },
    '/voice/synthesize': {
      post: {
        summary: 'Synthesize speech via Bhashini TTS and archive audio asset to Supabase Storage',
        responses: {
          '200': { description: 'Audio synthesized' },
        },
      },
    },
    '/voice/command': {
      post: {
        summary: 'Execute an end-to-end voice command through V3 AssistantOrchestrator',
        responses: {
          '200': { description: 'Voice command processed' },
        },
      },
    },
    '/voice/telephony/webhook': {
      post: {
        summary: 'Ingest normalized telephony inbound/speech/hangup webhook events',
        responses: {
          '200': { description: 'Telephony directive returned' },
        },
      },
    },
  },
};

export const setupSwagger = (app: Express): void => {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
