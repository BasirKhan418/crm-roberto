'use client';

import type { ReactNode } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellIcon, CreditCardIcon } from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';

type SettingsNavItem = {
  key: 'reminders' | 'stripe';
  href: string;
  icon: ReactNode;
};

const settingsNavItems: SettingsNavItem[] = [
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
];

const settingsMessages = {
  en: {
    shellTitle: 'Settings',
    heading: 'Settings',
    subtitle: 'Configure reminders, payments, and workspace behavior.',
    nav: {
      reminders: 'Reminders',
      stripe: 'Stripe',
    },
  },
  fr: {
    shellTitle: 'Paramètres',
    heading: 'Paramètres',
    subtitle: 'Configurez les relances, les paiements et le comportement de l\'espace de travail.',
    nav: {
      reminders: 'Relances',
      stripe: 'Stripe',
    },
  },
} as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { locale } = useLocale();
  const t = settingsMessages[locale];

  return (
    <CrmShell title={t.shellTitle}>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <nav className="flex flex-wrap items-center gap-2" aria-label={t.heading}>
          {settingsNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
                  isActive
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                )}
              >
                {item.icon}
                <span>{t.nav[item.key]}</span>
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </CrmShell>
  );
}