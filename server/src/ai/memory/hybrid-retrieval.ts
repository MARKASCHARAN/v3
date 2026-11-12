import { AppError } from '../../middleware/error.middleware';
import { MemoryRepository } from '../../modules/memory/memory.repository';
import {
  HybridMemoryMatch,
  KeywordMemoryMatch,
  SemanticMemoryMatch,
  StructuredWorkspaceMetrics,
} from '../../modules/memory/memory.types';
import { formatVectorLiteral, generateTextEmbedding } from '../providers/embeddings';
import { RetrievedContextSlice } from '../runtime/state';

export interface RrfFusionOptions {
  k?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  importanceWeight?: number;
  limit?: number;
}

export interface HybridRetrievalParams {
  userId: string;
  query: string;
  category?: string;
  memoryType?: string;
  limit?: number;
  minSimilarity?: number;
}

export interface HybridRetrievalResult {
  mode: 'hybrid_rrf' | 'sql_and_fts';
  query: string;
  preferences: Array<{ key: string; value: string; category: string }>;
  structuredMetrics: StructuredWorkspaceMetrics;
  results: HybridMemoryMatch[];
}

export const fuseMemoriesWithRRF = (input: {
  vectorMatches: SemanticMemoryMatch[];
  keywordMatches: KeywordMemoryMatch[];
  options?: RrfFusionOptions;
}): HybridMemoryMatch[] => {
  const k = input.options?.k ?? 60;
  const vectorWeight = input.options?.vectorWeight ?? 1.0;
  const keywordWeight = input.options?.keywordWeight ?? 0.9;
  const importanceWeight = input.options?.importanceWeight ?? 0.002;
  const limit = input.options?.limit ?? 10;

  const byId = new Map<string, HybridMemoryMatch>();

  input.vectorMatches.forEach((match, index) => {
    const rankPosition = index + 1;
    const vectorContribution = vectorWeight / (k + rankPosition);
    const importanceBoost = (match.importance - 1) * importanceWeight;

    byId.set(match.id, {
      id: match.id,
      userId: match.userId,
      title: match.title,
      content: match.content,
      category: match.category,
      memoryType: match.memoryType,
      sourceType: match.sourceType,
      sourceId: match.sourceId,
      tags: match.tags,
      importance: match.importance,
      confidence: match.confidence,
      expiresAt: match.expiresAt,
      supersededById: match.supersededById,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      rrfScore: vectorContribution + importanceBoost,
      similarity: match.similarity,
      keywordRank: null,
      vectorRankPosition: rankPosition,
      keywordRankPosition: null,
    });
  });

  input.keywordMatches.forEach((match, index) => {
    const rankPosition = index + 1;
    const keywordContribution = keywordWeight / (k + rankPosition);
    const existing = byId.get(match.id);

    if (existing) {
      existing.rrfScore += keywordContribution;
      existing.keywordRank = match.keywordRank;
      existing.keywordRankPosition = rankPosition;
      return;
    }

    const importanceBoost = (match.importance - 1) * importanceWeight;
    byId.set(match.id, {
      id: match.id,
      userId: match.userId,
      title: match.title,
      content: match.content,
      category: match.category,
      memoryType: match.memoryType,
      sourceType: match.sourceType,
      sourceId: match.sourceId,
      tags: match.tags,
      importance: match.importance,
      confidence: match.confidence,
      expiresAt: match.expiresAt,
      supersededById: match.supersededById,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
      rrfScore: keywordContribution + importanceBoost,
      similarity: null,
      keywordRank: match.keywordRank,
      vectorRankPosition: null,
      keywordRankPosition: rankPosition,
    });
  });

  return [...byId.values()]
    .sort((a, b) => {
      if (b.rrfScore !== a.rrfScore) {
        return b.rrfScore - a.rrfScore;
      }
      return b.importance - a.importance;
    })
    .slice(0, limit);
};

export interface HybridRetrievalDeps {
  repository?: MemoryRepository;
  embedQuery?: (query: string) => Promise<number[]>;
}

export const retrieveHybridMemoryContext = async (
  params: HybridRetrievalParams,
  deps: HybridRetrievalDeps = {}
): Promise<HybridRetrievalResult> => {
  const repository = deps.repository ?? new MemoryRepository();
  const embedQuery =
    deps.embedQuery ?? ((text: string) => generateTextEmbedding(text, 'RETRIEVAL_QUERY'));
  const limit = params.limit ?? 10;
  const candidateLimit = Math.min(limit * 3, 50);

  const vectorSearchPromise = embedQuery(params.query)
    .then(async (vector) => ({
      mode: 'pgvector' as const,
      matches: await repository.findSimilarMemories(params.userId, formatVectorLiteral(vector), {
        category: params.category,
        memoryType: params.memoryType,
        limit: candidateLimit,
        minSimilarity: params.minSimilarity ?? 0.25,
      }),
    }))
    .catch((error: unknown) => {
      if (error instanceof AppError && error.code === 'AI_PROVIDER_UNCONFIGURED') {
        return { mode: 'fallback' as const, matches: [] as SemanticMemoryMatch[] };
      }
      throw error;
    });

  const [preferences, structuredMetrics, keywordMatches, vectorResult] = await Promise.all([
    repository.findPreferences(params.userId),
    repository.findStructuredWorkspaceMetrics(params.userId),
    repository.findFullTextMemories(params.userId, params.query, {
      category: params.category,
      memoryType: params.memoryType,
      limit: candidateLimit,
    }),
    vectorSearchPromise,
  ]);

  const fused = fuseMemoriesWithRRF({
    vectorMatches: vectorResult.matches,
    keywordMatches,
    options: { limit },
  });

  return {
    mode: vectorResult.mode === 'pgvector' ? 'hybrid_rrf' : 'sql_and_fts',
    query: params.query,
    preferences: preferences.map((pref) => ({
      key: pref.key,
      value: pref.value,
      category: pref.category,
    })),
    structuredMetrics,
    results: fused,
  };
};

export const toRetrievedContextSlice = (result: HybridRetrievalResult): RetrievedContextSlice => ({
  preferences: result.preferences.map((pref) => ({ key: pref.key, value: pref.value })),
  facts: result.results.map((item) => ({
    id: item.id,
    title: item.title,
    content: item.content,
    source: `${item.memoryType}:${item.sourceType}`,
    score: item.rrfScore,
  })),
  structuredMetrics: { ...result.structuredMetrics },
});
