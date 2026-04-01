'use client';

import Link from 'next/link';

import { BellRingIcon, CopyIcon, DownloadIcon, EyeIcon, PencilIcon, SendIcon, Trash2Icon } from 'lucide-react';

import QuoteHistoryDialog from '@/components/quotes/QuoteHistoryDialog';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { StatusBadge, type QuoteStatus } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  return (
    <>
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, idx) => (
              <div key={`quote-mobile-skeleton-${idx}`} className="space-y-3 rounded-xl border border-border/70 p-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 flex-1" />
                  <Skeleton className="h-8 flex-1" />
                </div>
              </div>
            ))
          : items.map((quote) => {
              const canEdit = quote.status === 'draft' || quote.status === 'sent';
              const isAccepted = quote.status === 'accepted';

              return (
                <article key={quote._id} className={`space-y-3 rounded-xl border p-3.5 shadow-sm ${isAccepted ? 'border-(--color-text-success)/40 bg-(--color-background-success)/30' : 'border-border/70 bg-card/80'}`}>
                  {isAccepted ? (
                    <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold" style={{ backgroundColor: 'var(--color-background-success)', color: 'var(--color-text-success)' }}>
                      <BellRingIcon className="size-3.5 shrink-0" />
                      Action required — Quote signed by client
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/quotes/${quote._id}`} className="block text-sm font-semibold text-(--color-text-info) hover:underline wrap-break-word">
                        {quote.quoteNumber}
                      </Link>
                      <Link href={`/clients/${quote.clientId}`} className="mt-0.5 block text-sm text-(--color-text-info) hover:underline wrap-break-word">
                        {quote.clientSnapshot.fullName}
                      </Link>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{labels.date}</p>
                      <p className="font-medium">{formatDate(quote.date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{labels.totalIncludingTax}</p>
                      <p className="font-medium">
                        <PriceDisplay cents={quote.totalIncludingTax} />
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{labels.quickActions}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button type="button" size="sm" variant="outline" className="h-9" asChild>
                        <Link href={`/quotes/${quote._id}`}>
                          <EyeIcon className="size-3.5" />
                          {labels.view}
                        </Link>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        asChild={canEdit}
                        disabled={!canEdit}
                        title={!canEdit ? labels.lockEdit : labels.edit}
                        className={`h-9 ${!canEdit ? 'opacity-40' : ''}`}
                      >
                        {canEdit ? (
                          <Link href={`/quotes/${quote._id}/edit`}>
                            <PencilIcon className="size-3.5" />
                            {labels.edit}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <PencilIcon className="size-3.5" />
                            {labels.edit}
                          </span>
                        )}
                      </Button>

                      <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => onDownload(quote)}>
                        <DownloadIcon className="size-3.5" />
                        {labels.downloadPdf}
                      </Button>

                      <Button type="button" size="sm" variant="destructive" className="h-9" onClick={() => onDelete(quote)}>
                        <Trash2Icon className="size-3.5" />
                        {labels.delete}
                      </Button>

                      {quote.status === 'draft' ? (
                        <Button type="button" size="sm" variant="default" className="col-span-2 h-9" onClick={() => onSend(quote)}>
                          <SendIcon className="size-3.5" />
                          {labels.send}
                        </Button>
                      ) : null}

                      {!canEdit ? (
                        <Button type="button" size="sm" variant="outline" className="col-span-2 h-9" disabled={duplicatingId === quote._id} onClick={() => onDuplicate(quote)}>
                          <CopyIcon className="size-3.5" />
                          {labels.duplicate}
                        </Button>
                      ) : null}

                      <div className="col-span-2">
                        <QuoteHistoryDialog
                          quoteId={quote._id}
                          quoteNumber={quote.quoteNumber}
                          currentStatus={quote.status}
                          locale={locale}
                          label={labels.history}
                        />
                      </div>
                    </div>
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
              <TableHead>{labels.client}</TableHead>
              <TableHead>{labels.date}</TableHead>
              <TableHead>{labels.totalIncludingTax}</TableHead>
              <TableHead>{labels.status}</TableHead>
              <TableHead>{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`quote-skeleton-${idx}`}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-36" /></TableCell>
                  </TableRow>
                ))
              : items.map((quote) => {
                  const canEdit = quote.status === 'draft' || quote.status === 'sent';
                  const isAccepted = quote.status === 'accepted';

                  return (
                    <TableRow key={quote._id} className={isAccepted ? 'bg-(--color-background-success)/40 hover:bg-(--color-background-success)/60' : ''}>
                      <TableCell className="font-medium">
                        <Link href={`/quotes/${quote._id}`} className="text-(--color-text-info) hover:underline">
                          {quote.quoteNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link href={`/clients/${quote.clientId}`} className="text-(--color-text-info) hover:underline">
                          {quote.clientSnapshot.fullName}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(quote.date)}</TableCell>
                      <TableCell>
                        <PriceDisplay cents={quote.totalIncludingTax} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <StatusBadge status={quote.status} />
                          {isAccepted ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--color-text-success)' }}>
                              <BellRingIcon className="size-3" />
                              Action required
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`/quotes/${quote._id}`}>
                              <EyeIcon className="size-3.5" />
                              {labels.view}
                            </Link>
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            asChild={canEdit}
                            disabled={!canEdit}
                            title={!canEdit ? labels.lockEdit : labels.edit}
                            className={!canEdit ? 'opacity-40' : ''}
                          >
                            {canEdit ? (
                              <Link href={`/quotes/${quote._id}/edit`}>
                                <PencilIcon className="size-3.5" />
                                {labels.edit}
                              </Link>
                            ) : (
                              <span className="inline-flex items-center gap-1.5">
                                <PencilIcon className="size-3.5" />
                                {labels.edit}
                              </span>
                            )}
                          </Button>

                          <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(quote)}>
                            <Trash2Icon className="size-3.5" />
                            {labels.delete}
                          </Button>

                          {!canEdit ? (
                            <Button type="button" size="sm" variant="outline" disabled={duplicatingId === quote._id} onClick={() => onDuplicate(quote)}>
                              <CopyIcon className="size-3.5" />
                              {labels.duplicate}
                            </Button>
                          ) : null}

                          <Button type="button" size="sm" variant="outline" onClick={() => onDownload(quote)}>
                            <DownloadIcon className="size-3.5" />
                            {labels.downloadPdf}
                          </Button>

                          {quote.status === 'draft' ? (
                            <Button type="button" size="sm" variant="default" onClick={() => onSend(quote)}>
                              <SendIcon className="size-3.5" />
                              {labels.send}
                            </Button>
                          ) : null}

                          <QuoteHistoryDialog
                            quoteId={quote._id}
                            quoteNumber={quote.quoteNumber}
                            currentStatus={quote.status}
                            locale={locale}
                            label={labels.history}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
