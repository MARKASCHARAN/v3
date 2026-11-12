import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma';
import { VoiceSessionRecord, VoiceSessionStatus } from './voice.types';

export class VoiceRepository {
  async createSession(params: {
    userId: string;
    languageCode: string;
    executionId?: string;
    callMetadata?: Record<string, unknown>;
  }): Promise<VoiceSessionRecord> {
    return prisma.voiceSession.create({
      data: {
        userId: params.userId,
        languageCode: params.languageCode,
        executionId: params.executionId,
        callMetadata: (params.callMetadata ?? {}) as Prisma.InputJsonValue,
        status: 'ACTIVE',
      },
    });
  }

  async findSessionsByUserId(
    userId: string,
    filters: { status?: VoiceSessionStatus; limit?: number } = {}
  ): Promise<VoiceSessionRecord[]> {
    return prisma.voiceSession.findMany({
      where: {
        userId,
        ...(filters.status ? { status: filters.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 20,
    });
  }

  async findSessionByIdAndUserId(id: string, userId: string): Promise<VoiceSessionRecord | null> {
    return prisma.voiceSession.findFirst({
      where: { id, userId },
    });
  }

  async updateSession(
    id: string,
    data: {
      executionId?: string;
      asrTranscript?: string;
      translatedText?: string;
      ttsAudioKey?: string;
      duration?: number;
      callMetadata?: Record<string, unknown>;
      status?: VoiceSessionStatus;
    }
  ): Promise<VoiceSessionRecord> {
    return prisma.voiceSession.update({
      where: { id },
      data: {
        ...(data.executionId !== undefined ? { executionId: data.executionId } : {}),
        ...(data.asrTranscript !== undefined ? { asrTranscript: data.asrTranscript } : {}),
        ...(data.translatedText !== undefined ? { translatedText: data.translatedText } : {}),
        ...(data.ttsAudioKey !== undefined ? { ttsAudioKey: data.ttsAudioKey } : {}),
        ...(data.duration !== undefined ? { duration: data.duration } : {}),
        ...(data.callMetadata !== undefined
          ? { callMetadata: data.callMetadata as Prisma.InputJsonValue }
          : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    });
  }
}

