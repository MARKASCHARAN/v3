'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Compass } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button, Card, ErrorBanner, inputClassName } from '@/components/ui/primitives';
import { ApiClientError } from '@/lib/api-client';
import { saveAuthSession } from '@/lib/auth-storage';
import { authApi } from '@/lib/v3-api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'register';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const result = isRegister
        ? await authApi.register({ email, password, name: name.trim() || undefined })
        : await authApi.login({ email, password });

      if (result.session?.access_token) {
        saveAuthSession({
          accessToken: result.session.access_token,
          refreshToken: result.session.refresh_token,
          user: result.user,
        });
        router.replace('/dashboard');
        return;
      }

      setNotice(
        'Account created. Check your email to confirm your address before signing in.'
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Unable to reach the V3 server API. Verify the backend is running.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-clip bg-[#faf9f6] px-4 py-8 sm:py-12">
      <div className="v3-grid-backdrop pointer-events-none fixed inset-0 z-0" />
      <div className="pointer-events-none absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-orange-500/10 blur-[120px]" />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-950 shadow-[0_10px_24px_-6px_rgba(249,115,22,0.55)]">
              <Compass className="h-5 w-5 text-orange-500" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-neutral-950">V3 Studio</span>
          </Link>
          <h1 className="mt-3 text-xl font-bold text-neutral-950">
            {isRegister ? 'Create your V3 workspace' : 'Sign in to V3'}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {isRegister
              ? 'Initialize your personal intelligence, goals, and automation OS.'
              : 'Access your goals, semantic memory, research, and autonomous agents.'}
          </p>
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorBanner message={error} />}
            {notice && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                {notice}
              </div>
            )}

            {isRegister && (
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputClassName}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClassName}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Password
              </label>
              <input
                type="password"
                required
                minLength={isRegister ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'}
                className={inputClassName}
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full py-2.5">
              {submitting ? 'Authenticating...' : isRegister ? 'Create workspace' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-neutral-500">
          {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
          <Link
            href={isRegister ? '/login' : '/register'}
            className="font-semibold text-orange-600 underline-offset-4 hover:underline"
          >
            {isRegister ? 'Sign in' : 'Register'}
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
