'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import FirstVisitGuide from '@/components/onboarding/first-visit-guide';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface CrmShellProps {
  title: string;
  children: ReactNode;
  contentClassName?: string;
}

export default function CrmShell({ title, children, contentClassName }: CrmShellProps) {
  const pathname = usePathname();
  const moduleTone = useMemo(() => {
    if (pathname.startsWith('/clients')) {
      return {
        shell: 'from-indigo-50/80 to-transparent dark:from-indigo-950/20 dark:to-transparent',
        panel: 'bg-indigo-50/40 dark:bg-indigo-950/15',
        glow: 'bg-indigo-400/45 dark:bg-indigo-500/25',
        glowSoft: 'bg-indigo-300/35 dark:bg-indigo-500/15',
      };
    }
    if (pathname.startsWith('/suppliers')) {
      return {
        shell: 'from-cyan-50/80 to-transparent dark:from-cyan-950/20 dark:to-transparent',
        panel: 'bg-cyan-50/40 dark:bg-cyan-950/15',
        glow: 'bg-cyan-400/45 dark:bg-cyan-500/25',
        glowSoft: 'bg-cyan-300/35 dark:bg-cyan-500/15',
      };
    }
    if (pathname.startsWith('/catalogue')) {
      return {
        shell: 'from-emerald-50/80 to-transparent dark:from-emerald-950/20 dark:to-transparent',
        panel: 'bg-emerald-50/40 dark:bg-emerald-950/15',
        glow: 'bg-emerald-400/45 dark:bg-emerald-500/25',
        glowSoft: 'bg-emerald-300/35 dark:bg-emerald-500/15',
      };
    }
    if (pathname.startsWith('/quotes')) {
      return {
        shell: 'from-amber-50/80 to-transparent dark:from-amber-950/20 dark:to-transparent',
        panel: 'bg-amber-50/40 dark:bg-amber-950/15',
        glow: 'bg-amber-400/45 dark:bg-amber-500/25',
        glowSoft: 'bg-amber-300/35 dark:bg-amber-500/15',
      };
    }
    if (pathname.startsWith('/invoices')) {
      return {
        shell: 'from-rose-50/80 to-transparent dark:from-rose-950/20 dark:to-transparent',
        panel: 'bg-rose-50/40 dark:bg-rose-950/15',
        glow: 'bg-rose-400/45 dark:bg-rose-500/25',
        glowSoft: 'bg-rose-300/35 dark:bg-rose-500/15',
      };
    }
    if (pathname.startsWith('/notes')) {
      return {
        shell: 'from-violet-50/80 to-transparent dark:from-violet-950/20 dark:to-transparent',
        panel: 'bg-violet-50/40 dark:bg-violet-950/15',
        glow: 'bg-violet-400/45 dark:bg-violet-500/25',
        glowSoft: 'bg-violet-300/35 dark:bg-violet-500/15',
      };
    }
    if (pathname.startsWith('/profile')) {
      return {
        shell: 'from-sky-50/80 to-transparent dark:from-sky-950/20 dark:to-transparent',
        panel: 'bg-sky-50/40 dark:bg-sky-950/15',
        glow: 'bg-sky-400/45 dark:bg-sky-500/25',
        glowSoft: 'bg-sky-300/35 dark:bg-sky-500/15',
      };
    }

    return null;
  }, [pathname]);

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={title} />
        <main className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              '@container/main flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 pb-[calc(1rem+var(--app-safe-area-bottom)+var(--app-keyboard-inset-height))] scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))] lg:px-6 lg:py-6',
              moduleTone ? `bg-linear-to-b ${moduleTone.shell}` : null,
              contentClassName,
            )}
          >
            {moduleTone ? (
              <div className={cn('relative overflow-hidden rounded-2xl p-3 sm:p-4', moduleTone.panel)}>
                <div className={cn('pointer-events-none absolute -top-16 -right-12 size-44 rounded-full blur-3xl', moduleTone.glow)} />
                <div className={cn('pointer-events-none absolute -bottom-20 -left-14 size-52 rounded-full blur-3xl', moduleTone.glowSoft)} />
                <div className="relative">
                  {children}
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </main>
        <FirstVisitGuide />
      </SidebarInset>
    </SidebarProvider>
  );
}
