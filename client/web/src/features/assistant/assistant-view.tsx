'use client';

import {
  Activity,
  Bot,
  Check,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Lock,
  LockOpen,
  Pause,
  RefreshCw,
  Send,
  ShieldAlert,
  Terminal,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { FormEvent, useCallback, useMemo, useState } from 'react';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  inputClassName,
} from '@/components/ui/primitives';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { ApiClientError } from '@/lib/api-client';
import { automationApi } from '@/lib/v3-api';
import {
  AgentRole,
  AiApprovalStatus,
  AiExecution,
  AiExecutionStatus,
  ToolRiskLevel,
} from '@/types/api';

const formatMicroUsdShort = (microUsd: number): string =>
  `$${(microUsd / 1_000_000).toFixed(4)}`;

const formatCompactTokens = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return String(tokens);
};

const riskTone = (risk: ToolRiskLevel): 'green' | 'orange' | 'red' | 'dark' => {
  if (risk === 'READ') return 'green';
  if (risk === 'INTERNAL_WRITE') return 'dark';
  if (risk === 'EXTERNAL_REVERSIBLE') return 'orange';
  return 'red';
};

const statusTone = (
  status: AiExecutionStatus | AiApprovalStatus
): 'green' | 'orange' | 'red' => {
  if (status === 'COMPLETED' || status === 'EXECUTED' || status === 'APPROVED') return 'green';
  if (status === 'AWAITING_APPROVAL' || status === 'PENDING' || status === 'RUNNING') {
    return 'orange';
  }
  return 'red';
};

