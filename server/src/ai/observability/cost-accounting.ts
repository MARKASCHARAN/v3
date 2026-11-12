import { aiConfig } from '../../config/ai.config';

export interface ModelPricingRate {
  inputMicroUsdPerMillionTokens: number;
  outputMicroUsdPerMillionTokens: number;
}

const GEMINI_MODEL_RATES: Record<string, ModelPricingRate> = {
  'gemini-2.5-flash': {
    inputMicroUsdPerMillionTokens: 150_000,
    outputMicroUsdPerMillionTokens: 600_000,
  },
  'gemini-2.5-flash-lite': {
    inputMicroUsdPerMillionTokens: 75_000,
    outputMicroUsdPerMillionTokens: 300_000,
  },
  'gemini-2.5-pro': {
    inputMicroUsdPerMillionTokens: 1_250_000,
    outputMicroUsdPerMillionTokens: 5_000_000,
  },
  'gemini-embedding-001': {
    inputMicroUsdPerMillionTokens: 150_000,
    outputMicroUsdPerMillionTokens: 150_000,
  },
};

const DEFAULT_RATE: ModelPricingRate = {
  inputMicroUsdPerMillionTokens: 150_000,
  outputMicroUsdPerMillionTokens: 600_000,
};

export const estimateModelCostMicroUsd = (params: {
  modelId?: string | null;
  tokensUsed: number;
  inputTokens?: number;
  outputTokens?: number;
}): number => {
  if (params.tokensUsed <= 0 && (params.inputTokens ?? 0) <= 0 && (params.outputTokens ?? 0) <= 0) {
    return 0;
  }

  const normalizedModel = (params.modelId ?? 'gemini-2.5-flash').toLowerCase();
  const rate =
    GEMINI_MODEL_RATES[normalizedModel] ??
    Object.entries(GEMINI_MODEL_RATES).find(([prefix]) => normalizedModel.includes(prefix))?.[1] ??
    DEFAULT_RATE;

  if (params.inputTokens !== undefined && params.outputTokens !== undefined) {
    const rawMicro =
      (params.inputTokens * rate.inputMicroUsdPerMillionTokens +
        params.outputTokens * rate.outputMicroUsdPerMillionTokens) /
      1_000_000;
    return Math.max(1, Math.round(rawMicro));
  }

  const estimatedInput = Math.round(params.tokensUsed * 0.75);
  const estimatedOutput = Math.max(0, params.tokensUsed - estimatedInput);
  const rawMicro =
    (estimatedInput * rate.inputMicroUsdPerMillionTokens +
      estimatedOutput * rate.outputMicroUsdPerMillionTokens) /
    1_000_000;
  return Math.max(1, Math.round(rawMicro));
};

export const buildLangSmithTraceUrl = (
  traceId?: string | null,
  project: string = aiConfig.langsmith.project
): string | null => {
  if (!traceId || traceId.trim().length === 0) {
    return null;
  }

  const baseHost = aiConfig.langsmith.endpoint.includes('eu.')
    ? 'https://eu.smith.langchain.com'
    : 'https://smith.langchain.com';

  return `${baseHost}/public/${encodeURIComponent(project)}/r/${encodeURIComponent(traceId)}`;
};
