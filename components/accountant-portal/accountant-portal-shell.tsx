'use client';

import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { LanguageThemeToggle } from '@/components/language-theme-toggle';
import { AccountantPortalSidebar } from '@/components/accountant-portal/accountant-portal-sidebar';
import { useLocale } from '@/components/providers/locale-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { WorkspaceHeader } from '@/components/workspace-header';
import type { CompanyFeatureFlags } from '@/lib/company-features';
import { cn } from '@/lib/utils';

const shellMessages = {
  en: {
    role: 'Accountant',
    fallbackName: 'Accountant',
    dashboard: {
      title: 'Accounting dashboard',
      description: 'Track revenue, VAT exposure, unpaid documents, and assigned accounting work from one shared workspace shell.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(241,245,249,0.96))]',
    },
    purchaseInvoices: {
      title: 'Purchase invoices',
      description: 'Review supplier costs, payment state, and source attachments with the same table framing used across the CRM.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(236,253,245,0.88))]',
    },
    salesInvoices: {
      title: 'Sales invoices',
      description: 'Follow receivables, invoice status, and secure PDF access inside the same high-clarity workspace layout.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(239,246,255,0.92))]',
    },
    tickets: {
      title: 'Accounting tickets',
      description: 'Stay aligned with the company team through the same structured support workspace patterns used in the CRM.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(245,243,255,0.9))]',
    },
    exports: {
      title: 'Accounting exports',
      description: 'Generate accounting rows and statutory packs in a focused export workspace that matches the refreshed portal chrome.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,251,235,0.92))]',
    },
  },
  fr: {
    role: 'Comptable',
    fallbackName: 'Comptable',
    dashboard: {
      title: 'Tableau comptable',
      description: 'Suivez le chiffre, la TVA, les documents impayes et les tickets assignes dans un shell partage avec le CRM.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(241,245,249,0.96))]',
    },
    purchaseInvoices: {
      title: 'Achats',
      description: 'Relisez les couts fournisseurs, le statut de paiement et les pieces jointes dans le meme cadre que les ecrans CRM.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(236,253,245,0.88))]',
    },
    salesInvoices: {
      title: 'Ventes',
      description: 'Suivez les creances, les statuts facture et les PDF securises dans une presentation plus claire et uniforme.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(239,246,255,0.92))]',
    },
    tickets: {
      title: 'Tickets comptables',
      description: 'Retrouvez les echanges comptables dans le meme espace de travail structure que le CRM principal.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(245,243,255,0.9))]',
    },
    exports: {
      title: 'Exports comptables',
      description: 'Telechargez les ecritures et les syntheses dans un espace export aligne avec le nouveau chrome du portail.',
      tone: 'bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.4),rgba(255,251,235,0.92))]',
    },
  },
} as const;

type AccountantPortalShellProps = {
  children: React.ReactNode;
  featureFlags?: CompanyFeatureFlags;
  userName?: string;
  userEmail?: string;
};

export function AccountantPortalShell({ children, featureFlags, userName, userEmail }: AccountantPortalShellProps) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const isAuthPage = pathname === '/accountant-portal/login' || pathname === '/accountant-portal/forgot-password';
  const t = shellMessages[locale];
  const displayName = userName?.trim() || t.fallbackName;
  const userInitials = useMemo(() => {
    const parts = displayName.split(' ').filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
    }

    return displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const routeMeta = useMemo(() => {
    if (pathname.startsWith('/accountant-portal/purchase-invoices')) {
      return t.purchaseInvoices;
    }
    if (pathname.startsWith('/accountant-portal/sales-invoices')) {
      return t.salesInvoices;
    }
    if (pathname.startsWith('/accountant-portal/tickets')) {
      return t.tickets;
    }
    if (pathname.startsWith('/accountant-portal/exports')) {
      return t.exports;
    }

    return t.dashboard;
  }, [pathname, t]);

  if (isAuthPage) {
    return <div className="min-h-dvh bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,rgba(15,23,42,0.02),transparent_28%)]">{children}</div>;
  }

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 74)',
          '--header-height': 'calc(var(--spacing) * 14)',
        } as CSSProperties
      }
    >
      <AccountantPortalSidebar variant="inset" featureFlags={featureFlags} userName={userName} userEmail={userEmail} />
      <SidebarInset className="overflow-hidden bg-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.06),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,1))] dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.10),transparent_26%),linear-gradient(180deg,rgba(2,6,23,0.94),rgba(15,23,42,1))]" />
        <div className="relative flex min-h-svh flex-1 flex-col">
          <WorkspaceHeader
            title={routeMeta.title}
            description={routeMeta.description}
            actions={
              <>
                <div className="relative group/profile">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-10 w-10 rounded-full border border-slate-200/80 bg-white/85 p-0 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950/80 dark:hover:bg-slate-900 sm:h-11 sm:w-11"
                    aria-label={displayName}
                  >
                    <Avatar size="lg" className="size-8 rounded-full bg-slate-100 dark:bg-slate-900 sm:size-9">
                      <AvatarFallback className="text-[13px] font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>

                  <div className="pointer-events-none absolute right-0 top-[calc(100%+0.6rem)] z-30 w-64 translate-y-2 rounded-2xl border border-slate-200/80 bg-white/96 p-4 text-left opacity-0 shadow-[0_18px_48px_rgba(15,23,42,0.14)] transition-all duration-150 group-hover/profile:pointer-events-auto group-hover/profile:translate-y-0 group-hover/profile:opacity-100 group-focus-within/profile:pointer-events-auto group-focus-within/profile:translate-y-0 group-focus-within/profile:opacity-100 dark:border-slate-800/80 dark:bg-slate-950/96 dark:shadow-[0_18px_48px_rgba(2,6,23,0.45)]">
                    <div className="flex items-start gap-3">
                      <Avatar size="lg" className="size-10 rounded-full bg-slate-100 dark:bg-slate-900">
                        <AvatarFallback className="text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">
                          {userInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{displayName}</p>
                        {userEmail ? <p className="truncate text-xs text-muted-foreground">{userEmail}</p> : null}
                        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <LanguageThemeToggle className="shrink-0" compactOnMobile />
              </>
            }
          />

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              className={cn(
                '@container/main flex min-h-0 min-w-0 flex-1 flex-col gap-4 px-4 py-4 pb-[calc(1rem+var(--app-safe-area-bottom)+var(--app-keyboard-inset-height))] scroll-pb-[calc(5rem+var(--app-keyboard-inset-height))] lg:px-6 lg:py-6',
                routeMeta.tone,
              )}
            >
              <div className="relative min-w-0 overflow-x-clip rounded-[28px] border border-white/70 bg-white/88 p-3 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/55 dark:shadow-[0_24px_80px_rgba(2,6,23,0.45)] sm:p-4">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-slate-200/80 to-transparent dark:via-slate-700/70" />
                <div className="relative flex min-w-0 flex-col gap-4 *:min-w-0">{children}</div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}