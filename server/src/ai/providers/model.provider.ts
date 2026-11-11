import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel } from 'ai';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface ModelDescriptor {
  provider: string;
  modelId: string;
  model: LanguageModel;
}

export const getDefaultLanguageModel = (): ModelDescriptor => {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      503,
      'GEMINI_API_KEY is not configured for AI planning',
      'AI_PROVIDER_UNCONFIGURED'
    );
  }

  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const modelId = 'gemini-2.5-flash';

  return {
    provider: 'google',
    modelId,
    model: google(modelId),
  };
};
