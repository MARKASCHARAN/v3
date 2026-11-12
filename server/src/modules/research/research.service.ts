import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  createGoogleSearchTool,
  extractTextContent,
  getChatModelForTier,
} from '../../ai/providers/model-router';
import { withAiRetry } from '../../ai/workflows/retry.workflow';
import { AppError } from '../../middleware/error.middleware';
import { MemoryService } from '../memory/memory.service';
import { ResearchRepository } from './research.repository';
import { synthesizedResearchOutputSchema } from './research.schema';
import {
  ConductResearchInput,
  CreateResearchInput,
  FetchedPageExcerpt,
  ResearchQueryInput,
  ResearchSource,
  WebResearchExecutionResult,
  WebResearchRunner,
} from './research.types';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
];

interface GeminiGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

interface GeminiGroundingMetadata {
  groundingChunks?: GeminiGroundingChunk[];
}

export const isSafePublicHttpUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
    return !PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(hostname));
  } catch {
    return false;
  }
};

export const stripHtmlToText = (html: string, maxLength: number = 6000): string => {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutScripts.slice(0, maxLength);
};

const extractTitleFromHtml = (html: string): string | undefined => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = match?.[1]?.replace(/\s+/g, ' ').trim();
  return rawTitle || undefined;
};

const extractGroundingSources = (message: AIMessage): ResearchSource[] => {
  const rawMetadata = (message.response_metadata?.groundingMetadata ??
    message.additional_kwargs?.groundingMetadata) as GeminiGroundingMetadata | undefined;

  if (!rawMetadata?.groundingChunks || !Array.isArray(rawMetadata.groundingChunks)) {
    return [];
  }

  const sources: ResearchSource[] = [];
  for (const chunk of rawMetadata.groundingChunks) {
    const uri = chunk.web?.uri;
    if (typeof uri === 'string' && uri.length > 0) {
      sources.push({
        url: uri,
        title: chunk.web?.title,
      });
    }
  }
  return sources;
};

export const fetchSafePageExcerpts = async (urls: string[]): Promise<FetchedPageExcerpt[]> => {
  const results: FetchedPageExcerpt[] = [];

  for (const url of urls) {
    if (!isSafePublicHttpUrl(url)) {
      throw new AppError(400, `Blocked unsafe or private URL: ${url}`, 'UNSAFE_URL');
    }

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'V3-Research-Bot/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        continue;
      }
      const html = await response.text();
      const excerpt = stripHtmlToText(html);
      if (excerpt) {
        results.push({
          url,
          title: extractTitleFromHtml(html),
          excerpt,
        });
      }
    } catch {
      continue;
    }
  }

  return results;
};

export class AiWebResearchRunner implements WebResearchRunner {
  async research(input: {
    query: string;
    pageExcerpts: FetchedPageExcerpt[];
  }): Promise<WebResearchExecutionResult> {
    const descriptor = getChatModelForTier('RESEARCH');
    const googleSearch = createGoogleSearchTool();

    const excerptsSection =
      input.pageExcerpts.length > 0
        ? `\n\nProvided Web Page Excerpts:\n${input.pageExcerpts
            .map((p) => `Source: ${p.url}${p.title ? ` (${p.title})` : ''}\n${p.excerpt}`)
            .join('\n\n')}`
        : '';

    const groundedModel = descriptor.model.bindTools([googleSearch]);
    const { result: grounded } = await withAiRetry(() =>
      groundedModel.invoke([
        new SystemMessage(
          'You are V3 Research Assistant. Use Google Search grounding and any provided web excerpts to gather accurate, up-to-date facts and citations.'
        ),
        new HumanMessage(`Research Query: ${input.query}${excerptsSection}`),
      ])
    );

    const groundedText = extractTextContent(grounded.content);
    const structuredModel = descriptor.model.withStructuredOutput(synthesizedResearchOutputSchema, {
      name: 'ResearchSynthesis',
    });

    const { result: synthesized } = await withAiRetry(() =>
      structuredModel.invoke([
        new SystemMessage(
          'Synthesize the provided research findings into a concise title, comprehensive summary, and bullet-free keyFindings array.'
        ),
        new HumanMessage(`Query: ${input.query}\n\nFindings:\n${groundedText}`),
      ])
    );

    const parsed = synthesizedResearchOutputSchema.safeParse(synthesized);
    if (!parsed.success) {
      throw new AppError(502, 'AI research synthesis failed', 'AI_GENERATION_FAILED');
    }

    const dedupedSources = new Map<string, ResearchSource>();
    for (const page of input.pageExcerpts) {
      dedupedSources.set(page.url, {
        url: page.url,
        title: page.title,
        snippet: page.excerpt.slice(0, 240),
      });
    }
    for (const source of extractGroundingSources(grounded)) {
      if (!dedupedSources.has(source.url)) {
        dedupedSources.set(source.url, source);
      }
    }

    return {
      provider: descriptor.provider,
      model: descriptor.modelId,
      title: parsed.data.title,
      summary: parsed.data.summary,
      keyFindings: parsed.data.keyFindings,
      sources: [...dedupedSources.values()],
    };
  }
}

