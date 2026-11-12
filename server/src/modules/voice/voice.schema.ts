import { z } from 'zod';

export const voiceSessionStatusSchema = z.enum(['ACTIVE', 'COMPLETED', 'FAILED']);

export const startVoiceSessionSchema = z.object({
  languageCode: z.string().trim().min(2).max(10).default('en'),
  executionId: z.string().uuid().optional(),
  callMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const transcribeVoiceSchema = z.object({
  sessionId: z.string().uuid().optional(),
  audioBase64: z.string().min(4),
  sourceLanguage: z.string().trim().min(2).max(10).default('hi'),
  audioFormat: z.enum(['wav', 'mp3', 'flac', 'webm']).default('wav'),
});

export const translateVoiceSchema = z.object({
  sessionId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
  sourceLanguage: z.string().trim().min(2).max(10),
  targetLanguage: z.string().trim().min(2).max(10).default('en'),
});

export const synthesizeVoiceSchema = z.object({
  sessionId: z.string().uuid().optional(),
  text: z.string().trim().min(1).max(4000),
  languageCode: z.string().trim().min(2).max(10).default('en'),
  gender: z.enum(['male', 'female']).default('female'),
  uploadToStorage: z.boolean().default(true),
});

export const voiceCommandSchema = z
  .object({
    sessionId: z.string().uuid().optional(),
    audioBase64: z.string().min(4).optional(),
    audioFormat: z.enum(['wav', 'mp3', 'flac', 'webm']).default('wav'),
    transcriptText: z.string().trim().min(1).max(4000).optional(),
    sourceLanguage: z.string().trim().min(2).max(10).default('en'),
    targetLanguage: z.string().trim().min(2).max(10).default('en'),
    executeCommand: z.boolean().default(true),
    synthesizeReply: z.boolean().default(false),
    voiceGender: z.enum(['male', 'female']).default('female'),
  })
  .refine((data) => Boolean(data.audioBase64 || data.transcriptText), {
    message: 'Either audioBase64 or transcriptText is required',
  });

export const telephonyWebhookSchema = z.object({
  callSid: z.string().trim().min(1).optional(),
  CallSid: z.string().trim().min(1).optional(),
  from: z.string().optional(),
  From: z.string().optional(),
  to: z.string().optional(),
  To: z.string().optional(),
  eventType: z.string().optional(),
  CallStatus: z.string().optional(),
  speechText: z.string().optional(),
  SpeechResult: z.string().optional(),
  audioUrl: z.string().optional(),
  RecordingUrl: z.string().optional(),
  languageCode: z.string().optional(),
  durationSeconds: z.number().int().min(0).optional(),
  CallDuration: z.string().optional(),
  synthesizeReply: z.boolean().default(false),
});

export const voiceSessionIdParamSchema = z.object({
  id: z.string().uuid('Invalid voice session ID'),
});

export const voiceSessionsQuerySchema = z.object({
  status: voiceSessionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

