'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  ChevronDown,
  ChevronRight,
  Flag,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  Network,
  Radio,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  SplitSquareVertical,
  Terminal,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ComponentType, FormEvent, ReactNode, useEffect, useState } from 'react';
import { MotionPage, PulseStatusDot } from '@/components/ui/motion';
import { Button, ErrorBanner, inputClassName } from '@/components/ui/primitives';
import { useRequireAuth } from '@/hooks/use-require-auth';
import { ApiClientError } from '@/lib/api-client';
import { clearAuthSession, getStoredAuthSession, saveAuthSession } from '@/lib/auth-storage';
import { authApi, automationApi } from '@/lib/v3-api';

interface NavEntry {
  href: string;
  label: string;
  code?: string;
  icon: ComponentType<{ className?: string }>;
}

const navGroups: Array<{ group: string; items: NavEntry[] }> = [
  {
    group: 'Command Stream',
    items: [
      { href: '/dashboard', label: 'Command Overview', code: '01', icon: LayoutDashboard },
      { href: '/dashboard/goals', label: 'Strategic Goals', code: '02', icon: Flag },
      { href: '/dashboard/tasks', label: 'Execution Board', code: '03', icon: SplitSquareVertical },
      { href: '/dashboard/schedule', label: 'Time Studio', code: '04', icon: Calendar },
      { href: '/dashboard/assistant', label: 'AI Command Center', icon: Bot },
    ],
  },
  {
    group: 'Synthetics & Intel',
    items: [
      { href: '/dashboard/planning', label: 'Strategic Planning', icon: Route },
      { href: '/dashboard/research', label: 'Research Library', icon: BookOpen },
      { href: '/dashboard/memory', label: 'Memory Intelligence', icon: Brain },
      { href: '/dashboard/notifications', label: 'Communication Center', icon: MessageSquare },
      { href: '/dashboard/voice', label: 'Voice Studio', icon: Mic },
    ],
  },
  {
    group: 'Infrastructure',
    items: [
      { href: '/dashboard/integrations', label: 'Integration Vault', icon: Network },
      { href: '/dashboard/developer', label: 'Developer Workspace', icon: Terminal },
      { href: '/dashboard/ops', label: 'Autonomy Operations', icon: SlidersHorizontal },
    ],
  },
];

