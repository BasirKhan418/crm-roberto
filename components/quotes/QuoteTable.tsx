'use client';

import { useState } from 'react';
import Link from 'next/link';

import { CopyIcon, DownloadIcon, EllipsisVerticalIcon, EyeIcon, HistoryIcon, PencilIcon, SendIcon, Trash2Icon } from 'lucide-react';

import QuoteHistoryDialog from '@/components/quotes/QuoteHistoryDialog';
import QuoteStatusSummary from '@/components/quotes/QuoteStatusSummary';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { QuoteStatus } from '@/components/ui/StatusBadge';

export interface QuoteListItem {
  _id: string;
  quoteNumber: string;
  clientId: string;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
  date: string;
  totalIncludingTax: number;
  status: QuoteStatus;
  statusChangedAt?: string | null;
}

interface QuoteTableProps {
  items: QuoteListItem[];
  loading: boolean;
  labels: {
    quoteNumber: string;
    client: string;
    date: string;
    totalIncludingTax: string;
    status: string;
    actions: string;
    quickActions: string;
    view: string;
    edit: string;
    duplicate: string;
    delete: string;
    downloadPdf: string;
    lockEdit: string;
    send: string;
    history: string;
  };
  locale: 'en' | 'fr';
  formatDate: (value: string) => string;
  onDelete: (quote: QuoteListItem) => void;
  onDownload: (quote: QuoteListItem) => Promise<void>;
  onDuplicate: (quote: QuoteListItem) => Promise<void>;
  onSend: (quote: QuoteListItem) => void;
  duplicatingId?: string | null;
}

