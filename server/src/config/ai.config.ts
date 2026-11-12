import { env } from './env';

const isLangSmithEnabled =
  env.LANGSMITH_TRACING === 'true' && Boolean(env.LANGSMITH_API_KEY?.trim());

export const aiConfig = {
  defaultProvider: 'google' as const,
  langgraphSchema: 'langgraph',
  defaultTokenBudget: 60000,
  defaultMaxIterations: 8,
  defaultApprovalTtlMs: 24 * 60 * 60 * 1000,
  embeddingDimensions: 768,
  langsmith: {
    enabled: isLangSmithEnabled,
    apiKey: env.LANGSMITH_API_KEY,
    project: env.LANGSMITH_PROJECT,
    endpoint: env.LANGSMITH_ENDPOINT,
  },
};

export const configureLangSmithRuntime = (): boolean => {
  if (aiConfig.langsmith.enabled) {
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    process.env.LANGSMITH_TRACING = 'true';
    process.env.LANGSMITH_PROJECT = aiConfig.langsmith.project;
    process.env.LANGSMITH_ENDPOINT = aiConfig.langsmith.endpoint;
    return true;
  }

  process.env.LANGCHAIN_TRACING_V2 = 'false';
  process.env.LANGSMITH_TRACING = 'false';
  return false;
};
