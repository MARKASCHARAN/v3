import { env } from '../../config/env';
import { AppError } from '../../middleware/error.middleware';

export interface BhashiniAsrInput {
  audioBase64: string;
  sourceLanguage: string;
  audioFormat?: 'wav' | 'mp3' | 'flac' | 'webm';
}

export interface BhashiniAsrResult {
  transcript: string;
  sourceLanguage: string;
}

export interface BhashiniTranslationInput {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface BhashiniTranslationResult {
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface BhashiniTtsInput {
  text: string;
  languageCode: string;
  gender?: 'male' | 'female';
}

export interface BhashiniTtsResult {
  audioBase64: string;
  audioFormat: string;
  languageCode: string;
}

export interface BhashiniAdapter {
  isConfigured(): boolean;
  transcribe(input: BhashiniAsrInput, apiKeyOverride?: string): Promise<BhashiniAsrResult>;
  translate(
    input: BhashiniTranslationInput,
    apiKeyOverride?: string
  ): Promise<BhashiniTranslationResult>;
  synthesizeSpeech(input: BhashiniTtsInput, apiKeyOverride?: string): Promise<BhashiniTtsResult>;
}

const BHASHINI_INFERENCE_ENDPOINT =
  'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

export class HttpBhashiniAdapter implements BhashiniAdapter {
  constructor(
    private readonly defaultInferenceKey: string | undefined = env.BHASHINI_INFERENCE_KEY,
    private readonly defaultUdyatKey: string | undefined = env.BHASHINI_UDYAT_KEY
  ) {}

  isConfigured(): boolean {
    return Boolean(
      (this.defaultInferenceKey && this.defaultInferenceKey.trim().length > 0) ||
      (this.defaultUdyatKey && this.defaultUdyatKey.trim().length > 0)
    );
  }

  private resolveAuthKey(apiKeyOverride?: string): string {
    const key = apiKeyOverride ?? this.defaultInferenceKey ?? this.defaultUdyatKey;
    if (!key) {
      throw new AppError(
        503,
        'Bhashini integration is not configured (missing BHASHINI_INFERENCE_KEY)',
        'BHASHINI_NOT_CONFIGURED'
      );
    }
    return key;
  }

  private async postInference(body: Record<string, unknown>, apiKeyOverride?: string) {
    const authKey = this.resolveAuthKey(apiKeyOverride);
    const response = await fetch(BHASHINI_INFERENCE_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(
        502,
        `Bhashini inference error (${response.status}): ${errorText.slice(0, 300)}`,
        'BHASHINI_INFERENCE_FAILED'
      );
    }

    return (await response.json()) as {
      pipelineResponse?: Array<{
        taskType?: string;
        output?: Array<{ source?: string; target?: string }>;
        audio?: Array<{ audioContent?: string }>;
      }>;
    };
  }

  async transcribe(input: BhashiniAsrInput, apiKeyOverride?: string): Promise<BhashiniAsrResult> {
    const data = await this.postInference(
      {
        pipelineTasks: [
          {
            taskType: 'asr',
            config: {
              language: { sourceLanguage: input.sourceLanguage },
              audioFormat: input.audioFormat ?? 'wav',
              samplingRate: 16000,
            },
          },
        ],
        inputData: {
          audio: [{ audioContent: input.audioBase64 }],
        },
      },
      apiKeyOverride
    );

    const transcript = data.pipelineResponse?.[0]?.output?.[0]?.source ?? '';
    return {
      transcript,
      sourceLanguage: input.sourceLanguage,
    };
  }

  async translate(
    input: BhashiniTranslationInput,
    apiKeyOverride?: string
  ): Promise<BhashiniTranslationResult> {
    if (input.sourceLanguage === input.targetLanguage) {
      return {
        translatedText: input.text,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      };
    }

    const data = await this.postInference(
      {
        pipelineTasks: [
          {
            taskType: 'translation',
            config: {
              language: {
                sourceLanguage: input.sourceLanguage,
                targetLanguage: input.targetLanguage,
              },
            },
          },
        ],
        inputData: {
          input: [{ source: input.text }],
        },
      },
      apiKeyOverride
    );

    const translatedText = data.pipelineResponse?.[0]?.output?.[0]?.target ?? '';
    return {
      translatedText,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    };
  }

  async synthesizeSpeech(
    input: BhashiniTtsInput,
    apiKeyOverride?: string
  ): Promise<BhashiniTtsResult> {
    const data = await this.postInference(
      {
        pipelineTasks: [
          {
            taskType: 'tts',
            config: {
              language: { sourceLanguage: input.languageCode },
              gender: input.gender ?? 'female',
              samplingRate: 22050,
            },
          },
        ],
        inputData: {
          input: [{ source: input.text }],
        },
      },
      apiKeyOverride
    );

    const audioBase64 = data.pipelineResponse?.[0]?.audio?.[0]?.audioContent ?? '';
    return {
      audioBase64,
      audioFormat: 'wav',
      languageCode: input.languageCode,
    };
  }
}
