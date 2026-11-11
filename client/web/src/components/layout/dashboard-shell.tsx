'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { Button } from '@/components/ui/primitives';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { clearAuthSession } from '@/lib/auth-storage';
import { authApi } from '@/lib/v3-api';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/goals', label: 'Goals' },
  { href: '/dashboard/tasks', label: 'Tasks' },
  { href: '/dashboard/schedule', label: 'Schedule' },
  { href: '/dashboard/planning', label: 'AI Planner' },
  { href: '/dashboard/memory', label: 'Memory' },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useRequireAuth();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      clearAuthSession();
      router.replace('/login');
      return;
    }
    clearAuthSession();
    router.replace('/login');
  };

  if (!session?.accessToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500">Checking session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white px-5 py-4 lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0 lg:py-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between lg:block">
            <div>
              <Link href="/dashboard" className="text-lg font-bold tracking-tight">
                V3 Workspace
              </Link>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Personal Management & AI
              </p>
            </div>
            <Button variant="ghost" onClick={handleLogout} className="lg:hidden">
              Sign out
            </Button>
          </div>

          <nav className="mt-4 flex gap-1.5 overflow-x-auto pb-1 lg:mt-6 lg:flex-col lg:overflow-visible">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 hidden border-t border-slate-200 pt-4 lg:block dark:border-slate-800">
            <p className="truncate text-sm font-medium">{session.user?.name || 'V3 User'}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              {session.user?.email || 'Authenticated session'}
            </p>
            <Button variant="secondary" onClick={handleLogout} className="mt-3 w-full">
              Sign out
            </Button>
          </div>
        </aside>

        <main className="flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

