import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { AppError } from '../../middleware/error.middleware';
import {
  memoryCategorySchema,
  memorySourceTypeSchema,
  memoryTypeSchema,
} from '../../modules/memory/memory.schema';
import { MemoryRecordSummary, MemorySourceType } from '../../modules/memory/memory.types';
import { getChatModelForTier } from '../providers/model-router';
import { withAiRetry } from '../workflows/retry.workflow';

export const candidateMemorySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(10000),
  category: memoryCategorySchema.default('FACT'),
  memoryType: memoryTypeSchema.default('SEMANTIC'),
  sourceType: memorySourceTypeSchema.default('CONVERSATION'),
  sourceId: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  importance: z.number().int().min(1).max(5).default(2),
  confidence: z.number().min(0).max(1).default(0.85),
  expiresAt: z.coerce.date().optional(),
});

export type CandidateMemoryInput = z.infer<typeof candidateMemorySchema>;

export interface CandidateValidationOutcome {
  status: 'ACCEPTED' | 'DUPLICATE' | 'CONFLICT' | 'REJECTED';
  reason: string;
  candidate?: CandidateMemoryInput;
  duplicateMemoryId?: string;
  conflictingMemoryIds: string[];
}

const LOW_SIGNAL_CONTENTS = new Set([
  'ok',
  'okay',
  'thanks',
  'thank you',
  'hello',
  'hi',
  'hey',
  'done',
  'sure',
  'yes',
  'no',
]);

export const normalizeMemoryTags = (tags: string[]): string[] => {
  const unique = new Set<string>();
  for (const tag of tags) {
    const cleaned = tag.trim().toLowerCase();
    if (cleaned.length > 0) {
      unique.add(cleaned);
    }
  }
  return [...unique].slice(0, 20);
};

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeText = (value: string): Set<string> => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return new Set();
  }
  return new Set(normalized.split(' ').filter((token) => token.length > 1));
};

export const computeTokenJaccardSimilarity = (a: string, b: string): number => {
  const tokensA = tokenizeText(a);
  const tokensB = tokenizeText(b);
  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

export const validateCandidateMemory = (
  rawCandidate: unknown,
  existingMemories: MemoryRecordSummary[]
): CandidateValidationOutcome => {
  const parsed = candidateMemorySchema.safeParse(rawCandidate);
  if (!parsed.success) {
    return {
      status: 'REJECTED',
      reason: 'Candidate memory failed schema validation.',
      conflictingMemoryIds: [],
    };
  }

  const candidate = parsed.data;
  const trimmedContent = candidate.content.trim();
  const normalizedContent = normalizeText(trimmedContent);

  if (trimmedContent.length < 8 || LOW_SIGNAL_CONTENTS.has(normalizedContent)) {
    return {
      status: 'REJECTED',
      reason: 'Candidate memory content is too brief or low-signal to retain.',
      conflictingMemoryIds: [],
    };
  }

  if (candidate.expiresAt && candidate.expiresAt <= new Date()) {
    return {
      status: 'REJECTED',
      reason: 'Candidate memory already has an expired expiresAt timestamp.',
      conflictingMemoryIds: [],
    };
  }

  const normalizedConfidence =
    candidate.sourceType === 'MANUAL' ? candidate.confidence : Math.min(candidate.confidence, 0.95);

  const sanitizedCandidate: CandidateMemoryInput = {
    ...candidate,
    content: trimmedContent,
    tags: normalizeMemoryTags(candidate.tags),
    confidence: normalizedConfidence,
  };

  for (const existing of existingMemories) {
    const existingNormalized = normalizeText(existing.content);
    if (
      existingNormalized === normalizedContent ||
      computeTokenJaccardSimilarity(trimmedContent, existing.content) >= 0.85
    ) {
      return {
        status: 'DUPLICATE',
        reason: 'Equivalent memory already exists in active storage.',
        candidate: sanitizedCandidate,
        duplicateMemoryId: existing.id,
        conflictingMemoryIds: [],
      };
    }
  }

  const normalizedTitle = sanitizedCandidate.title ? normalizeText(sanitizedCandidate.title) : '';

  const conflictingMemoryIds: string[] = [];
  for (const existing of existingMemories) {
    if (existing.memoryType !== sanitizedCandidate.memoryType) {
      continue;
    }

    const existingTitle = existing.title ? normalizeText(existing.title) : '';
    const sameTitleConflict =
      normalizedTitle.length > 2 && existingTitle.length > 2 && existingTitle === normalizedTitle;
    const sameSourceConflict =
      Boolean(sanitizedCandidate.sourceId) &&
      existing.sourceId === sanitizedCandidate.sourceId &&
      sanitizedCandidate.memoryType !== 'EPISODIC';

    if (sameTitleConflict || sameSourceConflict) {
      conflictingMemoryIds.push(existing.id);
    }
  }

  if (conflictingMemoryIds.length > 0) {
    return {
      status: 'CONFLICT',
      reason: 'Candidate memory updates or supersedes one or more existing active memories.',
      candidate: sanitizedCandidate,
      conflictingMemoryIds,
    };
  }

  return {
    status: 'ACCEPTED',
    reason: 'Candidate memory passed validation rules.',
    candidate: sanitizedCandidate,
    conflictingMemoryIds: [],
  };
};

const extractedMemoryListSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string().trim().min(1).max(200),
      content: z.string().trim().min(8).max(2000),
      category: memoryCategorySchema,
      memoryType: z.enum(['SEMANTIC', 'PROCEDURAL', 'PROJECT']),
      tags: z.array(z.string().trim().min(1).max(50)).max(8),
      importance: z.number().int().min(1).max(5),
      confidence: z.number().min(0.4).max(0.95),
    })
  ),
});

export const extractCandidateMemoriesFromInteraction = async (input: {
  text: string;
  sourceType: MemorySourceType;
  sourceId?: string;
}): Promise<CandidateMemoryInput[]> => {
  if (input.text.trim().length < 20) {
    return [];
  }

  try {
    const descriptor = getChatModelForTier('CLASSIFICATION');
    const structuredModel = descriptor.model.withStructuredOutput(extractedMemoryListSchema, {
      name: 'ExtractedMemories',
    });

    const { result } = await withAiRetry(() =>
      structuredModel.invoke([
        new SystemMessage(
          'Extract only durable personal preferences, project facts, recurring procedures, or goals worth remembering long-term. Return an empty array if nothing durable exists.'
        ),
        new HumanMessage(input.text),
      ])
    );

    const parsed = extractedMemoryListSchema.safeParse(result);
    if (!parsed.success) {
      return [];
    }

    return parsed.data.candidates.map((item) => ({
      ...item,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      tags: normalizeMemoryTags(item.tags),
    }));
  } catch (error) {
    if (error instanceof AppError && error.code === 'AI_PROVIDER_UNCONFIGURED') {
      return [];
    }
    throw error;
  }
};
