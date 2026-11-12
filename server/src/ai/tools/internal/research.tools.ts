import { z } from 'zod';
import { conductResearchSchema } from '../../../modules/research/research.schema';
import { ResearchService } from '../../../modules/research/research.service';
import { V3ToolContract } from '../tool.types';

const researchService = new ResearchService();

const researchOutputSchema = z.object({ id: z.string() }).catchall(z.unknown());

export const RESEARCH_TOOLS: V3ToolContract[] = [
  {
    name: 'webResearch',
    domain: 'research',
    description: 'Conduct grounded web research and summarize findings for a query.',
    riskLevel: 'READ',
    idempotent: false,
    inputSchema: conductResearchSchema,
    outputSchema: researchOutputSchema,
    execute: (ctx, input) =>
      researchService.conductResearch(ctx.userId, input as z.infer<typeof conductResearchSchema>),
  } as V3ToolContract,
];

