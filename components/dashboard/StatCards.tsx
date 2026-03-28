'use client';

import { useEffect, useState } from 'react';

import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
}

export default function StatCards() {
  const { locale } = useLocale();
  const t = {
    en: {
      loadError: 'Could not load stats.',
      totalClients: 'Total clients',
      totalSuppliers: 'Total suppliers',
      notesWeek: 'Notes this week',
      quotesMonth: 'Quotes this month',
      acceptedValue: 'Accepted quotes value',
      aria: 'Dashboard stats',
    },
    fr: {
      loadError: 'Impossible de charger les statistiques.',
      totalClients: 'Total des clients',
      totalSuppliers: 'Total des fournisseurs',
      notesWeek: 'Notes cette semaine',
      quotesMonth: 'Devis ce mois-ci',
      acceptedValue: 'Valeur des devis acceptes',
      aria: 'Statistiques du tableau de bord',
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

        if (!response.ok) {
          throw new Error('Failed to load stats');
        }

        const data = (await response.json()) as DashboardStats;
        setStats(data);
      } catch (caughtError) {
        if (isAbortError(caughtError) || controller.signal.aborted) {
          return;
        }

        // Keep the last successful values visible if a transient request fails.
        setFetchError(t.loadError);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadStats();

    return () => controller.abort();
  }, [t.loadError]);

  const cards: Array<{ label: string; value: number; type: 'count' | 'currency' }> = [
    { label: t.totalClients, value: toWholeNumber(stats?.totalClients), type: 'count' },
    { label: t.totalSuppliers, value: toWholeNumber(stats?.totalSuppliers), type: 'count' },
    { label: t.notesWeek, value: toWholeNumber(stats?.notesThisWeek), type: 'count' },
    { label: t.quotesMonth, value: toWholeNumber(stats?.quotesThisMonth), type: 'count' },
    { label: t.acceptedValue, value: toWholeNumber(stats?.acceptedQuotesValue), type: 'currency' },
  ];
  const hasStats = stats !== null;
  const showError = Boolean(fetchError) && !hasStats;
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';

  return (
    <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5" aria-label={t.aria}>
      {showError ? (
        <div className="md:col-span-2 xl:col-span-5">
          <ErrorMessage message={fetchError ?? undefined} />
        </div>
      ) : null}

      {cards.map((card) => (
        <Card key={card.label} size="sm" className="gap-1 py-3">
          <CardHeader className="px-4 pb-0">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              card.type === 'currency' ? (
                <PriceDisplay
                  cents={card.value}
                  locale={priceLocale}
                  className="text-2xl font-semibold tabular-nums sm:text-3xl"
                />
              ) : (
                <p className="text-3xl font-semibold tabular-nums">{card.value}</p>
              )
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}