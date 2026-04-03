'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ArrowDown, ArrowUp, ArrowUpDown, PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import CatalogueItemModal, { type CatalogueItemFormValue } from '@/components/catalogue/CatalogueItemModal';
import CatalogueTable, {
  type CatalogueItem,
  type CatalogueSortBy,
  type CatalogueSortOrder,
} from '@/components/catalogue/CatalogueTable';
import DeleteCatalogueDialog from '@/components/catalogue/DeleteCatalogueDialog';
import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type CatalogueTypeFilter = 'all' | 'product' | 'service';

interface CatalogueApiResponse {
  success: boolean;
  message?: string;
  data?: CatalogueItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const initialPagination: Pagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
};

interface SortButtonProps {
  label: string;
  column: CatalogueSortBy;
  sortBy: CatalogueSortBy;
  sortOrder: CatalogueSortOrder;
  onSort: (column: CatalogueSortBy) => void;
}

function SortButton({ label, column, sortBy, sortOrder, onSort }: SortButtonProps) {
  const active = sortBy === column;

  return (
    <Button
      type="button"
      variant="outline"
      className={`h-8 border-border/80 bg-transparent px-2 text-xs sm:px-2.5 sm:text-sm ${
        active ? 'border-(--color-text-info) text-(--color-text-info)' : 'text-muted-foreground'
      }`}
      onClick={() => onSort(column)}
    >
      {label}
      {active ? (sortOrder === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />) : <ArrowUpDown className="size-3.5" />}
    </Button>
  );
}

