'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BellIcon, CreditCardIcon, LayoutGridIcon, ReceiptTextIcon, ShieldCheckIcon, UsersIcon } from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { useAuthMe } from '@/hooks/useAuthMe';
import { canManageRoleMatrix, getDefaultCrmLandingPath, getSettingsLandingPath, hasModuleActionAccess } from '@/lib/route-access';
import { cn } from '@/lib/utils';

type SettingsNavItem = {
  key: 'overview' | 'reminders' | 'stripe' | 'users' | 'expenses' | 'roles';
  href: string;
  icon: ReactNode;
};

const settingsNavItems: SettingsNavItem[] = [
  {
    key: 'overview',
    href: '/settings',
    icon: <LayoutGridIcon className="size-4" />,
  },
  {
    key: 'reminders',
    href: '/settings/reminders',
    icon: <BellIcon className="size-4" />,
  },
  {
    key: 'stripe',
    href: '/settings/stripe',
    icon: <CreditCardIcon className="size-4" />,
  },
  {
    key: 'expenses',
    href: '/settings/expenses',
    icon: <ReceiptTextIcon className="size-4" />,
  },
  {
    key: 'users',
    href: '/settings/users',
    icon: <UsersIcon className="size-4" />,
  },
  {
    key: 'roles',
    href: '/settings/roles',
    icon: <ShieldCheckIcon className="size-4" />,
  },
];

const settingsMessages = {
  en: {
    shellTitle: 'Settings',
    heading: 'Settings',
    subtitle: 'Organize payments, reminders, templates, and recurring invoice workflows in one place.',
    nav: {
      overview: 'Overview',
      reminders: 'Reminders',
      stripe: 'Payments',
      expenses: 'Expenses',
      users: 'Users',
      roles: 'Role Matrix',
    },
  },
  fr: {
    shellTitle: 'Paramètres',
    heading: 'Paramètres',
    subtitle: 'Organisez les paiements, les relances, les modèles et les flux de facturation récurrente au même endroit.',
    nav: {
      overview: 'Vue d\'ensemble',
      reminders: 'Relances',
      stripe: 'Paiements',
      expenses: 'Dépenses',
      users: 'Utilisateurs',
      roles: 'Matrice des roles',
    },
  },
} as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useLocale();
  const { user, loading } = useAuthMe();
  const t = settingsMessages[locale];
  const canViewSettings = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'settings', action: 'view' });
  const canViewUsers = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'users', action: 'view' });
  const canViewExpenses =
    user?.featureFlags?.expenses !== false &&
    hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'expenses', action: 'view' });
  const canManageRoles = canManageRoleMatrix(user?.role, user?.featureFlags);
  const settingsLandingPath = getSettingsLandingPath(user?.role, user?.modulePermissions, user?.featureFlags);

  useEffect(() => {
    if (loading) {
      return;
    }

    const fallbackPath = settingsLandingPath || getDefaultCrmLandingPath(user?.role, user?.modulePermissions, user?.featureFlags);
    const cannotAccessCurrentPath =
      (pathname === '/settings' || pathname.startsWith('/settings/reminders') || pathname.startsWith('/settings/stripe'))
        ? !canViewSettings
        : pathname.startsWith('/settings/users')
          ? !canViewUsers
          : pathname.startsWith('/settings/expenses')
            ? !canViewExpenses
            : pathname.startsWith('/settings/roles')
              ? !canManageRoles
              : false;

    if (cannotAccessCurrentPath && fallbackPath && fallbackPath !== pathname) {
      router.replace(fallbackPath);
      return;
    }

    if (pathname === '/settings' && settingsLandingPath && settingsLandingPath !== pathname && !canViewSettings) {
      router.replace(settingsLandingPath);
    }
  }, [canManageRoles, canViewExpenses, canViewSettings, canViewUsers, loading, pathname, router, settingsLandingPath, user?.featureFlags, user?.modulePermissions, user?.role]);

  const visibleNavItems = settingsNavItems.filter((item) => {
    if (item.key === 'overview' || item.key === 'reminders' || item.key === 'stripe') return canViewSettings;
    if (item.key === 'users') return canViewUsers;
    if (item.key === 'expenses') return canViewExpenses;
    if (item.key === 'roles') return canManageRoles;
    return false;
  });

  return (
    <CrmShell title={t.shellTitle}>
      <div className="space-y-6">
        <div className="space-y-1.5" data-tour-settings-header>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <nav className="w-full" aria-label={t.heading} data-tour-settings-nav>
          <div className="flex items-stretch gap-0.5 rounded-2xl border border-border/60 bg-muted/40 p-1.5 shadow-sm">
            {visibleNavItems.map((item) => {
              const isActive =
                item.href === '/settings'
                  ? pathname === '/settings'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={cn(
                    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-center text-xs font-medium transition-all duration-150 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm',
                    isActive
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/40'
                      : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                  )}
                >
                  {item.icon}
                  <span className="min-w-0 whitespace-normal leading-tight sm:text-left">{t.nav[item.key]}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {children}
      </div>
    </CrmShell>
  );
}