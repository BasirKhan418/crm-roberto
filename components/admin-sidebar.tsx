'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  UsersRound,
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
  { key: 'users', url: '/admin', icon: <UsersRound /> },
] as const;

const sidebarMessages = {
  en: {
    brand: 'CRM Roberto',
    tagline: 'Admin Panel',
    management: 'Management',
    users: 'User Management',
    session: 'Session',
    logout: 'Logout',
  },
  fr: {
    brand: 'CRM Roberto',
    tagline: 'Panneau Admin',
    management: 'Gestion',
    users: 'Gestion des utilisateurs',
    session: 'Session',
    logout: 'Déconnexion',
  },
} as const;

const navLabels = {
  en: { users: 'User Management' },
  fr: { users: 'Gestion des utilisateurs' },
} as const;

export function AdminSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const t = sidebarMessages[locale];

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
            <SidebarMenuButton className="h-auto rounded-xl border border-sidebar-border/80 bg-sidebar-accent/50 p-2 data-[slot=sidebar-menu-button]:p-2!">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary p-1.5 text-primary-foreground">
                  <LayoutDashboard className="size-4" />
                </div>
                <div className="grid text-left leading-tight">
                  <span className="text-base font-semibold">{t.brand}</span>
                  <span className="text-xs text-muted-foreground">{t.tagline}</span>
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
                  isActive={pathname === item.url}
                  className="h-10 bg-transparent text-(--color-text-secondary) hover:bg-transparent hover:text-(--color-text-secondary) data-[active=true]:bg-(--color-background-info) data-[active=true]:text-(--color-text-info)"
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
            <div className="flex items-center gap-2.5 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2.5 mx-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <ShieldCheck className="size-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">Super Admin</p>
                <p className="truncate text-[10px] text-muted-foreground">admin session</p>
              </div>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="mx-2 h-9 w-[calc(100%-1rem)] gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
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
