import type { Metadata } from 'next';
import { Geist, Geist_Mono, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'V3 — Autonomous Personal Intelligence & Execution OS',
  description:
    'Clean white, orange, and obsidian personal intelligence OS for goals, hybrid pgvector memory, grounded research, multi-channel comms, and LangGraph automation.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#faf9f6] font-sans text-[#1a1c1a] selection:bg-[#ff6b35]/20 selection:text-[#5f1900]">
        {children}
      </body>
    </html>
  );
}
