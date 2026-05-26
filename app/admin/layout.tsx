'use client';

import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { AdminSidebar } from '@/components/admin-sidebar';
import { LanguageThemeToggle } from '@/components/language-theme-toggle';
import { useLocale } from '@/components/providers/locale-provider';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { WorkspaceHeader } from '@/components/workspace-header';
import { cn } from '@/lib/utils';

const adminMessages = {
  en: {
    eyebrow: 'Super admin',
    badge: 'Platform access',
    dashboard: {
      title: 'Platform dashboard',
      description: 'Operate companies, feature access, and platform activity from the same workspace framing used across the CRM.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(241,245,249,0.96))]',
    },
    logs: {
      title: 'Platform logs',
      description: 'Review admin activity, access attempts, and platform signals in a more structured operations workspace.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,241,242,0.92))]',
    },
  },
  fr: {
    eyebrow: 'Super admin',
    badge: 'Acces plateforme',
    dashboard: {
      title: 'Tableau plateforme',
      description: 'Pilotez les entreprises, les modules et l activite plateforme dans un cadre aligne sur le CRM.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(241,245,249,0.96))]',
    },
    logs: {
      title: 'Journaux plateforme',
      description: 'Analysez les actions admin et les tentatives d acces dans un espace operations plus clair.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,241,242,0.92))]',
    },
  },
} as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const isLoginPage = pathname === '/admin/login';
  const t = adminMessages[locale];

  const routeMeta = useMemo(() => {
    if (pathname.startsWith('/admin/logs')) {
      return t.logs;
    }

    return t.dashboard;
  }, [pathname, t]);

  if (isLoginPage) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 70)',
          '--header-height': 'calc(var(--spacing) * 14)',
        } as CSSProperties
      }
    >
      <AdminSidebar variant="inset" />
      <SidebarInset className="overflow-hidden bg-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,1))] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,1))]" />
        <div className="relative flex min-h-svh flex-1 flex-col">
          <WorkspaceHeader
            title={routeMeta.title}
            description={routeMeta.description}
            actions={
              <>
                <div className="hidden rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-300 lg:inline-flex">
                  Admin Panel
                </div>
                <LanguageThemeToggle className="shrink-0" />
              </>
            }
          />

          <main className="flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                '@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-4 py-4 pb-[calc(1rem+var(--app-safe-area-bottom)+var(--app-keyboard-inset-height))] scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))] lg:px-6 lg:py-6',
                routeMeta.tone,
              )}
            >
              <div className="relative min-w-0 overflow-x-clip rounded-[28px] border border-white/70 bg-white/90 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/55 dark:shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-4">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-200/80 to-transparent dark:via-slate-700/70" />
                <div className="relative flex min-w-0 flex-col gap-4 *:min-w-0">
                  {children}
                </div>
              </div>
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
