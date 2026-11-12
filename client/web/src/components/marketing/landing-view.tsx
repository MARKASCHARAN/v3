'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AsciiDitherMedia from '@/components/ui/background-ascii-dither';
import ProductBentoGrid from '@/components/marketing/product-bento-grid';
import Footer1 from '@/components/ui/footer-section-1';
import {
  ChevronRight,
  Menu,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';

export function LandingView() {
  const [email, setEmail] = useState('');
  const [ctaSubmitted, setCtaSubmitted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#faf9f6] text-[#111111] font-sans antialiased selection:bg-[#ff6b35]/20 selection:text-[#5f1900]">
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40">
        <AsciiDitherMedia mode="ascii" cellSize={14} className="text-[#77736F]/30" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent transition-all">
        <div className="mx-auto flex h-16 sm:h-20 max-w-[1560px] items-center justify-between gap-4 px-4 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center gap-1.5 select-none">
              <span className="font-display text-3xl sm:text-4xl tracking-tighter text-[#111111] transition-colors group-hover:text-[#ff6b35] leading-none">
                V3
              </span>
              <span className="h-2 w-2 rounded-full bg-[#ff6b35] self-end mb-1" />
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#e8e6e1] bg-[#ffffff] px-3.5 py-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] text-[11px] font-mono font-medium text-[#111111]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b35] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b35]" />
              </span>
              <span className="tracking-wider">PERSONAL AI SYSTEM</span>
            </div>

            <Link
              href="/login"
              className="hidden md:inline-flex text-xs font-mono font-semibold tracking-wider uppercase text-[#77736F] hover:text-[#111111] transition-colors px-2 py-1"
            >
              Sign In
            </Link>

            <Link
              href="/register"
              className="group inline-flex items-center gap-1.5 rounded-full bg-[#111111] px-4 py-2 sm:px-5 sm:py-2.5 text-xs font-mono font-semibold tracking-wide text-[#ffffff] shadow-sm transition-all hover:bg-[#ff6b35] hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
            >
              <span>Get started</span>
              <span className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                ↗
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle mobile menu"
              className="inline-flex items-center justify-center rounded-full border border-[#e8e6e1] bg-white p-1.5 text-[#111111] sm:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-b border-[#e8e6e1] bg-[#faf9f6] px-6 py-4 sm:hidden">
            <div className="flex flex-col gap-3 text-sm text-[#77736F]">
              <div className="flex items-center gap-2 py-1 text-xs font-mono text-[#111111]">
                <span className="h-2 w-2 rounded-full bg-[#ff6b35]" />
                <span className="tracking-wider uppercase">PERSONAL AI SYSTEM</span>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-[#e8e6e1]">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-[#ffffff] border border-[#e8e6e1] py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-wider text-[#111111]"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl bg-[#111111] py-2.5 text-center font-mono text-xs font-semibold uppercase tracking-wider text-[#ffffff]"
                >
                  Get started ↗
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="hidden lg:flex fixed right-0 top-1/2 -translate-y-1/2 z-40">
        <div className="flex items-center gap-2 rounded-l-md bg-[#111111] py-3.5 px-2 text-[#ffffff] shadow-md transition-colors hover:bg-[#ff6b35] cursor-default [writing-mode:vertical-rl] select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b35]" />
          <span className="font-mono text-[9px] font-bold tracking-[0.24em] text-[#ffffff]/90 uppercase">
            PERSONAL AI
          </span>
        </div>
      </div>

      <main className="relative z-10 w-full bg-transparent">
        <div className="flex w-full flex-col">
          <section className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-transparent pt-20 pb-8 sm:pt-24 lg:pt-28">
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
              <div className="h-[460px] w-[88vw] max-w-[1080px] rounded-full bg-gradient-to-b from-[#fff0e8]/30 via-[#ff6b35]/5 to-transparent blur-3xl" />
            </div>

            <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col items-center justify-center px-4 sm:px-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -8, 0],
                  rotate: [-8, -6, -8],
                }}
                transition={{
                  y: { repeat: Infinity, duration: 4.8, ease: 'easeInOut' },
                  rotate: { repeat: Infinity, duration: 4.8, ease: 'easeInOut' },
                  opacity: { duration: 0.6, delay: 0.15 },
                }}
                whileHover={{ scale: 1.06, rotate: -4 }}
                className="hidden lg:flex absolute left-4 xl:left-10 top-10 xl:top-14 items-center gap-2 rounded-full border-2 border-white bg-gradient-to-r from-[#ff6b35] to-[#e95724] px-5 py-2.5 text-[#ffffff] shadow-[0_12px_28px_rgba(233,87,36,0.32)] cursor-default select-none z-20"
              >
                <Zap className="h-4 w-4 fill-white text-white" />
                <span className="font-mono text-xs xl:text-sm font-bold tracking-wider uppercase">
                  AGENTS AT WORK
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: 12 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -9, 0],
                  rotate: [12, 15, 12],
                }}
                transition={{
                  y: { repeat: Infinity, duration: 5.4, ease: 'easeInOut' },
                  rotate: { repeat: Infinity, duration: 5.4, ease: 'easeInOut' },
                  opacity: { duration: 0.6, delay: 0.25 },
                }}
                whileHover={{ scale: 1.08, rotate: 18 }}
                className="hidden lg:flex absolute right-4 xl:right-10 top-8 xl:top-12 flex-col items-center justify-center h-28 w-28 rounded-full border-2 border-white bg-[#111111] shadow-[0_14px_32px_rgba(0,0,0,0.14)] p-2 cursor-default select-none z-20"
              >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full border border-dashed border-[#ff6b35]/60 bg-[#1c1c1c] p-2 text-center">
                  <span className="font-mono text-[9px] font-bold tracking-[0.22em] text-[#ff6b35] uppercase">
                    THINK
                  </span>
                  <span className="font-display text-base tracking-tight text-[#ffffff] uppercase leading-none my-0.5">
                    PLAN
                  </span>
                  <span className="font-mono text-[9px] font-bold tracking-[0.22em] text-[#ff6b35] uppercase">
                    EXECUTE.
                  </span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -7, 0],
                  rotate: [-8, -6, -8],
                }}
                transition={{
                  y: { repeat: Infinity, duration: 5.1, ease: 'easeInOut' },
                  rotate: { repeat: Infinity, duration: 5.1, ease: 'easeInOut' },
                  opacity: { duration: 0.6, delay: 0.35 },
                }}
                whileHover={{ scale: 1.06, rotate: -4 }}
                className="hidden lg:flex absolute left-4 xl:left-12 bottom-20 xl:bottom-24 flex-col gap-1.5 rounded-2xl border-2 border-white bg-[#fff0e8] ring-1 ring-[#ff6b35]/25 p-3.5 shadow-[0_12px_28px_rgba(255,107,53,0.15)] cursor-default select-none z-20"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[10px] xl:text-[11px] font-bold uppercase tracking-wider text-[#111111]">
                    GOAL IN PROGRESS
                  </span>
                  <span className="font-mono text-xs xl:text-sm font-extrabold text-[#ff6b35] tabular-nums">
                    72%
                  </span>
                </div>
                <div className="h-1.5 w-36 xl:w-44 overflow-hidden rounded-full bg-white/80">
                  <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#ff6b35] to-[#e95724]" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: 6 }}
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: [0, -6, 0],
                  rotate: [6, 4, 6],
                }}
                transition={{
                  y: { repeat: Infinity, duration: 4.6, ease: 'easeInOut' },
                  rotate: { repeat: Infinity, duration: 4.6, ease: 'easeInOut' },
                  opacity: { duration: 0.6, delay: 0.45 },
                }}
                whileHover={{ scale: 1.06, rotate: 2 }}
                className="hidden lg:flex absolute right-4 xl:right-12 bottom-20 xl:bottom-24 items-center gap-2 rounded-full border-2 border-white bg-[#ffffff] px-5 py-2.5 shadow-[0_12px_28px_rgba(0,0,0,0.08)] cursor-default select-none z-20"
              >
                <Sparkles className="h-4 w-4 text-[#ff6b35]" />
                <span className="font-mono text-xs xl:text-sm font-bold tracking-wider uppercase text-[#111111]">
                  REMEMBERS YOUR CONTEXT
                </span>
              </motion.div>

              <div className="relative flex flex-col items-center text-center max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.95 }}
                  animate={{ opacity: 1, y: [0, -5, 0], scale: 1 }}
                  transition={{
                    y: { repeat: Infinity, duration: 4.2, ease: 'easeInOut' },
                    opacity: { duration: 0.5 },
                    scale: { duration: 0.5 },
                  }}
                  className="mb-5 sm:mb-7 inline-flex items-center gap-2.5 rounded-full border border-[#e8e6e1] bg-[#ffffff] px-4 py-1.5 sm:py-2 shadow-[0_4px_16px_rgba(0,0,0,0.05)] hover:shadow-md transition-shadow cursor-default"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b35] opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b35]" />
                  </span>
                  <span className="font-mono text-xs font-semibold tracking-wider text-[#111111] uppercase">
                    YOUR AI IS READY
                  </span>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display uppercase tracking-tight text-[#111111] leading-[0.88] select-none text-[46px] sm:text-[88px] md:text-[124px] lg:text-[150px] xl:text-[174px]"
                >
                  <span className="block">YOUR LIFE.</span>
                  <span className="block">IN MOTION.</span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-6 sm:mt-8 max-w-xl text-center text-sm sm:text-base md:text-lg leading-relaxed text-[#77736F]"
                >
                  An intelligent personal system that connects your goals, plans, knowledge,
                  and digital world — and helps turn intentions into action.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto"
                >
                  <Link
                    href="/register"
                    className="group relative inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-full bg-[#111111] px-7 py-3.5 text-sm sm:text-base font-semibold text-[#ffffff] shadow-sm transition-all hover:bg-[#ff6b35] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <span>Meet your assistant</span>
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      ↗
                    </span>
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex w-full sm:w-auto justify-center items-center rounded-full border border-[#e8e6e1] bg-[#ffffff] px-7 py-3.5 text-sm sm:text-base font-semibold text-[#111111] shadow-xs transition-all hover:border-[#111111] hover:bg-[#faf9f6] hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Explore V3
                  </Link>
                </motion.div>

                <div className="mt-8 flex lg:hidden flex-wrap items-center justify-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-white bg-gradient-to-r from-[#ff6b35] to-[#e95724] px-3 py-1.5 text-[#ffffff] text-[11px] font-mono font-bold tracking-wider uppercase shadow-xs">
                    <Zap className="h-3 w-3 fill-white text-white" />
                    <span>AGENTS AT WORK</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white bg-[#fff0e8] px-3 py-1.5 text-[11px] font-mono font-bold text-[#111111] shadow-xs">
                    <span>GOAL IN PROGRESS</span>
                    <span className="text-[#ff6b35]">72%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-14 sm:mt-18 w-full max-w-[1360px] mx-auto px-4 sm:px-8">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e8e6e1]" />
                </div>
                <div className="relative bg-[#faf9f6]/85 backdrop-blur-xs px-3 font-mono text-[9px] sm:text-[11px] font-semibold tracking-[0.18em] sm:tracking-[0.22em] uppercase text-[#77736F] text-center">
                  ONE SYSTEM. CONNECTED CAPABILITIES.
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-8 gap-y-2 font-mono text-[11px] sm:text-sm font-semibold tracking-wider text-[#77736F]">
                <span>GOALS</span>
                <span className="text-[#ff6b35]">·</span>
                <span>PLANNING</span>
                <span className="text-[#ff6b35]">·</span>
                <span>TASKS</span>
                <span className="text-[#ff6b35]">·</span>
                <span>SCHEDULING</span>
                <span className="text-[#ff6b35]">·</span>
                <span>MEMORY</span>
                <span className="text-[#ff6b35]">·</span>
                <span>RESEARCH</span>
                <span className="text-[#ff6b35]">·</span>
                <span>AUTONOMY</span>
              </div>
            </div>
          </section>

          <ProductBentoGrid />

          <section id="preview" className="relative z-10 mx-auto w-full max-w-[1360px] px-4 py-16 sm:px-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6 }}
              className="rounded-3xl bg-[#0c0c0e] p-6 sm:p-10 lg:p-12 text-white shadow-2xl border border-white/10 overflow-hidden"
            >
              <div className="mb-8 sm:mb-12">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-xs bg-[#a855f7] inline-block" />
                  <span className="font-mono text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                    EVENTS &amp; PODCASTS
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-7 sm:h-9 w-[2px] bg-white/70" />
                  <h2 className="text-2xl sm:text-4xl lg:text-5xl font-serif font-normal tracking-tight text-white">
                    Our events and our podcasts
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
                <div className="flex flex-col justify-between lg:col-span-7 xl:col-span-8">
                  <div className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#3b0764] via-[#7e22ce] to-[#ea580c] p-6 sm:p-8 flex flex-col justify-between shadow-xl">
                    <div className="absolute inset-0 bg-[radial-gradient(#000000_1.5px,transparent_1.5px)] [background-size:6px_6px] opacity-45 pointer-events-none" />

                    <div className="relative z-10 flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/40 px-3.5 py-1.5 font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                        <span className="h-2 w-2 rounded-full bg-[#ff6b35] animate-pulse" />
                        <span>THE FUTURE OF PERSONAL AI &amp; AUTONOMY</span>
                      </span>
                      <span className="font-mono text-[11px] text-white/80 font-medium">
                        EPISODE #12 • KEYNOTE
                      </span>
                    </div>

                    <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto py-6 sm:py-8">
                      <span className="font-mono text-[11px] sm:text-xs font-semibold tracking-[0.25em] uppercase text-amber-200/90 mb-2">
                        Autonomous Systems Summit
                      </span>
                      <h3 className="text-2xl sm:text-4xl lg:text-5xl font-serif text-white tracking-tight drop-shadow-md max-w-xl">
                        What Comes After Chatbots?
                      </h3>
                      <span className="mt-3 font-mono text-[11px] sm:text-xs text-white/80">
                        Live from San Francisco • V3 Intelligence Keynote
                      </span>
                    </div>

                    <div className="relative z-10 flex items-center justify-between pt-2 text-white/80">
                      <div className="flex items-center gap-2 font-mono text-[11px]">
                        <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                        <span>Keynote Session • 54 min</span>
                      </div>
                      <Link
                        href="/register"
                        className="font-mono text-[11px] underline underline-offset-4 decoration-white/40 group-hover:decoration-white transition-all"
                      >
                        Watch recording ↗
                      </Link>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-lg sm:text-2xl font-serif text-white tracking-tight">
                      Find out more about V3 OS events
                    </h3>
                    <a
                      href="#features"
                      className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 hover:bg-white/15 hover:border-white px-5 py-2.5 font-mono text-xs font-semibold uppercase tracking-wider text-white transition-all duration-200 self-start sm:self-auto"
                    >
                      Go to events
                    </a>
                  </div>
                </div>

                <div className="flex flex-col justify-between lg:col-span-5 xl:col-span-4">
                  <div>
                    <div className="mb-4 font-mono text-[11px] font-semibold tracking-[0.22em] uppercase text-white/50">
                      RECENT AND FEATURED PODCASTS
                    </div>

                    <div className="divide-y divide-white/10 border-t border-white/10">
                      {[
                        {
                          title:
                            'Building Sovereign AI Kernels: Hybrid pgvector Memory & Local Enclave Security — V3 Core Team',
                          href: '#features',
                        },
                        {
                          title:
                            'Beyond Reactive Prompts: Deterministic Multi-Agent Workflows & LangGraph Execution',
                          href: '#features',
                        },
                        {
                          title:
                            'Zero Context Drift: Continuous Ambient Intelligence & Autonomous Hardware Governance',
                          href: '#preview',
                        },
                      ].map((podcast, idx) => (
                        <a
                          key={idx}
                          href={podcast.href}
                          className="group flex items-start justify-between gap-4 py-5 transition-colors hover:text-[#ff6b35]"
                        >
                          <p className="text-sm sm:text-base font-serif leading-snug text-white/90 group-hover:text-white transition-colors">
                            {podcast.title}
                          </p>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/40 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-white" />
                        </a>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <a
                      href="#preview"
                      className="inline-flex items-center justify-center rounded-md bg-white hover:bg-[#ff6b35] hover:text-white px-6 py-2.5 text-xs sm:text-sm font-semibold text-[#111111] shadow-md transition-all duration-200"
                    >
                      See all podcasts
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>
          </section>

          <section className="relative z-10 mx-auto w-full max-w-[1100px] px-4 py-12 sm:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-[#ffffff]/90 backdrop-blur-xs border border-[#e8e6e1]/80 p-8 text-center shadow-md sm:p-12">
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

          <section id="deploy" className="relative z-10 mx-auto w-full max-w-[1240px] px-4 pb-16 pt-6 sm:px-8">
            <div className="relative flex flex-col items-center overflow-hidden rounded-3xl bg-[#ffffff]/90 backdrop-blur-xs border border-[#e8e6e1]/80 p-8 text-center shadow-lg sm:p-12">
              <div className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-[#ffdbd0]/40 blur-2xl" />

              <div className="mb-3 inline-flex items-center rounded-full bg-[#faf9f6] px-3 py-1 font-mono text-[11px] font-bold uppercase text-[#ff6b35] shadow-xs border border-[#e8e6e1]">
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
                className="mb-5 flex w-full max-w-md flex-col items-center gap-2 rounded-2xl bg-[#faf9f6] p-2 border border-[#e8e6e1] shadow-xs sm:flex-row sm:rounded-full sm:p-1.5"
              >
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full min-w-0 bg-transparent px-4 py-2.5 text-sm text-[#1a1c1a] placeholder:text-[#594139]/60 focus:outline-none sm:py-3"
                />
                <button
                  type="submit"
                  className="w-full shrink-0 rounded-xl bg-[#ff6b35] px-6 py-3 text-sm font-semibold text-[#ffffff] transition-all duration-150 hover:bg-[#ad3300] sm:w-auto sm:rounded-full"
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

      <Footer1
        className="relative z-10 bg-transparent"
        logo={
          <Link href="/" className="group flex items-center gap-1.5 select-none">
            <span className="font-display text-4xl sm:text-5xl tracking-tighter text-[#111111] transition-colors group-hover:text-[#ff6b35] leading-none">
              V3
            </span>
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6b35] self-end mb-1" />
          </Link>
        }
        links={[
          { label: 'Capabilities', href: '#features' },
          { label: 'Architecture', href: '#features' },
          { label: 'Keynotes & Podcasts', href: '#preview' },
          { label: 'Deploy', href: '#deploy' },
          { label: 'Sign In', href: '/login' },
          { label: 'Get Started', href: '/register' },
        ]}
        copyright="© 2026 V3 OS — Autonomous Personal AI Operating System. All rights reserved."
      />
    </div>
  );
}
