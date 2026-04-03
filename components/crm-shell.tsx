'use client';

import type { CSSProperties, ReactNode } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

interface CrmShellProps {
  title: string;
  children: ReactNode;
  contentClassName?: string;
}

export default function CrmShell({ title, children, contentClassName }: CrmShellProps) {
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
              contentClassName,
            )}
          >
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
