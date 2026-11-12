'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ReactNode } from 'react';

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function MotionPage({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerGrid({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : 'hidden'}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.045,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionStaggerItem({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      variants={
        reduced
          ? undefined
          : {
              hidden: { opacity: 0, y: 12, scale: 0.985 },
              visible: {
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.34, ease: EASE_OUT_EXPO },
              },
            }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function MotionInteractiveSurface({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function PulseStatusDot({
  tone = 'orange',
}: {
  tone?: 'orange' | 'emerald' | 'dark' | 'rose';
}) {
  const colors = {
    orange: { ping: 'bg-orange-500', dot: 'bg-orange-500' },
    emerald: { ping: 'bg-emerald-500', dot: 'bg-emerald-500' },
    dark: { ping: 'bg-neutral-900', dot: 'bg-neutral-950' },
    rose: { ping: 'bg-rose-500', dot: 'bg-rose-500' },
  }[tone];

  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span
        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${colors.ping}`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colors.dot}`} />
    </span>
  );
}
