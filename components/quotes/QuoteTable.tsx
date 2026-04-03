'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CopyIcon, DownloadIcon, EllipsisVerticalIcon, EyeIcon, HistoryIcon, PencilIcon, SendIcon, Trash2Icon } from 'lucide-react';

import QuoteHistoryDialog from '@/components/quotes/QuoteHistoryDialog';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { StatusBadge, type QuoteStatus } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_ACCENT: Record<QuoteStatus, string> = {
  draft: 'var(--color-text-secondary)',
  sent: 'var(--color-text-info)',
  accepted: 'var(--color-text-success)',
  refused: 'var(--color-text-danger)',
  rejected: '#c2410c',
};

const STATUS_ROW_BG: Record<QuoteStatus, string> = {
  draft: 'rgba(100, 116, 139, 0.04)',
  sent: 'rgba(14, 165, 233, 0.04)',
  accepted: 'rgba(34, 197, 94, 0.045)',
  refused: 'rgba(239, 68, 68, 0.04)',
  rejected: 'rgba(239, 68, 68, 0.07)',
};

function isNewQuote(quote: QuoteListItem): boolean {
  if (quote.status !== 'accepted' && quote.status !== 'rejected') return false;
  if (!quote.statusChangedAt) return false;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(quote.statusChangedAt).getTime() < SEVEN_DAYS_MS;
}

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
  subject?: string | null;
}

interface QuoteTableProps {
  items: QuoteListItem[];
  loading: boolean;
  labels: {
    quoteNumber: string;
    client: string;
    subject: string;
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
    sendForSignature: string;
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
  const router = useRouter();
  const [historyTarget, setHistoryTarget] = useState<QuoteListItem | null>(null);
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  function renderPrimaryAction(quote: QuoteListItem, className?: string) {
    if (quote.status === 'draft') {
      return (
        <Button
          type="button"
          size="sm"
          className={className}
          onClick={(event) => {
            event.stopPropagation();
            onSend(quote);
          }}
        >
          <SendIcon className="size-3.5" />
          {labels.sendForSignature}
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
    const moreActionsLabel = locale === 'fr' ? 'Plus d\'actions' : 'More actions';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="outline" className="size-8 shrink-0" aria-label={`${moreActionsLabel} ${quote.quoteNumber}`}>
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          {quote.status === 'draft' ? (
            <DropdownMenuItem onSelect={() => onSend(quote)}>
              <SendIcon className="size-4" />
              {labels.sendForSignature}
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
    
      <div className="space-y-2 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, idx) => (
              <div key={`quote-mobile-skeleton-${idx}`} className="rounded-xl border border-border/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Skeleton className="h-6 w-28" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            ))
          : items.map((quote) => (
              <article
                key={quote._id}
                className="cursor-pointer rounded-xl border border-border/60 bg-card shadow-xs"
                style={{ borderLeftWidth: '3px', borderLeftColor: STATUS_ACCENT[quote.status], backgroundColor: STATUS_ROW_BG[quote.status] }}
                onClick={() => router.push(`/quotes/${quote._id}`)}
              >
           
                <div className="flex items-start justify-between gap-3 px-4 pt-4.5">
                  <div className="min-w-0">
                    <Link
                      href={`/clients/${quote.clientId}`}
                      className="block truncate text-sm font-semibold text-foreground hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {quote.clientSnapshot.fullName}
                    </Link>
                    {quote.subject ? (
                      <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{quote.subject}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(quote.date)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {isNewQuote(quote) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                        </span>
                        NEW
                      </span>
                    ) : null}
                    <StatusBadge status={quote.status} className="mt-0.5" />
                  </div>
                </div>

             
                <div className="flex items-center justify-between gap-3 px-4 pb-4.5 pt-3">
                  <PriceDisplay
                    cents={quote.totalIncludingTax}
                    locale={priceLocale}
                    className="text-base font-semibold tabular-nums text-foreground"
                  />
                  <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                    {renderPrimaryAction(quote, 'h-8 px-3 text-xs')}
                    {renderSecondaryActions(quote)}
                  </div>
                </div>
              </article>
            ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-white md:block dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 pl-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.client}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.subject}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.date}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.totalIncludingTax}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.status}</TableHead>
              <TableHead className="h-11 pr-4 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`quote-skeleton-${idx}`}>
                    <TableCell className="py-4 pl-5">
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="py-4 pr-4"><Skeleton className="ml-auto h-8 w-32" /></TableCell>
                  </TableRow>
                ))
              : items.map((quote) => (
                  <TableRow
                    key={quote._id}
                    className="group cursor-pointer border-b border-border/45 transition-colors last:border-0 hover:bg-muted/20"
                    style={{ backgroundColor: STATUS_ROW_BG[quote.status] }}
                    onClick={() => router.push(`/quotes/${quote._id}`)}
                  >
                    {/* Client */}
                    <TableCell
                      className="py-4 pl-5 align-middle"
                      style={{ borderLeft: `3px solid ${STATUS_ACCENT[quote.status]}` }}
                    >
                      <Link
                        href={`/clients/${quote.clientId}`}
                        className="block text-sm font-semibold text-foreground hover:text-(--color-text-info) hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {quote.clientSnapshot.fullName}
                      </Link>
                    </TableCell>

                    {/* Subject */}
                    <TableCell className="py-4 align-middle">
                      {quote.subject ? (
                        <span className="inline-block max-w-35 truncate rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground/80">
                          {quote.subject}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>

                    {/* Date */}
                    <TableCell className="py-4 align-middle text-sm text-muted-foreground">
                      {formatDate(quote.date)}
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="py-4 align-middle">
                      <PriceDisplay
                        cents={quote.totalIncludingTax}
                        locale={priceLocale}
                        className="text-[15px] font-semibold tabular-nums text-foreground"
                      />
                    </TableCell>

                    {/* Status badge + NEW indicator if client responded recently */}
                    <TableCell className="py-4 align-middle">
                      <div className="flex flex-col items-start gap-1">
                        {isNewQuote(quote) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                            <span className="relative flex size-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                              <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                            </span>
                            NEW
                          </span>
                        ) : null}
                        <StatusBadge status={quote.status} />
                      </div>
                    </TableCell>

                    {/* Actions: primary + dropdown */}
                    <TableCell className="py-4 pr-4 align-middle">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        {renderPrimaryAction(quote, 'h-8 px-3 text-xs')}
                        {renderSecondaryActions(quote, 'end')}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
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
            if (!next) setHistoryTarget(null);
          }}
        />
      ) : null}
    </>
  );
}