const allItems = navGroups.flatMap((g) => g.items);

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useRequireAuth();
  const hasSession = Boolean(session?.accessToken);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number | null>(null);

  const currentNav = allItems.find((item) => item.href === pathname) ?? allItems[0];

  useEffect(() => {
    if (!hasSession) return;
    let active = true;
    automationApi
      .listApprovals({ status: 'PENDING', limit: 25 })
      .then((rows) => {
        if (active) setPendingApprovalsCount(rows.length);
      })
      .catch(() => {
        if (active) setPendingApprovalsCount(null);
      });
    return () => {
      active = false;
    };
  }, [hasSession, pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenProfile = () => {
    setProfileName(session?.user?.name || '');
    setProfileError(null);
    setProfileOpen(true);
  };

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!profileName.trim()) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const updated = await authApi.updateMe({ name: profileName.trim() });
      const current = getStoredAuthSession();
      if (current) {
        saveAuthSession({ ...current, user: updated });
      }
      setProfileOpen(false);
    } catch (err) {
      setProfileError(err instanceof ApiClientError ? err.message : 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

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

  const filteredModules = allItems.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-[#faf9f6] text-[#1a1c1a] antialiased">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 flex-col border-r border-[#e9e8e5] bg-[#ffffff] lg:flex">
        <div className="border-b border-[#e9e8e5] p-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f312f]">
                <span className="font-mono text-[11px] font-semibold text-[#ffffff]">V3</span>
              </div>
              <div>
                <span className="block text-[16px] font-semibold leading-none tracking-tight text-[#1a1c1a]">
                  AETHER OS
                </span>
                <span className="mt-1 block font-mono text-[11px] leading-none text-[#5f5e5e]">
                  v3.4.1-rc
                </span>
              </div>
            </Link>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b35] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b35]" />
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-[#e9e8e5] bg-[#f4f3f1] px-2.5 py-1.5 font-mono text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff6b35]" />
              <span className="font-medium text-[#594139]">Core Active</span>
            </div>
            <span className="text-[#5f5e5e]">9 Agents</span>
            <span className="font-medium text-[#ab3500]">Live Sync</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 py-4">
          {navGroups.map((group, groupIndex) => (
            <div key={group.group} className={groupIndex > 0 ? 'mt-5' : ''}>
              <div className="mb-1.5 px-2.5">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-[#5f5e5e]">
                  {group.group}
                </span>
              </div>
              <nav className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  const showPendingPill =
                    item.href === '/dashboard/assistant' &&
                    pendingApprovalsCount !== null &&
                    pendingApprovalsCount > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                        active
                          ? 'bg-[#ff6b35] font-medium text-[#ffffff] shadow-xs'
                          : 'text-[#594139] hover:bg-[#efeeeb] hover:text-[#1a1c1a]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {showPendingPill ? (
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                            active
                              ? 'bg-[#ffffff]/20 text-[#ffffff]'
                              : 'bg-[#ff6b35] text-[#ffffff]'
                          }`}
                        >
                          {pendingApprovalsCount} Pending
                        </span>
                      ) : (
                        item.code && (
                          <span
                            className={`font-mono text-[11px] ${
                              active ? 'text-[#ffffff]/80' : 'text-[#5f5e5e]'
                            }`}
                          >
                            {item.code}
                          </span>
                        )
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-[#e9e8e5] p-3">
          <div className="flex items-center justify-between rounded-lg bg-[#f4f3f1] p-2">
            <button
              type="button"
              onClick={handleOpenProfile}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2f312f]">
                <Radio className="h-3.5 w-3.5 text-[#ffffff]" />
              </div>
              <div className="min-w-0">
                <span className="block truncate font-mono text-[11px] font-semibold leading-tight text-[#1a1c1a]">
                  L9-NEURAL
                </span>
                <span className="block truncate font-mono text-[10px] leading-tight text-[#5f5e5e]">
                  {session?.user?.email || '99.98% sync'}
                </span>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <ShieldCheck className="h-4 w-4 text-[#594139]" />
              {hasSession && (
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  className="rounded p-1 text-[#5f5e5e] transition-colors hover:bg-[#e3e2e0] hover:text-[#1a1c1a]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-72">
        <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-[#e9e8e5] bg-[#ffffff]/95 px-3 backdrop-blur-md sm:h-16 sm:px-5 lg:left-72 lg:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e9e8e5] bg-[#f4f3f1] text-[#1a1c1a] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 items-center gap-1 font-mono text-[11px] text-[#594139]">
              <span className="hidden text-[#5f5e5e] sm:inline">AETHER</span>
              <ChevronRight className="hidden h-3.5 w-3.5 text-[#5f5e5e] sm:inline" />
              <span className="truncate font-semibold uppercase text-[#1a1c1a]">
                {currentNav?.label || 'SYSTEM'}
              </span>
            </div>

            <div className="hidden h-4 w-px bg-[#e9e8e5] md:block" />

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden w-64 items-center gap-2 rounded-full border border-[#e9e8e5] bg-[#f4f3f1] px-3.5 py-1.5 text-left transition-all hover:border-[#e1bfb5] md:flex lg:w-72"
            >
              <Search className="h-3.5 w-3.5 text-[#5f5e5e]" />
              <span className="flex-1 text-[13px] text-[#5f5e5e]">Omnisearch intent...</span>
              <kbd className="rounded border border-[#e9e8e5] bg-[#ffffff] px-1.5 py-0.5 font-mono text-[10px] text-[#5f5e5e] shadow-xs">
                ⌘K
              </kbd>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Omnisearch workspace"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#594139] transition-colors hover:bg-[#f4f3f1] md:hidden"
            >
              <Search className="h-4 w-4" />
            </button>

            <div className="hidden items-center gap-1.5 rounded-full border border-[#e9e8e5] bg-[#f4f3f1] px-2.5 py-1 lg:flex">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b35] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b35]" />
              </span>
              <span className="font-mono text-[11px] text-[#1a1c1a]">Agent Pulse: Harmonic</span>
            </div>

            <Link
              href="/dashboard/notifications"
              title="Communication Center"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#594139] transition-colors hover:bg-[#f4f3f1]"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#ff6b35] ring-2 ring-[#ffffff]" />
            </Link>

            <Link
              href="/dashboard/ops"
              title="Autonomy Operations"
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-[#594139] transition-colors hover:bg-[#f4f3f1] sm:flex"
            >
              <Activity className="h-4 w-4" />
            </Link>

            <div className="hidden h-5 w-px bg-[#e9e8e5] sm:block" />

            <button
              type="button"
              onClick={handleOpenProfile}
              className="flex items-center gap-2 rounded-xl p-1 text-left transition-colors hover:bg-[#f4f3f1]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ab3500] text-[#ffffff] shadow-xs">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden flex-col sm:flex">
                <span className="text-[13px] font-medium leading-tight text-[#1a1c1a]">
                  {session?.user?.name || 'Operator'}
                </span>
                <span className="font-mono text-[10px] leading-tight text-[#5f5e5e]">
                  Autonomous Lead
                </span>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-[#594139] sm:block" />
            </button>
          </div>
        </header>

        <main className="min-h-screen w-full min-w-0 bg-[#faf9f6] pb-20 pt-14 sm:pt-16 lg:pb-8">
          {!hasSession && (
            <div className="flex min-h-[60vh] items-center justify-center p-6">
              <div className="flex items-center gap-3 rounded-2xl border border-[#e9e8e5] bg-[#ffffff] px-5 py-3 text-sm text-[#5f5e5e] shadow-sm">
                <PulseStatusDot tone="orange" />
                <span>Verifying AETHER OS workspace session...</span>
              </div>
            </div>
          )}
          {hasSession && (
            <div className="mx-auto w-full min-w-0 max-w-[1680px] px-3.5 py-4 sm:px-6 lg:px-8 lg:py-6">
              <MotionPage key={pathname}>{children}</MotionPage>
            </div>
          )}
        </main>
      </div>

      <nav
        aria-label="Mobile quick navigation"
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[#e9e8e5] bg-[#ffffff]/95 px-1 py-1.5 backdrop-blur-md lg:hidden"
      >
        {[
          { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
          { href: '/dashboard/goals', label: 'Goals', icon: Flag },
          { href: '/dashboard/tasks', label: 'Tasks', icon: SplitSquareVertical },
          { href: '/dashboard/assistant', label: 'AI Core', icon: Bot },
        ].map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          const showPending =
            item.href === '/dashboard/assistant' &&
            pendingApprovalsCount !== null &&
            pendingApprovalsCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium transition-colors ${
                active ? 'text-[#ab3500]' : 'text-[#5f5e5e]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              {showPending && (
                <span className="absolute right-2.5 top-0.5 flex h-2 w-2 rounded-full bg-[#ff6b35]" />
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex min-w-[60px] flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[10px] font-medium text-[#5f5e5e]"
        >
          <Menu className="h-4 w-4" />
          <span>Modules</span>
        </button>
      </nav>

      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex bg-[#1a1c1a]/40 backdrop-blur-xs lg:hidden"
          >
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="flex h-full w-[84vw] max-w-72 flex-col bg-[#ffffff] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#e9e8e5] p-4">
                <span className="text-sm font-bold text-[#1a1c1a]">AETHER OS // V3</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-lg p-1 text-[#5f5e5e] hover:bg-[#efeeeb]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">
                {navGroups.map((group) => (
                  <div key={group.group} className="mb-4">
                    <p className="mb-1.5 px-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#5f5e5e]">
                      {group.group}
                    </p>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileNavOpen(false)}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm ${
                              active
                                ? 'bg-[#ff6b35] font-medium text-[#ffffff]'
                                : 'text-[#594139] hover:bg-[#efeeeb]'
                            }`}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {hasSession && (
                <div className="border-t border-[#e9e8e5] p-3">
                  <Button variant="secondary" onClick={handleLogout} className="w-full py-2 text-xs">
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out ({session?.user?.name || session?.user?.email || 'Operator'})
                  </Button>
                </div>
              )}
            </motion.div>
            <div className="flex-1" onClick={() => setMobileNavOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-[#1a1c1a]/35 p-4 pt-24 backdrop-blur-xs"
            onClick={() => setSearchOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -6 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#e9e8e5] bg-[#ffffff] shadow-2xl"
            >
              <div className="flex items-center gap-2.5 border-b border-[#e9e8e5] px-4 py-3">
                <Search className="h-4 w-4 text-[#ab3500]" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Jump to workspace module..."
                  className="flex-1 bg-transparent text-sm text-[#1a1c1a] outline-none placeholder:text-[#5f5e5e]"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="rounded px-1.5 py-0.5 font-mono text-[10px] text-[#5f5e5e] hover:bg-[#efeeeb]"
                >
                  ESC
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto p-2">
                {filteredModules.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-[#1a1c1a] transition-colors hover:bg-[#f4f3f1]"
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 text-[#ab3500]" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <span className="font-mono text-[11px] text-[#5f5e5e]">{item.href}</span>
                    </Link>
                  );
                })}
                {filteredModules.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-[#5f5e5e]">
                    No workspace modules match &ldquo;{searchQuery}&rdquo;.
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1c1a]/40 p-4 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              className="w-full max-w-md rounded-2xl border border-[#e9e8e5] bg-[#ffffff] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#e9e8e5] pb-3">
                <h2 className="text-base font-bold text-[#1a1c1a]">Operator Profile</h2>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="rounded-lg p-1 text-[#5f5e5e] hover:bg-[#efeeeb] hover:text-[#1a1c1a]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                {profileError && <ErrorBanner message={profileError} />}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5f5e5e]">
                    Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={session?.user?.email || ''}
                    className={`${inputClassName} bg-[#f4f3f1] text-[#5f5e5e]`}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#5f5e5e]">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className={inputClassName}
                  />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <Button type="button" variant="secondary" onClick={handleLogout}>
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setProfileOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={profileSaving}>
                      {profileSaving ? 'Saving...' : 'Update Profile'}
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
