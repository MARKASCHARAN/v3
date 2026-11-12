import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../app';
import {
  buildLangSmithTraceUrl,
  estimateModelCostMicroUsd,
} from '../observability/cost-accounting';
import { runRegressionEvaluationSuite } from './evaluator';

describe('Agent Evaluation & Observability Suite (M2.9)', () => {
  it('passes 100% of regression evaluation cases across permissions, prompt-injection, and cost accounting', () => {
    const report = runRegressionEvaluationSuite();
    expect(report.failures).toEqual([]);
    expect(report.passedCases).toBe(report.totalCases);
    expect(report.passRate).toBe(100);
  });

  it('computes deterministic costMicroUsd and LangSmith trace URLs', () => {
    expect(
      estimateModelCostMicroUsd({
        modelId: 'gemini-2.5-flash',
        tokensUsed: 10000,
      })
    ).toBeGreaterThan(0);

    expect(
      estimateModelCostMicroUsd({
        modelId: 'gemini-2.5-flash',
        tokensUsed: 0,
      })
    ).toBe(0);

    const traceUrl = buildLangSmithTraceUrl('trace-abc-123', 'v3-backend');
    expect(traceUrl).toBe('https://smith.langchain.com/public/v3-backend/r/trace-abc-123');
    expect(buildLangSmithTraceUrl(undefined)).toBeNull();
  });

  it('protects GET /api/v1/automation/metrics with authentication', async () => {
    const res = await request(app).get('/api/v1/automation/metrics');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

