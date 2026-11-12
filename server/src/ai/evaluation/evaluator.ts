import { Client } from 'langsmith';
import { aiConfig } from '../../config/ai.config';
import { evaluateToolPermission } from '../../permissions/risk-policy';
import {
  detectPromptInjectionSignals,
  wrapUntrustedExternalData,
} from '../guardrails/prompt-injection.guard';
import { estimateModelCostMicroUsd } from '../observability/cost-accounting';
import {
  COST_EVALUATION_DATASET,
  EVALUATION_DATASET_VERSION,
  INJECTION_EVALUATION_DATASET,
  PERMISSION_EVALUATION_DATASET,
} from './datasets';

export interface EvaluationCaseFailure {
  id: string;
  suite: 'PERMISSIONS' | 'PROMPT_INJECTION' | 'COST_ACCOUNTING';
  reason: string;
}

export interface EvaluationSuiteReport {
  datasetVersion: string;
  totalCases: number;
  passedCases: number;
  failedCases: number;
  passRate: number;
  failures: EvaluationCaseFailure[];
}

export const runRegressionEvaluationSuite = (): EvaluationSuiteReport => {
  const failures: EvaluationCaseFailure[] = [];

  for (const testCase of PERMISSION_EVALUATION_DATASET) {
    const res = evaluateToolPermission({
      role: testCase.role,
      toolName: testCase.toolName,
      riskLevel: testCase.riskLevel,
      allowAutoApproveWrites: testCase.allowAutoApproveWrites,
    });
    if (res.decision !== testCase.expectedDecision) {
      failures.push({
        id: testCase.id,
        suite: 'PERMISSIONS',
        reason: `Expected ${testCase.expectedDecision}, received ${res.decision}`,
      });
    }
  }

  for (const testCase of INJECTION_EVALUATION_DATASET) {
    const detection = detectPromptInjectionSignals(testCase.content);
    const wrapped = wrapUntrustedExternalData({
      sourceType: testCase.sourceType,
      content: testCase.content,
    });

    if (detection.flagged !== testCase.expectFlagged) {
      failures.push({
        id: testCase.id,
        suite: 'PROMPT_INJECTION',
        reason: `Expected flagged=${String(testCase.expectFlagged)}, received ${String(detection.flagged)}`,
      });
    }

    if (
      testCase.expectedSignals &&
      !testCase.expectedSignals.every((sig) => detection.signals.includes(sig))
    ) {
      failures.push({
        id: testCase.id,
        suite: 'PROMPT_INJECTION',
        reason: `Missing expected signals [${testCase.expectedSignals.join(',')}], got [${detection.signals.join(',')}]`,
      });
    }

    const closingMatches = wrapped.match(/<\/untrusted_external_data>/g) ?? [];
    if (closingMatches.length !== 1) {
      failures.push({
        id: testCase.id,
        suite: 'PROMPT_INJECTION',
        reason: `Expected exactly 1 closing boundary tag, found ${closingMatches.length}`,
      });
    }
  }

  for (const testCase of COST_EVALUATION_DATASET) {
    const cost = estimateModelCostMicroUsd({
      modelId: testCase.modelId,
      tokensUsed: testCase.inputTokens + testCase.outputTokens,
      inputTokens: testCase.inputTokens,
      outputTokens: testCase.outputTokens,
    });
    if (cost < testCase.expectedMinMicroUsd || cost > testCase.expectedMaxMicroUsd) {
      failures.push({
        id: testCase.id,
        suite: 'COST_ACCOUNTING',
        reason: `Cost ${cost} outside [${testCase.expectedMinMicroUsd}, ${testCase.expectedMaxMicroUsd}]`,
      });
    }
  }

  const totalCases =
    PERMISSION_EVALUATION_DATASET.length +
    INJECTION_EVALUATION_DATASET.length +
    COST_EVALUATION_DATASET.length;
  const failedCases = failures.length;
  const passedCases = totalCases - failedCases;

  return {
    datasetVersion: EVALUATION_DATASET_VERSION,
    totalCases,
    passedCases,
    failedCases,
    passRate: totalCases > 0 ? Number(((passedCases / totalCases) * 100).toFixed(2)) : 100,
    failures,
  };
};

export const syncEvaluationDatasetToLangSmith = async (
  datasetName: string = 'v3-phase2-safety-regression'
): Promise<{ synced: boolean; datasetId?: string; reason?: string }> => {
  if (!aiConfig.langsmith.enabled || !aiConfig.langsmith.apiKey) {
    return { synced: false, reason: 'LangSmith tracing/API key not configured' };
  }

  const client = new Client({
    apiKey: aiConfig.langsmith.apiKey,
    apiUrl: aiConfig.langsmith.endpoint,
  });

  const existing = await client.hasDataset({ datasetName });
  const dataset = existing
    ? await client.readDataset({ datasetName })
    : await client.createDataset(datasetName, {
        description: `V3 Phase 2 safety & routing regression suite v${EVALUATION_DATASET_VERSION}`,
      });

  return {
    synced: true,
    datasetId: dataset.id,
  };
};
