'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
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

const adminNavItems = [
  { key: 'dashboard', url: '/admin', icon: <Building2 /> },
  { key: 'users', url: '/admin/logs', icon: <ClipboardList /> },
] as const;

const sidebarMessages = {
  en: {
    brand: 'Roby',
    tagline: 'Platform operations cockpit',
    management: 'Management',
    dashboard: 'Platform Dashboard',
    users: 'Logs',
    session: 'Session',
    logout: 'Logout',
  },
  fr: {
    brand: 'Roby',
    tagline: 'Cockpit operations plateforme',
    management: 'Gestion',
    dashboard: 'Tableau plateforme',
    users: 'Logs',
    session: 'Session',
    logout: 'Déconnexion',
  },
} as const;

const navLabels = {
  en: { dashboard: 'Platform Dashboard', users: 'Logs' },
  fr: { dashboard: 'Tableau plateforme', users: 'Logs' },
} as const;

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const t = sidebarMessages[locale];

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
            {adminNavItems.map((item) => (
              <SidebarMenuItem key={item.key}>
                <SidebarMenuButton
                  asChild
                  isActive={isItemActive(item.url)}
                  className="h-11 rounded-xl border border-transparent bg-transparent text-(--color-text-secondary) hover:border-sidebar-border/60 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground data-[active=true]:border-sidebar-border/70 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground"
                >
                  <Link href={item.url}>
                    {item.icon}
                    <span>{navLabels[locale][item.key]}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
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
                  <p className="truncate text-xs text-muted-foreground">admin session</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-blue-200/70 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">
                  Platform scope
                </span>
                <span className="inline-flex items-center rounded-full border border-sidebar-border/60 bg-background/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  Secure session
                </span>
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
