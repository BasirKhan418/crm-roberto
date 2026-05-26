'use client';

import type { CSSProperties } from 'react';
import { usePathname } from 'next/navigation';

import { AdminSidebar } from '@/components/admin-sidebar';
import { LanguageThemeToggle } from '@/components/language-theme-toggle';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

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
          '--sidebar-width': 'calc(var(--spacing) * 68)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as CSSProperties
      }
    >
      <AdminSidebar variant="inset" />
      <SidebarInset>
        <header className="shrink-0 border-b bg-background/95 transition-[width,height] ease-linear supports-backdrop-filter:bg-background/80">
          <div className="flex min-h-(--header-height) w-full items-center gap-2 px-4 py-3 lg:gap-3 lg:px-6">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mx-1 hidden h-4 lg:block" />
          <span className="min-w-0 truncate text-base font-medium text-foreground">Admin Panel</span>
          <div className="ml-auto">
            <LanguageThemeToggle />
          </div>
          </div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col">
          <div className="@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-4 bg-[#f3f7fb] px-4 py-4 pb-[calc(1rem+var(--app-safe-area-bottom)+var(--app-keyboard-inset-height))] scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))] dark:bg-slate-950/20 lg:px-6 lg:py-6">
            <div className={cn('min-w-0 overflow-x-clip rounded-2xl border border-slate-200/80 bg-white p-3 dark:border-slate-800/70 dark:bg-slate-950/40 sm:p-4')}>
              <div className="flex min-w-0 flex-col gap-4 *:min-w-0">
                {children}
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
