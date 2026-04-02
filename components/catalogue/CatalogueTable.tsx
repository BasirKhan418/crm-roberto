'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, PencilIcon, Trash2Icon } from 'lucide-react';

import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface CatalogueItem {
  _id: string;
  name: string;
  type: 'product' | 'service';
  priceExcludingTax: number;
  priceIncludingTax?: number;
  vatRate: number;
  currency?: 'EUR';
  description?: string | null;
  attachmentUrl?: string | null;
  attachmentKey?: string | null;
  attachmentMimeType?: string | null;
  attachmentName?: string | null;
  createdAt: string;
}

export type CatalogueSortBy = 'name' | 'priceExcludingTax' | 'createdAt';
export type CatalogueSortOrder = 'asc' | 'desc';

interface CatalogueTableProps {
  items: CatalogueItem[];
  loading: boolean;
  sortBy: CatalogueSortBy;
  sortOrder: CatalogueSortOrder;
  onSort: (column: CatalogueSortBy) => void;
  onEdit: (item: CatalogueItem) => void;
  onDelete: (item: CatalogueItem) => void;
  labels: {
    name: string;
    type: string;
    product: string;
    service: string;
    priceExcludingTax: string;
    vatRate: string;
    description: string;
    actions: string;
    edit: string;
    delete: string;
    noDescription: string;
    addedDate: string;
  };
}

const truncate = (str: string | null | undefined, n = 60) =>
  str && str.length > n ? `${str.slice(0, n)}...` : str ?? '—';

function isImageAttachment(url?: string | null, mime?: string | null): boolean {
  if (mime?.startsWith('image/')) {
    return true;
  }

  if (!url) {
    return false;
  }

  return /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url);
}

const typePill = (type: 'product' | 'service') => ({
  fontSize: '11px',
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: '10px',
  background: type === 'product' ? 'var(--color-background-info)' : '#EEEDFE',
  color: type === 'product' ? 'var(--color-text-info)' : '#3C3489',
});

function SortIcon({ active, order }: { active: boolean; order: CatalogueSortOrder }) {
  if (!active) {
    return <ArrowUpDown className="size-3.5" />;
  }

  return order === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />;
}

function SortHeaderButton({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  column: CatalogueSortBy;
  sortBy: CatalogueSortBy;
  sortOrder: CatalogueSortOrder;
  onSort: (column: CatalogueSortBy) => void;
}) {
  const active = sortBy === column;

  return (
    <Button
      type="button"
      variant="ghost"
      className={`h-auto p-0 text-xs font-semibold uppercase tracking-wide ${
        active ? 'text-(--color-text-info)' : 'text-muted-foreground'
      }`}
      onClick={() => onSort(column)}
    >
      <span>{label}</span>
      <SortIcon active={active} order={sortOrder} />
    </Button>
  );
}

export default function CatalogueTable({
  items,
  loading,
  sortBy,
  sortOrder,
  onSort,
  onEdit,
  onDelete,
  labels,
}: CatalogueTableProps) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div key={`mobile-skeleton-${index}`} className="space-y-3 rounded-xl border border-border/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 flex-1" />
                  <Skeleton className="h-9 flex-1" />
                </div>
              </div>
            ))
          : items.map((item) => (
              <article key={item._id} className="rounded-xl border border-border/70 bg-card/80 p-3.5 shadow-sm">
                {/* Header row: name + type badge */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {item.attachmentUrl && isImageAttachment(item.attachmentUrl, item.attachmentMimeType) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.attachmentUrl}
                        alt={item.attachmentName || item.name}
                        className="h-9 w-9 shrink-0 rounded-md border border-border/70 object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <h3 className="line-clamp-2 text-sm font-semibold leading-5">{item.name}</h3>
                  </div>
                  <span className="shrink-0" style={typePill(item.type)}>
                    {item.type === 'product' ? labels.product : labels.service}
                  </span>
                </div>

                {/* Stats grid: clearer on narrow screens */}
                <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2 text-xs">
                  <div>
                    <p className="mb-0.5 text-muted-foreground">{labels.priceExcludingTax}</p>
                    <p className="font-medium"><PriceDisplay cents={item.priceExcludingTax} /></p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-muted-foreground">{labels.vatRate}</p>
                    <p className="font-medium">{item.vatRate}%</p>
                  </div>
                  <div className="col-span-2">
                    <p className="mb-0.5 text-muted-foreground">{labels.addedDate}</p>
                    <p className="font-medium">{new Date(item.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Description */}
                {item.description ? (
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                ) : null}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-9" onClick={() => onEdit(item)}>
                    <PencilIcon className="size-3.5" />
                    {labels.edit}
                  </Button>
                  <Button type="button" size="sm" variant="destructive" className="h-9" onClick={() => onDelete(item)}>
                    <Trash2Icon className="size-3.5" />
                    {labels.delete}
                  </Button>
                </div>
              </article>
            ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-border/70 bg-card md:block">
        <Table className="min-w-160 table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: '26%' }}>
                <SortHeaderButton label={labels.name} column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead style={{ width: '10%' }}>{labels.type}</TableHead>
              <TableHead style={{ width: '15%' }}>
                <SortHeaderButton label={labels.priceExcludingTax} column="priceExcludingTax" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead style={{ width: '8%' }}>{labels.vatRate}</TableHead>
              <TableHead style={{ width: '21%' }}>{labels.description}</TableHead>
              <TableHead style={{ width: '20%' }} className="text-right">{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-row-${index}`}>
                    <TableCell><Skeleton className="h-4 w-4/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-full" /></TableCell>
                  </TableRow>
                ))
              : items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium" title={item.name}>
                      <div className="flex min-w-0 items-center gap-2">
                        {item.attachmentUrl && isImageAttachment(item.attachmentUrl, item.attachmentMimeType) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.attachmentUrl}
                            alt={item.attachmentName || item.name}
                            className="h-8 w-8 shrink-0 rounded-md border border-border/70 object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : null}
                        <span className="truncate">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span style={typePill(item.type)}>{item.type === 'product' ? labels.product : labels.service}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <PriceDisplay cents={item.priceExcludingTax} />
                    </TableCell>
                    <TableCell>{item.vatRate}%</TableCell>
                    <TableCell className="truncate" title={item.description ?? labels.noDescription}>{truncate(item.description, 60) || labels.noDescription}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button type="button" size="sm" variant="outline" className="whitespace-nowrap" onClick={() => onEdit(item)}>
                          <PencilIcon className="size-3.5" />
                          {labels.edit}
                        </Button>
                        <Button type="button" size="sm" variant="destructive" className="whitespace-nowrap" onClick={() => onDelete(item)}>
                          <Trash2Icon className="size-3.5" />
                          {labels.delete}
                        </Button>
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
