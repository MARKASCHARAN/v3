export interface TelephonyWebhookEvent {
  callSid: string;
  from: string;
  to: string;
  eventType: 'INBOUND_CALL' | 'SPEECH_CAPTURED' | 'CALL_ENDED';
  speechText?: string;
  audioUrl?: string;
  languageCode?: string;
  durationSeconds?: number;
}

export interface TelephonyResponseDirective {
  action: 'SAY' | 'PLAY' | 'HANGUP';
  text?: string;
  audioUrl?: string | null;
  languageCode: string;
  callSid: string;
}

export interface TelephonyAdapter {
  normalizeWebhookPayload(raw: Record<string, unknown>): TelephonyWebhookEvent;
  buildDirective(params: {
    callSid: string;
    languageCode: string;
    replyText: string;
    audioUrl?: string | null;
    endCall?: boolean;
  }): TelephonyResponseDirective;
}

export class StandardTelephonyAdapter implements TelephonyAdapter {
  normalizeWebhookPayload(raw: Record<string, unknown>): TelephonyWebhookEvent {
    const callSid = String(raw.callSid ?? raw.CallSid ?? `call-${Date.now()}`);
    const from = String(raw.from ?? raw.From ?? 'unknown');
    const to = String(raw.to ?? raw.To ?? 'v3-assistant');
    const rawEvent = String(raw.eventType ?? raw.CallStatus ?? 'SPEECH_CAPTURED').toUpperCase();

    let eventType: TelephonyWebhookEvent['eventType'] = 'SPEECH_CAPTURED';
    if (rawEvent === 'INBOUND_CALL' || rawEvent === 'RINGING' || rawEvent === 'INITIATED') {
      eventType = 'INBOUND_CALL';
    } else if (rawEvent === 'CALL_ENDED' || rawEvent === 'COMPLETED' || rawEvent === 'HANGUP') {
      eventType = 'CALL_ENDED';
    }

    return {
      callSid,
      from,
      to,
      eventType,
      speechText:
        typeof raw.speechText === 'string'
          ? raw.speechText
          : typeof raw.SpeechResult === 'string'
            ? raw.SpeechResult
            : undefined,
      audioUrl:
        typeof raw.audioUrl === 'string'
          ? raw.audioUrl
          : typeof raw.RecordingUrl === 'string'
            ? raw.RecordingUrl
            : undefined,
      languageCode: typeof raw.languageCode === 'string' ? raw.languageCode : 'en',
      durationSeconds:
        typeof raw.durationSeconds === 'number'
          ? raw.durationSeconds
          : typeof raw.CallDuration === 'string'
            ? Number.parseInt(raw.CallDuration, 10) || undefined
            : undefined,
    };
  }

  buildDirective(params: {
    callSid: string;
    languageCode: string;
    replyText: string;
    audioUrl?: string | null;
    endCall?: boolean;
  }): TelephonyResponseDirective {
    if (params.endCall) {
      return {
        action: 'HANGUP',
        text: params.replyText,
        languageCode: params.languageCode,
        callSid: params.callSid,
      };
    }

    if (params.audioUrl) {
      return {
        action: 'PLAY',
        text: params.replyText,
        audioUrl: params.audioUrl,
        languageCode: params.languageCode,
        callSid: params.callSid,
      };
    }

    return {
      action: 'SAY',
      text: params.replyText,
      languageCode: params.languageCode,
      callSid: params.callSid,
    };
  }
}
