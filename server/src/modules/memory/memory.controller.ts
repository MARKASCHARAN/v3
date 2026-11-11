import { Response } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { contextQuerySchema, conversationQuerySchema, memoryQuerySchema } from './memory.schema';
import { MemoryService } from './memory.service';
import {
  CreateConversationMessageInput,
  CreateMemoryInput,
  UpdateMemoryInput,
  UpsertPreferenceInput,
} from './memory.types';

export class MemoryController {
  private readonly memoryService = new MemoryService();

  private getUserId(req: AuthenticatedRequest): string {
    if (!req.user?.id) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    return req.user.id;
  }

  private getParam(req: AuthenticatedRequest, key: string, label: string): string {
    const value = req.params[key];
    if (typeof value !== 'string' || !value) {
      throw new AppError(400, `${label} is required`, 'VALIDATION_ERROR');
    }
    return value;
  }

  getContext = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const query = contextQuerySchema.parse(req.query);
    const bundle = await this.memoryService.getContextBundle(userId, query);
    res.status(200).json({ success: true, data: bundle });
  };

  createMemory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const memory = await this.memoryService.createMemory(userId, req.body as CreateMemoryInput);
    res.status(201).json({ success: true, data: memory });
  };

  getMemories = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const filters = memoryQuerySchema.parse(req.query);
    const memories = await this.memoryService.getMemories(userId, filters);
    res.status(200).json({ success: true, data: memories });
  };

  getMemory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getParam(req, 'id', 'Memory ID');
    const memory = await this.memoryService.getMemoryById(id, userId);
    res.status(200).json({ success: true, data: memory });
  };

  updateMemory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getParam(req, 'id', 'Memory ID');
    const memory = await this.memoryService.updateMemory(id, userId, req.body as UpdateMemoryInput);
    res.status(200).json({ success: true, data: memory });
  };

  removeMemory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const id = this.getParam(req, 'id', 'Memory ID');
    await this.memoryService.deleteMemory(id, userId);
    res.status(200).json({ success: true, data: { message: 'Memory deleted successfully' } });
  };

  upsertPreference = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const pref = await this.memoryService.upsertPreference(
      userId,
      req.body as UpsertPreferenceInput
    );
    res.status(200).json({ success: true, data: pref });
  };

  getPreferences = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const preferences = await this.memoryService.getPreferences(userId);
    res.status(200).json({ success: true, data: preferences });
  };

  removePreference = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const key = this.getParam(req, 'key', 'Preference key');
    await this.memoryService.deletePreference(userId, key);
    res.status(200).json({ success: true, data: { message: 'Preference deleted successfully' } });
  };

  appendMessage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const msg = await this.memoryService.appendMessage(
      userId,
      req.body as CreateConversationMessageInput
    );
    res.status(201).json({ success: true, data: msg });
  };

  getConversations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const query = conversationQuerySchema.parse(req.query);
    const messages = await this.memoryService.getConversationHistory(userId, query);
    res.status(200).json({ success: true, data: messages });
  };

  clearConversations = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = this.getUserId(req);
    const query = conversationQuerySchema.parse(req.query);
    await this.memoryService.clearConversationHistory(userId, query.sessionId);
    res.status(200).json({ success: true, data: { message: 'Conversation history cleared' } });
  };
}