export default function QuoteTable({ items, loading, labels, locale, formatDate, onDelete, onDownload, onDuplicate, onSend, duplicatingId }: QuoteTableProps) {
  const [historyTarget, setHistoryTarget] = useState<QuoteListItem | null>(null);
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const uiText = locale === 'fr'
    ? {
        issuedOn: 'Cree le',
        amountLabel: 'Montant',
        moreActions: 'Plus d\'actions',
      }
    : {
        issuedOn: 'Issued on',
        amountLabel: 'Amount',
        moreActions: 'More actions',
      };

  function renderPrimaryAction(quote: QuoteListItem, className?: string) {
    if (quote.status === 'draft') {
      return (
        <Button type="button" size="sm" className={className} onClick={() => onSend(quote)}>
          <SendIcon className="size-3.5" />
          {labels.send}
        </Button>
      );
    }

    return (
      <Button type="button" size="sm" className={className} asChild>
        <Link href={`/quotes/${quote._id}`}>
          <EyeIcon className="size-3.5" />
          {labels.view}
        </Link>
      </Button>
    );
  }

  function renderSecondaryActions(quote: QuoteListItem, align: 'start' | 'end' = 'end') {
    const canEdit = quote.status === 'draft' || quote.status === 'sent' || quote.status === 'rejected';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="outline" className="size-9 shrink-0" aria-label={`${uiText.moreActions} ${quote.quoteNumber}`}>
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          {quote.status === 'draft' ? (
            <DropdownMenuItem asChild>
              <Link href={`/quotes/${quote._id}`}>
                <EyeIcon className="size-4" />
                {labels.view}
              </Link>
            </DropdownMenuItem>
          ) : null}

          {canEdit ? (
            <DropdownMenuItem asChild>
              <Link href={`/quotes/${quote._id}/edit`}>
                <PencilIcon className="size-4" />
                {labels.edit}
              </Link>
            </DropdownMenuItem>
          ) : null}

          {!canEdit ? (
            <DropdownMenuItem disabled={duplicatingId === quote._id} onSelect={() => void onDuplicate(quote)}>
              <CopyIcon className="size-4" />
              {labels.duplicate}
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuItem onSelect={() => void onDownload(quote)}>
            <DownloadIcon className="size-4" />
            {labels.downloadPdf}
          </DropdownMenuItem>

          <DropdownMenuItem onSelect={() => setHistoryTarget(quote)}>
            <HistoryIcon className="size-4" />
            {labels.history}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(quote)}>
            <Trash2Icon className="size-4" />
            {labels.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, idx) => (
              <div key={`quote-mobile-skeleton-${idx}`} className="space-y-3 rounded-xl border border-border/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="space-y-2 rounded-xl border border-border/60 px-3 py-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                </div>
                <Skeleton className="h-14 w-full rounded-xl" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 w-9" />
                </div>
              </div>
            ))
          : items.map((quote) => {
              const isAccepted = quote.status === 'accepted';

              return (
                <article key={quote._id} className={`space-y-3 rounded-xl border p-3.5 shadow-sm ${isAccepted ? 'border-(--color-text-success)/35 bg-(--color-background-success)/20' : 'border-border/70 bg-card/80'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/quotes/${quote._id}`} className="block text-base font-semibold text-(--color-text-info) hover:underline wrap-break-word">
                        {quote.quoteNumber}
                      </Link>
                      <Link href={`/clients/${quote.clientId}`} className="mt-1 block text-sm font-medium text-foreground hover:text-(--color-text-info) hover:underline wrap-break-word">
                        {quote.clientSnapshot.fullName}
                      </Link>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {uiText.issuedOn} {formatDate(quote.date)}
                      </p>
                    </div>
                    <div className="min-w-[7.5rem] rounded-xl border border-border/60 bg-background px-3 py-2 text-right">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{uiText.amountLabel}</p>
                      <PriceDisplay cents={quote.totalIncludingTax} locale={priceLocale} className="mt-1 text-base font-semibold text-foreground" />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-background/80 px-3 py-2.5">
                    <QuoteStatusSummary status={quote.status} statusChangedAt={quote.statusChangedAt} locale={locale} showActionRequired />
                  </div>

                  <div className="flex items-center gap-2">
                    {renderPrimaryAction(quote, 'h-9 flex-1')}
                    {renderSecondaryActions(quote)}
                  </div>
                </article>
              );
            })}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{labels.quoteNumber}</TableHead>
              <TableHead>{labels.status}</TableHead>
              <TableHead>{labels.totalIncludingTax}</TableHead>
              <TableHead>{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`quote-skeleton-${idx}`}>
                    <TableCell>
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-10 w-28 rounded-xl" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-9 w-40" /></TableCell>
                  </TableRow>
                ))
              : items.map((quote) => {
                  const isAccepted = quote.status === 'accepted';

                  return (
                    <TableRow key={quote._id} className={isAccepted ? 'bg-(--color-background-success)/40 hover:bg-(--color-background-success)/60' : ''}>
                      <TableCell className="py-4 align-top">
                        <div className="space-y-1">
                          <Link href={`/quotes/${quote._id}`} className="block font-semibold text-(--color-text-info) hover:underline">
                            {quote.quoteNumber}
                          </Link>
                          <Link href={`/clients/${quote.clientId}`} className="block text-sm text-foreground hover:text-(--color-text-info) hover:underline">
                            {quote.clientSnapshot.fullName}
                          </Link>
                          <p className="text-xs text-muted-foreground">
                            {uiText.issuedOn} {formatDate(quote.date)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <QuoteStatusSummary status={quote.status} statusChangedAt={quote.statusChangedAt} locale={locale} showActionRequired />
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <PriceDisplay cents={quote.totalIncludingTax} locale={priceLocale} className="text-sm font-semibold text-foreground" />
                      </TableCell>
                      <TableCell className="py-4 align-top">
                        <div className="flex items-center justify-end gap-2">
                          {renderPrimaryAction(quote, 'h-9 min-w-28')}
                          {renderSecondaryActions(quote, 'end')}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      {historyTarget ? (
        <QuoteHistoryDialog
          quoteId={historyTarget._id}
          quoteNumber={historyTarget.quoteNumber}
          currentStatus={historyTarget.status}
          locale={locale}
          label={labels.history}
          open={Boolean(historyTarget)}
          hideTrigger
          onOpenChange={(next) => {
            if (!next) {
              setHistoryTarget(null);
            }
          }}
        />
      ) : null}
    </>
  );
}
