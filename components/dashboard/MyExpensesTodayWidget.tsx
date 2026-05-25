'use client';

import Link from 'next/link';
import { CirclePlusIcon, MessageSquareIcon, ReceiptTextIcon, WalletCardsIcon } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { useSmartAlerts } from '@/hooks/useSmartAlerts';

export default function MyExpensesTodayWidget() {
  const { locale } = useLocale();
  const { data, loading, error } = useSmartAlerts();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const t = {
    en: {
      title: 'My expenses today',
      description: 'Quick daily pulse for expense capture and pending follow-up work.',
      enteredToday: 'Entered today',
      dueThisWeek: 'Due this week',
      tickets: 'Tickets awaiting reply',
      quickExpense: 'New expense',
      loadError: 'Could not load today\'s expense snapshot.',
    },
    fr: {
      title: 'Mes depenses aujourd hui',
      description: 'Vue rapide du jour pour la saisie des depenses et le suivi en attente.',
      enteredToday: 'Saisies aujourd hui',
      dueThisWeek: 'Echeances cette semaine',
      tickets: 'Tickets en attente de reponse',
      quickExpense: 'Nouvelle depense',
      loadError: 'Impossible de charger le resume du jour.',
    },
  }[locale];

  const stats = [
    {
      label: t.enteredToday,
      count: data.myExpensesToday.expensesEnteredTodayCount,
      amount: data.myExpensesToday.expensesEnteredTodayTotalCents,
      icon: WalletCardsIcon,
      href: '/expenses?sortBy=createdAt&sortOrder=desc',
    },
    {
      label: t.dueThisWeek,
      count: data.myExpensesToday.supplierInvoicesDueThisWeekCount,
      amount: data.myExpensesToday.supplierInvoicesDueThisWeekTotalCents,
      icon: ReceiptTextIcon,
      href: '/expenses?sortBy=dueDate&sortOrder=asc',
    },
    {
      label: t.tickets,
      count: data.myExpensesToday.openTicketsAwaitingReplyCount,
      amount: null,
      icon: MessageSquareIcon,
      href: '/tickets?status=waiting&assignedToMe=true',
    },
  ];

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{error ? t.loadError : t.description}</CardDescription>
          </div>
          <Button asChild size="sm" className="rounded-full px-3 text-xs font-semibold">
            <Link href="/expenses?newExpense=1">
              <CirclePlusIcon className="size-3.5" />
              {t.quickExpense}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {stats.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 transition-colors hover:bg-muted/45"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="rounded-xl bg-background p-2 ring-1 ring-border/60">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  {loading ? <Skeleton className="mt-1 h-3.5 w-16" /> : <p className="text-xs text-muted-foreground">{item.count} item(s)</p>}
                </div>
              </div>
              <div className="text-right">
                {loading ? (
                  <Skeleton className="h-5 w-20" />
                ) : item.amount !== null ? (
                  <PriceDisplay cents={item.amount} locale={priceLocale} className="text-sm font-semibold tabular-nums text-foreground" />
                ) : (
                  <span className="text-sm font-semibold tabular-nums text-foreground">{item.count}</span>
                )}
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}