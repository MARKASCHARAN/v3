import { LanguageModel, ModelMessage, ToolSet, generateText, stepCountIs } from 'ai';
import { ExecutionStepTrace } from '../tools/tool.types';
import { RetryOptions, withAiRetry } from './retry.workflow';

export interface MultiStepWorkflowInput {
  model: LanguageModel;
  system: string;
  messages: ModelMessage[];
  tools: ToolSet;
  maxSteps: number;
  retryOptions?: RetryOptions;
}

export interface MultiStepWorkflowOutput {
  text: string;
  attempts: number;
  steps: ExecutionStepTrace[];
}

export const runMultiStepToolWorkflow = async (
  input: MultiStepWorkflowInput
): Promise<MultiStepWorkflowOutput> => {
  const { result, attempts } = await withAiRetry(
    () =>
      generateText({
        model: input.model,
        system: input.system,
        messages: input.messages,
        tools: input.tools,
        stopWhen: stepCountIs(input.maxSteps),
      }),
    input.retryOptions
  );

  const steps: ExecutionStepTrace[] = result.steps.map((step, index) => ({
    stepNumber: index + 1,
    finishReason: step.finishReason,
    text: step.text,
    toolCalls: step.toolCalls.map((call) => ({
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      input: call.input,
    })),
    toolResults: step.toolResults.map((toolResult) => ({
      toolCallId: toolResult.toolCallId,
      toolName: toolResult.toolName,
      output: toolResult.output,
    })),
  }));

  return {
    text: result.text,
    attempts,
    steps,
  };
};
