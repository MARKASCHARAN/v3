import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { EmbeddingModel, LanguageModel, embed } from 'ai';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';
import { withAiRetry } from '../workflows/retry.workflow';

export type AiProviderName = 'google';

export interface ModelResolutionOptions {
  provider?: AiProviderName;
  modelId?: string;
}

export interface ModelDescriptor {
  provider: AiProviderName;
  modelId: string;
  model: LanguageModel;
}

export interface EmbeddingModelDescriptor {
  provider: AiProviderName;
  modelId: string;
  dimensions: number;
  model: EmbeddingModel;
}

const DEFAULT_MODEL_BY_PROVIDER: Record<AiProviderName, string> = {
  google: 'gemini-2.5-flash',
};

const DEFAULT_EMBEDDING_MODEL_BY_PROVIDER: Record<AiProviderName, string> = {
  google: 'gemini-embedding-001',
};

export const DEFAULT_EMBEDDING_DIMENSIONS = 768;

const createGoogleClient = () => {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      503,
      'GEMINI_API_KEY is not configured for AI workflows',
      'AI_PROVIDER_UNCONFIGURED'
    );
  }
  return createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
};

export const resolveLanguageModel = (options: ModelResolutionOptions = {}): ModelDescriptor => {
  const provider: AiProviderName = options.provider ?? 'google';
  const modelId = options.modelId ?? DEFAULT_MODEL_BY_PROVIDER[provider];

  if (provider === 'google') {
    const google = createGoogleClient();
    return {
      provider,
      modelId,
      model: google(modelId),
    };
  }

  throw new AppError(400, `Unsupported AI provider: ${provider}`, 'UNSUPPORTED_AI_PROVIDER');
};

export const resolveEmbeddingModel = (
  options: ModelResolutionOptions = {}
): EmbeddingModelDescriptor => {
  const provider: AiProviderName = options.provider ?? 'google';
  const modelId = options.modelId ?? DEFAULT_EMBEDDING_MODEL_BY_PROVIDER[provider];

  if (provider === 'google') {
    const google = createGoogleClient();
    return {
      provider,
      modelId,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      model: google.embedding(modelId),
    };
  }

  throw new AppError(400, `Unsupported AI provider: ${provider}`, 'UNSUPPORTED_AI_PROVIDER');
};

export const generateTextEmbedding = async (
  value: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> => {
  const descriptor = resolveEmbeddingModel();
  const { result } = await withAiRetry(() =>
    embed({
      model: descriptor.model,
      value,
      providerOptions: {
        google: {
          outputDimensionality: descriptor.dimensions,
          taskType,
        },
      },
    })
  );
  return result.embedding;
};

export const createGoogleSearchTool = () => {
  const google = createGoogleClient();
  return google.tools.googleSearch({});
};

export const getDefaultLanguageModel = (): ModelDescriptor => resolveLanguageModel();
