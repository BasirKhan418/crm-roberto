'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge, type QuoteStatus } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useLocale } from '@/components/providers/locale-provider';

interface RecentQuotesProps {
  refreshKey?: number;
}

interface RecentQuoteItem {
  _id: string;
  quoteNumber: string;
  date: string;
  totalIncludingTax: number;
  status: QuoteStatus;
  clientSnapshot: {
    fullName: string;
  };
}

interface QuoteListResponse {
  success?: boolean;
  message?: string;
  data?: RecentQuoteItem[];
}

function toLocalDate(value: string, locale: 'en' | 'fr'): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '--';
  }

  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function isAbortError(reason: unknown): boolean {
  return reason instanceof DOMException && reason.name === 'AbortError';
}

export default function RecentQuotes({ refreshKey = 0 }: RecentQuotesProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = {
    en: {
      title: 'Recent quotes',
      quoteNumber: 'Quote #',
      client: 'Client',
      date: 'Date',
      amount: 'Amount',
      status: 'Status',
      empty: 'No quotes yet. Create your first quote to see it here.',
      loadError: 'Could not load recent quotes.',
      openQuote: 'Open quote',
      viewAll: 'View all quotes',
    },
    fr: {
      title: 'Devis recents',
      quoteNumber: 'Devis #',
      client: 'Client',
      date: 'Date',
      amount: 'Montant',
      status: 'Statut',
      empty: 'Aucun devis pour le moment. Creez votre premier devis.',
      loadError: 'Impossible de charger les devis recents.',
      openQuote: 'Ouvrir le devis',
      viewAll: 'Voir tous les devis',
    },
  }[locale];

  const [items, setItems] = useState<RecentQuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRecentQuotes() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/quotes?page=1&limit=5&sort=date', {
          cache: 'no-store',
          signal: controller.signal,
        });

        const payload = (await response.json()) as QuoteListResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.message || t.loadError);
        }

        setItems(Array.isArray(payload.data) ? payload.data.slice(0, 5) : []);
      } catch (fetchError) {
        if (isAbortError(fetchError) || controller.signal.aborted) {
          return;
        }

        setItems([]);
        setError(fetchError instanceof Error ? fetchError.message : t.loadError);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadRecentQuotes();

    return () => controller.abort();
  }, [refreshKey, t.loadError]);

  const priceLocale = useMemo(() => (locale === 'fr' ? 'fr-FR' : 'en-IE'), [locale]);
  const showError = Boolean(error) && items.length === 0;

  return (
    <Card className="gap-0 overflow-hidden border-border/80">
      <CardHeader className="border-b bg-linear-to-r from-muted/40 to-background">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {t.title}
          </CardTitle>
          <Link href="/quotes" className="text-xs font-medium text-(--color-text-info) hover:underline">
            {t.viewAll}
          </Link>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {showError ? <ErrorMessage message={error ?? undefined} /> : null}

        <div className="space-y-2.5 md:hidden">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div key={`recent-quote-mobile-skeleton-${index}`} className="rounded-lg border border-border/70 p-3">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="mt-2 h-4 w-40" />
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              ))
            : items.map((quote) => (
                <button
                  key={quote._id}
                  type="button"
                  className="w-full rounded-xl border border-border/70 bg-background p-3 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
                  onClick={() => router.push(`/quotes/${quote._id}`)}
                  title={t.openQuote}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-(--color-text-info)">{quote.quoteNumber}</p>
                    <StatusBadge status={quote.status} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{quote.clientSnapshot.fullName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t.date}</p>
                      <p className="font-medium text-foreground">{toLocalDate(quote.date, locale)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t.amount}</p>
                      <PriceDisplay cents={quote.totalIncludingTax} locale={priceLocale} className="text-sm font-medium" />
                    </div>
                  </div>
                </button>
              ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.quoteNumber}</TableHead>
                <TableHead>{t.client}</TableHead>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.amount}</TableHead>
                <TableHead>{t.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`recent-quote-skeleton-${index}`}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    </TableRow>
                  ))
                : items.map((quote) => (
                    <TableRow
                      key={quote._id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => router.push(`/quotes/${quote._id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/quotes/${quote._id}`);
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`${t.openQuote} ${quote.quoteNumber}`}
                    >
                      <TableCell className="font-medium text-(--color-text-info)">
                        <Link href={`/quotes/${quote._id}`} className="hover:underline">
                          {quote.quoteNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{quote.clientSnapshot.fullName}</TableCell>
                      <TableCell>{toLocalDate(quote.date, locale)}</TableCell>
                      <TableCell>
                        <PriceDisplay cents={quote.totalIncludingTax} locale={priceLocale} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={quote.status} />
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>

        {!loading && !showError && items.length === 0 ? <EmptyState message={t.empty} /> : null}
      </CardContent>
    </Card>
  );
}
