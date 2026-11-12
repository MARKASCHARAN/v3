import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../../app';
import { BhashiniAdapter } from '../../integrations/bhashini/bhashini.adapter';
import { StandardTelephonyAdapter } from '../../integrations/bhashini/telephony.adapter';
import { VoiceAssetStorage } from '../../integrations/bhashini/voice-storage';
import { IntegrationsService } from '../integrations/integrations.service';
import { VoiceRepository } from './voice.repository';
import { VoiceService } from './voice.service';
import { VoiceCommandRunner, VoiceSessionRecord } from './voice.types';

const makeVoiceSession = (overrides: Partial<VoiceSessionRecord> = {}): VoiceSessionRecord => ({
  id: '44444444-4444-4444-4444-444444444444',
  userId: 'user-1',
  executionId: null,
  languageCode: 'hi',
  asrTranscript: null,
  translatedText: null,
  ttsAudioKey: null,
  duration: null,
  callMetadata: {},
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Voice & Bhashini Module (M2.8)', () => {
  it('runs multilingual ASR -> translate -> V3 command -> localized TTS -> Supabase Storage', async () => {
    const session = makeVoiceSession();
    const completedSession = makeVoiceSession({
      asrTranscript: 'मेरे आज के कार्य दिखाओ',
      translatedText: 'Show my tasks for today',
      executionId: 'exec-voice-1',
      ttsAudioKey: 'user-1/4444/audio.wav',
      status: 'COMPLETED',
    });

    const repo = {
      createSession: vi.fn().mockResolvedValue(session),
      updateSession: vi.fn().mockResolvedValue(completedSession),
    } as unknown as VoiceRepository;

    const bhashini: BhashiniAdapter = {
      isConfigured: () => true,
      transcribe: vi.fn().mockResolvedValue({
        transcript: 'मेरे आज के कार्य दिखाओ',
        sourceLanguage: 'hi',
      }),
      translate: vi
        .fn()
        .mockResolvedValueOnce({
          translatedText: 'Show my tasks for today',
          sourceLanguage: 'hi',
          targetLanguage: 'en',
        })
        .mockResolvedValueOnce({
          translatedText: 'आपके पास 2 कार्य बाकी हैं।',
          sourceLanguage: 'en',
          targetLanguage: 'hi',
        }),
      synthesizeSpeech: vi.fn().mockResolvedValue({
        audioBase64: Buffer.from('mock-wav-bytes').toString('base64'),
        audioFormat: 'wav',
        languageCode: 'hi',
      }),
    };

    const storage: VoiceAssetStorage = {
      uploadAudio: vi.fn().mockResolvedValue({
        objectKey: 'user-1/4444/audio.wav',
        signedUrl: 'https://supabase.test/signed/audio.wav',
      }),
      getSignedAudioUrl: vi.fn().mockResolvedValue('https://supabase.test/signed/audio.wav'),
    };

    const integrations = {
      getDecryptedCredentials: vi.fn().mockResolvedValue(null),
    } as unknown as IntegrationsService;

    const commandRunner: VoiceCommandRunner = {
      executeCommand: vi.fn().mockResolvedValue({
        executionId: 'exec-voice-1',
        responseText: 'You have 2 remaining tasks.',
      }),
    };

    const service = new VoiceService(
      repo,
      bhashini,
      storage,
      new StandardTelephonyAdapter(),
      integrations,
      commandRunner
    );

    const result = await service.processVoiceCommand('user-1', {
      audioBase64: 'UklGRg==',
      sourceLanguage: 'hi',
      targetLanguage: 'en',
      executeCommand: true,
      synthesizeReply: true,
    });

    expect(result.transcript).toBe('मेरे आज के कार्य दिखाओ');
    expect(result.translatedText).toBe('Show my tasks for today');
    expect(result.executionId).toBe('exec-voice-1');
    expect(result.replyText).toBe('आपके पास 2 कार्य बाकी हैं।');
    expect(result.ttsAudioKey).toBe('user-1/4444/audio.wav');
    expect(result.signedUrl).toBe('https://supabase.test/signed/audio.wav');
    expect(storage.uploadAudio).toHaveBeenCalledOnce();
  });

  it('normalizes inbound/ended telephony webhook calls and returns voice directives', async () => {
    const repo = {
      createSession: vi.fn().mockResolvedValue(makeVoiceSession({ languageCode: 'en' })),
      updateSession: vi
        .fn()
        .mockResolvedValue(makeVoiceSession({ status: 'COMPLETED', duration: 42 })),
    } as unknown as VoiceRepository;

    const service = new VoiceService(repo, undefined, undefined, new StandardTelephonyAdapter(), {
      getDecryptedCredentials: vi.fn().mockResolvedValue(null),
    } as unknown as IntegrationsService);

    const inbound = await service.handleTelephonyWebhook('user-1', {
      CallSid: 'CA123',
      From: '+919999999999',
      CallStatus: 'ringing',
    });
    expect(inbound.directive.action).toBe('SAY');
    expect(inbound.directive.callSid).toBe('CA123');

    const ended = await service.handleTelephonyWebhook('user-1', {
      CallSid: 'CA123',
      CallStatus: 'completed',
      CallDuration: '42',
    });
    expect(ended.directive.action).toBe('HANGUP');
  });

  it('protects /api/v1/voice endpoints with authentication', async () => {
    const res = await request(app).get('/api/v1/voice/sessions');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
