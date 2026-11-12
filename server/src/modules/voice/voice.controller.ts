import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { voiceSessionsQuerySchema } from './voice.schema';
import { VoiceService } from './voice.service';
import { ProcessVoicePipelineInput, StartVoiceSessionInput } from './voice.types';

export class VoiceController {
  private readonly service = new VoiceService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  startSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as StartVoiceSessionInput;
    const session = await this.service.startSession(userId, body);
    res.status(201).json({ success: true, data: session });
  };

  listSessions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const query = voiceSessionsQuerySchema.parse(req.query);
    const sessions = await this.service.listSessions(userId, query);
    res.status(200).json({ success: true, data: sessions });
  };

  getSession = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = String(req.params.id);
    const session = await this.service.getSession(id, userId);
    res.status(200).json({ success: true, data: session });
  };

  transcribe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      sessionId?: string;
      audioBase64: string;
      sourceLanguage: string;
      audioFormat?: 'wav' | 'mp3' | 'flac' | 'webm';
    };
    const result = await this.service.transcribeAudio(userId, body);
    res.status(200).json({ success: true, data: result });
  };

  translate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      sessionId?: string;
      text: string;
      sourceLanguage: string;
      targetLanguage: string;
    };
    const result = await this.service.translateText(userId, body);
    res.status(200).json({ success: true, data: result });
  };

  synthesize = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as {
      sessionId?: string;
      text: string;
      languageCode: string;
      gender?: 'male' | 'female';
      uploadToStorage?: boolean;
    };
    const result = await this.service.synthesizeSpeech(userId, body);
    res.status(200).json({ success: true, data: result });
  };

  processCommand = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as ProcessVoicePipelineInput;
    const result = await this.service.processVoiceCommand(userId, body);
    res.status(200).json({ success: true, data: result });
  };

  telephonyWebhook = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const body = req.body as Record<string, unknown>;
    const result = await this.service.handleTelephonyWebhook(userId, body);
    res.status(200).json({ success: true, data: result });
  };
}
