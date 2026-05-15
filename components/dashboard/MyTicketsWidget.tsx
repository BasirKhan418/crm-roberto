'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { EyeIcon, Loader2Icon, MessageSquareIcon, TimerResetIcon } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';

type TicketSummary = {
  open: number;
  waiting: number;
  unread: number;
};

type TicketSummaryResponse = {
  success?: boolean;
  message?: string;
  data?: Partial<TicketSummary>;
};

function toSafeCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

export default function MyTicketsWidget() {
  const { locale } = useLocale();

  const t = {
    en: {
      title: 'My tickets',
      subtitle: 'Your open workload and unread updates',
      open: 'Open',
      waiting: 'Waiting',
      unread: 'Unread',
      openDescription: 'Assigned or created by you',
      waitingDescription: 'Waiting for assignee reply',
      unreadDescription: 'Needs your attention',
      viewAll: 'View all tickets',
      loadError: 'Could not load ticket summary.',
    },
    fr: {
      title: 'Mes tickets',
      subtitle: 'Charge ouverte et mises à jour non lues',
      open: 'Ouverts',
      waiting: 'En attente',
      unread: 'Non lus',
      openDescription: 'Assignés à vous ou créés par vous',
      waitingDescription: 'En attente de réponse',
      unreadDescription: 'Demande votre attention',
      viewAll: 'Voir tous les tickets',
      loadError: 'Impossible de charger le résumé des tickets.',
    },
  }[locale];

  const [summary, setSummary] = useState<TicketSummary>({ open: 0, waiting: 0, unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/dashboard/tickets/summary', {
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = (await response.json()) as TicketSummaryResponse;

        if (response.status === 401 || response.status === 403) {
          setSummary({ open: 0, waiting: 0, unread: 0 });
          return;
        }

        if (!response.ok || !payload.success) {
          throw new Error(payload.message || t.loadError);
        }

        setSummary({
          open: toSafeCount(payload.data?.open),
          waiting: toSafeCount(payload.data?.waiting),
          unread: toSafeCount(payload.data?.unread),
        });
      } catch (caughtError) {
        if (controller.signal.aborted) {
          return;
        }

        setSummary({ open: 0, waiting: 0, unread: 0 });
        console.error('[tickets] summary load failed', caughtError);
        setError(t.loadError);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => controller.abort();
  }, [t.loadError]);

  const items = useMemo(
    () => [
      {
        key: 'open',
        label: t.open,
        value: summary.open,
        href: '/tickets?assignedToMe=true&status=open',
        description: t.openDescription,
        Icon: MessageSquareIcon,
        tone: 'text-sky-600 dark:text-sky-300',
      },
      {
        key: 'waiting',
        label: t.waiting,
        value: summary.waiting,
        href: '/tickets?assignedToMe=true&status=waiting',
        description: t.waitingDescription,
        Icon: TimerResetIcon,
        tone: 'text-amber-600 dark:text-amber-300',
      },
      {
        key: 'unread',
        label: t.unread,
        value: summary.unread,
        href: '/tickets?unreadOnly=true',
        description: t.unreadDescription,
        Icon: EyeIcon,
        tone: 'text-red-600 dark:text-red-300',
      },
    ],
    [summary.open, summary.unread, summary.waiting, t.open, t.openDescription, t.unread, t.unreadDescription, t.waiting, t.waitingDescription]
  );

  return (
    <section>
      <Card className="overflow-hidden border border-border/70 pt-0">
        <CardHeader className="border-b bg-slate-50 px-5 py-4 dark:bg-slate-900/35">
          <CardTitle className="text-lg font-semibold text-foreground">{t.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </CardHeader>

        <CardContent className="space-y-3 p-4 sm:p-5">
          {error ? <ErrorMessage message={error} /> : null}

          <div className="grid gap-2.5 sm:grid-cols-3">
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="rounded-xl border border-border/60 bg-card px-3 py-3 shadow-sm transition-colors hover:bg-muted/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <item.Icon className={`size-4 ${item.tone}`} strokeWidth={2} />
                </div>

                <div className="mt-2 min-h-9">
                  {loading ? (
                    <div className="flex h-9 items-center">
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ) : (
                    <p className="text-3xl font-bold tabular-nums text-foreground">{item.value}</p>
                  )}
                </div>

                <p className="mt-1 text-[11px] text-muted-foreground">{item.description}</p>
              </Link>
            ))}
          </div>

          <div className="flex justify-end">
            <Link href="/tickets" className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline">
              {loading ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
              <span>{t.viewAll}</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
