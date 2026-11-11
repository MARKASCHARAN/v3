'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button, Card, ErrorBanner, inputClassName } from '@/components/ui/primitives';
import { ApiClientError } from '@/lib/api-client';
import { saveAuthSession } from '@/lib/auth-storage';
import { authApi } from '@/lib/v3-api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            V3
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {isRegister ? 'Create your V3 account' : 'Sign in to V3'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isRegister
              ? 'Set up your personal goals, tasks, and schedule workspace.'
              : 'Access your goals, tasks, calendar blocks, and AI plans.'}
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <ErrorBanner message={error} />}
            {notice && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-300">
                {notice}
              </div>
            )}

            {isRegister && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Name</label>
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
              <label className="mb-1.5 block text-sm font-medium">Email</label>
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
              <label className="mb-1.5 block text-sm font-medium">Password</label>
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

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Please wait...' : isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {isRegister ? 'Already have an account?' : 'Need an account?'}{' '}
          <Link
            href={isRegister ? '/login' : '/register'}
            className="font-medium text-slate-900 underline dark:text-slate-100"
          >
            {isRegister ? 'Sign in' : 'Register'}
          </Link>
        </p>
      </div>
    </div>
  );
}

