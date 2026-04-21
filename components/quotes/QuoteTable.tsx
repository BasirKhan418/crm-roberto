'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { CopyIcon, CheckCircle2Icon, DownloadIcon, EllipsisVerticalIcon, EyeIcon, FileTextIcon, HistoryIcon, PencilIcon, SendIcon, Trash2Icon } from 'lucide-react';

import QuoteHistoryDialog from '@/components/quotes/QuoteHistoryDialog';
import QuoteStatusSummary from '@/components/quotes/QuoteStatusSummary';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import type { QuoteStatus } from '@/components/ui/StatusBadge';
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


export interface QuoteListItem {
  _id: string;
  quoteNumber: string;
  clientId: string;
  clientSnapshot: {
    fullName: string;
    email?: string | null;
  };
  date: string;
  totalExcludingTax?: number;
  totalVat?: number;
  totalIncludingTax: number;
  status: QuoteStatus;
  signedStatus?: 'not_signed' | 'signed';
  convertedToInvoice?: boolean;
  invoiceId?: string | null;
  rejectionAcknowledgedAt?: string | Date | null;
  statusChangedAt?: string | null;
  subject?: string | null;
}

interface QuoteTableProps {
  items: QuoteListItem[];
  loading: boolean;
  visibleColumns?: Partial<Record<QuoteTableColumnKey, boolean>>;
  labels: {
    quoteNumber: string;
    client: string;
    subject: string;
    date: string;
    totalIncludingTax: string;
    status: string;
    invoiceLink: string;
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
    convertToInvoice: string;
    invoiced: string;
    markReviewed: string;
    markReviewing: string;
  };
  locale: 'en' | 'fr';
  formatDate: (value: string) => string;
  onDelete: (quote: QuoteListItem) => void;
  onDownload: (quote: QuoteListItem) => Promise<void>;
  onDuplicate: (quote: QuoteListItem) => Promise<void>;
  onSend: (quote: QuoteListItem) => void;
  onConvert: (quote: QuoteListItem) => void;
  onAcknowledge: (quote: QuoteListItem) => Promise<void>;
  duplicatingId?: string | null;
  acknowledgingId?: string | null;
}

export type QuoteTableColumnKey = 'quoteNumber' | 'client' | 'subject' | 'date' | 'totalIncludingTax' | 'status' | 'invoiceLink';

