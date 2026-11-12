import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { MessageContent } from '@langchain/core/messages';
import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export type GeminiBoundTool = Parameters<ChatGoogleGenerativeAI['bindTools']>[0][number];

export type AiProviderName = 'google';

export type ModelTaskTier =
  | 'ORCHESTRATION'
  | 'PLANNING'
  | 'RESEARCH'
  | 'CLASSIFICATION'
  | 'EXTRACTION'
  | 'CODE_ANALYSIS'
  | 'EMBEDDING';

export interface ChatModelResolutionOptions {
  provider?: AiProviderName;
  modelId?: string;
  tier?: ModelTaskTier;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface ChatModelDescriptor {
  provider: AiProviderName;
  modelId: string;
  tier: ModelTaskTier;
  model: ChatGoogleGenerativeAI;
}

export const MODEL_BY_TIER: Record<ModelTaskTier, string> = {
  ORCHESTRATION: 'gemini-2.5-flash',
  PLANNING: 'gemini-2.5-flash',
  RESEARCH: 'gemini-2.5-flash',
  CLASSIFICATION: 'gemini-2.5-flash-lite',
  EXTRACTION: 'gemini-2.5-flash',
  CODE_ANALYSIS: 'gemini-2.5-pro',
  EMBEDDING: 'gemini-embedding-001',
};

export const requireGeminiApiKey = (): string => {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      503,
      'GEMINI_API_KEY is not configured for AI workflows',
      'AI_PROVIDER_UNCONFIGURED'
    );
  }
  return env.GEMINI_API_KEY;
};

export const resolveChatModel = (options: ChatModelResolutionOptions = {}): ChatModelDescriptor => {
  const provider: AiProviderName = options.provider ?? 'google';
  const tier: ModelTaskTier = options.tier ?? 'ORCHESTRATION';
  const modelId = options.modelId ?? MODEL_BY_TIER[tier];

  if (provider === 'google') {
    const apiKey = requireGeminiApiKey();
    const model = new ChatGoogleGenerativeAI({
      model: modelId,
      apiKey,
      maxRetries: 0,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxOutputTokens !== undefined
        ? { maxOutputTokens: options.maxOutputTokens }
        : {}),
    });

    return {
      provider,
      modelId,
      tier,
      model,
    };
  }

  throw new AppError(400, `Unsupported AI provider: ${provider}`, 'UNSUPPORTED_AI_PROVIDER');
};

export const getDefaultChatModel = (): ChatModelDescriptor =>
  resolveChatModel({ tier: 'ORCHESTRATION' });

export const getChatModelForTier = (
  tier: ModelTaskTier,
  options: Omit<ChatModelResolutionOptions, 'tier'> = {}
): ChatModelDescriptor => resolveChatModel({ ...options, tier });

export const createGoogleSearchTool = (): GeminiBoundTool =>
  ({ googleSearch: {} }) as unknown as GeminiBoundTool;

export const extractTextContent = (content: MessageContent): string => {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((block) => {
      if (typeof block === 'string') {
        return block;
      }
      if (
        block &&
        typeof block === 'object' &&
        'type' in block &&
        block.type === 'text' &&
        'text' in block &&
        typeof block.text === 'string'
      ) {
        return block.text;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
};
