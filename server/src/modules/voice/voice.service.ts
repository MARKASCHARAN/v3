import { AssistantOrchestrator } from '../../ai/agents/assistant.agent';
import { aiConfig } from '../../config/ai.config';
import { BhashiniAdapter, HttpBhashiniAdapter } from '../../integrations/bhashini/bhashini.adapter';
import {
  StandardTelephonyAdapter,
  TelephonyAdapter,
} from '../../integrations/bhashini/telephony.adapter';
import { SupabaseVoiceStorage, VoiceAssetStorage } from '../../integrations/bhashini/voice-storage';
import { AppError } from '../../middleware/error.middleware';
import { IntegrationsService } from '../integrations/integrations.service';
import { VoiceRepository } from './voice.repository';
import {
  ProcessVoicePipelineInput,
  StartVoiceSessionInput,
  VoiceCommandRunner,
  VoiceSessionRecord,
  VoiceSessionStatus,
} from './voice.types';

const defaultVoiceCommandRunner: VoiceCommandRunner = {
  async executeCommand({ userId, sessionId, prompt }) {
    const orchestrator = new AssistantOrchestrator();
    const execution = (await orchestrator.run({
      userId,
      prompt,
      sessionId: `voice:${sessionId}`,
      maxSteps: aiConfig.defaultMaxIterations,
      allowAutoApproveWrites: false,
      triggerType: 'REQUEST',
    })) as { id: string; responseText?: string | null };

    return {
      executionId: execution.id,
      responseText: execution.responseText ?? 'Command processed.',
    };
  },
};

export class VoiceService {
  constructor(
    private readonly repo: VoiceRepository = new VoiceRepository(),
    private readonly bhashini: BhashiniAdapter = new HttpBhashiniAdapter(),
    private readonly storage: VoiceAssetStorage = new SupabaseVoiceStorage(),
    private readonly telephony: TelephonyAdapter = new StandardTelephonyAdapter(),
    private readonly integrationsService: IntegrationsService = new IntegrationsService(),
    private readonly commandRunner: VoiceCommandRunner = defaultVoiceCommandRunner
  ) {}

  private async resolveBhashiniApiKey(userId: string): Promise<string | undefined> {
    const creds = await this.integrationsService
      .getDecryptedCredentials(userId, 'BHASHINI')
      .catch(() => null);
    return creds?.apiKey;
  }

  startSession(userId: string, input: StartVoiceSessionInput): Promise<VoiceSessionRecord> {
    return this.repo.createSession({
      userId,
      languageCode: input.languageCode,
      executionId: input.executionId,
      callMetadata: input.callMetadata,
    });
  }

  listSessions(
    userId: string,
    filters: { status?: VoiceSessionStatus; limit?: number } = {}
  ): Promise<VoiceSessionRecord[]> {
    return this.repo.findSessionsByUserId(userId, filters);
  }

  async getSession(
    id: string,
    userId: string
  ): Promise<VoiceSessionRecord & { audioSignedUrl: string | null }> {
    const session = await this.repo.findSessionByIdAndUserId(id, userId);
    if (!session) {
      throw new AppError(404, 'Voice session not found', 'NOT_FOUND');
    }

    const audioSignedUrl = session.ttsAudioKey
      ? await this.storage.getSignedAudioUrl(session.ttsAudioKey).catch(() => null)
      : null;

    return {
      ...session,
      audioSignedUrl,
    };
  }

  private async ensureOrCreateSession(
    userId: string,
    sessionId: string | undefined,
    languageCode: string
  ): Promise<VoiceSessionRecord> {
    if (sessionId) {
      const existing = await this.repo.findSessionByIdAndUserId(sessionId, userId);
      if (!existing) {
        throw new AppError(404, 'Voice session not found', 'NOT_FOUND');
      }
      return existing;
    }

    return this.repo.createSession({
      userId,
      languageCode,
    });
  }

