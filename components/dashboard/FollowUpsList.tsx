'use client';

import Link from 'next/link';
import { useState } from 'react';

import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import type { FollowUpItem } from '@/hooks/useDashboard';

interface FollowUpsListProps {
  followUps?: FollowUpItem[];
  loading?: boolean;
  error?: string | null;
}

function getStartOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatFollowUpDate(dateStr?: string): string {
  if (!dateStr) {
    return '--';
  }

  const date = new Date(dateStr);
  const dateTime = date.getTime();

  if (!Number.isFinite(dateTime)) {
    return '--';
  }

  const today = new Date();
  const todayStart = getStartOfDay(today);
  const tomorrowStart = getStartOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  const targetStart = getStartOfDay(date);

  if (targetStart === todayStart) {
    return 'Today';
  }

  if (targetStart === tomorrowStart) {
    return 'Tomorrow';
  }

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

function buildLinkedPath(item: FollowUpItem): string {
  const linkedType = item.linkedType === 'client' ? 'clients' : 'suppliers';
  const linkedId = item.linkedId?._id;
  return linkedId ? `/${linkedType}/${linkedId}` : `/${linkedType}`;
}

export default function FollowUpsList({ followUps = [], loading = false, error = null }: FollowUpsListProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Upcoming follow-ups',
      empty: 'No upcoming follow-ups. Add a follow-up date to any note.',
    },
    fr: {
      title: 'Suivis a venir',
      empty: 'Aucun suivi a venir. Ajoutez une date de suivi a une note.',
    },
  }[locale];
  const [referenceNow] = useState<number>(() => Date.now());
  const items = (Array.isArray(followUps) ? followUps : [])
    .filter((item) => {
      const dateTime = item.followUpDate ? new Date(item.followUpDate).getTime() : Number.NaN;
      return Number.isFinite(dateTime) && dateTime >= referenceNow;
    })
    .sort((a, b) => new Date(a.followUpDate ?? 0).getTime() - new Date(b.followUpDate ?? 0).getTime());
  const showError = Boolean(error) && items.length === 0;

  return (
    <Card className="h-full gap-0">
      <CardHeader className="border-b">
        <CardTitle className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {t.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2 px-4 pt-4">
        {showError ? <ErrorMessage message={error ?? undefined} /> : null}

        {loading && !showError
          ? [1, 2, 3].map((index) => <Skeleton key={index} className="h-5 w-full" />)
          : null}

        {!loading && !showError
          ? items.map((item, index) => {
              const isLast = index === items.length - 1;

              return (
                <div
                  key={item._id ?? `${item.followUpDate ?? 'follow-up'}-${index}`}
                  className={`flex items-start gap-3 py-2 ${isLast ? '' : 'border-b border-border/70'}`}
                >
                  <span className="min-w-16 pt-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400">
                    {formatFollowUpDate(item.followUpDate)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{item.title ?? 'Untitled follow-up'}</p>
                    <Link
                      href={buildLinkedPath(item)}
                      className="mt-1 inline-flex max-w-full items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:hover:bg-sky-900/60"
                    >
                      <span className="truncate">
                        {item.linkedType === 'client' ? 'Client' : 'Supplier'} - {item.linkedId?.fullName ?? 'Unknown'}
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })
          : null}

        {!loading && !showError && items.length === 0 ? (
          <EmptyState message={t.empty} />
        ) : null}
      </CardContent>
    </Card>
  );
}