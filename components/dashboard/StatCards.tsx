'use client';

import { useEffect, useState } from 'react';

import ErrorMessage from '@/components/ui/ErrorMessage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  totalClients?: number;
  totalSuppliers?: number;
  notesThisWeek?: number;
}

function toWholeNumber(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.trunc(parsed);
}

export default function StatCards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
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
      } catch {
        setStats(null);
        setFetchError('Could not load stats.');
      } finally {
        setLoading(false);
      }
    }

    loadStats();

    return () => controller.abort();
  }, []);

  const cards = [
    { label: 'Total clients', value: toWholeNumber(stats?.totalClients) },
    { label: 'Total suppliers', value: toWholeNumber(stats?.totalSuppliers) },
    { label: 'Notes this week', value: toWholeNumber(stats?.notesThisWeek) },
  ];

  return (
    <section className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Dashboard stats">
      {fetchError ? (
        <div className="md:col-span-3">
          <ErrorMessage message={fetchError} />
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
              <p className="text-3xl font-semibold tabular-nums">{card.value}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}