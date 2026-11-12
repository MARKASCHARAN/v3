'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar,
  Check,
  CheckCircle2,
  Code2,
  Database,
  Lock,
  Mail,
  MessageSquare,
  Mic,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export function ProductBentoGrid() {
  return (
    <section id="features" className="relative z-10 w-full bg-[#050505] text-white py-20 sm:py-28 px-4 sm:px-6 lg:px-8 border-y border-white/5">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[840px] h-[480px] bg-gradient-to-b from-[#FF6B35]/[0.05] via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1200px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-12 sm:mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-sans font-medium tracking-tight text-white leading-[1.1]">
            Everything connected. Everything moving.
          </h2>
          <p className="mt-4 text-sm sm:text-base md:text-lg text-[#A1A1A1] max-w-xl mx-auto leading-relaxed">
            One intelligent system for your goals, work, knowledge, and digital life.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="group relative rounded-[24px] bg-[#0B0B0B] border border-white/[0.08] hover:border-white/[0.18] p-6 sm:p-8 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] lg:col-span-6 lg:row-span-2 order-1"
          >
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-[#FF6B35]/[0.08] blur-3xl transition-opacity group-hover:opacity-100 opacity-60" />

            <div>
              <div className="mb-3 font-mono text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] uppercase text-[#FF6B35]">
                WHAT IS V3
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-[28px] font-medium tracking-tight text-white leading-snug">
                Your personal AI system for getting things done.
              </h3>
              <p className="mt-3 text-xs sm:text-sm text-[#A1A1A1] leading-relaxed max-w-lg">
                V3 connects your goals, plans, tasks, memory, and digital tools into one intelligent
                system that helps turn intentions into action.
              </p>
              <div className="mt-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-white/90 hover:text-[#FF6B35] transition-colors"
                >
                  <span>See how V3 works</span>
                  <span className="transition-transform group-hover:translate-x-0.5">↗</span>
                </Link>
              </div>
            </div>

            <div className="relative mt-7 rounded-2xl bg-[#101012] border border-white/[0.07] p-4 sm:p-5 shadow-inner overflow-hidden">
              <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="ml-2 font-mono text-[10px] text-white/40">v3-core.local</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6B35] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF6B35]" />
                  </span>
                  <span className="font-mono text-[10px] font-medium text-white/60">LIVE SYNC</span>
                </div>
              </div>

              <div className="space-y-3 font-mono">
                <div className="rounded-xl bg-[#161619] p-3 border border-white/[0.05]">
                  <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                    <span>AMBIENT INTENT</span>
                    <span className="text-[#FF6B35]">FAST-PATH</span>
                  </div>
                  <p className="font-sans text-xs text-white/90 leading-relaxed">
                    &ldquo;Draft Q3 product roadmap from strategy notes &amp; schedule architecture
                    review.&rdquo;
                  </p>
                </div>

                <div className="rounded-xl bg-[#161619] p-3 border border-white/[0.05]">
                  <div className="flex items-center justify-between text-[10px] mb-1.5">
                    <span className="text-white/60 uppercase">Q3 Product Launch</span>
                    <span className="text-[#FF6B35] font-semibold">72% Completed</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#FF6B35] to-[#E95724]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-[#141416] p-2.5 border border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <Check className="h-3.5 w-3.5 shrink-0 text-[#22c55e]" />
                      <span className="truncate text-white/80">Research Grounded</span>
                    </div>
                    <span className="text-[10px] text-white/40 shrink-0">14 chunks</span>
                  </div>
                  <div className="rounded-lg bg-[#141416] p-2.5 border border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin text-[#FF6B35]" />
                      <span className="truncate text-white/80">Code Worktree</span>
                    </div>
                    <span className="text-[10px] text-[#FF6B35] shrink-0">Running</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="group relative rounded-[24px] bg-[#0A0A0A] border border-white/[0.08] hover:border-white/[0.18] p-6 sm:p-7 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] lg:col-span-3 lg:col-start-7 lg:row-start-1 order-2"
          >
            <div>
              <div className="mb-2 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-[#A1A1A1]">
                GOALS &amp; PLANNING
              </div>
              <h3 className="text-lg sm:text-xl font-medium tracking-tight text-white leading-snug">
                From ambition to action.
              </h3>
              <p className="mt-2 text-xs text-[#A1A1A1] leading-relaxed">
                Turn long-term objectives into milestones, priorities, and actionable plans.
              </p>
            </div>

            <div className="mt-5 rounded-xl bg-[#111113] p-3.5 border border-white/[0.06] font-mono text-[11px] space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#FF6B35]" />
                <span className="font-semibold text-white">Build a product</span>
              </div>
              <div className="ml-1 pl-3 border-l border-white/15 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-white/70">
                  <span>↓ Launch MVP</span>
                  <span className="text-[#FF6B35]">75%</span>
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-white/50 pt-0.5">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">Design</span>
                  <span>·</span>
                  <span className="rounded bg-[#FF6B35]/20 text-[#FF6B35] px-1.5 py-0.5 font-semibold">
                    Build
                  </span>
                  <span>·</span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5">Validate</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="group relative rounded-[24px] bg-[#0A0A0A] border border-white/[0.08] hover:border-white/[0.18] p-6 sm:p-7 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] lg:col-span-3 lg:col-start-10 lg:row-start-1 order-3"
          >
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-[#FF6B35]/[0.07] blur-2xl" />

            <div>
              <div className="mb-2 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-[#A1A1A1]">
                PERSISTENT MEMORY
              </div>
              <h3 className="text-lg sm:text-xl font-medium tracking-tight text-white leading-snug">
                It remembers your context.
              </h3>
              <p className="mt-2 text-xs text-[#A1A1A1] leading-relaxed">
                Preferences, conversations, projects, and useful information remain connected over
                time.
              </p>
            </div>

            <div className="relative mt-5 rounded-xl bg-[#111113] p-4 border border-white/[0.06] flex items-center justify-center">
              <div className="relative flex flex-col items-center justify-center w-full py-2">
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-36 h-20 border border-dashed border-white/10 rounded-full" />
                </div>
                <div className="relative z-10 rounded-xl bg-[#1A1A1D] border border-[#FF6B35]/40 px-3.5 py-1.5 font-mono text-xs font-bold text-white shadow-sm shadow-[#FF6B35]/20 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B35] animate-pulse" />
                  <span>YOU</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-8 gap-y-2 w-full text-center font-mono text-[10px] text-white/60">
                  <span className="hover:text-white transition-colors">Goals</span>
                  <span className="hover:text-white transition-colors">Projects</span>
                  <span className="hover:text-white transition-colors">Preferences</span>
                  <span className="hover:text-white transition-colors">Conversations</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="group relative rounded-[24px] bg-[#0A0A0A] border border-white/[0.08] hover:border-white/[0.18] p-6 sm:p-7 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] lg:col-span-6 lg:col-start-7 lg:row-start-2 order-5"
          >
            <div>
              <div className="mb-2 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-[#A1A1A1]">
                CONNECTED DIGITAL LIFE
              </div>
              <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-white leading-snug">
                Your tools. One intelligent layer.
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[#A1A1A1] leading-relaxed max-w-md">
                Coordinate work across communication, calendars, development, and knowledge services.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-3 sm:grid-cols-6 gap-2.5">
              {[
                { icon: MessageSquare, name: 'Communication' },
                { icon: Calendar, name: 'Calendar' },
                { icon: Code2, name: 'GitHub' },
                { icon: Mail, name: 'Email' },
                { icon: Database, name: 'Knowledge' },
                { icon: Mic, name: 'Voice' },
              ].map((tool) => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.name}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-[#141416] border border-white/[0.08] hover:border-[#FF6B35]/40 hover:bg-[#1a1a1e] p-3 text-center transition-all duration-200"
                  >
                    <Icon className="h-4 w-4 text-white/80 group-hover:text-white" />
                    <span className="font-mono text-[9px] text-white/60 tracking-tight truncate w-full">
                      {tool.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="group relative rounded-[24px] bg-[#0B0B0B] border border-white/[0.08] hover:border-white/[0.18] p-6 sm:p-7 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] lg:col-span-6 lg:col-start-1 lg:row-start-3 order-4"
          >
            <div>
              <div className="mb-2 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-[#A1A1A1]">
                AUTONOMOUS EXECUTION
              </div>
              <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-white leading-snug">
                Not just recommendations. Real execution.
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[#A1A1A1] leading-relaxed max-w-lg">
                V3 can plan multi-step work, delegate tasks to specialized agents, use connected
                tools, monitor results, and adapt when things change.
              </p>
            </div>

            <div className="mt-5 rounded-xl bg-[#111113] p-4 border border-white/[0.06]">
              <div className="flex flex-col gap-2.5 font-mono text-xs">
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2 text-white/90">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />
                    <span>Objective received</span>
                  </div>
                  <span className="text-[10px] text-[#22c55e] font-semibold">Completed</span>
                </div>

                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2 text-white/90">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#22c55e]" />
                    <span>Plan generated</span>
                  </div>
                  <span className="text-[10px] text-[#22c55e] font-semibold">Completed</span>
                </div>

                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2 text-white/90">
                    <RefreshCw className="h-3.5 w-3.5 text-[#FF6B35] animate-spin" />
                    <span>Agents working</span>
                  </div>
                  <span className="text-[10px] text-[#FF6B35] font-semibold">Running</span>
                </div>

                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-white/[0.05]">
                  <div className="flex items-center gap-2 text-white/90">
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    <span>Tools executed</span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-semibold">Waiting approval</span>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 text-white/40">
                    <span className="h-3.5 w-3.5 rounded-full border border-white/20 inline-block" />
                    <span>Results verified</span>
                  </div>
                  <span className="text-[10px] text-white/40">Queued</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="group relative rounded-[24px] bg-[#0A0A0A] border border-white/[0.08] hover:border-white/[0.18] p-6 sm:p-7 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.6)] lg:col-span-6 lg:col-start-7 lg:row-start-3 order-6"
          >
            <div>
              <div className="mb-2 font-mono text-[10px] font-semibold tracking-[0.2em] uppercase text-[#A1A1A1]">
                CONTROL &amp; TRUST
              </div>
              <h3 className="text-xl sm:text-2xl font-medium tracking-tight text-white leading-snug">
                Autonomy with you in control.
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-[#A1A1A1] leading-relaxed max-w-lg">
                Important actions respect permissions, approval requirements, and execution history.
              </p>
            </div>

            <div className="mt-5 rounded-xl bg-[#121214] p-4 border border-white/[0.08]">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#FF6B35]" />
                  <span className="font-mono text-xs font-medium text-white">
                    Send email to recipient
                  </span>
                </div>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[9px] font-semibold text-amber-300 uppercase">
                  EXTERNAL CONSEQUENCE
                </span>
              </div>

              <div className="py-2.5 font-mono text-[11px] text-white/60">
                <span>Destination: </span>
                <span className="text-white/90">team@investor-partners.com</span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="font-mono text-[10px] text-white/40 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  <span>Hardware gate active</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3.5 py-1.5 font-mono text-xs text-white/70 transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-[#FF6B35] hover:bg-[#E95724] px-4 py-1.5 font-mono text-xs font-semibold text-white shadow-md shadow-[#FF6B35]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

export default ProductBentoGrid;
