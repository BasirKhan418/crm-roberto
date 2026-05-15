'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ArrowDown, ArrowUp, ArrowUpDown, Columns3Icon, PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import CatalogueItemModal, { type CatalogueItemFormValue } from '@/components/catalogue/CatalogueItemModal';
import CatalogueTable, {
  type CatalogueItem,
  type CatalogueTableColumnKey,
  type CatalogueSortBy,
  type CatalogueSortOrder,
} from '@/components/catalogue/CatalogueTable';
import DeleteCatalogueDialog from '@/components/catalogue/DeleteCatalogueDialog';
import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { resolveTranslatedError } from '@/lib/i18n/messages';
import { eurosToCents } from '@/lib/price';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
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

interface CatalogueViewConfig {
  searchInput?: string;
  typeFilter?: CatalogueTypeFilter;
  sortBy?: CatalogueSortBy;
  sortOrder?: CatalogueSortOrder;
  minPriceInput?: string;
  maxPriceInput?: string;
}

const COLUMN_STORAGE_KEY = 'crm.catalogue.visibleColumns.v1';
const VIEW_STORAGE_KEY = 'crm.catalogue.viewConfig.v1';

const DEFAULT_VISIBLE_COLUMNS: Record<CatalogueTableColumnKey, boolean> = {
  type: true,
  priceExcludingTax: true,
  priceIncludingTax: true,
  vatRate: true,
  addedDate: true,
  description: true,
};

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
      columns: 'Columns',
      visibleColumns: 'Visible columns',
      applyColumns: 'Apply',
      cancelColumns: 'Cancel',
      minPrice: 'Min price',
      maxPrice: 'Max price',
      resetFilters: 'Reset filters',
      quickCreateTitle: 'Quick add reusable item',
      quickNamePlaceholder: 'Item name',
      quickPricePlaceholder: 'Price HT',
      quickAdd: 'Add',
      quickAdding: 'Adding...',
      quickValidation: 'Name and price are required',
      quickFailed: 'Failed to create item',
      quickEditTitle: 'Quick edit item',
      quickEditDescription: 'Update key business fields without opening the full form.',
      quickEditName: 'Name',
      quickEditPrice: 'Price excl. tax',
      quickEditVat: 'VAT rate',
      quickEditSave: 'Save changes',
      quickEditSaving: 'Saving...',
      quickEditFailed: 'Failed to update item',
      duplicate: 'Duplicate',
      duplicateSuccess: 'Item duplicated',
      duplicateFailed: 'Failed to duplicate item',
      quickEdit: 'Quick edit',
      moreActions: 'More actions',
      emptyMessage: 'No products or services yet',
      name: 'Name',
      type: 'Type',
      product: 'Product',
      service: 'Service',
      priceExcludingTax: 'Price excl. tax',
      priceIncludingTax: 'Price incl. tax',
      vatRate: 'VAT',
      description: 'Description',
      actions: 'Actions',
      columnType: 'Type',
      columnPriceExcludingTax: 'Price excl.',
      columnPriceIncludingTax: 'Price incl.',
      columnVatRate: 'VAT',
      columnAddedDate: 'Date added',
      columnDescription: 'Description',
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
      subtitle: 'Gérez des produits et services réutilisables pour créer des devis rapidement.',
      newItem: 'Nouvel élément',
      loadingError: 'Impossible de charger les éléments du catalogue',
      loadItemFailed: 'Impossible de charger le détail de cet élément',
      searchPlaceholder: 'Rechercher par nom, type ou description...',
      tabAll: 'Tous',
      tabProducts: 'Produits',
      tabServices: 'Services',
      sortName: 'Nom',
      sortPrice: 'Prix',
      sortDate: "Date d'ajout",
      columns: 'Colonnes',
      visibleColumns: 'Colonnes visibles',
      applyColumns: 'Appliquer',
      cancelColumns: 'Annuler',
      minPrice: 'Prix min',
      maxPrice: 'Prix max',
      resetFilters: 'Réinitialiser les filtres',
      quickCreateTitle: "Ajout rapide d'un élément réutilisable",
      quickNamePlaceholder: "Nom de l'élément",
      quickPricePlaceholder: 'Prix HT',
      quickAdd: 'Ajouter',
      quickAdding: 'Ajout...',
      quickValidation: 'Le nom et le prix sont requis',
      quickFailed: "Impossible de créer l'élément",
      quickEditTitle: 'Modification rapide',
      quickEditDescription: 'Mettez à jour les champs essentiels sans ouvrir le formulaire complet.',
      quickEditName: 'Nom',
      quickEditPrice: 'Prix HT',
      quickEditVat: 'TVA',
      quickEditSave: 'Enregistrer',
      quickEditSaving: 'Enregistrement...',
      quickEditFailed: "Impossible de mettre à jour l'élément",
      duplicate: 'Dupliquer',
      duplicateSuccess: 'Élément dupliqué',
      duplicateFailed: "Impossible de dupliquer l'élément",
      quickEdit: 'Édition rapide',
      moreActions: 'Plus d\'actions',
      emptyMessage: 'Aucun produit ou service pour le moment',
      name: 'Nom',
      type: 'Type',
      product: 'Produit',
      service: 'Service',
      priceExcludingTax: 'Prix HT',
      priceIncludingTax: 'Prix TTC',
      vatRate: 'TVA',
      description: 'Description',
      actions: 'Actions',
      columnType: 'Type',
      columnPriceExcludingTax: 'Prix HT',
      columnPriceIncludingTax: 'Prix TTC',
      columnVatRate: 'TVA',
      columnAddedDate: 'Date d\'ajout',
      columnDescription: 'Description',
      edit: 'Modifier',
      delete: 'Supprimer',
      noDescription: '—',
      addedDate: "Date d'ajout",
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Précédent',
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
  const [minPriceInput, setMinPriceInput] = useState('');
  const [maxPriceInput, setMaxPriceInput] = useState('');
  const [minPriceDebounced, setMinPriceDebounced] = useState('');
  const [maxPriceDebounced, setMaxPriceDebounced] = useState('');
  const [sortBy, setSortBy] = useState<CatalogueSortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<CatalogueSortOrder>('desc');
  const [visibleColumns, setVisibleColumns] = useState<Record<CatalogueTableColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<Record<CatalogueTableColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<CatalogueItemFormValue | null>(null);
  const [deleteItem, setDeleteItem] = useState<CatalogueItem | null>(null);
  const [quickEditItem, setQuickEditItem] = useState<CatalogueItem | null>(null);
  const [quickEditName, setQuickEditName] = useState('');
  const [quickEditPrice, setQuickEditPrice] = useState('');
  const [quickEditVatRate, setQuickEditVatRate] = useState('17');
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickPrice, setQuickPrice] = useState('');
  const [quickType, setQuickType] = useState<'product' | 'service'>('product');
  const [quickSaving, setQuickSaving] = useState(false);

  useEffect(() => {
    try {
      const rawView = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (rawView) {
        const parsed = JSON.parse(rawView) as CatalogueViewConfig;
        const nextSearchInput = typeof parsed.searchInput === 'string' ? parsed.searchInput : '';
        const nextTypeFilter: CatalogueTypeFilter =
          parsed.typeFilter === 'product' || parsed.typeFilter === 'service' ? parsed.typeFilter : 'all';
        const nextSortBy: CatalogueSortBy =
          parsed.sortBy === 'name' || parsed.sortBy === 'priceExcludingTax' || parsed.sortBy === 'createdAt'
            ? parsed.sortBy
            : 'createdAt';
        const nextSortOrder: CatalogueSortOrder = parsed.sortOrder === 'asc' ? 'asc' : 'desc';
        const nextMinPrice = typeof parsed.minPriceInput === 'string' ? parsed.minPriceInput : '';
        const nextMaxPrice = typeof parsed.maxPriceInput === 'string' ? parsed.maxPriceInput : '';

        setSearchInput(nextSearchInput);
        setSearchDebounced(nextSearchInput.trim());
        setTypeFilter(nextTypeFilter);
        setSortBy(nextSortBy);
        setSortOrder(nextSortOrder);
        setMinPriceInput(nextMinPrice);
        setMaxPriceInput(nextMaxPrice);
        setMinPriceDebounced(nextMinPrice.trim());
        setMaxPriceDebounced(nextMaxPrice.trim());
      }

      const rawColumns = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      if (rawColumns) {
        const parsedColumns = JSON.parse(rawColumns) as Partial<Record<CatalogueTableColumnKey, boolean>>;
        const nextColumns = { ...DEFAULT_VISIBLE_COLUMNS, ...parsedColumns };
        setVisibleColumns(nextColumns);
        setDraftVisibleColumns(nextColumns);
      }
    } catch {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
      setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        VIEW_STORAGE_KEY,
        JSON.stringify({
          searchInput,
          typeFilter,
          sortBy,
          sortOrder,
          minPriceInput,
          maxPriceInput,
        } satisfies CatalogueViewConfig),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [maxPriceInput, minPriceInput, searchInput, sortBy, sortOrder, typeFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchDebounced(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMinPriceDebounced(minPriceInput.trim());
      setMaxPriceDebounced(maxPriceInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [maxPriceInput, minPriceInput]);

  useEffect(() => {
    setPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [maxPriceDebounced, minPriceDebounced, searchDebounced, sortBy, sortOrder, typeFilter]);

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

    const hasMinPrice = minPriceDebounced.trim().length > 0;
    const minPriceNumeric = Number(minPriceDebounced);
    if (hasMinPrice && Number.isFinite(minPriceNumeric) && minPriceNumeric >= 0) {
      params.set('minPrice', String(eurosToCents(minPriceNumeric)));
    }

    const hasMaxPrice = maxPriceDebounced.trim().length > 0;
    const maxPriceNumeric = Number(maxPriceDebounced);
    if (hasMaxPrice && Number.isFinite(maxPriceNumeric) && maxPriceNumeric >= 0) {
      params.set('maxPrice', String(eurosToCents(maxPriceNumeric)));
    }

    return params.toString();
  }, [maxPriceDebounced, minPriceDebounced, pagination.page, pagination.limit, searchDebounced, sortBy, sortOrder, typeFilter]);

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
      return;
    }

    setSortBy(column);
    setSortOrder(column === 'createdAt' ? 'desc' : 'asc');
  }

  function toggleDraftColumn(column: CatalogueTableColumnKey, checked: boolean) {
    setDraftVisibleColumns((prev) => ({ ...prev, [column]: checked }));
  }

  function applyColumns() {
    setVisibleColumns(draftVisibleColumns);
    try {
      window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(draftVisibleColumns));
    } catch {
      // Ignore storage errors.
    }
    setColumnsOpen(false);
  }

  function openQuickEdit(item: CatalogueItem) {
    setQuickEditItem(item);
    setQuickEditName(item.name);
    setQuickEditPrice((item.priceExcludingTax / 100).toString());
    setQuickEditVatRate(item.vatRate.toString());
  }

  function resetFilters() {
    setSearchInput('');
    setSearchDebounced('');
    setTypeFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setMinPriceInput('');
    setMaxPriceInput('');
    setMinPriceDebounced('');
    setMaxPriceDebounced('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  async function handleDuplicateItem(item: CatalogueItem) {
    try {
      const response = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${item.name} (${t.duplicate})`,
          type: item.type,
          priceExcludingTax: item.priceExcludingTax,
          vatRate: item.vatRate,
          currency: item.currency ?? 'EUR',
          description: item.description ?? null,
          attachmentUrl: item.attachmentUrl ?? null,
          attachmentKey: item.attachmentKey ?? null,
          attachmentMimeType: item.attachmentMimeType ?? null,
          attachmentName: item.attachmentName ?? null,
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.duplicateFailed);
      }

      toast.success(t.duplicateSuccess);
      await refreshAfterMutation();
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.duplicateFailed));
    }
  }

  async function saveQuickEdit() {
    if (!quickEditItem?._id) {
      return;
    }

    const name = quickEditName.trim();
    const price = Number(quickEditPrice.trim());
    const vatRate = Number(quickEditVatRate.trim());

    if (!name || !Number.isFinite(price) || price < 0 || !Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
      toast.error(t.quickValidation);
      return;
    }

    setQuickEditSaving(true);
    try {
      const response = await fetch(`/api/catalogue/${quickEditItem._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          priceExcludingTax: eurosToCents(price),
          vatRate,
          currency: quickEditItem.currency ?? 'EUR',
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.quickEditFailed);
      }

      setQuickEditItem(null);
      await loadItems();
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.quickEditFailed));
    } finally {
      setQuickEditSaving(false);
    }
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

  async function handleQuickCreate() {
    const name = quickName.trim();
    const price = quickPrice.trim();
    if (!name || !price) {
      toast.error(t.quickValidation);
      return;
    }

    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      toast.error(t.quickValidation);
      return;
    }

    setQuickSaving(true);
    try {
      const response = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: quickType,
          priceExcludingTax: eurosToCents(numericPrice),
          vatRate: 17,
          currency: 'EUR',
        }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.quickFailed);
      }

      setQuickName('');
      setQuickPrice('');
      await refreshAfterMutation();
    } catch (error) {
      toast.error(resolveTranslatedError(locale, error, t.quickFailed));
    } finally {
      setQuickSaving(false);
    }
  }

  const productCount = items.filter((item) => item.type === 'product').length;
  const serviceCount = items.filter((item) => item.type === 'service').length;
  const avgPriceExcludingTax =
    items.length === 0 ? 0 : Math.round(items.reduce((sum, item) => sum + item.priceExcludingTax, 0) / items.length);

  const columnOptions: Array<{ key: CatalogueTableColumnKey; label: string }> = [
    { key: 'type', label: t.columnType },
    { key: 'priceExcludingTax', label: t.columnPriceExcludingTax },
    { key: 'priceIncludingTax', label: t.columnPriceIncludingTax },
    { key: 'vatRate', label: t.columnVatRate },
    { key: 'addedDate', label: t.columnAddedDate },
    { key: 'description', label: t.columnDescription },
  ];

  return (
    <CrmShell title={t.shellTitle}>
      <section className="space-y-5">
        <div data-tour-catalogue-header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button type="button" data-tour-catalogue-new-item className="w-full sm:w-auto h-10" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            {t.newItem}
          </Button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-linear-to-br from-background via-background to-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.tabAll}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{pagination.total}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-linear-to-br from-background via-background to-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.type}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{productCount} / {serviceCount}</p>
            <p className="text-xs text-muted-foreground">{t.product} / {t.service}</p>
          </div>
          <div className="rounded-xl border border-border/70 bg-linear-to-br from-background via-background to-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.sortPrice}</p>
            <p className="mt-1 text-xl font-semibold"><PriceDisplay cents={avgPriceExcludingTax} /></p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/50 p-3 shadow-sm sm:p-4">
          <div data-tour-catalogue-quick-add className="rounded-lg border border-border/80 bg-background/70 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.quickCreateTitle}</p>
            <div className="grid gap-2 sm:grid-cols-[1.2fr_0.7fr_auto_auto]">
              <Input
                value={quickName}
                onChange={(event) => setQuickName(event.target.value)}
                placeholder={t.quickNamePlaceholder}
                className="h-9"
              />
              <Input
                value={quickPrice}
                onChange={(event) => setQuickPrice(event.target.value)}
                placeholder={t.quickPricePlaceholder}
                className="h-9"
                inputMode="decimal"
              />
              <Tabs value={quickType} onValueChange={(value) => setQuickType(value as 'product' | 'service')}>
                <TabsList className="h-9 border border-border/80 bg-transparent p-1">
                  <TabsTrigger
                    value="product"
                    className="px-3 text-xs hover:bg-transparent hover:text-foreground data-active:bg-primary data-active:text-primary-foreground"
                  >
                    {t.product}
                  </TabsTrigger>
                  <TabsTrigger
                    value="service"
                    className="px-3 text-xs hover:bg-transparent hover:text-foreground data-active:bg-primary data-active:text-primary-foreground"
                  >
                    {t.service}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Button type="button" className="h-9" onClick={() => void handleQuickCreate()} disabled={quickSaving}>
                {quickSaving ? t.quickAdding : t.quickAdd}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto_auto_auto] lg:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                data-tour-catalogue-search
                className="h-10 pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t.searchPlaceholder}
              />
            </div>

            <Input
              value={minPriceInput}
              onChange={(event) => setMinPriceInput(event.target.value)}
              placeholder={t.minPrice}
              className="h-10 w-full lg:w-28"
              inputMode="decimal"
            />

            <Input
              value={maxPriceInput}
              onChange={(event) => setMaxPriceInput(event.target.value)}
              placeholder={t.maxPrice}
              className="h-10 w-full lg:w-28"
              inputMode="decimal"
            />

            <DropdownMenu
              open={columnsOpen}
              onOpenChange={(next) => {
                setColumnsOpen(next);
                if (next) {
                  setDraftVisibleColumns(visibleColumns);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="h-10 w-full lg:w-auto">
                  <Columns3Icon className="size-4" />
                  {t.columns}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{t.visibleColumns}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnOptions.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={draftVisibleColumns[column.key]}
                    onCheckedChange={(checked) => toggleDraftColumn(column.key, Boolean(checked))}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <div className="flex gap-2 p-1">
                  <Button type="button" size="sm" variant="outline" className="h-8 flex-1" onClick={() => setColumnsOpen(false)}>
                    {t.cancelColumns}
                  </Button>
                  <Button type="button" size="sm" className="h-8 flex-1" onClick={applyColumns}>
                    {t.applyColumns}
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button type="button" variant="ghost" className="h-10" onClick={resetFilters}>
              {t.resetFilters}
            </Button>

            <div data-tour-catalogue-filters className="flex items-center gap-2 overflow-x-auto pb-0.5">
              <SortButton label={t.sortName} column="name" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <SortButton label={t.sortPrice} column="priceExcludingTax" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
              <SortButton label={t.sortDate} column="createdAt" sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            </div>
          </div>

          <Tabs
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value as CatalogueTypeFilter);
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
            <div data-tour-catalogue-table>
            <CatalogueTable
              items={items}
              loading={loading}
              sortBy={sortBy}
              sortOrder={sortOrder}
              visibleColumns={visibleColumns}
              onSort={handleSort}
              onEdit={openEdit}
              onQuickEdit={openQuickEdit}
              onDuplicate={handleDuplicateItem}
              onDelete={setDeleteItem}
              labels={{
                name: t.name,
                type: t.type,
                product: t.product,
                service: t.service,
                priceExcludingTax: t.priceExcludingTax,
                priceIncludingTax: t.priceIncludingTax,
                vatRate: t.vatRate,
                description: t.description,
                actions: t.actions,
                edit: t.edit,
                quickEdit: t.quickEdit,
                duplicate: t.duplicate,
                moreActions: t.moreActions,
                delete: t.delete,
                noDescription: t.noDescription,
                addedDate: t.addedDate,
              }}
            />
            </div>

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

      <Dialog open={Boolean(quickEditItem)} onOpenChange={(next) => (!next ? setQuickEditItem(null) : undefined)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md p-4 sm:p-5">
          <DialogHeader className="pr-8">
            <DialogTitle>{t.quickEditTitle}</DialogTitle>
            <DialogDescription>{t.quickEditDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{t.quickEditName}</p>
              <Input value={quickEditName} onChange={(event) => setQuickEditName(event.target.value)} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t.quickEditPrice}</p>
                <Input
                  value={quickEditPrice}
                  onChange={(event) => setQuickEditPrice(event.target.value)}
                  className="h-9"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">{t.quickEditVat}</p>
                <Input
                  value={quickEditVatRate}
                  onChange={(event) => setQuickEditVatRate(event.target.value)}
                  className="h-9"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => setQuickEditItem(null)}>
              {t.cancelColumns}
            </Button>
            <Button type="button" onClick={() => void saveQuickEdit()} disabled={quickEditSaving}>
              {quickEditSaving ? t.quickEditSaving : t.quickEditSave}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CrmShell>
  );
}
