'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ArrowDownIcon, ArrowUpIcon, BellIcon, DownloadIcon, EllipsisVerticalIcon, EyeIcon, PencilIcon, PlusIcon, SendIcon, Trash2Icon } from 'lucide-react';

import type { InvoiceListItem } from '@/hooks/useInvoices';
import { InvoiceStatusBadge } from '@/components/ui/InvoiceStatusBadge';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const STATUS_ACCENT: Record<InvoiceListItem['status'], string> = {
  unpaid: 'var(--color-text-secondary)',
  partial_paid: 'var(--color-text-warning)',
  paid: 'var(--color-text-success)',
  overdue: 'var(--color-text-danger)',
};

const STATUS_ROW_BG: Record<InvoiceListItem['status'], string> = {
  unpaid: 'rgba(100, 116, 139, 0.04)',
  partial_paid: 'rgba(245, 158, 11, 0.08)',
  paid: 'rgba(34, 197, 94, 0.05)',
  overdue: 'rgba(239, 68, 68, 0.08)',
};

function getDueDateStyle(dueDate: string | null | undefined, status: string) {
  if (!dueDate || status === 'paid') return { color: 'var(--color-text-secondary)' };
  const daysUntilDue = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  if (daysUntilDue < 0) return { color: 'var(--color-text-danger)', fontWeight: 500 };
  if (daysUntilDue <= 3) return { color: 'var(--color-text-warning)', fontWeight: 500 };
  return { color: 'var(--color-text-secondary)' };
}

