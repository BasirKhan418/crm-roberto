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
  const shellTone = useMemo(() => {
    if (pathname.startsWith('/clients')) {
      return 'bg-[#eef4ff] dark:bg-slate-950/20';
    }
    if (pathname.startsWith('/suppliers')) {
      return 'bg-[#eef9f7] dark:bg-slate-950/20';
    }
    if (pathname.startsWith('/catalogue')) {
      return 'bg-[#f2f8ee] dark:bg-slate-950/20';
    }
    if (pathname.startsWith('/quotes')) {
      return 'bg-white dark:bg-slate-950/20';
    }
    if (pathname.startsWith('/invoices')) {
      return 'bg-[#fff1f1] dark:bg-slate-950/20';
    }
    if (pathname.startsWith('/notes')) {
      return 'bg-[#f6f1ff] dark:bg-slate-950/20';
    }
    if (pathname.startsWith('/profile') || pathname.startsWith('/settings')) {
      return 'bg-[#eef6fb] dark:bg-slate-950/20';
    }
    if (pathname.startsWith('/dashboard')) {
      return 'bg-[#f3f7fb] dark:bg-slate-950/20';
    }

    return 'bg-[#f5f7fa] dark:bg-slate-950/20';
  }, [pathname]);

  const panelTone = 'rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800/70 dark:bg-slate-950/40';

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
              shellTone,
              contentClassName,
            )}
          >
            <div className={cn('p-3 sm:p-4', panelTone)}>
              <div className="flex flex-col gap-4">
                {children}
              </div>
            </div>
          </div>
        </main>
        <FirstVisitGuide />
      </SidebarInset>
    </SidebarProvider>
  );
}