export default function QuoteTable({ items, loading, visibleColumns, labels, locale, formatDate, onDelete, onDownload, onDuplicate, onSend, onConvert, onAcknowledge, duplicatingId, acknowledgingId }: QuoteTableProps) {
  const router = useRouter();
  const [historyTarget, setHistoryTarget] = useState<QuoteListItem | null>(null);
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const isVisible = (column: QuoteTableColumnKey) => visibleColumns?.[column] !== false;

  async function markSidebarItemAsRead(entityType: 'quote' | 'invoice', id: string) {
    window.dispatchEvent(new CustomEvent('sidebar-badges:mark-read', { detail: { entityType, id } }));

    try {
      await fetch('/api/sidebar/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, id }),
        keepalive: true,
      });
    } catch {
      // Navigation should still work even if the sidebar sync fails.
    }

    window.dispatchEvent(new Event('sidebar-badges:refresh'));
  }

  async function openQuote(quote: QuoteListItem) {
    await markSidebarItemAsRead('quote', quote._id);
    router.push(`/quotes/${quote._id}`);
  }

  async function openInvoice(invoiceId: string) {
    await markSidebarItemAsRead('invoice', invoiceId);
    router.push(`/invoices/${invoiceId}`);
  }

  function isNeedsReview(quote: QuoteListItem): boolean {
    return quote.status === 'rejected' && !quote.rejectionAcknowledgedAt;
  }

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
        <Link
          href={`/quotes/${quote._id}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openQuote(quote);
          }}
        >
          <EyeIcon className="size-3.5" />
          {labels.view}
        </Link>
      </Button>
    );
  }

  function renderSecondaryActions(quote: QuoteListItem, align: 'start' | 'end' = 'end', tourTarget: 'mobile' | 'table' = 'table') {
    const canEdit = quote.status === 'draft' || quote.status === 'sent' || quote.status === 'rejected';
    const canConvert =
      quote.status === 'accepted' &&
      quote.signedStatus === 'signed' &&
      !quote.convertedToInvoice &&
      !quote.invoiceId;
    const moreActionsLabel = locale === 'fr' ? 'Plus d\'actions' : 'More actions';

    const isInvoiced = Boolean(quote.convertedToInvoice && quote.invoiceId);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 shrink-0"
            data-tour-quote-actions={tourTarget}
            aria-label={`${moreActionsLabel} ${quote.quoteNumber}`}
          >
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

          {canConvert ? (
            <DropdownMenuItem onSelect={() => onConvert(quote)}>
              <FileTextIcon className="size-4" />
              {labels.convertToInvoice}
            </DropdownMenuItem>
          ) : null}

          {isInvoiced && quote.invoiceId ? (
            <DropdownMenuItem asChild>
              <Link
                href={`/invoices/${quote.invoiceId}`}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void openInvoice(quote.invoiceId!);
                }}
              >
                <FileTextIcon className="size-4" />
                {labels.invoiced}
              </Link>
            </DropdownMenuItem>
          ) : null}

          {isNeedsReview(quote) ? (
            <DropdownMenuItem
              disabled={acknowledgingId === quote._id}
              onSelect={() => void onAcknowledge(quote)}
              className="text-orange-700 focus:bg-orange-50 focus:text-orange-700 dark:text-orange-400 dark:focus:bg-orange-950/40"
            >
              <CheckCircle2Icon className="size-4" />
              {acknowledgingId === quote._id ? labels.markReviewing : labels.markReviewed}
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
          : items.map((quote) => {
              const isInvoiced = Boolean(quote.convertedToInvoice && quote.invoiceId);
              return (
              <article
                key={quote._id}
                className="cursor-pointer rounded-xl border border-border/60 bg-card shadow-xs"
                style={{
                  borderLeftWidth: '3px',
                  borderLeftColor: STATUS_ACCENT[quote.status],
                  backgroundColor: isInvoiced ? 'rgba(16, 185, 129, 0.08)' : STATUS_ROW_BG[quote.status],
                }}
                onClick={() => {
                  void openQuote(quote);
                }}
              >
           
                <div className="flex items-start justify-between gap-3 px-4 pt-4.5">
                  <div className="min-w-0">
                    {isVisible('client') ? (
                      <Link
                        href={`/clients/${quote.clientId}`}
                        className="block truncate text-sm font-semibold text-foreground hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {quote.clientSnapshot.fullName}
                      </Link>
                    ) : null}
                    {isVisible('quoteNumber') ? <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{quote.quoteNumber}</p> : null}
                    {isVisible('subject') && quote.subject ? (
                      <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{quote.subject}</p>
                    ) : null}
                    {isVisible('date') ? <p className="mt-1 text-[11px] text-muted-foreground">{formatDate(quote.date)}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {isVisible('invoiceLink') && isInvoiced ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-emerald-700">
                        <FileTextIcon className="size-3" />
                        {labels.invoiced}
                      </span>
                    ) : null}
                    {isVisible('status') && isNeedsReview(quote) ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                        <span className="relative flex size-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                          <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                        </span>
                        {locale === 'fr' ? 'REVU ?' : 'REVIEW'}
                      </span>
                    ) : null}
                    {isVisible('status') ? <QuoteStatusSummary status={quote.status} statusChangedAt={quote.statusChangedAt} locale={locale} className="items-end" /> : null}
                  </div>
                </div>

             
                <div className="flex items-center justify-between gap-3 px-4 pb-4.5 pt-3">
                  {isVisible('totalIncludingTax') ? (
                    <PriceDisplay
                      cents={quote.totalIncludingTax}
                      locale={priceLocale}
                      className="text-base font-semibold tabular-nums text-foreground"
                    />
                  ) : <span className="text-sm text-muted-foreground">{quote.quoteNumber}</span>}
                  <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                    {isVisible('invoiceLink') && isInvoiced && quote.invoiceId ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link
                          href={`/invoices/${quote.invoiceId}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void openInvoice(quote.invoiceId!);
                          }}
                        >
                          {labels.invoiced}
                        </Link>
                      </Button>
                    ) : null}
                    {renderPrimaryAction(quote, 'h-8 px-3 text-xs')}
                    {renderSecondaryActions(quote, 'end', 'mobile')}
                  </div>
                </div>
              </article>
            );
            })}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-white md:block dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {isVisible('client') ? <TableHead className="h-11 pl-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.client}</TableHead> : null}
              {isVisible('quoteNumber') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.quoteNumber}</TableHead> : null}
              {isVisible('subject') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.subject}</TableHead> : null}
              {isVisible('date') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.date}</TableHead> : null}
              {isVisible('totalIncludingTax') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.totalIncludingTax}</TableHead> : null}
              {isVisible('status') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.status}</TableHead> : null}
              {isVisible('invoiceLink') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.invoiceLink}</TableHead> : null}
              <TableHead className="h-11 pr-4 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`quote-skeleton-${idx}`}>
                    {isVisible('client') ? (
                      <TableCell className="py-4 pl-5">
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </TableCell>
                    ) : null}
                    {isVisible('quoteNumber') ? <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-full" /></TableCell> : null}
                    {isVisible('subject') ? <TableCell className="py-4"><Skeleton className="h-5 w-20 rounded-full" /></TableCell> : null}
                    {isVisible('date') ? <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell> : null}
                    {isVisible('totalIncludingTax') ? <TableCell className="py-4"><Skeleton className="h-5 w-24" /></TableCell> : null}
                    {isVisible('status') ? <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-full" /></TableCell> : null}
                    {isVisible('invoiceLink') ? <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-full" /></TableCell> : null}
                    <TableCell className="py-4 pr-4"><Skeleton className="ml-auto h-8 w-32" /></TableCell>
                  </TableRow>
                ))
              : items.map((quote) => {
                  const isInvoiced = Boolean(quote.convertedToInvoice && quote.invoiceId);
                  return (
                  <TableRow
                    key={quote._id}
                    className="group cursor-pointer border-b border-border/45 transition-colors last:border-0 hover:bg-muted/20"
                    style={{ backgroundColor: isInvoiced ? 'rgba(16, 185, 129, 0.06)' : STATUS_ROW_BG[quote.status] }}
                    onClick={() => {
                      void openQuote(quote);
                    }}
                  >
                    {/* Client */}
                    {isVisible('client') ? (
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
                    ) : null}

                    {isVisible('quoteNumber') ? (
                      <TableCell className="py-4 align-middle text-sm font-medium text-foreground">{quote.quoteNumber}</TableCell>
                    ) : null}

                    {/* Subject */}
                    {isVisible('subject') ? (
                    <TableCell className="py-4 align-middle">
                      {quote.subject ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-block max-w-35 truncate rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground/80">
                            {quote.subject}
                          </span>
                          {isInvoiced ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-emerald-700">
                              <FileTextIcon className="size-3" />
                              {labels.invoiced}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-muted-foreground/40">—</span>
                          {isInvoiced ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold leading-none text-emerald-700">
                              <FileTextIcon className="size-3" />
                              {labels.invoiced}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    ) : null}

                    {/* Date */}
                    {isVisible('date') ? (
                      <TableCell className="py-4 align-middle text-sm text-muted-foreground">
                        {formatDate(quote.date)}
                      </TableCell>
                    ) : null}

                    {/* Amount */}
                    {isVisible('totalIncludingTax') ? (
                      <TableCell className="py-4 align-middle">
                        <PriceDisplay
                          cents={quote.totalIncludingTax}
                          locale={priceLocale}
                          className="text-[15px] font-semibold tabular-nums text-foreground"
                        />
                      </TableCell>
                    ) : null}

                    {/* Status badge + REVIEW indicator for unacknowledged rejections */}
                    {isVisible('status') ? (
                    <TableCell className="py-4 align-middle">
                      <div className="flex flex-col items-start gap-1">
                        {isNeedsReview(quote) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold leading-none text-white">
                            <span className="relative flex size-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                              <span className="relative inline-flex size-1.5 rounded-full bg-white" />
                            </span>
                            {locale === 'fr' ? 'REVU ?' : 'REVIEW'}
                          </span>
                        ) : null}
                        <QuoteStatusSummary status={quote.status} statusChangedAt={quote.statusChangedAt} locale={locale} />
                      </div>
                    </TableCell>
                    ) : null}

                    {isVisible('invoiceLink') ? (
                      <TableCell className="py-4 align-middle text-sm">
                        {isInvoiced && quote.invoiceId ? (
                          <Button type="button" variant="outline" size="sm" asChild>
                            <Link
                              href={`/invoices/${quote.invoiceId}`}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void openInvoice(quote.invoiceId!);
                              }}
                            >
                              {labels.invoiced}
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    ) : null}

                    {/* Actions: primary + dropdown */}
                    <TableCell className="py-4 pr-4 align-middle">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        {renderPrimaryAction(quote, 'h-8 px-3 text-xs')}
                        {renderSecondaryActions(quote, 'end', 'table')}
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
            if (!next) setHistoryTarget(null);
          }}
        />
      ) : null}
    </>
  );
}
