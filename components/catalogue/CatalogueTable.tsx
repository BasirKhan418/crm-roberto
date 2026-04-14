'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, CopyIcon, EllipsisVerticalIcon, PencilIcon, SquarePenIcon, Trash2Icon } from 'lucide-react';

import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
export type CatalogueTableColumnKey = 'type' | 'priceExcludingTax' | 'priceIncludingTax' | 'vatRate' | 'addedDate' | 'description';

interface CatalogueTableProps {
  items: CatalogueItem[];
  loading: boolean;
  sortBy: CatalogueSortBy;
  sortOrder: CatalogueSortOrder;
  visibleColumns?: Partial<Record<CatalogueTableColumnKey, boolean>>;
  onSort: (column: CatalogueSortBy) => void;
  onEdit: (item: CatalogueItem) => void;
  onQuickEdit: (item: CatalogueItem) => void;
  onDuplicate: (item: CatalogueItem) => void;
  onDelete: (item: CatalogueItem) => void;
  labels: {
    name: string;
    type: string;
    product: string;
    service: string;
    priceExcludingTax: string;
    priceIncludingTax: string;
    vatRate: string;
    description: string;
    actions: string;
    edit: string;
    quickEdit: string;
    duplicate: string;
    moreActions: string;
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
  visibleColumns,
  onSort,
  onEdit,
  onQuickEdit,
  onDuplicate,
  onDelete,
  labels,
}: CatalogueTableProps) {
  const isVisible = (column: CatalogueTableColumnKey) => visibleColumns?.[column] !== false;

  function renderActions(item: CatalogueItem, align: 'start' | 'end' = 'end') {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button type="button" size="sm" variant="outline" className="whitespace-nowrap" onClick={() => onEdit(item)}>
          <PencilIcon className="size-3.5" />
          {labels.edit}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon" variant="outline" className="size-8" aria-label={labels.moreActions}>
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={align} className="w-48">
            <DropdownMenuItem onSelect={() => onQuickEdit(item)}>
              <SquarePenIcon className="size-4" />
              {labels.quickEdit}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onDuplicate(item)}>
              <CopyIcon className="size-4" />
              {labels.duplicate}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}>
              <Trash2Icon className="size-4" />
              {labels.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

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
                  {isVisible('priceExcludingTax') ? (
                    <div>
                      <p className="mb-0.5 text-muted-foreground">{labels.priceExcludingTax}</p>
                      <p className="font-medium"><PriceDisplay cents={item.priceExcludingTax} /></p>
                    </div>
                  ) : null}
                  {isVisible('priceIncludingTax') ? (
                    <div>
                      <p className="mb-0.5 text-muted-foreground">{labels.priceIncludingTax}</p>
                      <p className="font-medium"><PriceDisplay cents={item.priceIncludingTax ?? Math.round(item.priceExcludingTax * (1 + item.vatRate / 100))} /></p>
                    </div>
                  ) : null}
                  {isVisible('vatRate') ? (
                    <div>
                      <p className="mb-0.5 text-muted-foreground">{labels.vatRate}</p>
                      <p className="font-medium">{item.vatRate}%</p>
                    </div>
                  ) : null}
                  {isVisible('addedDate') ? (
                    <div className="col-span-2">
                      <p className="mb-0.5 text-muted-foreground">{labels.addedDate}</p>
                      <p className="font-medium">{new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                  ) : null}
                </div>

                {/* Description */}
                {isVisible('description') && item.description ? (
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
                ) : null}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant="secondary" className="h-9" onClick={() => onQuickEdit(item)}>
                    <SquarePenIcon className="size-3.5" />
                    {labels.quickEdit}
                  </Button>
                  <div className="flex items-center justify-end gap-2">
                    {renderActions(item, 'end')}
                  </div>
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
              {isVisible('type') ? <TableHead style={{ width: '10%' }}>{labels.type}</TableHead> : null}
              {isVisible('priceExcludingTax') ? (
                <TableHead style={{ width: '14%' }}>
                  <SortHeaderButton label={labels.priceExcludingTax} column="priceExcludingTax" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                </TableHead>
              ) : null}
              {isVisible('priceIncludingTax') ? <TableHead style={{ width: '14%' }}>{labels.priceIncludingTax}</TableHead> : null}
              {isVisible('vatRate') ? <TableHead style={{ width: '8%' }}>{labels.vatRate}</TableHead> : null}
              {isVisible('addedDate') ? (
                <TableHead style={{ width: '12%' }}>
                  <SortHeaderButton label={labels.addedDate} column="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                </TableHead>
              ) : null}
              {isVisible('description') ? <TableHead style={{ width: '18%' }}>{labels.description}</TableHead> : null}
              <TableHead style={{ width: '20%' }} className="text-right">{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-row-${index}`}>
                    <TableCell><Skeleton className="h-4 w-4/5" /></TableCell>
                    {isVisible('type') ? <TableCell><Skeleton className="h-5 w-14 rounded-full" /></TableCell> : null}
                    {isVisible('priceExcludingTax') ? <TableCell><Skeleton className="h-4 w-20" /></TableCell> : null}
                    {isVisible('priceIncludingTax') ? <TableCell><Skeleton className="h-4 w-20" /></TableCell> : null}
                    {isVisible('vatRate') ? <TableCell><Skeleton className="h-4 w-10" /></TableCell> : null}
                    {isVisible('addedDate') ? <TableCell><Skeleton className="h-4 w-20" /></TableCell> : null}
                    {isVisible('description') ? <TableCell><Skeleton className="h-4 w-full" /></TableCell> : null}
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
                    {isVisible('type') ? (
                      <TableCell>
                        <span style={typePill(item.type)}>{item.type === 'product' ? labels.product : labels.service}</span>
                      </TableCell>
                    ) : null}
                    {isVisible('priceExcludingTax') ? (
                      <TableCell className="whitespace-nowrap">
                        <PriceDisplay cents={item.priceExcludingTax} />
                      </TableCell>
                    ) : null}
                    {isVisible('priceIncludingTax') ? (
                      <TableCell className="whitespace-nowrap">
                        <PriceDisplay cents={item.priceIncludingTax ?? Math.round(item.priceExcludingTax * (1 + item.vatRate / 100))} />
                      </TableCell>
                    ) : null}
                    {isVisible('vatRate') ? <TableCell>{item.vatRate}%</TableCell> : null}
                    {isVisible('addedDate') ? <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell> : null}
                    {isVisible('description') ? (
                      <TableCell className="truncate" title={item.description ?? labels.noDescription}>{truncate(item.description, 60) || labels.noDescription}</TableCell>
                    ) : null}
                    <TableCell>{renderActions(item)}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
