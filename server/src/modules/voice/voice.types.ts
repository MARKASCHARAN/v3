export type VoiceSessionStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface VoiceSessionRecord {
  id: string;
  userId: string;
  executionId: string | null;
  languageCode: string;
  asrTranscript: string | null;
  translatedText: string | null;
  ttsAudioKey: string | null;
  duration: number | null;
  callMetadata: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StartVoiceSessionInput {
  languageCode: string;
  executionId?: string;
  callMetadata?: Record<string, unknown>;
}

export interface ProcessVoicePipelineInput {
  sessionId?: string;
  audioBase64?: string;
  audioFormat?: 'wav' | 'mp3' | 'flac' | 'webm';
  transcriptText?: string;
  sourceLanguage: string;
  targetLanguage?: string;
  executeCommand?: boolean;
  synthesizeReply?: boolean;
  voiceGender?: 'male' | 'female';
}

export interface VoiceCommandRunner {
  executeCommand(params: {
    userId: string;
    sessionId: string;
    prompt: string;
  }): Promise<{ executionId: string; responseText: string }>;
}