function ReminderStateBadge({
  invoice,
  locale,
  compact,
}: {
  invoice: InvoiceListItem;
  locale: 'en' | 'fr';
  compact?: boolean;
}) {
  const level = Math.max(0, Math.min(4, Math.round(Number(invoice.reminderState?.level ?? 0))));
  if (level <= 0 || invoice.status === 'paid') {
    return null;
  }

  const lastSentAt = invoice.reminderState?.lastSentAt ?? null;
  const isPaused = invoice.reminderState?.isPaused === true;

  const dateLabel = lastSentAt
    ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        day: '2-digit',
        month: '2-digit',
      }).format(new Date(lastSentAt))
    : null;

  let label: string;
  if (isPaused) {
    label = locale === 'fr' ? `Relances en pause · niveau ${level}` : `Reminders paused · level ${level}`;
  } else if (level === 4) {
    label = locale === 'fr'
      ? (dateLabel ? `Mise en demeure envoyée · ${dateLabel}` : 'Mise en demeure envoyée')
      : dateLabel
        ? `Formal notice sent · ${dateLabel}`
        : 'Formal notice sent';
  } else {
    const levelTxt = locale === 'fr' ? `Rappel ${level} envoyé` : `Reminder ${level} sent`;
    label = dateLabel ? `${levelTxt} · ${dateLabel}` : levelTxt;
  }

  const tone = isPaused
    ? 'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300'
    : level === 4
      ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300'
      : level === 3
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300'
        : level === 2
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
          : 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300';

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold shadow-xs ring-1 ring-inset ring-current/10 whitespace-nowrap ${tone} ${compact ? 'text-[11px]' : 'text-xs'}`}
      title={label}
    >
      <BellIcon className={compact ? 'size-3.5' : 'size-4'} />
      {label}
    </span>
  );
}

function getReminderActionLabel(invoice: InvoiceListItem, locale: 'en' | 'fr'): string {
  const level = Math.max(0, Math.min(4, Math.round(Number(invoice.reminderState?.level ?? 0))));
  const hasReminderBeenSent = level > 0 || Boolean(invoice.reminderState?.lastSentAt);
  const formalNoticeAlreadySent =
    level >= 4 && Boolean(invoice.reminderState?.formalNoticeSentAt ?? invoice.reminderState?.lastSentAt);

  if (formalNoticeAlreadySent) {
    return locale === 'fr' ? 'Renvoyer (exceptionnel)' : 'Resend (exceptional)';
  }

  if (!hasReminderBeenSent) {
    return locale === 'fr' ? 'Envoyer rappel' : 'Send reminder';
  }

  return locale === 'fr' ? 'Envoyer rappel à nouveau' : 'Send reminder again';
}

interface InvoiceTableProps {
  items: InvoiceListItem[];
  loading: boolean;
  visibleColumns?: Partial<Record<InvoiceTableColumnKey, boolean>>;
  labels: {
    invoiceNumber: string;
    client: string;
    date: string;
    dueDate: string;
    totalIncludingTax: string;
    amountPaid: string;
    remainingAmount: string;
    paymentProgress: string;
    depositAmount: string;
    depositPaymentDate: string;
    status: string;
    actions: string;
    quickActions: string;
    view: string;
    edit: string;
    send: string;
    sendInvoice: string;
    sendReminder: string;
    recordPayment?: string;
    downloadPdf: string;
    delete: string;
  };
  locale: 'en' | 'fr';
  formatDate: (value: string | null | undefined) => string;
  onDelete: (invoice: InvoiceListItem) => void;
  onDownload: (invoice: InvoiceListItem) => Promise<void>;
  onSend: (invoice: InvoiceListItem) => void;
  onSendReminder?: (invoice: InvoiceListItem) => void;
  onRecordPayment?: (invoice: InvoiceListItem) => void;
  numberSortOrder?: 'asc' | 'desc';
  onToggleNumberSort?: () => void;
  selectedInvoiceIds?: string[];
  onToggleInvoiceSelection?: (invoiceId: string, checked: boolean) => void;
  onToggleSelectAllVisible?: (checked: boolean) => void;
  canManageActions?: boolean;
}

export type InvoiceTableColumnKey =
  | 'invoiceNumber'
  | 'client'
  | 'date'
  | 'dueDate'
  | 'totalIncludingTax'
  | 'amountPaid'
  | 'remainingAmount'
  | 'paymentProgress'
  | 'depositAmount'
  | 'depositPaymentDate'
  | 'status';

export default function InvoiceTable({
  items,
  loading,
  visibleColumns,
  labels,
  locale,
  formatDate,
  onDelete,
  onDownload,
  onSend,
  onSendReminder,
  onRecordPayment,
  numberSortOrder = 'desc',
  onToggleNumberSort,
  selectedInvoiceIds = [],
  onToggleInvoiceSelection,
  onToggleSelectAllVisible,
  canManageActions = true,
}: InvoiceTableProps) {
  const router = useRouter();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  async function markInvoiceAsRead(invoice: InvoiceListItem) {
    window.dispatchEvent(new CustomEvent('sidebar-badges:mark-read', { detail: { entityType: 'invoice', id: invoice._id } }));

    try {
      await fetch('/api/sidebar/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: 'invoice', id: invoice._id }),
        keepalive: true,
      });
    } catch {
      // Navigation should still work even if the sidebar sync fails.
    }

    window.dispatchEvent(new Event('sidebar-badges:refresh'));
  }

  async function openInvoice(invoice: InvoiceListItem) {
    await markInvoiceAsRead(invoice);
    router.push(`/invoices/${invoice._id}`);
  }

  function hasDeposit(invoice: InvoiceListItem) {
    return typeof invoice.depositAmount === 'number' && invoice.depositAmount > 0;
  }

  function getAmountPaid(invoice: InvoiceListItem) {
    return Math.max(0, Math.round(invoice.amountPaid ?? 0));
  }

  function getRemainingAmount(invoice: InvoiceListItem) {
    const total = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
    const fallback = Math.max(0, total - getAmountPaid(invoice));
    return Math.max(0, Math.round(invoice.remainingAmount ?? fallback));
  }

  function getPaymentProgressPercent(invoice: InvoiceListItem) {
    const total = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
    const fallback = total > 0 ? Math.min(100, Math.round((getAmountPaid(invoice) / total) * 100)) : 0;
    return Math.min(100, Math.max(0, Math.round(invoice.paymentProgressPercent ?? fallback)));
  }

  const showDepositColumns = items.some((invoice) => hasDeposit(invoice) || Boolean(invoice.depositPaidAt));
  const isVisible = (column: InvoiceTableColumnKey) => visibleColumns?.[column] !== false;
  const selectionEnabled = canManageActions && typeof onToggleInvoiceSelection === 'function';
  const selectedIdsSet = new Set(selectedInvoiceIds);
  const allVisibleSelected = items.length > 0 && items.every((invoice) => selectedIdsSet.has(invoice._id));

  function renderPrimaryAction(invoice: InvoiceListItem, className?: string) {
    if (!canManageActions) {
      return (
        <Button type="button" size="sm" className={`h-8 px-3 text-xs ${className ?? ''}`} asChild>
          <Link
            href={`/invoices/${invoice._id}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void openInvoice(invoice);
            }}
          >
            <EyeIcon className="size-3.5" />
            {labels.view}
          </Link>
        </Button>
      );
    }

    // unpaid → send invoice
    if (invoice.status === 'unpaid') {
      return (
        <Button
          type="button"
          size="sm"
          className={`h-8 px-3 text-xs ${className ?? ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onSend(invoice);
          }}
        >
          <SendIcon className="size-3.5" />
          {labels.sendInvoice}
        </Button>
      );
    }

    // overdue or partial_paid → send reminder (Relancer)
    if ((invoice.status === 'overdue' || invoice.status === 'partial_paid') && onSendReminder) {
      const reminderActionLabel = getReminderActionLabel(invoice, locale);

      return (
        <Button
          type="button"
          size="sm"
          className={`h-8 px-3 text-xs ${className ?? ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onSendReminder(invoice);
          }}
        >
          <BellIcon className="size-3.5" />
          {reminderActionLabel}
        </Button>
      );
    }

    // all other statuses → view
    return (
      <Button type="button" size="sm" className={`h-8 px-3 text-xs ${className ?? ''}`} asChild>
        <Link
          href={`/invoices/${invoice._id}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void openInvoice(invoice);
          }}
        >
          <EyeIcon className="size-3.5" />
          {labels.view}
        </Link>
      </Button>
    );
  }

  function renderSecondaryActions(invoice: InvoiceListItem, align: 'start' | 'end' = 'end') {
    const moreActionsLabel = locale === 'fr' ? "Plus d'actions" : 'More actions';
    const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoice.invoiceNumber);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="outline" className="size-8 shrink-0" aria-label={`${moreActionsLabel} ${displayInvoiceNumber}`}>
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          <DropdownMenuItem asChild>
            <Link
              href={`/invoices/${invoice._id}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void openInvoice(invoice);
              }}
            >
              <EyeIcon className="size-4" />
              {labels.view}
            </Link>
          </DropdownMenuItem>
          {canManageActions && !invoice.quoteId && !invoice.sentAt ? (
            <DropdownMenuItem asChild>
              <Link href={`/invoices/${invoice._id}/edit`}>
                <PencilIcon className="size-4" />
                {labels.edit}
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canManageActions ? (
            <DropdownMenuItem onSelect={() => onSend(invoice)} disabled={invoice.status === 'paid'}>
              <SendIcon className="size-4" />
              {labels.sendInvoice}
            </DropdownMenuItem>
          ) : null}
          {canManageActions && onSendReminder && invoice.status !== 'paid' ? (
            <DropdownMenuItem onSelect={() => onSendReminder(invoice)}>
              <BellIcon className="size-4" />
              {getReminderActionLabel(invoice, locale)}
            </DropdownMenuItem>
          ) : null}
          {canManageActions && onRecordPayment && invoice.status !== 'paid' ? (
            <DropdownMenuItem onSelect={() => onRecordPayment(invoice)}>
              <PlusIcon className="size-4" />
              {labels.recordPayment ?? (locale === 'fr' ? 'Enregistrer un paiement' : 'Record payment')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => void onDownload(invoice)}>
            <DownloadIcon className="size-4" />
            {labels.downloadPdf}
          </DropdownMenuItem>
          {canManageActions ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(invoice)}>
                <Trash2Icon className="size-4" />
                {labels.delete}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <div className="space-y-2 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, idx) => (
              <div key={`invoice-mobile-skeleton-${idx}`} className="rounded-xl border border-border/70 p-4">
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
          : items.map((invoice) => {
              const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoice.invoiceNumber);
              const showDepositSummary =
                (hasDeposit(invoice) || Boolean(invoice.depositPaidAt)) &&
                (isVisible('depositAmount') || isVisible('depositPaymentDate'));
              const showPaymentSummary = isVisible('amountPaid') || isVisible('remainingAmount') || isVisible('paymentProgress');
              const amountPaid = getAmountPaid(invoice);
              const remainingAmount = getRemainingAmount(invoice);
              const paymentProgressPercent = getPaymentProgressPercent(invoice);

              return (
                <article
                  key={invoice._id}
                  className="cursor-pointer rounded-xl border border-border/60 bg-card shadow-xs"
                  style={{ borderLeftWidth: '3px', borderLeftColor: STATUS_ACCENT[invoice.status], backgroundColor: STATUS_ROW_BG[invoice.status] }}
                  onClick={() => {
                    void openInvoice(invoice);
                  }}
                >
                  <div className="flex items-start justify-between gap-3 px-4 pt-4.5">
                    {selectionEnabled ? (
                      <Checkbox
                        checked={selectedIdsSet.has(invoice._id)}
                        onCheckedChange={(checked) => onToggleInvoiceSelection?.(invoice._id, Boolean(checked))}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Select ${displayInvoiceNumber}`}
                      />
                    ) : null}
                    <div className="min-w-0">
                      {isVisible('client') ? (
                        <Link
                          href={`/clients/${invoice.clientId}`}
                          className="block truncate text-sm font-semibold text-foreground hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {invoice.clientSnapshot.fullName}
                        </Link>
                      ) : null}
                      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{displayInvoiceNumber}</p>
                      {isVisible('dueDate') ? (
                        <p className="mt-1 text-[11px]" style={getDueDateStyle(invoice.dueDate, invoice.status)}>
                          {labels.dueDate}: {formatDate(invoice.dueDate)}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {isVisible('status') ? <InvoiceStatusBadge status={invoice.status} locale={locale} className="mt-0.5" /> : null}
                      <ReminderStateBadge invoice={invoice} locale={locale} compact />
                      {invoice.status === 'partial_paid' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                          <span className="size-1.5 rounded-full bg-amber-500 animate-ping" />
                          {locale === 'fr' ? 'Partiel' : 'Partial'}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {showDepositSummary ? (
                    <div className="mx-4 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        {isVisible('depositAmount') ? (
                          <div className="min-w-0">
                            <p className="text-muted-foreground">{labels.depositAmount}</p>
                            {hasDeposit(invoice) ? (
                              <PriceDisplay cents={invoice.depositAmount ?? 0} locale={priceLocale} className="mt-1 block truncate text-sm font-semibold tabular-nums text-foreground" />
                            ) : (
                              <p className="mt-1 text-sm text-muted-foreground">—</p>
                            )}
                          </div>
                        ) : null}
                        {isVisible('depositPaymentDate') ? (
                          <div className="min-w-0">
                            <p className="text-muted-foreground">{labels.depositPaymentDate}</p>
                            <p className={`mt-1 text-sm ${invoice.depositPaidAt ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                              {formatDate(invoice.depositPaidAt)}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {showPaymentSummary ? (
                    <div className="mx-4 rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        {isVisible('amountPaid') ? (
                          <div className="min-w-0">
                            <p className="text-muted-foreground">{labels.amountPaid}</p>
                            <PriceDisplay cents={amountPaid} locale={priceLocale} className="mt-1 block truncate text-sm font-semibold tabular-nums text-foreground" />
                          </div>
                        ) : null}
                        {isVisible('remainingAmount') ? (
                          <div className="min-w-0">
                            <p className="text-muted-foreground">{labels.remainingAmount}</p>
                            <PriceDisplay cents={remainingAmount} locale={priceLocale} className="mt-1 block truncate text-sm font-semibold tabular-nums text-foreground" />
                          </div>
                        ) : null}
                      </div>
                      {isVisible('paymentProgress') ? (
                        <div className="mt-2">
                          <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{labels.paymentProgress}</span>
                            <span className="font-semibold text-foreground">{paymentProgressPercent}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                              style={{ width: `${paymentProgressPercent}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 px-4 pb-4.5 pt-3">
                    {isVisible('totalIncludingTax') ? (
                      <PriceDisplay
                        cents={invoice.totalIncludingTax}
                        locale={priceLocale}
                        className="text-base font-semibold tabular-nums text-foreground"
                      />
                    ) : <span className="text-sm text-muted-foreground">{displayInvoiceNumber}</span>}
                    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {renderPrimaryAction(invoice)}
                      {renderSecondaryActions(invoice)}
                    </div>
                  </div>
                </article>
              );
            })}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-white md:block dark:bg-card">
        <Table className="min-w-280">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectionEnabled ? (
                <TableHead className="h-11 w-12 pl-4 pr-3">
                  <Checkbox
                    checked={allVisibleSelected}
                    onCheckedChange={(checked) => onToggleSelectAllVisible?.(Boolean(checked))}
                    aria-label={locale === 'fr' ? 'Tout selectionner' : 'Select all visible'}
                  />
                </TableHead>
              ) : null}
              <TableHead className="h-11 pl-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {onToggleNumberSort ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                    onClick={onToggleNumberSort}
                  >
                    {labels.invoiceNumber}
                    {numberSortOrder === 'asc' ? <ArrowUpIcon className="size-3.5" /> : <ArrowDownIcon className="size-3.5" />}
                  </Button>
                ) : (
                  labels.invoiceNumber
                )}
              </TableHead>
              {isVisible('client') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.client}</TableHead> : null}
              {isVisible('date') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.date}</TableHead> : null}
              {isVisible('dueDate') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.dueDate}</TableHead> : null}
              {isVisible('totalIncludingTax') ? <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.totalIncludingTax}</TableHead> : null}
              {isVisible('amountPaid') ? <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.amountPaid}</TableHead> : null}
              {isVisible('remainingAmount') ? <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.remainingAmount}</TableHead> : null}
              {isVisible('paymentProgress') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.paymentProgress}</TableHead> : null}
              {showDepositColumns && isVisible('depositAmount') ? <TableHead className="h-11 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.depositAmount}</TableHead> : null}
              {showDepositColumns && isVisible('depositPaymentDate') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.depositPaymentDate}</TableHead> : null}
              {isVisible('status') ? <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.status}</TableHead> : null}
              <TableHead className="h-11 pr-4 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.quickActions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`invoice-skeleton-${idx}`}>
                    {selectionEnabled ? <TableCell className="py-4 pl-4 pr-3"><Skeleton className="h-4 w-4 rounded" /></TableCell> : null}
                    <TableCell className="py-4 pl-5"><Skeleton className="h-4 w-28" /></TableCell>
                    {isVisible('client') ? <TableCell className="py-4"><Skeleton className="h-4 w-28" /></TableCell> : null}
                    {isVisible('date') ? <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell> : null}
                    {isVisible('dueDate') ? <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell> : null}
                    {isVisible('totalIncludingTax') ? <TableCell className="py-4"><Skeleton className="h-5 w-24" /></TableCell> : null}
                    {isVisible('amountPaid') ? <TableCell className="py-4"><Skeleton className="ml-auto h-5 w-24" /></TableCell> : null}
                    {isVisible('remainingAmount') ? <TableCell className="py-4"><Skeleton className="ml-auto h-5 w-24" /></TableCell> : null}
                    {isVisible('paymentProgress') ? <TableCell className="py-4"><Skeleton className="h-4 w-20" /></TableCell> : null}
                    {showDepositColumns && isVisible('depositAmount') ? <TableCell className="py-4"><Skeleton className="ml-auto h-5 w-20" /></TableCell> : null}
                    {showDepositColumns && isVisible('depositPaymentDate') ? <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell> : null}
                    {isVisible('status') ? <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-full" /></TableCell> : null}
                    <TableCell className="py-4 pr-4"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              : items.map((invoice) => {
                  const displayInvoiceNumber = formatInvoiceDisplayNumber(locale, invoice.invoiceNumber);
                  const invoiceHasDeposit = hasDeposit(invoice);
                  const amountPaid = getAmountPaid(invoice);
                  const remainingAmount = getRemainingAmount(invoice);
                  const paymentProgressPercent = getPaymentProgressPercent(invoice);

                  return (
                    <TableRow
                      key={invoice._id}
                      className="group cursor-pointer border-b border-border/45 transition-colors last:border-0 hover:bg-muted/20"
                      style={{ backgroundColor: STATUS_ROW_BG[invoice.status] }}
                      onClick={() => {
                        void openInvoice(invoice);
                      }}
                    >
                      {selectionEnabled ? (
                        <TableCell className="py-4 pl-4 pr-3 align-middle" onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selectedIdsSet.has(invoice._id)}
                            onCheckedChange={(checked) => onToggleInvoiceSelection?.(invoice._id, Boolean(checked))}
                            aria-label={`Select ${displayInvoiceNumber}`}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell
                        className="py-4 pl-5 align-middle"
                        style={{ borderLeft: `3px solid ${STATUS_ACCENT[invoice.status]}` }}
                      >
                        <Link
                          href={`/invoices/${invoice._id}`}
                          className="text-sm font-semibold text-foreground hover:text-(--color-text-info) hover:underline"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            void openInvoice(invoice);
                          }}
                        >
                          {displayInvoiceNumber}
                        </Link>
                      </TableCell>
                      {isVisible('client') ? (
                        <TableCell className="py-4 align-middle">
                          <Link
                            href={`/clients/${invoice.clientId}`}
                            className="text-sm font-medium text-foreground hover:underline"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {invoice.clientSnapshot.fullName}
                          </Link>
                        </TableCell>
                      ) : null}
                      {isVisible('date') ? <TableCell className="py-4 align-middle text-sm text-muted-foreground">{formatDate(invoice.date)}</TableCell> : null}
                      {isVisible('dueDate') ? (
                        <TableCell className="py-4 align-middle text-sm" style={getDueDateStyle(invoice.dueDate, invoice.status)}>
                          {formatDate(invoice.dueDate)}
                        </TableCell>
                      ) : null}
                      {isVisible('totalIncludingTax') ? (
                        <TableCell className="py-4 align-middle text-right">
                          <PriceDisplay cents={invoice.totalIncludingTax} locale={priceLocale} className="text-[15px] font-semibold tabular-nums text-foreground" />
                        </TableCell>
                      ) : null}
                      {isVisible('amountPaid') ? (
                        <TableCell className="py-4 align-middle text-right">
                          <PriceDisplay cents={amountPaid} locale={priceLocale} className="text-sm font-medium tabular-nums text-foreground" />
                        </TableCell>
                      ) : null}
                      {isVisible('remainingAmount') ? (
                        <TableCell className="py-4 align-middle text-right">
                          <PriceDisplay cents={remainingAmount} locale={priceLocale} className="text-sm font-semibold tabular-nums text-foreground" />
                        </TableCell>
                      ) : null}
                      {isVisible('paymentProgress') ? (
                        <TableCell className="py-4 align-middle">
                          <div className="max-w-28">
                            <div className="mb-1 flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">{paymentProgressPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/70">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                                style={{ width: `${paymentProgressPercent}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      ) : null}
                      {showDepositColumns && isVisible('depositAmount') ? (
                        <TableCell className="py-4 align-middle text-right">
                          {invoiceHasDeposit ? (
                            <PriceDisplay cents={invoice.depositAmount ?? 0} locale={priceLocale} className="text-sm font-medium tabular-nums text-foreground" />
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ) : null}
                      {showDepositColumns && isVisible('depositPaymentDate') ? (
                        <TableCell className="py-4 align-middle text-sm">
                          <span className={invoice.depositPaidAt ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                            {formatDate(invoice.depositPaidAt)}
                          </span>
                        </TableCell>
                      ) : null}
                      {isVisible('status') ? (
                        <TableCell className="py-4 align-middle">
                          <div className="flex flex-col items-start gap-1">
                            <InvoiceStatusBadge status={invoice.status} locale={locale} />
                            <ReminderStateBadge invoice={invoice} locale={locale} />
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell className="py-4 pr-4 align-middle">
                        <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                          {renderPrimaryAction(invoice)}
                          {renderSecondaryActions(invoice, 'end')}
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