  async transcribeAudio(
    userId: string,
    params: {
      sessionId?: string;
      audioBase64: string;
      sourceLanguage: string;
      audioFormat?: 'wav' | 'mp3' | 'flac' | 'webm';
    }
  ) {
    const session = await this.ensureOrCreateSession(
      userId,
      params.sessionId,
      params.sourceLanguage
    );
    const apiKey = await this.resolveBhashiniApiKey(userId);
    const result = await this.bhashini.transcribe(
      {
        audioBase64: params.audioBase64,
        sourceLanguage: params.sourceLanguage,
        audioFormat: params.audioFormat,
      },
      apiKey
    );

    const updated = await this.repo.updateSession(session.id, {
      asrTranscript: result.transcript,
    });

    return {
      session: updated,
      transcript: result.transcript,
      sourceLanguage: result.sourceLanguage,
    };
  }

  async translateText(
    userId: string,
    params: {
      sessionId?: string;
      text: string;
      sourceLanguage: string;
      targetLanguage: string;
    }
  ) {
    const session = await this.ensureOrCreateSession(
      userId,
      params.sessionId,
      params.sourceLanguage
    );
    const apiKey = await this.resolveBhashiniApiKey(userId);
    const result = await this.bhashini.translate(
      {
        text: params.text,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
      },
      apiKey
    );

    const updated = await this.repo.updateSession(session.id, {
      translatedText: result.translatedText,
    });

    return {
      session: updated,
      translatedText: result.translatedText,
      sourceLanguage: result.sourceLanguage,
      targetLanguage: result.targetLanguage,
    };
  }

  async synthesizeSpeech(
    userId: string,
    params: {
      sessionId?: string;
      text: string;
      languageCode: string;
      gender?: 'male' | 'female';
      uploadToStorage?: boolean;
    }
  ) {
    const session = await this.ensureOrCreateSession(userId, params.sessionId, params.languageCode);
    const apiKey = await this.resolveBhashiniApiKey(userId);
    const tts = await this.bhashini.synthesizeSpeech(
      {
        text: params.text,
        languageCode: params.languageCode,
        gender: params.gender,
      },
      apiKey
    );

    let ttsAudioKey: string | undefined;
    let signedUrl: string | null = null;

    if (params.uploadToStorage !== false && tts.audioBase64) {
      const uploaded = await this.storage.uploadAudio({
        userId,
        sessionId: session.id,
        audioBase64: tts.audioBase64,
        extension: tts.audioFormat,
      });
      ttsAudioKey = uploaded.objectKey;
      signedUrl = uploaded.signedUrl;
    }

    const updated = await this.repo.updateSession(session.id, {
      ...(ttsAudioKey ? { ttsAudioKey } : {}),
    });

    return {
      session: updated,
      audioBase64: tts.audioBase64,
      audioFormat: tts.audioFormat,
      ttsAudioKey: ttsAudioKey ?? null,
      signedUrl,
    };
  }

