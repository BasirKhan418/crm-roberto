'use client';

import type { CSSProperties, ReactNode } from 'react';

import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

interface CrmShellProps {
  title: string;
  children: ReactNode;
}

export default function CrmShell({ title, children }: CrmShellProps) {
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
        <main className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-4 px-4 py-4 lg:px-6 lg:py-6">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
