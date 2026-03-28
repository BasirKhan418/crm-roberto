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
  vatRate: number;
  description?: string | null;
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
                <Skeleton className="h-4 w-2/3" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-10" />
                </div>
                <Skeleton className="h-4 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-7 flex-1" />
                  <Skeleton className="h-7 flex-1" />
                </div>
              </div>
            ))
          : items.map((item) => (
              <article key={item._id} className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-5">{item.name}</h3>
                  <span style={typePill(item.type)}>{item.type === 'product' ? labels.product : labels.service}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">{labels.priceExcludingTax}</p>
                    <p className="font-medium"><PriceDisplay cents={item.priceExcludingTax} /></p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{labels.vatRate}</p>
                    <p className="font-medium">{item.vatRate}%</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground">{labels.description}</p>
                  <p className="text-sm">{truncate(item.description, 60) || labels.noDescription}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)}>
                    <PencilIcon className="size-3.5" />
                    {labels.edit}
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(item)}>
                    <Trash2Icon className="size-3.5" />
                    {labels.delete}
                  </Button>
                </div>
              </article>
            ))}
      </div>

      <div className="hidden md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead style={{ width: '28%' }}>
                <SortHeaderButton label={labels.name} column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead style={{ width: '12%' }}>{labels.type}</TableHead>
              <TableHead style={{ width: '16%' }}>
                <SortHeaderButton label={labels.priceExcludingTax} column="priceExcludingTax" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
              </TableHead>
              <TableHead style={{ width: '10%' }}>{labels.vatRate}</TableHead>
              <TableHead style={{ width: '24%' }}>{labels.description}</TableHead>
              <TableHead style={{ width: '10%' }}>{labels.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={`skeleton-row-${index}`}>
                    <TableCell><Skeleton className="h-4 w-4/5" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell><Skeleton className="h-7 w-20" /></TableCell>
                  </TableRow>
                ))
              : items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="truncate font-medium" title={item.name}>{item.name}</TableCell>
                    <TableCell>
                      <span style={typePill(item.type)}>{item.type === 'product' ? labels.product : labels.service}</span>
                    </TableCell>
                    <TableCell>
                      <PriceDisplay cents={item.priceExcludingTax} />
                    </TableCell>
                    <TableCell>{item.vatRate}%</TableCell>
                    <TableCell className="truncate" title={item.description ?? labels.noDescription}>{truncate(item.description, 60) || labels.noDescription}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)}>
                          <PencilIcon className="size-3.5" />
                          {labels.edit}
                        </Button>
                        <Button type="button" size="sm" variant="destructive" onClick={() => onDelete(item)}>
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
