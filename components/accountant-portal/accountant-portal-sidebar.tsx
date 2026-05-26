'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpenText, Calculator, FileDown, LayoutDashboard, LogOut, ReceiptText, ShieldCheck } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import type { CompanyFeatureFlags } from '@/lib/company-features';

const sidebarMessages = {
  en: {
    workspace: 'Accounting workspace',
    tagline: 'Shared shell, portal-safe access',
    readOnly: 'Read-only access',
    scope: 'Company scoped',
    session: 'Session',
    logout: 'Sign out',
    accountant: 'External accountant',
    nav: {
      dashboard: 'Dashboard',
      purchaseInvoices: 'Purchase invoices',
      salesInvoices: 'Sales invoices',
      tickets: 'Tickets',
      exports: 'Exports',
    },
  },
  fr: {
    workspace: 'Espace comptable',
    tagline: 'Meme shell, acces portail securise',
    readOnly: 'Lecture seule',
    scope: 'Perimetre entreprise',
    session: 'Session',
    logout: 'Deconnexion',
    accountant: 'Comptable externe',
    nav: {
      dashboard: 'Tableau de bord',
      purchaseInvoices: 'Achats',
      salesInvoices: 'Ventes',
      tickets: 'Tickets',
      exports: 'Exports',
    },
  },
} as const;

const navItems = [
  { key: 'dashboard', href: '/accountant-portal', icon: LayoutDashboard },
  { key: 'purchaseInvoices', href: '/accountant-portal/purchase-invoices', icon: ReceiptText },
  { key: 'salesInvoices', href: '/accountant-portal/sales-invoices', icon: BookOpenText },
  { key: 'tickets', href: '/accountant-portal/tickets', icon: Calculator },
  { key: 'exports', href: '/accountant-portal/exports', icon: FileDown },
] as const;

type AccountantPortalSidebarProps = React.ComponentProps<typeof Sidebar> & {
  featureFlags?: CompanyFeatureFlags;
  userName?: string;
  userEmail?: string;
};

export function AccountantPortalSidebar({ featureFlags, userName, userEmail, ...props }: AccountantPortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const t = sidebarMessages[locale];

  const visibleNavItems = navItems.filter((item) => item.href !== '/accountant-portal/exports' || featureFlags?.exports !== false);

  async function handleLogout() {
    await fetch('/api/accountant/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null);

    router.replace('/accountant-portal/login');
    router.refresh();
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu className="px-1 pt-1">
          <SidebarMenuItem>
            <SidebarMenuButton className="h-auto rounded-2xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-3 data-[slot=sidebar-menu-button]:p-3! hover:bg-sidebar-accent/60">
              <div className="flex w-full flex-col items-center gap-2 text-center">
                <Image
                  src="/logo.png"
                  alt="Roby"
                  width={110}
                  height={38}
                  style={{ height: 'auto' }}
                  className="mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
                />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/70">{t.workspace}</p>
                  <p className="text-[11px] text-muted-foreground">{t.tagline}</p>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>{t.workspace}</SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === '/accountant-portal'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="h-11 rounded-xl border border-transparent bg-transparent text-(--color-text-secondary) hover:border-sidebar-border/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground data-[active=true]:border-sidebar-border/70 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground"
                  >
                    <Link href={item.href}>
                      <Icon />
                      <span>{t.nav[item.key]}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarGroupLabel className="px-3 pb-1">{t.session}</SidebarGroupLabel>
            <div className="mx-2 rounded-2xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{userName?.trim() || t.accountant}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail || t.accountant}</p>
                </div>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="mx-2 h-10 w-[calc(100%-1rem)] gap-2 rounded-xl border border-red-200/80 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-950/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
            >
              <LogOut className="size-4" />
              <span>{t.logout}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}