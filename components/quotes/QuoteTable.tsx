'use client';

import Link from 'next/link';

import { CopyIcon, DownloadIcon, EyeIcon, PencilIcon, Trash2Icon } from 'lucide-react';

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
    view: string;
    edit: string;
    duplicate: string;
    delete: string;
    downloadPdf: string;
    lockEdit: string;
  };
  formatDate: (value: string) => string;
  onDelete: (quote: QuoteListItem) => void;
  onDownload: (quote: QuoteListItem) => Promise<void>;
  onDuplicate: (quote: QuoteListItem) => Promise<void>;
}

export default function QuoteTable({ items, loading, labels, formatDate, onDelete, onDownload, onDuplicate }: QuoteTableProps) {
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

              return (
                <article key={quote._id} className="space-y-3 rounded-xl border border-border/70 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link href={`/quotes/${quote._id}`} className="block text-sm font-semibold text-(--color-text-info) hover:underline break-words">
                        {quote.quoteNumber}
                      </Link>
                      <Link href={`/clients/${quote.clientId}`} className="mt-0.5 block text-sm text-(--color-text-info) hover:underline break-words">
                        {quote.clientSnapshot.fullName}
                      </Link>
                    </div>
                    <StatusBadge status={quote.status} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
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

                  <div className="grid grid-cols-2 gap-2">
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
                      <Button type="button" size="sm" variant="outline" className="col-span-2" onClick={() => onDuplicate(quote)}>
                        <CopyIcon className="size-3.5" />
                        {labels.duplicate}
                      </Button>
                    ) : null}

                    <Button type="button" size="sm" variant="outline" onClick={() => onDownload(quote)}>
                      <DownloadIcon className="size-3.5" />
                      {labels.downloadPdf}
                    </Button>
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

                  return (
                    <TableRow key={quote._id}>
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
                        <StatusBadge status={quote.status} />
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
                            <Button type="button" size="sm" variant="outline" onClick={() => onDuplicate(quote)}>
                              <CopyIcon className="size-3.5" />
                              {labels.duplicate}
                            </Button>
                          ) : null}

                          <Button type="button" size="sm" variant="outline" onClick={() => onDownload(quote)}>
                            <DownloadIcon className="size-3.5" />
                            {labels.downloadPdf}
                          </Button>
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
