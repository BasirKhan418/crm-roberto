'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  LayoutGrid,
  ClipboardList,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

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
import { useLocale } from '@/components/providers/locale-provider';
import { CountBadgeRow } from '@/components/ui/count-badge';
import { useAdminSidebarBadges } from '@/hooks/useAdminSidebarBadges';

const adminNavItems = [
  { key: 'dashboard', url: '/admin', icon: <LayoutGrid /> },
  { key: 'companies', url: '/admin/companies', icon: <Building2 /> },
  { key: 'logs', url: '/admin/logs', icon: <ClipboardList /> },
] as const;

const sidebarMessages = {
  en: {
    brand: 'Roby',
    tagline: 'Platform operations cockpit',
    badgeTitles: {
      suspendedCompanies: (n: number) => `${n} suspended companies`,
      failedAccess: (n: number) => `${n} failed sign-ins in the last 24h`,
    },
    management: 'Management',
    dashboard: 'Platform Dashboard',
    companies: 'Companies',
    logs: 'Logs',
    session: 'Session',
    logout: 'Logout',
    adminSession: 'Admin session',
  },
  fr: {
    brand: 'Roby',
    tagline: 'Cockpit operations plateforme',
    badgeTitles: {
      suspendedCompanies: (n: number) => `${n} entreprise(s) suspendue(s)`,
      failedAccess: (n: number) => `${n} tentative(s) de connexion echouee(s) sur 24 h`,
    },
    management: 'Gestion',
    dashboard: 'Tableau plateforme',
    companies: 'Entreprises',
    logs: 'Journaux',
    session: 'Session',
    logout: 'Déconnexion',
    adminSession: 'Session administrateur',
  },
} as const;

const navLabels = {
  en: { dashboard: 'Platform Dashboard', companies: 'Companies', logs: 'Logs' },
  fr: { dashboard: 'Tableau plateforme', companies: 'Entreprises', logs: 'Journaux' },
} as const;

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const t = sidebarMessages[locale];
  const { badges } = useAdminSidebarBadges();

  function isItemActive(url: (typeof adminNavItems)[number]['url']) {
    if (url === '/admin') {
      return pathname === '/admin';
    }

    return pathname === url || pathname.startsWith(`${url}/`);
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Brand header */}
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
                  style={{ height: "auto" }}
                  className="mix-blend-multiply dark:mix-blend-normal dark:brightness-0 dark:invert"
                />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sidebar-foreground/70">{t.brand}</p>
                  <p className="text-[11px] text-muted-foreground">{t.tagline}</p>
                </div>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent>
        <SidebarGroup className="pt-1">
          <SidebarGroupLabel>{t.management}</SidebarGroupLabel>
          <SidebarMenu className="px-2">
            {adminNavItems.map((item) => {
              let badgeNode: React.ReactNode = null;

              if (item.key === 'companies') {
                const suspended = badges.companies.suspended;
                if (suspended > 0) {
                  badgeNode = (
                    <CountBadgeRow
                      items={[{ count: suspended, tone: 'red', title: t.badgeTitles.suspendedCompanies(suspended) }]}
                    />
                  );
                }
              } else if (item.key === 'logs') {
                const failedAccess = badges.logs.failedAccess;
                if (failedAccess > 0) {
                  badgeNode = (
                    <CountBadgeRow
                      items={[{ count: failedAccess, tone: 'red', title: t.badgeTitles.failedAccess(failedAccess) }]}
                    />
                  );
                }
              }

              return (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    asChild
                    isActive={isItemActive(item.url)}
                    className="h-11 rounded-xl border border-transparent bg-transparent text-(--color-text-secondary) hover:border-sidebar-border/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground data-[active=true]:border-sidebar-border/70 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground"
                  >
                    <Link href={item.url}>
                      {item.icon}
                      <span>{navLabels[locale][item.key]}</span>
                      {badgeNode}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — admin info + logout */}
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarGroupLabel className="px-3 pb-1">{t.session}</SidebarGroupLabel>
            <div className="mx-2 rounded-2xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <ShieldCheck className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">Super Admin</p>
                  <p className="truncate text-xs text-muted-foreground">{t.adminSession}</p>
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
