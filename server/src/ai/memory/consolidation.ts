import { AppError } from '../../middleware/error.middleware';
import { MemoryRepository } from '../../modules/memory/memory.repository';
import {
  CreateMemoryInput,
  EmbeddingGenerator,
  MemoryRecordSummary,
  ProposeMemoryInput,
} from '../../modules/memory/memory.types';
import {
  buildMemoryEmbeddingText,
  formatVectorLiteral,
  generateTextEmbedding,
} from '../providers/embeddings';
import { CandidateValidationOutcome, validateCandidateMemory } from './extraction';

const defaultEmbeddingGenerator: EmbeddingGenerator = {
  embedDocument: (text) => generateTextEmbedding(text, 'RETRIEVAL_DOCUMENT'),
  embedQuery: (text) => generateTextEmbedding(text, 'RETRIEVAL_QUERY'),
};

export interface MemoryProposalResult {
  action: 'CREATED' | 'SUPERSEDED' | 'DUPLICATE' | 'REJECTED';
  reason: string;
  memory: MemoryRecordSummary | null;
  supersededIds: string[];
  validationStatus: CandidateValidationOutcome['status'];
}

export class MemoryConsolidationService {
  constructor(
    private readonly memoryRepository: MemoryRepository = new MemoryRepository(),
    private readonly embeddingGenerator: EmbeddingGenerator = defaultEmbeddingGenerator
  ) {}

  private async trySyncEmbedding(memory: {
    id: string;
    title: string | null;
    category: string;
    tags: string[];
    content: string;
  }): Promise<boolean> {
    try {
      const text = buildMemoryEmbeddingText(memory);
      const vector = await this.embeddingGenerator.embedDocument(text);
      await this.memoryRepository.updateMemoryEmbedding(memory.id, formatVectorLiteral(vector));
      return true;
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_PROVIDER_UNCONFIGURED') {
        return false;
      }
      return false;
    }
  }

  async proposeAndPersistMemory(
    userId: string,
    input: ProposeMemoryInput | CreateMemoryInput,
    options: { autoSupersedeOnConflict?: boolean } = {}
  ): Promise<MemoryProposalResult> {
    const activeMemories = await this.memoryRepository.findActiveMemoriesForValidation(userId);
    const validation = validateCandidateMemory(input, activeMemories);

    if (validation.status === 'REJECTED' || !validation.candidate) {
      return {
        action: 'REJECTED',
        reason: validation.reason,
        memory: null,
        supersededIds: [],
        validationStatus: 'REJECTED',
      };
    }

    if (validation.status === 'DUPLICATE' && validation.duplicateMemoryId) {
      const existing = activeMemories.find((m) => m.id === validation.duplicateMemoryId) ?? null;
      return {
        action: 'DUPLICATE',
        reason: validation.reason,
        memory: existing,
        supersededIds: [],
        validationStatus: 'DUPLICATE',
      };
    }

    const shouldSupersede =
      options.autoSupersedeOnConflict ??
      ('autoSupersedeOnConflict' in input ? input.autoSupersedeOnConflict : true);

    const created = await this.memoryRepository.createMemory(userId, validation.candidate);
    await this.trySyncEmbedding(created);

    let supersededIds: string[] = [];
    if (
      validation.status === 'CONFLICT' &&
      shouldSupersede &&
      validation.conflictingMemoryIds.length > 0
    ) {
      await this.memoryRepository.markMemoriesSuperseded(
        validation.conflictingMemoryIds,
        created.id
      );
      supersededIds = validation.conflictingMemoryIds;
    }

    return {
      action: supersededIds.length > 0 ? 'SUPERSEDED' : 'CREATED',
      reason: validation.reason,
      memory: created,
      supersededIds,
      validationStatus: validation.status,
    };
  }

  async supersedeMemory(userId: string, oldMemoryId: string, replacement: CreateMemoryInput) {
    const existing = await this.memoryRepository.findMemoryByIdAndUserId(oldMemoryId, userId);
    if (!existing) {
      throw new AppError(404, 'Memory not found', 'MEMORY_NOT_FOUND');
    }

    const created = await this.memoryRepository.createMemory(userId, replacement);
    await this.trySyncEmbedding(created);
    await this.memoryRepository.markMemoriesSuperseded([oldMemoryId], created.id);

    return {
      supersededMemoryId: oldMemoryId,
      replacement: created,
    };
  }

  async recordEpisodicExecutionMemory(input: {
    userId: string;
    executionId: string;
    objective: string;
    summary: string;
    ttlDays?: number;
  }) {
    const ttlDays = input.ttlDays ?? 30;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const created = await this.memoryRepository.createMemory(input.userId, {
      title: `Execution: ${input.objective.slice(0, 120)}`,
      content: `${input.objective} — Outcome: ${input.summary}`,
      category: 'FACT',
      memoryType: 'EPISODIC',
      sourceType: 'EVENT',
      sourceId: input.executionId,
      tags: ['execution', 'episodic'],
      importance: 1,
      confidence: 0.85,
      expiresAt,
    });

    await this.trySyncEmbedding(created);
    return created;
  }

  async pruneExpiredMemories(userId?: string): Promise<{ prunedCount: number }> {
    const prunedCount = await this.memoryRepository.deleteExpiredMemories(userId);
    return { prunedCount };
  }
}