  async processVoiceCommand(userId: string, input: ProcessVoicePipelineInput) {
    const session = await this.ensureOrCreateSession(userId, input.sessionId, input.sourceLanguage);
    const apiKey = await this.resolveBhashiniApiKey(userId);

    let transcript = input.transcriptText ?? '';
    if (!transcript && input.audioBase64) {
      const asr = await this.bhashini.transcribe(
        {
          audioBase64: input.audioBase64,
          sourceLanguage: input.sourceLanguage,
          audioFormat: input.audioFormat,
        },
        apiKey
      );
      transcript = asr.transcript;
    }

    const targetLanguage = input.targetLanguage ?? 'en';
    const translation =
      input.sourceLanguage !== targetLanguage
        ? await this.bhashini.translate(
            {
              text: transcript,
              sourceLanguage: input.sourceLanguage,
              targetLanguage,
            },
            apiKey
          )
        : {
            translatedText: transcript,
            sourceLanguage: input.sourceLanguage,
            targetLanguage,
          };

    let executionId: string | undefined;
    let replyText = translation.translatedText;

    if (input.executeCommand !== false) {
      const commandResult = await this.commandRunner.executeCommand({
        userId,
        sessionId: session.id,
        prompt: translation.translatedText,
      });
      executionId = commandResult.executionId;
      replyText = commandResult.responseText;
    }

    const localizedReply =
      input.sourceLanguage !== targetLanguage && input.executeCommand !== false
        ? (
            await this.bhashini.translate(
              {
                text: replyText,
                sourceLanguage: targetLanguage,
                targetLanguage: input.sourceLanguage,
              },
              apiKey
            )
          ).translatedText
        : replyText;

    let ttsAudioKey: string | undefined;
    let signedUrl: string | null = null;
    if (input.synthesizeReply) {
      const tts = await this.bhashini.synthesizeSpeech(
        {
          text: localizedReply,
          languageCode: input.sourceLanguage,
          gender: input.voiceGender,
        },
        apiKey
      );

      if (tts.audioBase64) {
        const uploaded = await this.storage.uploadAudio({
          userId,
          sessionId: session.id,
          audioBase64: tts.audioBase64,
          extension: tts.audioFormat,
        });
        ttsAudioKey = uploaded.objectKey;
        signedUrl = uploaded.signedUrl;
      }
    }

    const updated = await this.repo.updateSession(session.id, {
      asrTranscript: transcript,
      translatedText: translation.translatedText,
      ...(executionId ? { executionId } : {}),
      ...(ttsAudioKey ? { ttsAudioKey } : {}),
      status: 'COMPLETED',
    });

    return {
      session: updated,
      transcript,
      translatedText: translation.translatedText,
      executionId: executionId ?? null,
      replyText: localizedReply,
      ttsAudioKey: ttsAudioKey ?? null,
      signedUrl,
    };
  }

  async handleTelephonyWebhook(userId: string, rawPayload: Record<string, unknown>) {
    const event = this.telephony.normalizeWebhookPayload(rawPayload);
    const languageCode = event.languageCode ?? 'en';
    const session = await this.repo.createSession({
      userId,
      languageCode,
      callMetadata: {
        callSid: event.callSid,
        from: event.from,
        to: event.to,
        eventType: event.eventType,
        audioUrl: event.audioUrl,
      },
    });

    if (event.eventType === 'INBOUND_CALL') {
      const directive = this.telephony.buildDirective({
        callSid: event.callSid,
        languageCode,
        replyText: 'V3 Assistant connected. Please speak your request.',
      });
      return { session, event, directive };
    }

    if (event.eventType === 'CALL_ENDED') {
      const closed = await this.repo.updateSession(session.id, {
        duration: event.durationSeconds,
        status: 'COMPLETED',
      });
      const directive = this.telephony.buildDirective({
        callSid: event.callSid,
        languageCode,
        replyText: 'Goodbye.',
        endCall: true,
      });
      return { session: closed, event, directive };
    }

    const speech = event.speechText?.trim();
    if (!speech) {
      const directive = this.telephony.buildDirective({
        callSid: event.callSid,
        languageCode,
        replyText: 'I did not catch that. Please repeat your command.',
      });
      return { session, event, directive };
    }

    const processed = await this.processVoiceCommand(userId, {
      sessionId: session.id,
      transcriptText: speech,
      sourceLanguage: languageCode,
      targetLanguage: 'en',
      executeCommand: true,
      synthesizeReply: Boolean(rawPayload.synthesizeReply),
    });

    const directive = this.telephony.buildDirective({
      callSid: event.callSid,
      languageCode,
      replyText: processed.replyText,
      audioUrl: processed.signedUrl,
    });

    return {
      session: processed.session,
      event,
      directive,
      executionId: processed.executionId,
    };
  }
}
