'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import QuoteTable, { type QuoteListItem, type QuoteTableColumnKey } from '@/components/quotes/QuoteTable';
import SendQuoteModal from '@/components/quotes/SendQuoteModal';
import CrmShell from '@/components/crm-shell';
import { useQuotes, type QuoteStatusFilter } from '@/hooks/useQuotes';
import { useQuotesActionCount } from '@/hooks/useQuotesActionCount';
import { useLocale } from '@/components/providers/locale-provider';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import FinancialTotalsBar from '@/components/ui/FinancialTotalsBar';

const COLUMN_STORAGE_KEY = 'crm.quote.visibleColumns.v1';
const VIEW_STORAGE_KEY = 'crm.quote.viewConfig.v1';
const DEFAULT_VISIBLE_COLUMNS: Record<QuoteTableColumnKey, boolean> = {
  quoteNumber: true,
  client: true,
  subject: true,
  date: true,
  totalIncludingTax: true,
  status: true,
  invoiceLink: true,
};

function QuotesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = {
    en: {
      shellTitle: 'Quotes',
      heading: 'Quotes',
      subtitle: 'Track quote lifecycle from draft to decision.',
      backToDashboard: 'Dashboard',
      totalResults: 'total results',
      currentFilter: 'Current filter',
      deleteFailed: 'Failed to delete quote',
      deleted: 'Quote deleted',
      duplicated: 'Quote duplicated',
      duplicateFailed: 'Failed to duplicate quote',
      downloadFailed: 'Failed to download PDF',
      newQuote: 'New quote',
      search: 'Search by quote number or client name...',
      sortDate: 'Date',
      sortAmount: 'Amount',
      columns: 'Columns',
      visibleColumns: 'Visible columns',
      applyColumns: 'Apply',
      cancelColumns: 'Cancel',
      tabAll: 'All',
      tabDraft: 'Draft',
      tabSent: 'Sent',
      tabAccepted: 'Accepted',
      tabRejected: 'Rejected',
      empty: 'No quotes yet - create your first quote',
      quoteNumber: 'Quote',
      client: 'Client',
      subject: 'Subject',
      date: 'Date',
      totalIncludingTax: 'Total incl. tax',
      status: 'Status',
      invoiceLink: 'Invoice link',
      columnQuoteNumber: 'Quote',
      columnClient: 'Client',
      columnSubject: 'Subject',
      columnDate: 'Date',
      columnTotal: 'Total',
      columnStatus: 'Status',
      columnInvoiceLink: 'Invoice link',
      actions: 'Main action',
      quickActions: 'Quick actions',
      view: 'View',
      edit: 'Edit',
      duplicate: 'Duplicate',
      delete: 'Delete',
      downloadPdf: 'PDF',
      lockEdit: 'Accepted and rejected quotes cannot be edited',
      send: 'Send',
      sendForSignature: 'Send for signature',
      history: 'History',
      convertToInvoice: 'Convert to invoice',
      invoiced: 'Invoiced',
      markReviewed: 'Mark as reviewed',
      markReviewing: 'Marking...',
      deleteTitle: 'Delete quote?',
      deleteDescription: 'Are you sure you want to delete this quote?',
      cancel: 'Cancel',
      deleting: 'Deleting...',
      deleteQuote: 'Delete quote',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
      numberOfDocuments: 'Number of documents',
      totalHT: 'Total HT',
      totalTVA: 'Total TVA',
      totalTTC: 'Total TTC',
      totalAccepted: 'Total accepted',
      actionRejected: (n: number) => `${n} quote${n === 1 ? '' : 's'} declined — follow up or revise`,
      actionRejectedHint: 'Disappears when you mark each declined quote as “Reviewed”',
      actionAccepted: (n: number) => `${n} quote${n === 1 ? '' : 's'} accepted — ready to invoice`,
      actionAcceptedHint: 'Disappears when you convert to invoice',
      seeRejected: 'See declined',
      seeAccepted: 'See accepted',
    },
    fr: {
      shellTitle: 'Devis',
      heading: 'Devis',
      subtitle: 'Suivez le cycle des devis du brouillon à la décision.',
      backToDashboard: 'Tableau de bord',
      totalResults: 'résultats au total',
      currentFilter: 'Filtre actuel',
      deleteFailed: 'Impossible de supprimer le devis',
      deleted: 'Devis supprimé',
      duplicated: 'Devis dupliqué',
      duplicateFailed: 'Impossible de dupliquer le devis',
      downloadFailed: 'Impossible de télécharger le PDF',
      newQuote: 'Nouveau devis',
      search: 'Rechercher par numéro de devis ou nom client...',
      sortDate: 'Date',
      sortAmount: 'Montant',
      columns: 'Colonnes',
      visibleColumns: 'Colonnes visibles',
      applyColumns: 'Appliquer',
      cancelColumns: 'Annuler',
      tabAll: 'Tous',
      tabDraft: 'Brouillon',
      tabSent: 'Envoyé',
      tabAccepted: 'Accepté',
      tabRejected: 'Refusé',
      empty: 'Aucun devis - créez votre premier devis',
      quoteNumber: 'Devis',
      client: 'Client',
      subject: 'Objet',
      date: 'Date',
      totalIncludingTax: 'Total TTC',
      status: 'Statut',
      invoiceLink: 'Lien facture',
      columnQuoteNumber: 'Devis',
      columnClient: 'Client',
      columnSubject: 'Objet',
      columnDate: 'Date',
      columnTotal: 'Total',
      columnStatus: 'Statut',
      columnInvoiceLink: 'Lien facture',
      actions: 'Action principale',
      quickActions: 'Actions rapides',
      view: 'Voir',
      edit: 'Modifier',
      duplicate: 'Dupliquer',
      delete: 'Supprimer',
      downloadPdf: 'PDF',
      lockEdit: 'Les devis acceptés et refusés (client) ne peuvent pas être modifiés',
      send: 'Envoyer',
      sendForSignature: 'Envoyer pour signature',
      history: 'Historique',
      convertToInvoice: 'Convertir en facture',
      invoiced: 'Facture créée',
      markReviewed: 'Marquer comme traité',
      markReviewing: 'Enregistrement...',
      deleteTitle: 'Supprimer le devis ?',
      deleteDescription: 'Voulez-vous vraiment supprimer ce devis ?',
      cancel: 'Annuler',
      deleting: 'Suppression...',
      deleteQuote: 'Supprimer le devis',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Précédent',
      next: 'Suivant',
      numberOfDocuments: 'Nombre de documents',
      totalHT: 'Total HT',
      totalTVA: 'Total TVA',
      totalTTC: 'Total TTC',
      totalAccepted: 'Total accepte',
      actionRejected: (n: number) => `${n} devis refusé${n === 1 ? '' : 's'} par le client — à relancer ou réviser`,
      actionRejectedHint: 'Disparaît lorsque vous marquez chaque devis refusé comme « Traité »',
      actionAccepted: (n: number) => `${n} devis accepté${n === 1 ? '' : 's'} — prêt${n === 1 ? '' : 's'} à facturer`,
      actionAcceptedHint: 'Disparaît lorsque vous convertissez en facture',
      seeRejected: 'Voir refusés',
      seeAccepted: 'Voir acceptés',
    },
  }[locale];

  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [status, setStatus] = useState<QuoteStatusFilter>('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [visibleColumns, setVisibleColumns] = useState<Record<QuoteTableColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<Record<QuoteTableColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendTarget, setSendTarget] = useState<QuoteListItem | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const { quotes, pagination, loading, error, refetch } = useQuotes(status, searchDebounced, sort, page, limit);
  const {
    allCount,
    draftCount,
    sentCount,
    rejectedCount,
    acceptedCount,
    pendingInvoiceCount,
    unacknowledgedRejectedCount,
  } = useQuotesActionCount(pagination.total + quotes.length + Number(loading));

  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        searchInput?: string;
        status?: QuoteStatusFilter;
        sort?: 'date' | 'amount';
      };

      const nextSearchInput = typeof parsed.searchInput === 'string' ? parsed.searchInput : '';
      const nextStatus: QuoteStatusFilter =
        parsed.status === 'draft' || parsed.status === 'sent' || parsed.status === 'accepted' || parsed.status === 'rejected'
          ? parsed.status
          : 'all';
      const nextSort: 'date' | 'amount' = parsed.sort === 'amount' ? 'amount' : 'date';

      setSearchInput(nextSearchInput);
      setSearchDebounced(nextSearchInput.trim());
      setStatus(nextStatus);
      setSort(nextSort);
    } catch {
      // Ignore malformed persisted view config.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        VIEW_STORAGE_KEY,
        JSON.stringify({
          searchInput,
          status,
          sort,
        }),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [searchInput, sort, status]);

  async function handleAcknowledgeRejection(quote: QuoteListItem) {
    if (acknowledgingId) return;
    setAcknowledgingId(quote._id);
    try {
      await fetch(`/api/quotes/${quote._id}/acknowledge`, { method: 'POST' });
      await refetch();
    } finally {
      setAcknowledgingId(null);
    }
  }

  useEffect(() => {
    const rawStatus = searchParams.get('status')?.toLowerCase();
    if (!rawStatus) {
      return;
    }

    const normalizedStatus: QuoteStatusFilter =
      rawStatus === 'draft' || rawStatus === 'sent' || rawStatus === 'accepted' || rawStatus === 'rejected'
        ? rawStatus
        : rawStatus === 'refused' || rawStatus === 'refuse'
          ? 'rejected'
          : 'all';

    setStatus(normalizedStatus);
  }, [searchParams]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchDebounced(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, status, sort]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const pageIsOutOfRange = page > 1 && (pagination.totalPages === 0 || page > pagination.totalPages);
    if (!pageIsOutOfRange) {
      return;
    }

    setPage(Math.max(1, pagination.totalPages));
  }, [loading, page, pagination.totalPages]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(COLUMN_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as Partial<Record<QuoteTableColumnKey, boolean>>;
      const next = { ...DEFAULT_VISIBLE_COLUMNS, ...parsed };
      setVisibleColumns(next);
      setDraftVisibleColumns(next);
    } catch {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
      setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    }
  }, []);

  function toggleDraftColumn(column: QuoteTableColumnKey, checked: boolean) {
    setDraftVisibleColumns((prev) => ({ ...prev, [column]: checked }));
  }

  function applyColumns() {
    setVisibleColumns(draftVisibleColumns);
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(draftVisibleColumns));
    setColumnsOpen(false);
  }

  const columnOptions: Array<{ key: QuoteTableColumnKey; label: string }> = [
    { key: 'quoteNumber', label: t.columnQuoteNumber },
    { key: 'client', label: t.columnClient },
    { key: 'subject', label: t.columnSubject },
    { key: 'date', label: t.columnDate },
    { key: 'totalIncludingTax', label: t.columnTotal },
    { key: 'status', label: t.columnStatus },
    { key: 'invoiceLink', label: t.columnInvoiceLink },
  ];

  const formatDate = useCallback(
    (value: string) => {
      const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
      return new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
    },
    [locale]
  );

  async function handleDeleteQuote() {
    if (!deleteTarget?._id) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/quotes/${deleteTarget._id}`, { method: 'DELETE' });
      const payload = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.deleteFailed);
      }

      toast.success(t.deleted);
      setDeleteTarget(null);

      if (page > 1 && quotes.length === 1) {
        setPage((prev) => prev - 1);
      } else {
        await refetch();
      }
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : t.deleteFailed);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDownloadPdf(quote: QuoteListItem) {
    try {
      const response = await fetch(`/api/quotes/${quote._id}/pdf?locale=${locale}`, { credentials: 'include' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || t.downloadFailed);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${quote.quoteNumber}.pdf`;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.downloadFailed);
    }
  }

  async function handleDuplicateQuote(quote: QuoteListItem) {
    if (duplicatingId) return;
    setDuplicatingId(quote._id);
    try {
      const response = await fetch(`/api/quotes/${quote._id}/duplicate`, { method: 'POST' });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        data?: { _id?: string };
      };

      if (!response.ok || !payload.success || !payload.data?._id) {
        throw new Error(payload.message || t.duplicateFailed);
      }

      toast.success(t.duplicated);
      router.push(`/quotes/${payload.data._id}/edit`);
    } catch (duplicateError) {
      toast.error(duplicateError instanceof Error ? duplicateError.message : t.duplicateFailed);
    } finally {
      setDuplicatingId(null);
    }
  }

  function handleConvertFromList(quote: QuoteListItem) {
    router.push(`/quotes/${quote._id}?convert=1`);
  }

  const currentFilterLabel =
    status === 'all' ? t.tabAll : status === 'draft' ? t.tabDraft : status === 'sent' ? t.tabSent : status === 'accepted' ? t.tabAccepted : t.tabRejected;

  const quoteMetrics = useMemo(() => {
    const totalHT = quotes.reduce((sum, quote) => sum + Math.max(0, Math.round(quote.totalExcludingTax ?? 0)), 0);
    const totalTVA = quotes.reduce((sum, quote) => sum + Math.max(0, Math.round(quote.totalVat ?? 0)), 0);
    const totalTTC = quotes.reduce((sum, quote) => sum + Math.max(0, Math.round(quote.totalIncludingTax ?? 0)), 0);
    const totalAccepted = quotes.reduce(
      (sum, quote) => sum + (quote.status === 'accepted' ? Math.max(0, Math.round(quote.totalIncludingTax ?? 0)) : 0),
      0
    );

    return [
      { key: 'doc-count', label: t.numberOfDocuments, value: quotes.length, kind: 'count' as const },
      { key: 'total-ht', label: t.totalHT, value: totalHT, kind: 'currency' as const },
      { key: 'total-tva', label: t.totalTVA, value: totalTVA, kind: 'currency' as const },
      { key: 'total-ttc', label: t.totalTTC, value: totalTTC, kind: 'currency' as const },
      { key: 'total-accepted', label: t.totalAccepted, value: totalAccepted, kind: 'currency' as const, tone: 'success' as const },
    ];
  }, [quotes, t.numberOfDocuments, t.totalAccepted, t.totalHT, t.totalTTC, t.totalTVA]);

  return (
    <CrmShell title={t.shellTitle}>
      <section className="space-y-5">
        <div data-tour-quotes-header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button type="button" className="w-full sm:w-auto h-10" data-tour-new-quote asChild>
            <Link href="/quotes/new">
              <PlusIcon className="size-4" />
              {t.newQuote}
            </Link>
          </Button>
        </div>

        <div data-tour-quotes-filters className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-muted-foreground">
              {pagination.total} {t.totalResults}
            </span>
            <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-muted-foreground">
              {t.currentFilter}: {currentFilterLabel}
            </span>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-10 pl-9" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t.search} />
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value === 'amount' ? 'amount' : 'date')}>
              <SelectTrigger className="h-9 w-full sm:w-40">
                <SelectValue placeholder={t.sortDate} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t.sortDate}</SelectItem>
                <SelectItem value="amount">{t.sortAmount}</SelectItem>
              </SelectContent>
            </Select>
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
                <Button data-tour-quotes-columns type="button" variant="outline" className="h-9 w-full sm:w-auto">{t.columns}</Button>
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
          </div>

          <Tabs value={status} onValueChange={(value) => setStatus(value as QuoteStatusFilter)}>
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="inline-flex h-auto min-w-max items-center gap-1 rounded-lg border border-border/80 bg-muted/10 p-1 shadow-xs">
                <TabsTrigger value="all" className="min-h-6 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabAll}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {allCount > 99 ? '99+' : allCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="draft" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabDraft}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {draftCount > 99 ? '99+' : draftCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="sent" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabSent}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {sentCount > 99 ? '99+' : sentCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="accepted" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabAccepted}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {acceptedCount > 99 ? '99+' : acceptedCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabRejected}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {rejectedCount > 99 ? '99+' : rejectedCount}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {error ? <ErrorMessage message={error} /> : null}

        {!loading && (status === 'all' || status === 'rejected' || status === 'accepted') &&
          (unacknowledgedRejectedCount > 0 || pendingInvoiceCount > 0) ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {unacknowledgedRejectedCount > 0 && status !== 'accepted' ? (
              <button
                type="button"
                onClick={() => setStatus('rejected')}
                className="flex w-full flex-col gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-left transition-colors hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/30 dark:hover:bg-orange-950/50 sm:flex-1 sm:basis-64 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-orange-500" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-orange-800 dark:text-orange-300">{t.actionRejected(unacknowledgedRejectedCount)}</span>
                    <span className="mt-0.5 block text-[11px] text-orange-600/80 dark:text-orange-400/70">{t.actionRejectedHint}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-orange-700 underline underline-offset-2 dark:text-orange-400">{t.seeRejected} →</span>
              </button>
            ) : null}
            {pendingInvoiceCount > 0 && status !== 'rejected' ? (
              <button
                type="button"
                onClick={() => setStatus('accepted')}
                className="flex w-full flex-col gap-1.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-left transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:hover:bg-green-950/50 sm:flex-1 sm:basis-64 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-green-800 dark:text-green-300">{t.actionAccepted(pendingInvoiceCount)}</span>
                    <span className="mt-0.5 block text-[11px] text-green-600/80 dark:text-green-400/70">{t.actionAcceptedHint}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-green-700 underline underline-offset-2 dark:text-green-400">{t.seeAccepted} →</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && quotes.length === 0 ? (
          <EmptyState message={t.empty} actionLabel={t.newQuote} onAction={() => router.push('/quotes/new')} />
        ) : (
          <>
            <div data-tour-quotes-table>
            <QuoteTable
              items={quotes}
              loading={loading}
              visibleColumns={visibleColumns}
              formatDate={formatDate}
              onDelete={setDeleteTarget}
              onDownload={handleDownloadPdf}
              labels={{
                quoteNumber: t.quoteNumber,
                client: t.client,
                subject: t.subject,
                date: t.date,
                totalIncludingTax: t.totalIncludingTax,
                status: t.status,
                invoiceLink: t.invoiceLink,
                actions: t.actions,
                quickActions: t.quickActions,
                view: t.view,
                edit: t.edit,
                duplicate: t.duplicate,
                delete: t.delete,
                downloadPdf: t.downloadPdf,
                lockEdit: t.lockEdit,
                send: t.send,
                sendForSignature: t.sendForSignature,
                history: t.history,
                convertToInvoice: t.convertToInvoice,
                invoiced: t.invoiced,
                markReviewed: t.markReviewed,
                markReviewing: t.markReviewing,
              }}
              locale={locale as 'en' | 'fr'}
              onDuplicate={handleDuplicateQuote}
              onSend={setSendTarget}
              onConvert={handleConvertFromList}
              onAcknowledge={handleAcknowledgeRejection}
              duplicatingId={duplicatingId}
              acknowledgingId={acknowledgingId}
            />
            </div>

            <div data-tour-quotes-totals>
              <FinancialTotalsBar metrics={quoteMetrics} locale={locale as 'en' | 'fr'} />
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {t.page} {pagination.page} {t.of} {Math.max(pagination.totalPages, 1)} - {pagination.total} {t.total}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((prev) => prev - 1)}>
                  {t.previous}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  {t.next}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(next) => (!next ? setDeleteTarget(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={isDeleting}>{t.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" onClick={handleDeleteQuote} disabled={isDeleting}>
                {isDeleting ? t.deleting : t.deleteQuote}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sendTarget ? (
        <SendQuoteModal
          open={Boolean(sendTarget)}
          onOpenChange={(next) => (!next ? setSendTarget(null) : undefined)}
          quoteId={sendTarget._id}
          quoteNumber={sendTarget.quoteNumber}
          clientEmail={sendTarget.clientSnapshot.email}
          clientName={sendTarget.clientSnapshot.fullName}
          companyName={undefined}
          quoteStatus={sendTarget.status}
          locale={locale as 'en' | 'fr'}
          onSent={() => {
            refetch();
          }}
        />
      ) : null}
    </CrmShell>
  );
}

export default function QuotesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement...</div>}>
      <QuotesPageContent />
    </Suspense>
  );
}
