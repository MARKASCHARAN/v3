import {
  GoogleGenerativeAIEmbeddings,
  GoogleGenerativeAIEmbeddingsParams,
} from '@langchain/google-genai';
import { aiConfig } from '../../config/ai.config';
import { AppError } from '../../middleware/error.middleware';
import { withAiRetry } from '../workflows/retry.workflow';
import { AiProviderName, MODEL_BY_TIER, requireGeminiApiKey } from './model-router';

export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export interface EmbeddingResolutionOptions {
  provider?: AiProviderName;
  modelId?: string;
  taskType?: EmbeddingTaskType;
}

export interface EmbeddingModelDescriptor {
  provider: AiProviderName;
  modelId: string;
  dimensions: number;
  model: GoogleGenerativeAIEmbeddings;
}

export const DEFAULT_EMBEDDING_DIMENSIONS = aiConfig.embeddingDimensions;
export const DEFAULT_EMBEDDING_MODEL = MODEL_BY_TIER.EMBEDDING;

export const resolveEmbeddingModel = (
  options: EmbeddingResolutionOptions = {}
): EmbeddingModelDescriptor => {
  const provider: AiProviderName = options.provider ?? 'google';
  const modelId = options.modelId ?? DEFAULT_EMBEDDING_MODEL;

  if (provider === 'google') {
    const apiKey = requireGeminiApiKey();
    const taskType = (options.taskType ?? 'RETRIEVAL_DOCUMENT') as NonNullable<
      GoogleGenerativeAIEmbeddingsParams['taskType']
    >;

    const model = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: modelId,
      taskType,
      outputDimensionality: DEFAULT_EMBEDDING_DIMENSIONS,
    });

    return {
      provider,
      modelId,
      dimensions: DEFAULT_EMBEDDING_DIMENSIONS,
      model,
    };
  }

  throw new AppError(400, `Unsupported AI provider: ${provider}`, 'UNSUPPORTED_AI_PROVIDER');
};

export const generateTextEmbedding = async (
  value: string,
  taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> => {
  const descriptor = resolveEmbeddingModel({ taskType });
  const { result } = await withAiRetry(() => descriptor.model.embedQuery(value));
  return result;
};

export const generateBatchEmbeddings = async (
  values: string[],
  taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT'
): Promise<number[][]> => {
  if (values.length === 0) {
    return [];
  }
  const descriptor = resolveEmbeddingModel({ taskType });
  const { result } = await withAiRetry(() => descriptor.model.embedDocuments(values));
  return result;
};