export default function CataloguePage() {
  const { locale } = useLocale();
  const t = {
    en: {
      shellTitle: 'Products & Services',
      heading: 'Products & Services',
      subtitle: 'Manage reusable products and services for fast quote creation.',
      newItem: 'New item',
      loadingError: 'Failed to load catalogue items',
      loadItemFailed: 'Failed to load item details',
      searchPlaceholder: 'Search by name, type or description...',
      tabAll: 'All',
      tabProducts: 'Products',
      tabServices: 'Services',
      sortName: 'Name',
      sortPrice: 'Price',
      sortDate: 'Date added',
      emptyMessage: 'No products or services yet',
      name: 'Name',
      type: 'Type',
      product: 'Product',
      service: 'Service',
      priceExcludingTax: 'Price excl. tax',
      vatRate: 'VAT',
      description: 'Description',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      noDescription: '—',
      addedDate: 'Date added',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
    },
    fr: {
      shellTitle: 'Produits & Services',
      heading: 'Produits & Services',
      subtitle: 'Gerez des produits et services reutilisables pour creer des devis rapidement.',
      newItem: 'Nouvel element',
      loadingError: 'Impossible de charger les elements du catalogue',
      loadItemFailed: 'Impossible de charger le detail de cet element',
      searchPlaceholder: 'Rechercher par nom, type ou description...',
      tabAll: 'Tous',
      tabProducts: 'Produits',
      tabServices: 'Services',
      sortName: 'Nom',
      sortPrice: 'Prix',
      sortDate: 'Date d\'ajout',
      emptyMessage: 'Aucun produit ou service pour le moment',
      name: 'Nom',
      type: 'Type',
      product: 'Produit',
      service: 'Service',
      priceExcludingTax: 'Prix HT',
      vatRate: 'TVA',
      description: 'Description',
      actions: 'Actions',
      edit: 'Modifier',
      delete: 'Supprimer',
      noDescription: '—',
      addedDate: 'Date d\'ajout',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Precedent',
      next: 'Suivant',
    },
  }[locale];

  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [typeFilter, setTypeFilter] = useState<CatalogueTypeFilter>('all');
  const [sortBy, setSortBy] = useState<CatalogueSortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<CatalogueSortOrder>('desc');

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogueItemFormValue | null>(null);
  const [deleteItem, setDeleteItem] = useState<CatalogueItem | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchDebounced(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [searchDebounced]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('limit', String(pagination.limit));
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    if (typeFilter !== 'all') {
      params.set('type', typeFilter);
    }

    if (searchDebounced) {
      params.set('search', searchDebounced);
    }

    return params.toString();
  }, [pagination.page, pagination.limit, sortBy, sortOrder, typeFilter, searchDebounced]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/catalogue?${queryString}`, { cache: 'no-store' });
      const payload = (await response.json()) as CatalogueApiResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.loadingError);
      }

      setItems(payload.data ?? []);
      setPagination((prev) => payload.pagination ?? prev);
    } catch (loadError) {
      setItems([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
      setError(loadError instanceof Error ? loadError.message : t.loadingError);
    } finally {
      setLoading(false);
    }
  }, [queryString, t.loadingError]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const pageIsOutOfRange = pagination.page > 1 && (pagination.totalPages === 0 || pagination.page > pagination.totalPages);
    if (!pageIsOutOfRange) {
      return;
    }

    setPagination((prev) => ({ ...prev, page: Math.max(1, prev.totalPages) }));
  }, [loading, pagination.page, pagination.totalPages]);

  function handleSort(column: CatalogueSortBy) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      setPagination((prev) => ({ ...prev, page: 1 }));
      return;
    }

    setSortBy(column);
    setSortOrder(column === 'createdAt' ? 'desc' : 'asc');
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  async function openEdit(item: CatalogueItem) {
    try {
      const response = await fetch(`/api/catalogue/${item._id}`, { cache: 'no-store' });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: CatalogueItem & {
          fileUrl?: string | null;
          fileKey?: string | null;
          fileMimeType?: string | null;
          fileName?: string | null;
          imageUrl?: string | null;
          imageKey?: string | null;
        };
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || t.loadItemFailed);
      }

      const detail = payload.data;
      setEditItem({
        _id: detail._id,
        name: detail.name,
        type: detail.type,
        priceExcludingTax: detail.priceExcludingTax,
        priceIncludingTax: detail.priceIncludingTax ?? Math.round(detail.priceExcludingTax * (1 + detail.vatRate / 100)),
        vatRate: detail.vatRate,
        currency: detail.currency ?? 'EUR',
        description: detail.description ?? null,
        attachmentUrl: detail.attachmentUrl ?? detail.fileUrl ?? detail.imageUrl ?? null,
        attachmentKey: detail.attachmentKey ?? detail.fileKey ?? detail.imageKey ?? null,
        attachmentMimeType: detail.attachmentMimeType ?? detail.fileMimeType ?? null,
        attachmentName: detail.attachmentName ?? detail.fileName ?? null,
      });
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.loadItemFailed));
    }
  }

  async function refreshAfterMutation() {
    if (pagination.page === 1) {
      await loadItems();
      return;
    }

    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  async function handleDeletedItem() {
    // If we removed the only row on the current page, move to previous page.
    if (pagination.page > 1 && items.length === 1) {
      setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
      return;
    }

    await loadItems();
  }

  return (
    <CrmShell title={t.shellTitle}>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button type="button" className="w-full sm:w-auto h-10" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            {t.newItem}
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <SortButton label={t.sortName} column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <SortButton label={t.sortPrice} column="priceExcludingTax" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <SortButton label={t.sortDate} column="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            </div>
          </div>

          <Tabs
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value as CatalogueTypeFilter);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          >
            <TabsList className="h-auto w-full rounded-lg border border-border/80 bg-transparent p-1 sm:w-auto">
              <TabsTrigger
                value="all"
                className="flex-1 rounded-md border border-transparent px-3 py-1 text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground sm:flex-none"
              >
                {t.tabAll}
              </TabsTrigger>
              <TabsTrigger
                value="product"
                className="flex-1 rounded-md border border-border/80 px-3 py-1 text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground sm:flex-none"
              >
                {t.tabProducts}
              </TabsTrigger>
              <TabsTrigger
                value="service"
                className="flex-1 rounded-md border border-border/80 px-3 py-1 text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground sm:flex-none"
              >
                {t.tabServices}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {error ? <ErrorMessage message={error} /> : null}

        {!loading && items.length === 0 ? (
          <EmptyState message={t.emptyMessage} actionLabel={t.newItem} onAction={() => setCreateOpen(true)} />
        ) : (
          <>
            <CatalogueTable
              items={items}
              loading={loading}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              onEdit={openEdit}
              onDelete={setDeleteItem}
              labels={{
                name: t.name,
                type: t.type,
                product: t.product,
                service: t.service,
                priceExcludingTax: t.priceExcludingTax,
                vatRate: t.vatRate,
                description: t.description,
                actions: t.actions,
                edit: t.edit,
                delete: t.delete,
                noDescription: t.noDescription,
                addedDate: t.addedDate,
              }}
            />

            <div className="flex flex-col gap-2 rounded-lg border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {t.page} {pagination.page} {t.of} {Math.max(pagination.totalPages, 1)} - {pagination.total} {t.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  {t.previous}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  {t.next}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <CatalogueItemModal
        open={createOpen}
        mode="add"
        onClose={() => setCreateOpen(false)}
        onSaved={refreshAfterMutation}
      />

      <CatalogueItemModal
        open={Boolean(editItem)}
        mode="edit"
        item={editItem}
        onClose={() => setEditItem(null)}
        onSaved={refreshAfterMutation}
      />

      <DeleteCatalogueDialog
        open={Boolean(deleteItem)}
        item={deleteItem}
        onClose={() => setDeleteItem(null)}
        onDeleted={handleDeletedItem}
      />
    </CrmShell>
  );
}
