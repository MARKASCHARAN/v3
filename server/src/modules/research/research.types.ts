import { z } from 'zod';
import {
  conductResearchSchema,
  createResearchSchema,
  researchQuerySchema,
  researchSourceSchema,
  researchStatusSchema,
  synthesizedResearchOutputSchema,
} from './research.schema';

export type ResearchStatus = z.infer<typeof researchStatusSchema>;
export type ResearchSource = z.infer<typeof researchSourceSchema>;
export type SynthesizedResearchOutput = z.infer<typeof synthesizedResearchOutputSchema>;
export type ConductResearchInput = z.infer<typeof conductResearchSchema>;
export type CreateResearchInput = z.infer<typeof createResearchSchema>;
export type ResearchQueryInput = z.infer<typeof researchQuerySchema>;

export interface FetchedPageExcerpt {
  url: string;
  title?: string;
  excerpt: string;
}

export interface WebResearchExecutionResult {
  provider: string;
  model: string;
  title: string;
  summary: string;
  keyFindings: string[];
  sources: ResearchSource[];
}

export interface WebResearchRunner {
  research(input: {
    query: string;
    pageExcerpts: FetchedPageExcerpt[];
  }): Promise<WebResearchExecutionResult>;
}
