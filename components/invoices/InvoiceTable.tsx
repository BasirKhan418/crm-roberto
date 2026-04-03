'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DownloadIcon, EllipsisVerticalIcon, EyeIcon, SendIcon, Trash2Icon } from 'lucide-react';

import type { InvoiceListItem } from '@/hooks/useInvoices';
import { InvoiceStatusBadge } from '@/components/ui/InvoiceStatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
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
  deposit_paid: 'var(--color-text-warning)',
  paid: 'var(--color-text-success)',
  overdue: 'var(--color-text-danger)',
};

const STATUS_ROW_BG: Record<InvoiceListItem['status'], string> = {
  unpaid: 'rgba(100, 116, 139, 0.04)',
  deposit_paid: 'rgba(245, 158, 11, 0.08)',
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

interface InvoiceTableProps {
  items: InvoiceListItem[];
  loading: boolean;
  labels: {
    invoiceNumber: string;
    client: string;
    date: string;
    dueDate: string;
    totalIncludingTax: string;
    status: string;
    actions: string;
    view: string;
    send: string;
    downloadPdf: string;
    delete: string;
  };
  locale: 'en' | 'fr';
  formatDate: (value: string | null | undefined) => string;
  onDelete: (invoice: InvoiceListItem) => void;
  onDownload: (invoice: InvoiceListItem) => Promise<void>;
  onSend: (invoice: InvoiceListItem) => void;
}

export default function InvoiceTable({
  items,
  loading,
  labels,
  locale,
  formatDate,
  onDelete,
  onDownload,
  onSend,
}: InvoiceTableProps) {
  const router = useRouter();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  function renderActions(invoice: InvoiceListItem, align: 'start' | 'end' = 'end') {
    const moreActionsLabel = locale === 'fr' ? 'Plus d actions' : 'More actions';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="icon" variant="outline" className="size-8 shrink-0" aria-label={`${moreActionsLabel} ${invoice.invoiceNumber}`}>
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/invoices/${invoice._id}`}>
              <EyeIcon className="size-4" />
              {labels.view}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSend(invoice)}>
            <SendIcon className="size-4" />
            {labels.send}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void onDownload(invoice)}>
            <DownloadIcon className="size-4" />
            {labels.downloadPdf}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(invoice)}>
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
          : items.map((invoice) => (
              <article
                key={invoice._id}
                className="cursor-pointer rounded-xl border border-border/60 bg-card shadow-xs"
                style={{ borderLeftWidth: '3px', borderLeftColor: STATUS_ACCENT[invoice.status], backgroundColor: STATUS_ROW_BG[invoice.status] }}
                onClick={() => router.push(`/invoices/${invoice._id}`)}
              >
                <div className="flex items-start justify-between gap-3 px-4 pt-4.5">
                  <div className="min-w-0">
                    <Link
                      href={`/clients/${invoice.clientId}`}
                      className="block truncate text-sm font-semibold text-foreground hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {invoice.clientSnapshot.fullName}
                    </Link>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{invoice.invoiceNumber}</p>
                    <p className="mt-1 text-[11px]" style={getDueDateStyle(invoice.dueDate, invoice.status)}>
                      {labels.dueDate}: {formatDate(invoice.dueDate)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <InvoiceStatusBadge status={invoice.status} locale={locale} className="mt-0.5" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 px-4 pb-4.5 pt-3">
                  <PriceDisplay
                    cents={invoice.totalIncludingTax}
                    locale={priceLocale}
                    className="text-base font-semibold tabular-nums text-foreground"
                  />
                  <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                    <Button type="button" size="sm" className="h-8 px-3 text-xs" asChild>
                      <Link href={`/invoices/${invoice._id}`}>
                        <EyeIcon className="size-3.5" />
                        {labels.view}
                      </Link>
                    </Button>
                    {renderActions(invoice)}
                  </div>
                </div>
              </article>
            ))}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-white md:block dark:bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 pl-5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.invoiceNumber}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.client}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.date}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.dueDate}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.totalIncludingTax}</TableHead>
              <TableHead className="h-11 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.status}</TableHead>
              <TableHead className="h-11 pr-4 text-right text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={`invoice-skeleton-${idx}`}>
                    <TableCell className="py-4 pl-5"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="py-4"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell className="py-4 pr-4"><Skeleton className="ml-auto h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              : items.map((invoice) => (
                  <TableRow
                    key={invoice._id}
                    className="group cursor-pointer border-b border-border/45 transition-colors last:border-0 hover:bg-muted/20"
                    style={{ backgroundColor: STATUS_ROW_BG[invoice.status] }}
                    onClick={() => router.push(`/invoices/${invoice._id}`)}
                  >
                    <TableCell
                      className="py-4 pl-5 align-middle"
                      style={{ borderLeft: `3px solid ${STATUS_ACCENT[invoice.status]}` }}
                    >
                      <Link
                        href={`/invoices/${invoice._id}`}
                        className="text-sm font-semibold text-foreground hover:text-(--color-text-info) hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="py-4 align-middle">
                      <Link
                        href={`/clients/${invoice.clientId}`}
                        className="text-sm font-medium text-foreground hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {invoice.clientSnapshot.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="py-4 align-middle text-sm text-muted-foreground">{formatDate(invoice.date)}</TableCell>
                    <TableCell className="py-4 align-middle text-sm" style={getDueDateStyle(invoice.dueDate, invoice.status)}>
                      {formatDate(invoice.dueDate)}
                    </TableCell>
                    <TableCell className="py-4 align-middle">
                      <PriceDisplay cents={invoice.totalIncludingTax} locale={priceLocale} className="text-[15px] font-semibold tabular-nums text-foreground" />
                    </TableCell>
                    <TableCell className="py-4 align-middle">
                      <InvoiceStatusBadge status={invoice.status} locale={locale} />
                    </TableCell>
                    <TableCell className="py-4 pr-4 align-middle">
                      <div className="flex items-center justify-end gap-1.5" onClick={(event) => event.stopPropagation()}>
                        {renderActions(invoice, 'end')}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
