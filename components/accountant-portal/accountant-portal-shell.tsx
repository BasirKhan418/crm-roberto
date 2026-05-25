'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpenText, Calculator, FileDown, LayoutDashboard, LogOut, ReceiptText } from 'lucide-react';

import { LanguageThemeToggle } from '@/components/language-theme-toggle';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/accountant-portal', icon: LayoutDashboard, label: 'Dashboard', labelFr: 'Tableau de bord' },
  { href: '/accountant-portal/purchase-invoices', icon: ReceiptText, label: 'Purchase invoices', labelFr: 'Achats' },
  { href: '/accountant-portal/sales-invoices', icon: BookOpenText, label: 'Sales invoices', labelFr: 'Ventes' },
  { href: '/accountant-portal/tickets', icon: Calculator, label: 'Tickets', labelFr: 'Tickets' },
  { href: '/accountant-portal/exports', icon: FileDown, label: 'Exports', labelFr: 'Exports' },
] as const;

export function AccountantPortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/accountant-portal/login';

  async function handleLogout() {
    await fetch('/api/accountant/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null);
    router.push('/accountant-portal/login');
    router.refresh();
  }

  if (isLoginPage) {
    return <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.12),_transparent_34%),linear-gradient(180deg,_rgba(15,23,42,0.02),_transparent_28%)]">{children}</div>;
  }

  return (
    <div
      className="min-h-dvh bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.06),_transparent_30%),linear-gradient(180deg,_rgba(255,255,255,0.94),_rgba(248,250,252,1))]"
      style={
        {
          '--portal-accent': '#b45309',
        } as CSSProperties
      }
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-[1480px] flex-col lg:flex-row">
        <aside className="border-b border-border/60 bg-white/80 px-4 py-4 backdrop-blur lg:min-h-dvh lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-start justify-between gap-3 lg:block">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Accountant Portal
              </div>
              <div>
                <h1 className="font-heading text-xl font-semibold text-slate-950">Read-only accounting workspace</h1>
                <p className="mt-1 text-sm text-muted-foreground">Dedicated access for external accountants with company-scoped finance views.</p>
              </div>
            </div>
            <div className="hidden lg:flex lg:items-center lg:gap-2">
              <LanguageThemeToggle />
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:flex-col lg:overflow-visible">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'inline-flex min-w-fit items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors lg:w-full',
                    isActive
                      ? 'border-amber-300 bg-amber-50 text-amber-900 shadow-sm'
                      : 'border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex items-center gap-2 lg:mt-auto lg:flex-col lg:items-stretch">
            <div className="lg:hidden">
              <LanguageThemeToggle />
            </div>
            <Button type="button" variant="outline" className="w-full justify-center gap-2" onClick={handleLogout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <main className="flex min-h-dvh min-w-0 flex-1 flex-col px-4 py-4 lg:px-6 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}