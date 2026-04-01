'use client';

import { useEffect, useState } from 'react';
import { Users, Package, StickyNote, FileText, TrendingUp } from 'lucide-react';

import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';

interface DashboardStats {
  totalClients?: number;
  totalSuppliers?: number;
  notesThisWeek?: number;
  quotesThisMonth?: number;
  acceptedQuotesValue?: number;
}

function isAbortError(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'AbortError';
}

function toWholeNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
}

export default function StatCards() {
  const { locale } = useLocale();
  const t = {
    en: {
      loadError: 'Could not load stats.',
      totalClients: 'Total Clients',
      totalSuppliers: 'Total Suppliers',
      totalNotes: 'Total Notes',
      totalQuotes: 'Total Quotes',
      acceptedValue: 'Accepted Revenue',
      aria: 'Dashboard key metrics',
      subClients: 'Active client records',
      subSuppliers: 'Active supplier records',
      subNotes: 'All notes logged',
      subQuotes: 'All quotes created',
      subRevenue: 'Cumulative accepted value',
    },
    fr: {
      loadError: 'Impossible de charger les statistiques.',
      totalClients: 'Total Clients',
      totalSuppliers: 'Total Fournisseurs',
      totalNotes: 'Total Notes',
      totalQuotes: 'Total Devis',
      acceptedValue: 'Chiffre Accepté',
      aria: 'Indicateurs clés',
      subClients: 'Clients actifs',
      subSuppliers: 'Fournisseurs actifs',
      subNotes: 'Toutes les notes',
      subQuotes: 'Tous les devis créés',
      subRevenue: 'Valeur cumulée acceptée',
    },
  }[locale];

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadStats() {
      setLoading(true);
      try {
        setFetchError(null);
        const response = await fetch('/api/dashboard/stats', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Failed to load stats');
        const data = (await response.json()) as DashboardStats;
        setStats(data);
      } catch (caughtError) {
        if (isAbortError(caughtError) || controller.signal.aborted) return;
        setFetchError(t.loadError);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    loadStats();
    return () => controller.abort();
  }, [t.loadError]);

  const hasStats = stats !== null;
  const showError = Boolean(fetchError) && !hasStats;
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';

  const CARDS = [
    {
      label: t.totalClients,
      value: toWholeNumber(stats?.totalClients),
      type: 'count' as const,
      subLabel: t.subClients,
      Icon: Users,
      border: 'border-2 border-primary/40 dark:border-primary/50',
      iconBg: 'bg-primary/8 dark:bg-primary/15',
      iconColor: 'text-primary dark:text-primary/80',
      numColor: 'text-primary dark:text-primary/80',
    },
    {
      label: t.totalSuppliers,
      value: toWholeNumber(stats?.totalSuppliers),
      type: 'count' as const,
      subLabel: t.subSuppliers,
      Icon: Package,
      border: 'border-2 border-primary/40 dark:border-primary/50',
      iconBg: 'bg-primary/8 dark:bg-primary/15',
      iconColor: 'text-primary dark:text-primary/80',
      numColor: 'text-primary dark:text-primary/80',
    },
    {
      label: t.totalNotes,
      value: toWholeNumber(stats?.notesThisWeek),
      type: 'count' as const,
      subLabel: t.subNotes,
      Icon: StickyNote,
      border: 'border-2 border-primary/40 dark:border-primary/50',
      iconBg: 'bg-primary/8 dark:bg-primary/15',
      iconColor: 'text-primary dark:text-primary/80',
      numColor: 'text-primary dark:text-primary/80',
    },
    {
      label: t.totalQuotes,
      value: toWholeNumber(stats?.quotesThisMonth),
      type: 'count' as const,
      subLabel: t.subQuotes,
      Icon: FileText,
      border: 'border-2 border-primary/40 dark:border-primary/50',
      iconBg: 'bg-primary/8 dark:bg-primary/15',
      iconColor: 'text-primary dark:text-primary/80',
      numColor: 'text-primary dark:text-primary/80',
    },
    {
      label: t.acceptedValue,
      value: toWholeNumber(stats?.acceptedQuotesValue),
      type: 'currency' as const,
      subLabel: t.subRevenue,
      Icon: TrendingUp,
      border: 'border-2 border-primary/40 dark:border-primary/50',
      iconBg: 'bg-primary/8 dark:bg-primary/15',
      iconColor: 'text-primary dark:text-primary/80',
      numColor: 'text-primary dark:text-primary/80',
    },
  ] as const;

  return (
    <section className="mb-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label={t.aria}>
      {showError ? (
        <div className="sm:col-span-2 xl:col-span-5">
          <ErrorMessage message={fetchError ?? undefined} />
        </div>
      ) : null}

      {CARDS.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl bg-card px-5 py-4 shadow-sm ${card.border}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {card.label}
              </p>
              <div className="mt-2.5">
                {loading ? (
                  <Skeleton className="h-9 w-20" />
                ) : card.type === 'currency' ? (
                  <PriceDisplay
                    cents={card.value}
                    locale={priceLocale}
                    className={`text-3xl font-bold tabular-nums ${card.numColor}`}
                  />
                ) : (
                  <p className={`text-3xl font-bold tabular-nums ${card.numColor}`}>{card.value}</p>
                )}
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{card.subLabel}</p>
            </div>
            <div className={`shrink-0 rounded-lg p-2.5 ${card.iconBg}`}>
              <card.Icon className={`size-5 ${card.iconColor}`} strokeWidth={1.75} />
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}