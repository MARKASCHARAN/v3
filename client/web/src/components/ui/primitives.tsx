'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ButtonHTMLAttributes, ReactNode } from 'react';

type BadgeTone = 'neutral' | 'orange' | 'blue' | 'dark' | 'green' | 'amber' | 'red';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-neutral-200 bg-neutral-100 text-neutral-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  blue: 'border-orange-200 bg-orange-50 text-orange-700',
  dark: 'border-neutral-900 bg-neutral-950 text-white',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-orange-300 bg-orange-100/80 text-orange-900',
  red: 'border-rose-200 bg-rose-50 text-rose-700',
};

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`v3-white-surface rounded-2xl border border-neutral-200/90 p-5 transition-colors duration-200 hover:border-neutral-300 ${className}`}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'dark' | 'secondary' | 'danger' | 'ghost';
}) {
  const variantClass =
    variant === 'primary'
      ? 'bg-gradient-to-b from-orange-500 to-orange-600 text-white border border-orange-500 shadow-[0_1px_0_rgba(255,255,255,0.28)_inset,0_10px_22px_-8px_rgba(249,115,22,0.55)] hover:from-orange-500 hover:to-orange-500 hover:shadow-[0_14px_26px_-8px_rgba(249,115,22,0.65)]'
      : variant === 'dark'
        ? 'bg-neutral-950 text-white border border-neutral-900 shadow-sm hover:bg-neutral-800'
        : variant === 'danger'
          ? 'bg-rose-600 text-white border border-rose-600 hover:bg-rose-700'
          : variant === 'ghost'
            ? 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 border border-transparent'
            : 'border border-neutral-300 bg-white text-neutral-900 shadow-2xs hover:border-orange-400 hover:bg-orange-50/40';

  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45 ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const reduced = useReducedMotion();

  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 ring-1 ring-inset ring-neutral-200/80">
      <motion.div
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="h-full rounded-full bg-gradient-to-r from-neutral-950 via-orange-600 to-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.35)]"
      />
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
      {message}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      <p className="mt-1 text-sm text-neutral-500">{description}</p>
    </div>
  );
}

export const baseFieldClassName =
  'rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 placeholder:text-neutral-400 shadow-2xs transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20';

export const inputClassName = `w-full ${baseFieldClassName}`;

export const inlineInputClassName = `w-auto ${baseFieldClassName}`;
