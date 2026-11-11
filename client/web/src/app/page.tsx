import Link from 'next/link';
import { Badge, Button, Card } from '@/components/ui/primitives';

const capabilities = [
  {
    title: '01. Goal Management',
    description: 'Yearly and hierarchical goals with milestone tracking and live progress rollup.',
  },
  {
    title: '02. AI Planning',
    description: 'Decompose goals into milestones and concrete tasks using your personal context.',
  },
  {
    title: '03. Scheduling',
    description: 'Time blocks with conflict detection and available slot suggestions.',
  },
  {
    title: '04. Task Management',
    description: 'Tasks, subtasks, priorities, deadlines, and overdue filtering.',
  },
  {
    title: '05. Accountability',
    description: 'Missed-task detection, reminders, and progress summaries.',
  },
  {
    title: '08. Memory',
    description: 'User preferences, project context notes, and conversation history retrieval.',
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight">V3</span>
            <Badge tone="blue">Phase 1</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-6 py-16">
        <section className="max-w-2xl space-y-5">
          <Badge tone="green">Personal Management & AI Workspace</Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Turn long-term goals into structured plans, schedules, and daily execution.
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            V3 connects hierarchical goals, AI decomposition, task management, time blocking,
            accountability reminders, and personal context in one modular workspace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard">
              <Button>Open Dashboard</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">Sign in</Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item) => (
            <Card key={item.title} className="space-y-2">
              <h2 className="text-base font-semibold">{item.title}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