export class ResearchService {
  constructor(
    private readonly researchRepository: ResearchRepository = new ResearchRepository(),
    private readonly researchRunner: WebResearchRunner = new AiWebResearchRunner(),
    private readonly memoryService: MemoryService = new MemoryService(),
    private readonly pageFetcher: (
      urls: string[]
    ) => Promise<FetchedPageExcerpt[]> = fetchSafePageExcerpts
  ) {}

  async conductResearch(userId: string, input: ConductResearchInput) {
    if (input.goalId) {
      const goal = await this.researchRepository.findOwnedGoal(input.goalId, userId);
      if (!goal) {
        throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
      }
    }

    const pageExcerpts = input.urls.length > 0 ? await this.pageFetcher(input.urls) : [];
    const output = await this.researchRunner.research({
      query: input.query,
      pageExcerpts,
    });

    const item = await this.researchRepository.create(userId, {
      goalId: input.goalId,
      query: input.query,
      title: output.title,
      summary: output.summary,
      keyFindings: output.keyFindings,
      sources: output.sources,
      provider: output.provider,
      model: output.model,
      status: input.saveToMemory ? 'SAVED_TO_MEMORY' : 'COMPLETED',
    });

    if (input.saveToMemory) {
      await this.memoryService.createMemory(userId, {
        title: output.title,
        content: `${output.summary}\n\nKey Findings:\n- ${output.keyFindings.join('\n- ')}`,
        category: 'FACT',
        tags: ['research'],
        importance: 3,
      });
    }

    return item;
  }

  async createResearchNote(userId: string, input: CreateResearchInput) {
    if (input.goalId) {
      const goal = await this.researchRepository.findOwnedGoal(input.goalId, userId);
      if (!goal) {
        throw new AppError(404, 'Goal not found', 'GOAL_NOT_FOUND');
      }
    }
    return this.researchRepository.create(userId, input);
  }

  async listResearch(userId: string, filters: Partial<ResearchQueryInput> = {}) {
    return this.researchRepository.findAllByUserId(userId, filters);
  }

  async getResearchById(id: string, userId: string) {
    const item = await this.researchRepository.findByIdAndUserId(id, userId);
    if (!item) {
      throw new AppError(404, 'Research item not found', 'RESEARCH_NOT_FOUND');
    }
    return item;
  }

  async saveToMemory(id: string, userId: string) {
    const item = await this.getResearchById(id, userId);
    const findings = Array.isArray(item.keyFindings)
      ? item.keyFindings.map((entry) => String(entry))
      : [];

    const memory = await this.memoryService.createMemory(userId, {
      title: item.title,
      content:
        findings.length > 0
          ? `${item.summary}\n\nKey Findings:\n- ${findings.join('\n- ')}`
          : item.summary,
      category: 'FACT',
      tags: ['research'],
      importance: 3,
    });

    const updated = await this.researchRepository.updateStatus(id, 'SAVED_TO_MEMORY');
    return { research: updated, memory };
  }

  async deleteResearch(id: string, userId: string) {
    await this.getResearchById(id, userId);
    await this.researchRepository.delete(id);
  }
}