export function AssistantView() {
  const [prompt, setPrompt] = useState('');
  const [agentRole, setAgentRole] = useState<AgentRole>('MAIN_ORCHESTRATOR');
  const [sessionId] = useState('default');
  const [threadId, setThreadId] = useState('');
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [maxSteps, setMaxSteps] = useState(5);
  const [allowAutoApproveWrites, setAllowAutoApproveWrites] = useState(false);
  const [running, setRunning] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const fetchAssistantState = useCallback(async () => {
    const [metrics, executions, approvals, agents, tools] = await Promise.all([
      automationApi.getMetrics(),
      automationApi.listExecutions({ limit: 15 }),
      automationApi.listApprovals({ limit: 25 }),
      automationApi.listAgents(),
      automationApi.listTools(),
    ]);
    return { metrics, executions, approvals, agents, tools };
  }, []);

  const { data, error, setError, loading, reload } = useAsyncResource(
    fetchAssistantState,
    'Failed to load AI orchestrator console'
  );

  const metrics = data?.metrics ?? null;
  const executions = useMemo(() => data?.executions ?? [], [data?.executions]);
  const approvals = useMemo(() => data?.approvals ?? [], [data?.approvals]);
  const agents = data?.agents ?? [];
  const tools = data?.tools ?? [];

  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === 'PENDING'),
    [approvals]
  );

  const activeExecution: AiExecution | null = useMemo(() => {
    if (executions.length === 0) return null;
    if (selectedExecutionId) {
      const found = executions.find((e) => e.id === selectedExecutionId);
      if (found) return found;
    }
    return executions[0];
  }, [executions, selectedExecutionId]);

  const approvalPassRate = useMemo(() => {
    const executed = metrics?.approvalsByStatus?.EXECUTED ?? 0;
    const rejected = metrics?.approvalsByStatus?.REJECTED ?? 0;
    const total = executed + rejected;
    if (total === 0) return 100;
    return Math.round((executed / total) * 100);
  }, [metrics]);

  const handleRunAssistant = async (event: FormEvent) => {
    event.preventDefault();
    if (!prompt.trim()) return;
    setRunning(true);
    try {
      const exec = await automationApi.run({
        prompt: prompt.trim(),
        agentRole,
        sessionId: sessionId.trim() || 'default',
        threadId: threadId.trim() || undefined,
        maxSteps,
        allowAutoApproveWrites,
      });
      setPrompt('');
      setSelectedExecutionId(exec.id);
      if (exec.threadId) {
        setThreadId(exec.threadId);
      }
      await reload();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'AI execution failed');
    } finally {
      setRunning(false);
    }
  };

  const handleApprovalDecision = async (id: string, approve: boolean) => {
    setDecidingId(id);
    try {
      if (approve) {
        await automationApi.approve(id, 'Approved from V3 web console');
      } else {
        await automationApi.reject(id, 'Rejected from V3 web console');
      }
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Failed to process approval decision'
      );
    } finally {
      setDecidingId(null);
    }
  };

  const primaryApproval = pendingApprovals[0] ?? null;
  const secondaryApprovals = pendingApprovals.slice(1, 4);

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
        <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div className="grid flex-1 grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-8">
            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#5f5e5e]">
                Total Agent Runs
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-medium tracking-tight text-[#1a1c1a] tabular-nums sm:text-4xl">
                  {(metrics?.totalExecutions ?? 0).toLocaleString()}
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#ab3500]">LIVE</span>
              </div>
              <span className="mt-0.5 font-mono text-[11px] text-[#5f5e5e]">
                {agents.length} registered specialists
              </span>
            </div>

            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#5f5e5e]">
                Cumulative Tokens
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-medium tracking-tight text-[#1a1c1a] tabular-nums sm:text-4xl">
                  {formatCompactTokens(metrics?.totalTokensUsed ?? 0)}
                </span>
                <span className="font-mono text-[11px] text-[#5f5e5e]">ctx</span>
              </div>
              <span className="mt-0.5 font-mono text-[11px] text-[#5f5e5e]">
                {(metrics?.totalTokensUsed ?? 0).toLocaleString()} exact tokens
              </span>
            </div>

            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#5f5e5e]">
                Real-Time Cost
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-medium tracking-tight text-[#1a1c1a] tabular-nums sm:text-4xl">
                  {formatMicroUsdShort(metrics?.totalCostMicroUsd ?? 0)}
                </span>
                <span className="font-mono text-[11px] text-[#ab3500]">USD</span>
              </div>
              <span className="mt-0.5 font-mono text-[11px] text-[#5f5e5e]">
                {metrics?.totalCostMicroUsd ?? 0} micro-USD ledger
              </span>
            </div>

            <div className="flex flex-col">
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#5f5e5e]">
                Human Approvals
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl font-medium tracking-tight text-[#1a1c1a] tabular-nums sm:text-4xl">
                  {approvalPassRate}%
                </span>
                <span className="font-mono text-[11px] font-semibold text-[#ab3500]">
                  {pendingApprovals.length} waiting
                </span>
              </div>
              <span className="mt-0.5 font-mono text-[11px] text-[#5f5e5e]">
                {metrics?.approvalsByStatus?.EXECUTED ?? 0} executed •{' '}
                {metrics?.approvalsByStatus?.REJECTED ?? 0} vetoed
              </span>
            </div>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 rounded-xl bg-[#f4f3f1] p-3.5 sm:gap-4 sm:p-4 xl:w-auto xl:bg-transparent xl:p-0">
            <div className="flex w-full flex-col gap-1 sm:w-auto">
              <span className="font-mono text-[10px] uppercase text-[#5f5e5e]">Execution Thread</span>
              <select
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                className="w-full rounded-lg bg-[#ffffff] px-3 py-2 font-mono text-xs text-[#1a1c1a] shadow-xs focus:outline-none focus:ring-1 focus:ring-[#1a1c1a] sm:w-auto"
              >
                <option value="">New Ephemeral Thread</option>
                {executions.map((exec) => (
                  <option key={exec.id} value={exec.threadId}>
                    {exec.threadId.slice(0, 16)} ({exec.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-[130px] flex-col gap-1">
              <div className="flex items-center justify-between font-mono text-[10px]">
                <span className="uppercase text-[#5f5e5e]">Max Depth</span>
                <span className="font-semibold text-[#1a1c1a]">{maxSteps} steps</span>
              </div>
              <input
                type="range"
                min={2}
                max={12}
                value={maxSteps}
                onChange={(e) => setMaxSteps(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#e3e2e0] accent-[#ff6b35]"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase text-[#5f5e5e]">Auto-Write FS</span>
              <button
                type="button"
                onClick={() => setAllowAutoApproveWrites((prev) => !prev)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 font-mono text-xs font-semibold transition-colors ${
                  allowAutoApproveWrites
                    ? 'bg-[#ff6b35] text-[#ffffff]'
                    : 'bg-[#e3e2e0] text-[#1a1c1a] hover:bg-[#d8d7d5]'
                }`}
              >
                {allowAutoApproveWrites ? (
                  <>
                    <LockOpen className="h-3.5 w-3.5" />
                    <span>Auto-Internal</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5 text-[#ab3500]" />
                    <span>Locked</span>
                  </>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={reload}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#2f312f] px-3 py-2 font-mono text-xs font-medium text-[#ffffff] hover:bg-[#1a1c1a]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </section>

      {error && <ErrorBanner message={error} />}

      <section className="rounded-xl bg-[#ffffff] p-4 shadow-xs sm:p-5">
        <div className="mb-3 flex flex-col justify-between gap-3 rounded-lg bg-[#f4f3f1] px-4 py-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2f312f] text-[#ffffff] shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tracking-tight text-[#1a1c1a]">
                  V3 Genesis Orchestrator
                </span>
                <span className="rounded bg-[#e3e2e0] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#594139]">
                  PostgresSaver Ready
                </span>
                <span className="h-2 w-2 rounded-full bg-[#ff6b35]" />
              </div>
              <p className="font-mono text-[11px] text-[#5f5e5e]">
                Active Target: <span className="font-semibold text-[#1a1c1a]">{agentRole}</span> •
                Click any specialist node below to route prompts directly
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-[#5f5e5e]">
            <span className="rounded-full bg-[#ffffff] px-3 py-1 shadow-2xs">
              Session: {sessionId}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10">
          {[
            { role: 'MAIN_ORCHESTRATOR' as AgentRole, name: 'Orchestrator', tier: 'Primary' },
            ...agents.map((ag) => ({ role: ag.role, name: ag.name, tier: ag.modelTier })),
          ]
            .slice(0, 10)
            .map((node) => {
              const selected = agentRole === node.role;
              return (
                <button
                  key={node.role}
                  type="button"
                  onClick={() => setAgentRole(node.role)}
                  className={`flex flex-col justify-between rounded-lg p-2.5 text-left transition-all ${
                    selected
                      ? 'bg-[#ff6b35]/15 ring-1 ring-[#ff6b35]'
                      : 'bg-[#f4f3f1] hover:bg-[#efeeeb]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Activity
                      className={`h-3.5 w-3.5 ${selected ? 'text-[#ab3500]' : 'text-[#5f5e5e]'}`}
                    />
                    <span
                      className={`h-2 w-2 rounded-full ${
                        selected ? 'animate-pulse bg-[#ff6b35]' : 'bg-[#c8c6c5]'
                      }`}
                    />
                  </div>
                  <div className="mt-2">
                    <span className="block truncate font-mono text-[11px] font-semibold text-[#1a1c1a]">
                      {node.name}
                    </span>
                    <span
                      className={`block truncate font-mono text-[10px] ${
                        selected ? 'font-semibold text-[#ab3500]' : 'text-[#5f5e5e]'
                      }`}
                    >
                      {selected ? 'Selected' : node.tier}
                    </span>
                  </div>
                </button>
              );
            })}
        </div>
      </section>

      <section className="rounded-xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-[#ff6b35]" />
            <span className="text-base font-semibold text-[#1a1c1a]">
              Operator Objective &amp; Instruction Console
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#5f5e5e]">
            Agent: {agentRole} • Max Steps: {maxSteps}
          </span>
        </div>

        <form onSubmit={handleRunAssistant} className="space-y-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-3 font-mono text-sm font-bold text-[#ab3500]">
                &gt;
              </span>
              <input
                type="text"
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Give V3 an objective (e.g. Review overdue tasks, schedule deep work tomorrow, or triage GitHub PRs)..."
                className="w-full rounded-xl bg-[#f4f3f1] py-3 pl-8 pr-4 font-mono text-xs text-[#1a1c1a] placeholder:text-[#5f5e5e] focus:bg-[#ffffff] focus:outline-none focus:ring-1 focus:ring-[#1a1c1a] sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={running}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2f312f] px-5 py-3 text-sm font-semibold text-[#ffffff] shadow-xs transition-colors hover:bg-[#1a1c1a] disabled:opacity-50"
            >
              <Send className="h-4 w-4 text-[#ff6b35]" />
              <span>{running ? 'Running Orchestrator...' : 'Run Orchestrator'}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-[#5f5e5e]">
            <span className="uppercase">Quick Presets:</span>
            {[
              'Audit overdue tasks and create a focused catch-up schedule',
              'Search memory for active quarterly priorities and summarize gaps',
              'Draft a milestone decomposition plan for my top active goal',
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setPrompt(preset)}
                className="rounded bg-[#f4f3f1] px-2.5 py-1 text-left transition-colors hover:bg-[#efeeeb] hover:text-[#1a1c1a]"
              >
                + {preset}
              </button>
            ))}
          </div>
        </form>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-xl bg-[#ffffff] p-5 shadow-xs sm:p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f4f3f1] px-4 py-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#ab3500]" />
              <span className="text-base font-semibold text-[#1a1c1a]">
                Active Execution Trace
              </span>
              {activeExecution && (
                <span className="rounded bg-[#e3e2e0] px-2 py-0.5 font-mono text-[11px] font-medium text-[#5f5e5e]">
                  {activeExecution.threadId.slice(0, 14)}
                </span>
              )}
            </div>
            {executions.length > 0 && (
              <select
                value={activeExecution?.id || ''}
                onChange={(e) => setSelectedExecutionId(e.target.value)}
                className={`${inputClassName} w-full max-w-full py-1 font-mono text-xs sm:w-auto`}
              >
                {executions.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.agentRole} • {ex.status} ({ex.tokensUsed} tok)
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-[#5f5e5e]">Loading execution traces...</p>
          ) : !activeExecution ? (
            <EmptyState
              title="No AI executions yet"
              description="Run an assistant prompt above to inspect live LangGraph execution steps and LangSmith traces."
            />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#f4f3f1] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="dark">{activeExecution.agentRole}</Badge>
                    <Badge tone={statusTone(activeExecution.status)}>
                      {activeExecution.status}
                    </Badge>
                    <span className="font-mono text-xs text-[#5f5e5e]">
                      {activeExecution.model || 'gemini'} •{' '}
                      {activeExecution.tokensUsed.toLocaleString()} tok •{' '}
                      {formatMicroUsdShort(activeExecution.costMicroUsd)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    {activeExecution.langsmithTraceUrl && (
                      <a
                        href={activeExecution.langsmithTraceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-[#ab3500] underline"
                      >
                        <span>LangSmith</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setThreadId(activeExecution.threadId)}
                      className="font-medium text-[#594139] underline hover:text-[#1a1c1a]"
                    >
                      Reuse Thread
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#1a1c1a]">
                  {activeExecution.prompt}
                </p>
              </div>

              <div className="relative space-y-3 pl-2">
                {activeExecution.stepsData && activeExecution.stepsData.length > 0 ? (
                  activeExecution.stepsData.map((step) => (
                    <div
                      key={step.stepNumber}
                      className="flex items-start gap-3 rounded-lg bg-[#f4f3f1] p-3"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ffffff] text-[#1a1c1a] shadow-2xs">
                        {activeExecution.status === 'AWAITING_APPROVAL' ? (
                          <Pause className="h-3.5 w-3.5 text-[#ab3500]" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between font-mono text-[10px] text-[#5f5e5e]">
                          <span>STEP {String(step.stepNumber).padStart(2, '0')}</span>
                          <span>{step.finishReason}</span>
                        </div>
                        {step.toolCalls.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {step.toolCalls.map((tc) => (
                              <span
                                key={tc.toolCallId}
                                className="rounded bg-[#e3e2e0] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#1a1c1a]"
                              >
                                {tc.toolName}
                              </span>
                            ))}
                          </div>
                        )}
                        {step.text && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-[#594139]">
                            {step.text}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  activeExecution.responseText && (
                    <div className="rounded-xl bg-[#f4f3f1] p-4">
                      <span className="mb-1 block font-mono text-[10px] uppercase text-[#5f5e5e]">
                        Synthesized Response
                      </span>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1a1c1a]">
                        {activeExecution.responseText}
                      </p>
                    </div>
                  )
                )}

                {activeExecution.errorMessage && (
                  <div className="rounded-lg bg-[#ffdad6] px-3 py-2 font-mono text-xs text-[#93000a]">
                    {activeExecution.errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-5">
          <div className="rounded-xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
            <div className="flex items-center justify-between rounded-lg bg-[#f4f3f1] px-4 py-3">
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4 text-[#ff6b35]" />
                <span className="text-base font-semibold text-[#1a1c1a]">
                  Human Approval Queue
                </span>
              </div>
              <Badge tone={pendingApprovals.length > 0 ? 'orange' : 'green'}>
                {pendingApprovals.length} pending
              </Badge>
            </div>

            {!primaryApproval ? (
              <div className="mt-4">
                <EmptyState
                  title="Approval queue clear"
                  description="Guarded external actions triggered by specialist agents will pause here for signature."
                />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#ffdad6] px-2 py-0.5 font-mono text-[11px] font-bold uppercase text-[#93000a]">
                    {primaryApproval.riskLevel}
                  </span>
                  <span className="font-mono text-[11px] text-[#5f5e5e]">
                    Agent: {primaryApproval.agentRole}
                  </span>
                </div>

                <h3 className="break-words text-lg font-medium leading-tight text-[#1a1c1a]">
                  Approve Tool: <code className="break-all font-mono">{primaryApproval.toolName}</code>
                </h3>

                <div className="max-w-full overflow-x-auto rounded-lg bg-[#f4f3f1] p-3.5 shadow-inner">
                  <div className="mb-2 flex items-center justify-between rounded bg-[#ffffff]/60 px-2 py-1 font-mono text-[10px] font-semibold uppercase text-[#5f5e5e]">
                    <span>Tool Call Payload</span>
                    <span>JSON Schema</span>
                  </div>
                  <pre className="max-h-48 overflow-auto font-mono text-xs leading-relaxed text-[#1a1c1a]">
                    <code>{JSON.stringify(primaryApproval.toolArgs, null, 2)}</code>
                  </pre>
                </div>

                {primaryApproval.errorMessage && (
                  <p className="font-mono text-xs text-[#ba1a1a]">
                    {primaryApproval.errorMessage}
                  </p>
                )}

                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    disabled={decidingId === primaryApproval.id}
                    onClick={() => handleApprovalDecision(primaryApproval.id, true)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#ff6b35] px-4 py-2.5 text-sm font-semibold text-[#ffffff] shadow-xs transition-colors hover:bg-[#ab3500] disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>
                      {decidingId === primaryApproval.id ? 'Processing...' : 'Approve & Execute'}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={decidingId === primaryApproval.id}
                    onClick={() => handleApprovalDecision(primaryApproval.id, false)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-[#f4f3f1] px-4 py-2.5 text-sm font-semibold text-[#1a1c1a] shadow-xs transition-colors hover:bg-[#ffdad6] hover:text-[#93000a] disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4 text-[#ba1a1a]" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {secondaryApprovals.map((app) => (
            <div key={app.id} className="rounded-xl bg-[#ffffff] p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <Badge tone={riskTone(app.riskLevel)}>{app.riskLevel}</Badge>
                <span className="font-mono text-[11px] text-[#5f5e5e]">{app.agentRole}</span>
              </div>
              <p className="mt-2 font-mono text-xs font-semibold text-[#1a1c1a]">
                {app.toolName}
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={decidingId === app.id}
                  onClick={() => handleApprovalDecision(app.id, false)}
                  className="rounded-lg px-2.5 py-1 font-mono text-[11px] text-[#5f5e5e] hover:bg-[#efeeeb]"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={decidingId === app.id}
                  onClick={() => handleApprovalDecision(app.id, true)}
                  className="rounded-lg bg-[#f4f3f1] px-3 py-1 font-mono text-[11px] font-semibold text-[#1a1c1a] hover:bg-[#ff6b35] hover:text-[#ffffff]"
                >
                  1-Click Approve
                </button>
              </div>
            </div>
          ))}

          {approvals.filter((a) => a.status !== 'PENDING').length > 0 && (
            <div className="rounded-xl bg-[#ffffff] p-4 shadow-xs">
              <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] uppercase text-[#5f5e5e]">
                <ShieldAlert className="h-3.5 w-3.5 text-[#ab3500]" />
                <span>Recent Approval Decisions</span>
              </div>
              <div className="space-y-1.5">
                {approvals
                  .filter((a) => a.status !== 'PENDING')
                  .slice(0, 4)
                  .map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between rounded-lg bg-[#f4f3f1] px-3 py-2 font-mono text-[11px]"
                    >
                      <span className="truncate pr-2 font-medium text-[#1a1c1a]">
                        {app.toolName}
                      </span>
                      <Badge tone={statusTone(app.status)}>{app.status}</Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-xl bg-[#ffffff] p-5 shadow-xs sm:p-6">
        <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-[#1a1c1a]" />
              <h2 className="text-base font-semibold text-[#1a1c1a]">
                Registered MCP Tool Explorer &amp; Risk Policy
              </h2>
            </div>
            <p className="mt-0.5 font-mono text-[11px] text-[#5f5e5e]">
              Runtime Model Context Protocol policy boundaries and human signature enforcement
            </p>
          </div>
          <span className="rounded bg-[#f4f3f1] px-2.5 py-1 font-mono text-[11px] font-medium text-[#5f5e5e]">
            {tools.length} active tools declared
          </span>
        </div>

        <div className="space-y-2.5 md:hidden">
          {tools.map((tool) => (
            <div key={tool.name} className="rounded-xl bg-[#f4f3f1] p-3.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="break-all font-mono font-semibold text-[#1a1c1a]">{tool.name}</span>
                <Badge tone={riskTone(tool.riskLevel)}>{tool.riskLevel}</Badge>
              </div>
              <p className="mt-1.5 text-[#594139]">{tool.description}</p>
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-[#5f5e5e]">
                <span>Domain: {tool.domain}</span>
                <span className={tool.policy === 'REQUIRE_APPROVAL' ? 'font-semibold text-[#ab3500]' : ''}>
                  {tool.policy === 'REQUIRE_APPROVAL' ? 'MANDATORY SIGN-OFF' : 'AUTO_EXECUTE'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="-mx-5 hidden overflow-x-auto sm:-mx-6 md:block">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="bg-[#f4f3f1] font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                <th className="px-6 py-3">Tool Identifier</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Risk Level</th>
                <th className="px-4 py-3">Policy Gate</th>
                <th className="px-6 py-3">Capability Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e9e8e5] text-xs text-[#1a1c1a]">
              {tools.map((tool) => (
                <tr key={tool.name} className="transition-colors hover:bg-[#f4f3f1]/60">
                  <td className="px-6 py-3.5 font-mono font-semibold text-[#1a1c1a]">
                    {tool.name}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[#5f5e5e]">{tool.domain}</td>
                  <td className="px-4 py-3.5">
                    <Badge tone={riskTone(tool.riskLevel)}>{tool.riskLevel}</Badge>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[11px]">
                    {tool.policy === 'REQUIRE_APPROVAL' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#ab3500]">
                        <Lock className="h-3 w-3" />
                        MANDATORY SIGN-OFF
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#5f5e5e]">
                        <X className="hidden" />
                        AUTO_EXECUTE
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5 text-[#594139]">{tool.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
