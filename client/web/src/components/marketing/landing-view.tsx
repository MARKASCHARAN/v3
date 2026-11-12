'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Check,
  CheckCheck,
  CheckCircle2,
  Code2,
  Copy,
  Clock,
  Fingerprint,
  FlaskConical,
  Lock,
  Menu,
  Mic,
  PenTool,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Terminal,
  User,
  X,
  Zap,
} from 'lucide-react';

export function LandingView() {
  const [shipped, setShipped] = useState(false);
  const [email, setEmail] = useState('');
  const [ctaSubmitted, setCtaSubmitted] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const installSnippet = 'curl v3.ai/os | sh';

  async function handleCopyCurl() {
    try {
      await navigator.clipboard.writeText(installSnippet);
      setCopiedCurl(true);
      window.setTimeout(() => setCopiedCurl(false), 2000);
    } catch {
      setCopiedCurl(true);
      window.setTimeout(() => setCopiedCurl(false), 2000);
    }
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a1c1a] font-sans antialiased selection:bg-[#ff6b35]/20 selection:text-[#5f1900]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#faf9f6]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-10">
            <Link href="/" className="flex select-none items-center gap-1 tracking-tight">
              <span className="text-base font-semibold tracking-tighter text-[#1a1c1a]">V3</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[#5f5e5e]">
                OS
              </span>
              <span className="ml-0.5 inline-block h-2 w-2 animate-pulse rounded-full bg-[#ff6b35]" />
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              <a
                href="#features"
                className="rounded-xl px-4 py-2 text-sm text-[#594139] transition-colors hover:bg-[#e9e8e5]/60 hover:text-[#1a1c1a]"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="rounded-xl px-4 py-2 text-sm text-[#594139] transition-colors hover:bg-[#e9e8e5]/60 hover:text-[#1a1c1a]"
              >
                How it Works
              </a>
              <a
                href="#agent-fleet"
                className="rounded-xl px-4 py-2 text-sm text-[#594139] transition-colors hover:bg-[#e9e8e5]/60 hover:text-[#1a1c1a]"
              >
                Agent Fleet
              </a>
              <a
                href="#deploy"
                className="rounded-xl px-4 py-2 text-sm text-[#594139] transition-colors hover:bg-[#e9e8e5]/60 hover:text-[#1a1c1a]"
              >
                Deploy
              </a>
              <a
                href="#preview"
                className="rounded-xl px-4 py-2 text-sm text-[#594139] transition-colors hover:bg-[#e9e8e5]/60 hover:text-[#1a1c1a]"
              >
                Live OS
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden px-3 py-2 text-sm text-[#594139] transition-colors hover:text-[#1a1c1a] sm:inline-flex"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-[#ffffff] transition-all hover:bg-[#ad3300] sm:px-5"
            >
              Try V3 Free
            </Link>
            <Link
              href="/dashboard"
              title="Open Workspace"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#ab3500] text-[#ffffff] transition-opacity hover:opacity-90"
            >
              <User className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle mobile menu"
              className="rounded-lg bg-[#efeeeb] p-1.5 text-[#1a1c1a] lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-[#e9e8e5] bg-[#faf9f6] px-6 py-4 lg:hidden">
            <div className="flex flex-col gap-2 text-sm text-[#594139]">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Features
              </a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                How it Works
              </a>
              <a href="#agent-fleet" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Agent Fleet
              </a>
              <a href="#deploy" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Deploy
              </a>
              <div className="mt-2 flex gap-2 border-t border-[#e9e8e5] pt-3">
                <Link
                  href="/login"
                  className="flex-1 rounded-xl bg-[#efeeeb] py-2 text-center font-medium text-[#1a1c1a]"
                >
                  Sign In
                </Link>
                <Link
                  href="/dashboard"
                  className="flex-1 rounded-xl bg-[#1a1c1a] py-2 text-center font-medium text-[#ffffff]"
                >
                  Open OS
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="w-full bg-[#faf9f6] pt-16">
        <div className="flex w-full flex-col">
          <section className="relative mx-auto flex w-full max-w-[1400px] flex-col items-center px-4 pb-8 pt-12 text-center sm:px-8 sm:pt-14">
            <div className="pointer-events-none absolute -top-12 left-1/2 -z-10 h-[340px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#ffdbd0]/40 via-[#ffb59e]/20 to-transparent blur-3xl" />

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-6 inline-flex cursor-default items-center gap-2 rounded-full bg-[#ffffff] px-4 py-1.5 shadow-sm transition-transform hover:scale-[1.02]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b35] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b35]" />
              </span>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#1a1c1a]">
                Meet V3 OS
              </span>
              <span className="font-mono text-[11px] text-[#e1bfb5]">•</span>
              <span className="text-[13px] font-medium text-[#594139]">
                Your Personal AI Operating System
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="mb-4 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.03em] text-[#1a1c1a] sm:text-[56px]"
            >
              Your life &amp; work, running{' '}
              <span className="relative inline-block bg-gradient-to-r from-[#ff6b35] via-[#ad3300] to-[#ff6b35] bg-clip-text text-transparent underline decoration-[#ffdbd0] decoration-wavy decoration-2 underline-offset-8">
                autonomously
              </span>{' '}
              on AI.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-10 max-w-2xl text-base leading-relaxed text-[#594139]"
            >
              V3 transforms high-level ambitions into verified results. Specialist agents decompose
              your goals, manage your calendar, draft code, and handle triage—all with
              human-in-the-loop sovereign safety.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="mb-10 flex w-full max-w-md flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <Link
                href="/register"
                className="group flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#ff6b35] px-8 py-3.5 text-base font-semibold text-[#ffffff] shadow-md transition-all duration-200 hover:bg-[#ad3300] sm:w-auto"
              >
                <span>Start in 60 Seconds</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#preview"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#ffffff] px-6 py-3.5 text-base font-semibold text-[#1a1c1a] shadow-sm transition-all duration-200 hover:bg-[#f4f3f1] sm:w-auto"
              >
                <PlayCircle className="h-4 w-4 text-[#ff6b35]" />
                <span>Explore Live OS</span>
              </a>
            </motion.div>

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-full bg-[#f4f3f1]/80 px-6 py-2 font-mono text-[13px] text-[#594139] shadow-sm">
              <div className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-[#ff6b35]" />
                <span className="font-medium text-[#1a1c1a]">1,400+</span> active operators
              </div>
              <div className="hidden font-mono text-[11px] text-[#e1bfb5] sm:block">•</div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#ff6b35]" />
                <span className="font-medium text-[#1a1c1a]">99.4%</span> task autonomy
              </div>
              <div className="hidden font-mono text-[11px] text-[#e1bfb5] sm:block">•</div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[#ff6b35]" />
                <span>Zero leaks (Local Enclave)</span>
              </div>
            </div>
          </section>

          <section id="preview" className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55 }}
              className="relative overflow-hidden rounded-3xl bg-[#ffffff] p-4 shadow-xl sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between rounded-xl bg-[#f4f3f1] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ba1a1a]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ffb59e]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[#ff6b35]" />
                  </div>
                  <span className="ml-1 font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                    v3-os-kernel.local
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 rounded-md bg-[#ffffff] px-2.5 py-0.5 shadow-sm">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff6b35]" />
                    <span className="font-mono text-[11px] text-[#1a1c1a]">
                      Autonomous Engine v3.4
                    </span>
                  </div>
                  <span className="hidden font-mono text-[11px] text-[#5f5e5e] md:inline">
                    Stream: Live Sync (0.4ms)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                <div className="flex flex-col gap-4 lg:col-span-8">
                  <div className="rounded-2xl bg-[#efeeeb] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase text-[#5f5e5e]">
                        Captured Ambient Intent
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[#ff6b35]">
                        Priority 0 • Fast-path
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 rounded-xl bg-[#ffffff] p-4 shadow-sm">
                      <Terminal className="mt-0.5 h-5 w-5 shrink-0 text-[#ff6b35]" />
                      <p className="text-sm font-medium leading-relaxed text-[#1a1c1a]">
                        &ldquo;Draft YC investor memo from research vault &amp; prepare pull request
                        for analytics migration.&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl bg-[#f4f3f1] p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase text-[#5f5e5e]">
                        Autonomous Execution Stream
                      </span>
                      <span className="rounded bg-[#e9e8e5] px-2 py-0.5 font-mono text-[11px] text-[#1a1c1a]">
                        All telemetry signed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                      <div className="flex flex-col justify-between rounded-xl bg-[#ffffff] p-3 shadow-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-[#5f5e5e]">01. Lexical</span>
                          <CheckCircle2 className="h-4 w-4 text-[#ff6b35]" />
                        </div>
                        <div className="text-[13px] font-semibold text-[#1a1c1a]">Understand</div>
                        <div className="mt-1 font-mono text-[11px] text-[#5f5e5e]">
                          12ms • Complete
                        </div>
                      </div>

                      <div className="flex flex-col justify-between rounded-xl bg-[#ffffff] p-3 shadow-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-[#5f5e5e]">02. Retrieval</span>
                          <CheckCircle2 className="h-4 w-4 text-[#ff6b35]" />
                        </div>
                        <div className="text-[13px] font-semibold text-[#1a1c1a]">Vector RRF</div>
                        <div className="mt-1 font-mono text-[11px] text-[#5f5e5e]">
                          38ms • 14 chunks
                        </div>
                      </div>

                      <div className="flex flex-col justify-between rounded-xl bg-[#ffffff] p-3 shadow-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-[#ff6b35]">
                            03. Code Fleet
                          </span>
                          <RefreshCw className="h-4 w-4 animate-spin text-[#ff6b35]" />
                        </div>
                        <div className="text-[13px] font-semibold text-[#1a1c1a]">
                          Code Architect
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-[#ff6b35]">
                          Executing tests...
                        </div>
                      </div>

                      <div className="flex flex-col justify-between rounded-xl bg-[#ffdbd0]/60 p-3">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-mono text-[11px] text-[#832600]">04. Gate</span>
                          <PenTool className="h-4 w-4 text-[#ff6b35]" />
                        </div>
                        <div className="text-[13px] font-semibold text-[#832600]">
                          {shipped ? 'Verified' : 'Awaiting Gate'}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-[#832600]">
                          {shipped ? 'Signed & Live' : '1-Click Signature'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#ffffff] p-4 shadow-sm sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffdbd0]">
                        <ShieldCheck className="h-5 w-5 text-[#ff6b35]" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-[#1a1c1a]">
                          Sign &amp; Deploy: PR #184 (Postgres migration)
                        </div>
                        <div className="font-mono text-[11px] text-[#5f5e5e]">
                          Deterministic boundary • Zero data mutation without manual sign
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShipped((prev) => !prev)}
                        className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold text-[#ffffff] shadow-sm transition-all duration-150 ${
                          shipped
                            ? 'bg-[#2f312f] hover:bg-[#1a1c1a]'
                            : 'bg-[#ff6b35] hover:bg-[#ad3300]'
                        }`}
                      >
                        {shipped ? (
                          <>
                            <Check className="h-4 w-4" />
                            <span>Shipped!</span>
                          </>
                        ) : (
                          <>
                            <CheckCheck className="h-4 w-4" />
                            <span>Approve &amp; Ship</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:col-span-4">
                  <div className="flex flex-col justify-between rounded-2xl bg-[#f4f3f1] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase text-[#5f5e5e]">
                        Neural Rhythm
                      </span>
                      <span className="rounded-full bg-[#ffdbd0] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[#832600]">
                        Active Defense
                      </span>
                    </div>
                    <div className="mb-1 flex items-baseline justify-between">
                      <div className="text-4xl font-medium tracking-tight text-[#1a1c1a]">
                        4.5<span className="text-xl font-semibold text-[#5f5e5e]">h</span>
                      </div>
                      <span className="text-[13px] font-medium text-[#ff6b35]">
                        +1.2h vs yesterday
                      </span>
                    </div>
                    <p className="text-[13px] leading-relaxed text-[#594139]">
                      Chronos deflected 4 synchronous invites and bundled 8 email threads into
                      silent summaries.
                    </p>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl bg-[#f4f3f1] p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase text-[#5f5e5e]">
                        Contextual Friction
                      </span>
                      <span className="font-mono text-[11px] text-[#5f5e5e]">Nominal (Low)</span>
                    </div>
                    <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-[#e9e8e5]">
                      <div className="h-full w-[12%] rounded-full bg-[#ff6b35] transition-all duration-500" />
                    </div>
                    <div className="flex items-center justify-between font-mono text-[11px] text-[#594139]">
                      <span>Friction Score: 12%</span>
                      <span className="font-semibold text-[#ff6b35]">State: Deep Flow</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-[#ffffff] p-4 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="h-3 w-3 rounded-full bg-[#ff6b35]" />
                      <div>
                        <div className="text-[13px] font-semibold text-[#1a1c1a]">
                          Local Enclave Running
                        </div>
                        <div className="font-mono text-[11px] text-[#5f5e5e]">
                          16 CPU Cores Allocated
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[#5f5e5e]">0.00ms lag</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          <section id="agent-fleet" className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-8">
            <div className="mb-8 flex flex-col justify-between md:flex-row md:items-end">
              <div>
                <div className="mb-2 inline-flex items-center rounded-md bg-[#ffdbd0]/60 px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-[#832600]">
                  Subsystem Fleet
                </div>
                <h2 className="text-3xl font-medium tracking-tight text-[#1a1c1a] sm:text-4xl">
                  Specialized autonomous minds.
                </h2>
              </div>
              <p className="mt-2 max-w-md text-sm text-[#594139] md:mt-0">
                Each agent operates inside a hardened sandbox with explicit capabilities, fine-tuned
                micro-models, and zero hallucination tolerances.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {[
                {
                  icon: FlaskConical,
                  tag: 'Grounded • 0.88 Cosine',
                  title: 'Research Synthesizer',
                  desc: 'Scans 100+ internal notes and verified citations. Eliminates hallucinations by forcing strict source grounding against your local vector database.',
                  leftMeta: 'Auto-Index: Active',
                  rightMeta: 'Ready',
                },
                {
                  icon: Code2,
                  tag: 'MCP Native • Fullstack',
                  title: 'Code Architect',
                  desc: 'Spins isolated git worktrees, writes unit tests, and prepares structured pull requests. Never modifies production code without your explicit sign-off.',
                  leftMeta: 'Sandbox: Safe',
                  rightMeta: 'Tests Verified',
                },
                {
                  icon: Clock,
                  tag: 'Auto-Deflect • Zero Drift',
                  title: 'Chronos Planner',
                  desc: 'Aggressively defends your morning creative hours. Automatically reschedules overlapping commitments, inserts recovery breaks, and syncs blocks effortlessly.',
                  leftMeta: 'Defending: Morning Slot',
                  rightMeta: 'Sealed',
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="group flex flex-col justify-between overflow-hidden rounded-3xl bg-[#ffffff] p-6 shadow-sm transition-all duration-200 hover:shadow-md"
                  >
                    <div>
                      <div className="mb-5 flex items-start justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f4f3f1] text-[#ff6b35] transition-transform group-hover:scale-105">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="rounded-full bg-[#f4f3f1] px-3 py-1 font-mono text-[11px] font-semibold text-[#5f5e5e]">
                          {card.tag}
                        </span>
                      </div>
                      <h3 className="mb-2 text-base font-semibold text-[#1a1c1a]">{card.title}</h3>
                      <p className="mb-6 text-sm leading-relaxed text-[#594139]">{card.desc}</p>
                    </div>

                    <div className="-mx-6 -mb-6 flex items-center justify-between bg-[#f4f3f1] px-6 py-3.5">
                      <span className="font-mono text-[11px] text-[#5f5e5e]">{card.leftMeta}</span>
                      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#ff6b35]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b35]" />
                        <span>{card.rightMeta}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section id="how-it-works" className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-8">
            <div id="features" className="mx-auto mb-10 max-w-2xl text-center">
              <div className="mb-2 inline-flex items-center rounded-md bg-[#f4f3f1] px-2.5 py-1 font-mono text-[11px] font-bold uppercase text-[#5f5e5e]">
                Execution Protocol
              </div>
              <h2 className="text-3xl font-medium tracking-tight text-[#1a1c1a] sm:text-4xl">
                How intent becomes reality.
              </h2>
              <p className="mt-2 text-sm text-[#594139]">
                A deterministic 3-tier pipeline designed for absolute reliability and verifiable
                accountability.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="flex flex-col justify-between rounded-3xl bg-[#f4f3f1] p-6">
                <div>
                  <span className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wider text-[#ff6b35]">
                    Step 01
                  </span>
                  <h3 className="mb-2 text-xl font-medium text-[#1a1c1a]">Speak Your Ambition</h3>
                  <p className="mb-6 text-sm leading-relaxed text-[#594139]">
                    Talk or write in unstructured human language. V3 extracts context, decodes
                    priorities, and maps dependencies automatically.
                  </p>
                </div>
                <div className="rounded-xl bg-[#ffffff] p-4 shadow-sm">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <Mic className="h-4 w-4 text-[#ff6b35]" />
                    <span className="font-mono text-[11px] text-[#5f5e5e]">Raw Input Sample</span>
                  </div>
                  <p className="font-mono text-[13px] text-[#1a1c1a]">
                    &ldquo;Organize my Q3 strategy doc &amp; alert engineering.&rdquo;
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-3xl bg-[#f4f3f1] p-6">
                <div>
                  <span className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wider text-[#ff6b35]">
                    Step 02
                  </span>
                  <h3 className="mb-2 text-xl font-medium text-[#1a1c1a]">Multi-Agent Delegation</h3>
                  <p className="mb-6 text-sm leading-relaxed text-[#594139]">
                    Subsystems execute concurrently. If one encounters an unexpected obstacle, peer
                    agents self-correct and coordinate behind cryptographic barriers.
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl bg-[#ffffff] p-4 shadow-sm">
                  <div className="flex items-center justify-between font-mono text-[13px]">
                    <span className="text-[#594139]">Parallel Threads</span>
                    <span className="font-semibold text-[#ff6b35]">4 Active Nodes</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#e9e8e5]">
                    <div className="h-full w-3/4 rounded-full bg-[#ff6b35]" />
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-3xl bg-[#f4f3f1] p-6">
                <div>
                  <span className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-wider text-[#ff6b35]">
                    Step 03
                  </span>
                  <h3 className="mb-2 text-xl font-medium text-[#1a1c1a]">One-Click Governance</h3>
                  <p className="mb-6 text-sm leading-relaxed text-[#594139]">
                    You hold the root encryption key. High-impact operations pause for your explicit,
                    unambiguous permission. No runaway agents. Ever.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#ffffff] p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-5 w-5 text-[#ff6b35]" />
                    <span className="text-[13px] font-semibold text-[#1a1c1a]">
                      Operator Signature
                    </span>
                  </div>
                  <span className="rounded bg-[#ffdbd0] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#832600]">
                    Hardware Gate
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-[#ffffff] p-8 text-center shadow-md sm:p-12">
              <div className="pointer-events-none absolute -top-4 left-6 select-none font-serif text-7xl leading-none text-[#ffdbd0]/60">
                &ldquo;
              </div>
              <p className="relative z-10 mx-auto mb-6 max-w-3xl text-xl font-medium leading-snug text-[#1a1c1a] sm:text-2xl">
                &ldquo;V3 took over our mundane infrastructure tasks and morning calendar triage. It
                honestly feels like having an L9 Chief of Staff who never sleeps.&rdquo;
              </p>
              <div className="relative z-10 flex flex-col items-center justify-center">
                <div className="text-base font-semibold text-[#1a1c1a]">Dr. Evelyn Vance</div>
                <div className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-[#5f5e5e]">
                  Senior Autonomous Systems Lead • Ex-DeepMind
                </div>
              </div>
            </div>
          </section>

          <section id="deploy" className="mx-auto w-full max-w-[1240px] px-4 pb-14 pt-6 sm:px-8">
            <div className="relative flex flex-col items-center overflow-hidden rounded-3xl bg-[#efeeeb] p-8 text-center shadow-lg sm:p-12">
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#ffdbd0]/40 blur-2xl" />

              <div className="mb-3 inline-flex items-center rounded-full bg-[#ffffff] px-3 py-1 font-mono text-[11px] font-bold uppercase text-[#ff6b35] shadow-sm">
                Instant Deployment
              </div>
              <h2 className="mb-2 max-w-2xl text-3xl font-semibold tracking-tight text-[#1a1c1a] sm:text-5xl">
                Reclaim 15+ hours every week.
              </h2>
              <p className="mb-8 max-w-xl text-base text-[#594139]">
                Launch the sovereign personal kernel or connect your workspace cockpit in under two
                minutes.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setCtaSubmitted(true);
                }}
                className="mb-5 flex w-full max-w-md flex-col items-center gap-2 rounded-full bg-[#ffffff] p-1.5 shadow-md sm:flex-row"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full bg-transparent px-4 py-3 text-sm text-[#1a1c1a] placeholder:text-[#594139]/60 focus:outline-none"
                />
                <button
                  type="submit"
                  className="w-full shrink-0 rounded-full bg-[#ff6b35] px-6 py-3 text-sm font-semibold text-[#ffffff] transition-all duration-150 hover:bg-[#ad3300] sm:w-auto"
                >
                  Get Started Free
                </button>
              </form>

              {ctaSubmitted && (
                <div className="mb-4 text-sm font-semibold text-[#ab3500]">
                  Workspace invite queued for {email}!{' '}
                  <Link href="/register" className="underline">
                    Complete registration now
                  </Link>
                  .
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-[#594139]">
                <span>No credit card required</span>
                <span>•</span>
                <span>Local or cloud enclave</span>
                <span>•</span>
                <span>Instant 1-click setup</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="w-full bg-[#f4f3f1] shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="mx-auto max-w-[1680px] px-4 py-12 sm:px-8">
          <div className="mb-10 grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <div className="mb-4 flex items-center gap-1.5">
                <span className="text-base font-semibold text-[#1a1c1a]">V3</span>
                <span className="font-mono text-[11px] uppercase text-[#5f5e5e]">OS</span>
                <span className="h-2 w-2 rounded-full bg-[#ff6b35]" />
              </div>
              <p className="mb-4 text-[13px] leading-relaxed text-[#594139]">
                Autonomous Personal AI Operating System engineered for sovereign, high-velocity
                background intelligence.
              </p>
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-[#faf9f6] px-3 py-1.5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b35]" />
                <span className="font-mono text-[11px] text-[#1a1c1a]">
                  All Subsystems Nominal 99.98%
                </span>
              </div>
            </div>

            <div>
              <div className="mb-4 font-mono text-[11px] uppercase text-[#5f5e5e]">
                Product Architecture
              </div>
              <ul className="flex flex-col gap-2 text-[13px] text-[#594139]">
                <li>
                  <Link href="/dashboard/assistant" className="hover:text-[#1a1c1a]">
                    Agent Orchestration
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/memory" className="hover:text-[#1a1c1a]">
                    Local Context Engine
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/ops" className="hover:text-[#1a1c1a]">
                    Dynamic Telemetry Docks
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/goals" className="hover:text-[#1a1c1a]">
                    Autonomous Worksheets
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-4 font-mono text-[11px] uppercase text-[#5f5e5e]">
                Workspace Modules
              </div>
              <ul className="flex flex-col gap-2 text-[13px] text-[#594139]">
                <li>
                  <Link href="/dashboard/research" className="hover:text-[#1a1c1a]">
                    Research Library
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/voice" className="hover:text-[#1a1c1a]">
                    Voice Studio
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/integrations" className="hover:text-[#1a1c1a]">
                    Integration Vault
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/developer" className="hover:text-[#1a1c1a]">
                    Developer Workspace
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="mb-4 font-mono text-[11px] uppercase text-[#5f5e5e]">
                Terminal Access
              </div>
              <p className="mb-4 text-[13px] text-[#594139]">
                Connect to the sovereign V3 compute stack.
              </p>
              <button
                type="button"
                onClick={handleCopyCurl}
                className="flex w-full items-center justify-between gap-2 rounded-lg bg-[#faf9f6] px-4 py-2 font-mono text-[13px] text-[#594139] shadow-[0_1px_8px_rgba(0,0,0,0.04)] hover:text-[#1a1c1a]"
              >
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-[#ff6b35]">$</span>
                  <span>{installSnippet}</span>
                </span>
                {copiedCurl ? (
                  <Check className="h-3.5 w-3.5 text-[#ab3500]" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#5f5e5e]" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-[#e9e8e5] pt-6 sm:flex-row">
            <div className="font-mono text-[11px] text-[#5f5e5e]">
              V3 Systems — Autonomous Personal Operating Fabric.
            </div>
            <div className="flex items-center gap-6 text-[13px] text-[#594139]">
              <Link href="/login" className="hover:text-[#1a1c1a]">
                Sign In
              </Link>
              <Link href="/register" className="hover:text-[#1a1c1a]">
                Create Workspace
              </Link>
              <Link href="/dashboard" className="hover:text-[#1a1c1a]">
                Dashboard OS
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
