'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Loader2Icon, PlusIcon, SearchIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';

import InvoiceTable, { type InvoiceTableColumnKey } from '@/components/invoices/InvoiceTable';
import SendInvoiceModal from '@/components/invoices/SendInvoiceModal';
import SendReminderModal from '@/components/invoices/SendReminderModal';
import CrmShell from '@/components/crm-shell';
import KpiCards, { type KpiCard } from '@/components/ui/KpiCards';
import { useLocale } from '@/components/providers/locale-provider';
import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInvoices, type InvoiceListItem, type InvoiceStatusFilter } from '@/hooks/useInvoices';
import { useInvoicesActionCount } from '@/hooks/useInvoicesActionCount';
import FinancialTotalsBar from '@/components/ui/FinancialTotalsBar';

const COLUMN_STORAGE_KEY = 'crm.invoice.visibleColumns.v1';
const VIEW_STORAGE_KEY = 'crm.invoice.viewConfig.v1';
const DEFAULT_VISIBLE_COLUMNS: Record<InvoiceTableColumnKey, boolean> = {
  invoiceNumber: true,
  client: true,
  date: true,
  dueDate: true,
  totalIncludingTax: true,
  amountPaid: true,
  remainingAmount: true,
  paymentProgress: true,
  depositAmount: true,
  depositPaymentDate: true,
  status: true,
};

function InvoicesPageContent() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = {
    en: {
      shellTitle: 'Invoices',
      heading: 'Invoices',
      subtitle: 'Track billing, urgency, and payment collection from one place.',
      totalResults: 'total results',
      currentFilter: 'Current filter',
      deleteFailed: 'Failed to delete invoice',
      deleted: 'Invoice deleted',
      downloadFailed: 'Failed to download PDF',
      newInvoice: 'New invoice',
      search: 'Search by invoice number or client name...',
      sortDate: 'Date',
      sortAmount: 'Amount',
      columns: 'Columns',
      visibleColumns: 'Visible columns',
      applyColumns: 'Apply',
      cancelColumns: 'Cancel',
      tabAll: 'All',
      tabUnpaid: 'Unpaid',
      tabInitialPaid: 'Partially paid',
      tabPaid: 'Paid',
      tabOverdue: 'Overdue',
      empty: 'No invoices yet - create your first invoice',
      invoiceNumber: 'Invoice number',
      client: 'Client',
      date: 'Date',
      dueDate: 'Due date',
      totalIncludingTax: 'Total incl. tax',
      amountPaid: 'Amount paid',
      remainingAmount: 'Remaining amount',
      paymentProgress: 'Paid',
      depositAmount: 'Deposit',
      depositPaymentDate: 'Deposit paid',
      status: 'Status',
      columnInvoiceNumber: 'Invoice',
      columnClient: 'Client',
      columnDate: 'Date',
      columnDueDate: 'Due date',
      columnTotal: 'Total',
      columnAmountPaid: 'Paid',
      columnRemaining: 'Remaining',
      columnProgress: 'Progress',
      columnDeposit: 'Deposit',
      columnDepositPaid: 'Deposit paid',
      columnStatus: 'Status',
      actions: 'Actions',
      quickActions: 'Main action',
      view: 'View',
      edit: 'Edit',
      send: 'Send',
      sendInvoice: 'Send invoice',
      sendReminder: 'Send reminder',
      downloadPdf: 'Download PDF',
      delete: 'Delete',
      deleteTitle: 'Delete invoice?',
      deleteDescription: 'Are you sure you want to delete this invoice?',
      cancel: 'Cancel',
      deleting: 'Deleting...',
      deleteInvoice: 'Delete invoice',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
      numberOfDocuments: 'Number of documents',
      totalHT: 'Total HT',
      totalTVA: 'Total TVA',
      totalTTC: 'Total TTC',
      totalPaid: 'Total paid',
      totalDue: 'Total due',
      actionOverdue: (n: number) => `${n} invoice${n === 1 ? '' : 's'} overdue — collect now`,
      actionOverdueHint: 'Disappears when invoice is paid',
      actionInitialPaid: (n: number) => `${n} invoice${n === 1 ? '' : 's'} partially paid — remaining balance due`,
      actionInitialPaidHint: 'Disappears when fully paid',
      seeOverdue: 'See overdue',
      seeInitialPaid: 'See partially paid',
      markAsPaid: 'Add payment',
      markingAsPaid: 'Recording...',
      bulkReminderTitle: 'Send reminder to selected',
      bulkReminderDescription: 'Choose reminder level, then send sequentially to avoid SMTP rate limits.',
      bulkLevelAuto: 'Auto — next logical level per invoice',
      bulkLevel1: 'Level 1 — soft reminder',
      bulkLevel2: 'Level 2 — medium reminder',
      bulkLevel3: 'Level 3 — firm reminder',
      bulkProcessed: (done: number, total: number) => `${done}/${total} processed`,
      bulkSuccessFailed: (success: number, failed: number) => `Success: ${success} · Failed: ${failed}`,
      bulkCancel: 'Cancel',
      bulkSending: 'Sending...',
      bulkStart: 'Start sending',
      bulkSendButton: 'Send reminder to selected',
      bulkClear: 'Clear',
      bulkExport: 'Export selected',
      bulkDone: 'Reminders sent',
      bulkPartial: (success: number, failed: number) => `${success} succeeded, ${failed} failed`,
      bulkNoEligible: 'No eligible invoices in the selection (paid invoices and those without a client email are skipped).',
      bulkSkippedSummary: (skipped: number) => `${skipped} invoice(s) skipped (paid or missing client email).`,
      kpiUnpaid: 'Unpaid',
      kpiPaid: 'Paid',
      kpiOverdue: 'Overdue',
      kpiAll: 'Invoices issued',
      kpiTotalTTC: 'Total TTC',
      kpiTotalHT: 'Total HT',
      kpiTotalVAT: 'Total VAT',
    },
    fr: {
      shellTitle: 'Factures',
      heading: 'Factures',
      subtitle: "Suivez la facturation, les urgences et l'encaissement au même endroit.",
      totalResults: 'résultats au total',
      currentFilter: 'Filtre actuel',
      deleteFailed: 'Impossible de supprimer la facture',
      deleted: 'Facture supprimée',
      downloadFailed: 'Impossible de télécharger le PDF',
      newInvoice: 'Nouvelle facture',
      search: 'Rechercher par numéro de facture ou nom client...',
      sortDate: 'Date',
      sortAmount: 'Montant',
      columns: 'Colonnes',
      visibleColumns: 'Colonnes visibles',
      applyColumns: 'Appliquer',
      cancelColumns: 'Annuler',
      tabAll: 'Tous',
      tabUnpaid: 'Impayées',
      tabInitialPaid: 'Partiellement payées',
      tabPaid: 'Payées',
      tabOverdue: 'En retard',
      empty: 'Aucune facture - créez votre première facture',
      invoiceNumber: 'Numéro',
      client: 'Client',
      date: 'Date',
      dueDate: 'Échéance',
      totalIncludingTax: 'Total TTC',
      amountPaid: 'Montant payé',
      remainingAmount: 'Reste à payer',
      paymentProgress: 'Payé',
      depositAmount: 'Acompte',
      depositPaymentDate: 'Acompte payé',
      status: 'Statut',
      columnInvoiceNumber: 'Facture',
      columnClient: 'Client',
      columnDate: 'Date',
      columnDueDate: 'Échéance',
      columnTotal: 'Total',
      columnAmountPaid: 'Payé',
      columnRemaining: 'Reste',
      columnProgress: 'Progression',
      columnDeposit: 'Acompte',
      columnDepositPaid: 'Acompte payé',
      columnStatus: 'Statut',
      actions: 'Actions',
      quickActions: 'Action principale',
      view: 'Voir',
      edit: 'Modifier',
      send: 'Envoyer',
      sendInvoice: 'Envoyer facture',
      sendReminder: 'Envoyer rappel',
      downloadPdf: 'Télécharger PDF',
      delete: 'Supprimer',
      deleteTitle: 'Supprimer la facture ?',
      deleteDescription: 'Voulez-vous vraiment supprimer cette facture ?',
      cancel: 'Annuler',
      deleting: 'Suppression...',
      deleteInvoice: 'Supprimer la facture',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Précédent',
      next: 'Suivant',
      numberOfDocuments: 'Nombre de documents',
      totalHT: 'Total HT',
      totalTVA: 'Total TVA',
      totalTTC: 'Total TTC',
      totalPaid: 'Total paye',
      totalDue: 'Total reste',
      actionOverdue: (n: number) => `${n} facture${n === 1 ? '' : 's'} en retard — encaissez maintenant`,
      actionOverdueHint: 'Disparaît lorsque la facture est marquée comme payée',
      actionInitialPaid: (n: number) => `${n} facture${n === 1 ? '' : 's'} partiellement payée(s)`,
      actionInitialPaidHint: 'Disparaît lorsque la facture est intégralement payée',
      seeOverdue: 'Voir en retard',
      seeInitialPaid: 'Voir paiements partiels',
      markAsPaid: 'Ajouter un paiement',
      markingAsPaid: 'Enregistrement...',
      bulkReminderTitle: 'Envoyer des relances',
      bulkReminderDescription: 'Choisissez le niveau à envoyer, puis lancez en séquence pour éviter les limites SMTP.',
      bulkLevelAuto: 'Auto — prochain niveau logique par facture',
      bulkLevel1: 'Niveau 1 — relance amicale',
      bulkLevel2: 'Niveau 2 — relance intermédiaire',
      bulkLevel3: 'Niveau 3 — relance ferme',
      bulkProcessed: (done: number, total: number) => `${done}/${total} traitées`,
      bulkSuccessFailed: (success: number, failed: number) => `Succès : ${success} · Échecs : ${failed}`,
      bulkCancel: 'Annuler',
      bulkSending: 'Envoi...',
      bulkStart: 'Lancer l\'envoi',
      bulkSendButton: 'Envoyer relance',
      bulkClear: 'Effacer',
      bulkExport: 'Exporter la sélection',
      bulkDone: 'Relances envoyées',
      bulkPartial: (success: number, failed: number) => `${success} réussie(s), ${failed} échec(s)`,
      bulkNoEligible: 'Aucune facture éligible dans la sélection (les factures payées ou sans e-mail client sont ignorées).',
      bulkSkippedSummary: (skipped: number) => `${skipped} facture(s) ignorée(s) (payées ou e-mail client manquant).`,
      kpiUnpaid: 'Impayées',
      kpiPaid: 'Payées',
      kpiOverdue: 'En retard',
      kpiAll: 'Factures émises',
      kpiTotalTTC: 'Total TTC',
      kpiTotalHT: 'Total HT',
      kpiTotalVAT: 'Total TVA',
    },
  }[locale];

  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [status, setStatus] = useState<InvoiceStatusFilter>('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [page, setPage] = useState(1);
  const limit = 10;
  const [visibleColumns, setVisibleColumns] = useState<Record<InvoiceTableColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [draftVisibleColumns, setDraftVisibleColumns] = useState<Record<InvoiceTableColumnKey, boolean>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendTarget, setSendTarget] = useState<InvoiceListItem | null>(null);
  const [reminderTarget, setReminderTarget] = useState<InvoiceListItem | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [bulkReminderOpen, setBulkReminderOpen] = useState(false);
  const [bulkReminderMode, setBulkReminderMode] = useState<'auto' | '1' | '2' | '3'>('auto');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; success: number; failed: number }>({
    done: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const { invoices, pagination, loading, error, refetch } = useInvoices(status, searchDebounced, sort, page, limit);
  const { allCount, unpaidCount, partialPaidCount, paidCount, overdueCount } = useInvoicesActionCount(
    pagination.total + invoices.length + Number(loading)
  );

  // ── KPI data ──────────────────────────────────────────────────────────────
  const [kpiData, setKpiData] = useState<{
    all: { count: number; totalTTC: number };
    unpaid: { count: number; totalTTC: number };
    paid: { count: number; totalTTC: number };
    overdue: { count: number; totalTTC: number };
    totals: { totalHT: number; totalVat: number; totalTTC: number };
  } | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);

  const invoiceKpiRefreshKey = useMemo(
    () =>
      `${pagination.total}:${loading ? '1' : '0'}:${invoices
        .map((invoice) => `${invoice._id}:${invoice.status}:${invoice.totalIncludingTax}:${invoice.amountPaid ?? 0}:${invoice.remainingAmount ?? 0}`)
        .join('|')}`,
    [invoices, loading, pagination.total]
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchKpis() {
      setKpiLoading(true);
      try {
        const res = await fetch('/api/invoices/kpis', { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const payload = await res.json() as { success?: boolean; data?: typeof kpiData };
        if (!cancelled && payload.success && payload.data) {
          setKpiData(payload.data);
        }
      } catch {
        // Silently ignore
      } finally {
        if (!cancelled) setKpiLoading(false);
      }
    }
    void fetchKpis();
    return () => { cancelled = true; };
  }, [invoiceKpiRefreshKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as {
        searchInput?: string;
        status?: InvoiceStatusFilter;
        sort?: 'date' | 'amount';
      };

      const nextSearchInput = typeof parsed.searchInput === 'string' ? parsed.searchInput : '';
      const nextStatus: InvoiceStatusFilter =
        parsed.status === 'unpaid' || parsed.status === 'partial_paid' || parsed.status === 'paid' || parsed.status === 'overdue'
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
    setSelectedInvoiceIds((prev) => prev.filter((id) => invoices.some((invoice) => invoice._id === id)));
  }, [invoices]);

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

      const parsed = JSON.parse(raw) as Partial<Record<InvoiceTableColumnKey, boolean>>;
      const next = { ...DEFAULT_VISIBLE_COLUMNS, ...parsed };
      setVisibleColumns(next);
      setDraftVisibleColumns(next);
    } catch {
      setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
      setDraftVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
    }
  }, []);

  function toggleDraftColumn(column: InvoiceTableColumnKey, checked: boolean) {
    setDraftVisibleColumns((prev) => ({ ...prev, [column]: checked }));
  }

  function applyColumns() {
    setVisibleColumns(draftVisibleColumns);
    window.localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(draftVisibleColumns));
    setColumnsOpen(false);
  }

  const hasDepositColumnsAvailable = invoices.some((invoice) => (invoice.depositAmount ?? 0) > 0 || Boolean(invoice.depositPaidAt));

  const columnOptions: Array<{ key: InvoiceTableColumnKey; label: string }> = [
    { key: 'client', label: t.columnClient },
    { key: 'date', label: t.columnDate },
    { key: 'dueDate', label: t.columnDueDate },
    { key: 'totalIncludingTax', label: t.columnTotal },
    { key: 'amountPaid', label: t.columnAmountPaid },
    { key: 'remainingAmount', label: t.columnRemaining },
    { key: 'paymentProgress', label: t.columnProgress },
    ...(hasDepositColumnsAvailable
      ? ([
          { key: 'depositAmount', label: t.columnDeposit },
          { key: 'depositPaymentDate', label: t.columnDepositPaid },
        ] as Array<{ key: InvoiceTableColumnKey; label: string }>)
      : []),
    { key: 'status', label: t.columnStatus },
  ];

  const formatDate = useCallback(
    (value: string | null | undefined) => {
      if (!value) {
        return '—';
      }

      const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
      return new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
    },
    [locale]
  );

  async function handleDeleteInvoice() {
    if (!deleteTarget?._id) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/invoices/${deleteTarget._id}`, { method: 'DELETE' });
      const payload = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.deleteFailed);
      }

      toast.success(t.deleted);
      setDeleteTarget(null);

      if (page > 1 && invoices.length === 1) {
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

  async function handleDownloadPdf(invoice: InvoiceListItem) {
    try {
      const response = await fetch(`/api/invoices/${invoice._id}/pdf?locale=${locale}`, { credentials: 'include' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || t.downloadFailed);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${formatInvoiceDisplayNumber(locale as 'en' | 'fr', invoice.invoiceNumber)}.pdf`;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : t.downloadFailed);
    }
  }

  const currentFilterLabel =
    status === 'all'
      ? t.tabAll
      : status === 'unpaid'
        ? t.tabUnpaid
        : status === 'partial_paid'
          ? t.tabInitialPaid
          : status === 'paid'
            ? t.tabPaid
            : t.tabOverdue;

  const invoiceMetrics = useMemo(() => {
    const totalHT = invoices.reduce((sum, invoice) => sum + Math.max(0, Math.round(invoice.totalExcludingTax ?? 0)), 0);
    const totalTVA = invoices.reduce((sum, invoice) => sum + Math.max(0, Math.round(invoice.totalVat ?? 0)), 0);
    const totalTTC = invoices.reduce((sum, invoice) => sum + Math.max(0, Math.round(invoice.totalIncludingTax ?? 0)), 0);
    const totalPaid = invoices.reduce((sum, invoice) => sum + Math.max(0, Math.round(invoice.amountPaid ?? 0)), 0);
    const totalDue = invoices.reduce(
      (sum, invoice) =>
        sum +
        Math.max(
          0,
          Math.round(
            invoice.remainingAmount ?? Math.max(0, Math.round(invoice.totalIncludingTax ?? 0) - Math.round(invoice.amountPaid ?? 0))
          )
        ),
      0
    );

    return [
      { key: 'doc-count', label: t.numberOfDocuments, value: invoices.length, kind: 'count' as const },
      { key: 'total-ht', label: t.totalHT, value: totalHT, kind: 'currency' as const },
      { key: 'total-tva', label: t.totalTVA, value: totalTVA, kind: 'currency' as const },
      { key: 'total-ttc', label: t.totalTTC, value: totalTTC, kind: 'currency' as const },
      { key: 'total-paid', label: t.totalPaid, value: totalPaid, kind: 'currency' as const, tone: 'success' as const },
      { key: 'total-due', label: t.totalDue, value: totalDue, kind: 'currency' as const, tone: 'danger' as const },
    ];
  }, [invoices, t.numberOfDocuments, t.totalDue, t.totalHT, t.totalPaid, t.totalTTC, t.totalTVA]);

  const selectedInvoices = useMemo(
    () => invoices.filter((invoice) => selectedInvoiceIds.includes(invoice._id)),
    [invoices, selectedInvoiceIds]
  );

  const invoiceKpiCards = useMemo<KpiCard[]>(() => {
    if (!kpiData) return [];
    return [
      {
        key: 'kpi-unpaid',
        label: t.kpiUnpaid,
        count: kpiData.unpaid.count,
        amount: kpiData.unpaid.totalTTC,
        variant: 'red-bold',
        icon: 'receipt',
        active: status === 'unpaid',
        onClick: () => setStatus('unpaid'),
      },
      {
        key: 'kpi-all',
        label: t.kpiAll,
        count: kpiData.all.count,
        amount: kpiData.all.totalTTC,
        variant: 'slate',
        icon: 'file-text',
        active: status === 'all',
        onClick: () => setStatus('all'),
      },
      {
        key: 'kpi-paid',
        label: t.kpiPaid,
        count: kpiData.paid.count,
        amount: kpiData.paid.totalTTC,
        variant: 'green',
        icon: 'check-circle',
        active: status === 'paid',
        onClick: () => setStatus('paid'),
      },
      {
        key: 'kpi-overdue',
        label: t.kpiOverdue,
        count: kpiData.overdue.count,
        amount: kpiData.overdue.totalTTC,
        variant: 'red-bold',
        icon: 'alert-triangle',
        active: status === 'overdue',
        onClick: () => setStatus('overdue'),
      },
    ];
  }, [kpiData, status, t.kpiAll, t.kpiOverdue, t.kpiPaid, t.kpiUnpaid]);

  const invoiceKpiTotalsCards = useMemo<KpiCard[]>(() => {
    if (!kpiData) return [];
    return [
      {
        key: 'kpi-ttc',
        label: t.kpiTotalTTC,
        amount: kpiData.totals.totalTTC,
        variant: 'slate',
        icon: 'dollar',
      },
      {
        key: 'kpi-ht',
        label: t.kpiTotalHT,
        amount: kpiData.totals.totalHT,
        variant: 'slate',
        icon: 'bar-chart',
      },
      {
        key: 'kpi-vat',
        label: t.kpiTotalVAT,
        amount: kpiData.totals.totalVat,
        variant: 'slate',
      },
    ];
  }, [kpiData, t.kpiTotalHT, t.kpiTotalTTC, t.kpiTotalVAT]);

  function getNextReminderLevel(level: number | null | undefined): 1 | 2 | 3 | 4 {
    const normalized = Number.isFinite(level) ? Math.max(0, Math.min(4, Math.round(Number(level)))) : 0;

    if (normalized <= 0) {
      return 1;
    }

    if (normalized === 1) {
      return 2;
    }

    if (normalized === 2) {
      return 3;
    }

    return 4;
  }

  function resolveBulkReminderLevel(invoice: InvoiceListItem): 1 | 2 | 3 | 4 {
    if (bulkReminderMode === '1' || bulkReminderMode === '2' || bulkReminderMode === '3') {
      return Number(bulkReminderMode) as 1 | 2 | 3;
    }

    return getNextReminderLevel(invoice.reminderState?.level);
  }

  async function sendReminderToSelectedSequentially() {
    if (selectedInvoices.length === 0 || bulkSending) {
      return;
    }

    // Pre-filter: skip invoices the backend will reject so users don't
    // see post-click errors on predictable state (paid, missing email,
    // or a bulk-chosen level that requires overdue but isn't overdue).
    const eligibleInvoices = selectedInvoices.filter((invoice) => {
      if (invoice.status === 'paid') return false;
      if (!invoice.clientSnapshot?.email?.trim()) return false;
      // Formal notice (level 4) is no longer gated by overdue status — behavior is consistent
      // with reminders 1–3, and the UI surfaces a warning when not yet overdue.
      return true;
    });

    const skippedCount = selectedInvoices.length - eligibleInvoices.length;

    if (eligibleInvoices.length === 0) {
      toast.error(t.bulkNoEligible);
      return;
    }

    if (skippedCount > 0) {
      toast.warning(t.bulkSkippedSummary(skippedCount));
    }

    setBulkSending(true);
    setBulkProgress({ done: 0, total: eligibleInvoices.length, success: 0, failed: 0 });

    let success = 0;
    let failed = 0;
    const failureMessages: string[] = [];

    for (let index = 0; index < eligibleInvoices.length; index += 1) {
      const invoice = eligibleInvoices[index];
      const level = resolveBulkReminderLevel(invoice);

      try {
        const response = await fetch(`/api/invoices/${invoice._id}/reminders/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, locale }),
        });

        const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.message || 'Failed to send reminder');
        }

        success += 1;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('reminder-logs:refresh', { detail: { invoiceId: invoice._id } })
          );
        }
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        failureMessages.push(`${formatInvoiceDisplayNumber(locale as 'en' | 'fr', invoice.invoiceNumber)}: ${message}`);
      } finally {
        setBulkProgress({ done: index + 1, total: eligibleInvoices.length, success, failed });
      }
    }

    if (failed === 0) {
      toast.success(t.bulkDone);
    } else {
      toast.error(t.bulkPartial(success, failed), {
        description: failureMessages.slice(0, 5).join('\n'),
      });
    }

    setBulkSending(false);
    setBulkReminderOpen(false);
    setSelectedInvoiceIds([]);
    await refetch();
  }

  return (
    <CrmShell title={t.shellTitle}>
      <section className="space-y-5">
        <div data-tour-invoices-header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button type="button" className="h-10 w-full sm:w-auto" data-tour-new-invoice asChild>
            <Link href="/invoices/new">
              <PlusIcon className="size-4" />
              {t.newInvoice}
            </Link>
          </Button>
        </div>

        {/* ── KPI cards row 1: per-status ───────────────────────────────────── */}
        <div className="space-y-3">
          <KpiCards cards={invoiceKpiCards} locale={locale as 'en' | 'fr'} loading={kpiLoading} />
          {!kpiLoading && invoiceKpiTotalsCards.length > 0 ? <KpiCards cards={invoiceKpiTotalsCards} locale={locale as 'en' | 'fr'} cols={3} /> : null}
        </div>

        <div data-tour-invoices-filters className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
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
                <Button data-tour-invoices-columns type="button" variant="outline" className="h-9 w-full sm:w-auto">{t.columns}</Button>
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

          <Tabs value={status} onValueChange={(value) => setStatus(value as InvoiceStatusFilter)}>
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="inline-flex h-auto min-w-max items-center gap-1 rounded-lg border border-border/80 bg-muted/10 p-1 shadow-xs">
                <TabsTrigger value="all" className="min-h-6 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabAll}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {allCount > 99 ? '99+' : allCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="unpaid" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabUnpaid}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-500 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {unpaidCount > 99 ? '99+' : unpaidCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="partial_paid" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabInitialPaid}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {partialPaidCount > 99 ? '99+' : partialPaidCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="paid" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabPaid}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-green-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {paidCount > 99 ? '99+' : paidCount}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="overdue" className="min-h-6 rounded-md border border-border/80 px-3 py-1.5 text-sm font-medium text-foreground/85 hover:bg-muted/60 hover:text-foreground data-active:border-primary/10 data-active:bg-primary data-active:text-primary-foreground data-active:shadow-sm">
                  <span>{t.tabOverdue}</span>
                  <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                    {overdueCount > 99 ? '99+' : overdueCount}
                  </span>
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {error ? <ErrorMessage message={error} /> : null}

        {/* ── Action-required banners ────────────────────────────────────────── */}
        {!loading && (status === 'all' || status === 'overdue' || status === 'partial_paid') &&
          (overdueCount > 0 || partialPaidCount > 0) ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {overdueCount > 0 && status !== 'partial_paid' ? (
              <button
                type="button"
                onClick={() => setStatus('overdue')}
                className="flex w-full flex-col gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:hover:bg-red-950/50 sm:flex-1 sm:basis-64 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-red-800 dark:text-red-300">{t.actionOverdue(overdueCount)}</span>
                    <span className="mt-0.5 block text-[11px] text-red-600/80 dark:text-red-400/70">{t.actionOverdueHint}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-red-700 underline underline-offset-2 dark:text-red-400">{t.seeOverdue} →</span>
              </button>
            ) : null}
            {partialPaidCount > 0 && status !== 'overdue' ? (
              <button
                type="button"
                onClick={() => setStatus('partial_paid')}
                className="flex w-full flex-col gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition-colors hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 sm:flex-1 sm:basis-64 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex size-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
                  </span>
                  <div>
                    <span className="block text-sm font-semibold text-amber-800 dark:text-amber-300">{t.actionInitialPaid(partialPaidCount)}</span>
                    <span className="mt-0.5 block text-[11px] text-amber-600/80 dark:text-amber-400/70">{t.actionInitialPaidHint}</span>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-amber-700 underline underline-offset-2 dark:text-amber-400">{t.seeInitialPaid} →</span>
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && invoices.length === 0 ? (
          <EmptyState message={t.empty} actionLabel={t.newInvoice} onAction={() => router.push('/invoices/new')} />
        ) : (
          <>
            <div data-tour-invoices-table>
            <InvoiceTable
              items={invoices}
              loading={loading}
              formatDate={formatDate}
              onDelete={setDeleteTarget}
              onDownload={handleDownloadPdf}
              onSend={setSendTarget}
              onSendReminder={setReminderTarget}
              selectedInvoiceIds={selectedInvoiceIds}
              onToggleInvoiceSelection={(invoiceId, checked) => {
                setSelectedInvoiceIds((prev) => {
                  if (checked) {
                    return prev.includes(invoiceId) ? prev : [...prev, invoiceId];
                  }

                  return prev.filter((id) => id !== invoiceId);
                });
              }}
              onToggleSelectAllVisible={(checked) => {
                setSelectedInvoiceIds((prev) => {
                  if (checked) {
                    const next = new Set(prev);
                    for (const invoice of invoices) {
                      next.add(invoice._id);
                    }
                    return Array.from(next);
                  }

                  const visibleIds = new Set(invoices.map((invoice) => invoice._id));
                  return prev.filter((id) => !visibleIds.has(id));
                });
              }}
              visibleColumns={visibleColumns}
              labels={{
                invoiceNumber: t.invoiceNumber,
                client: t.client,
                date: t.date,
                dueDate: t.dueDate,
                totalIncludingTax: t.totalIncludingTax,
                amountPaid: t.amountPaid,
                remainingAmount: t.remainingAmount,
                paymentProgress: t.paymentProgress,
                depositAmount: t.depositAmount,
                depositPaymentDate: t.depositPaymentDate,
                status: t.status,
                actions: t.actions,
                quickActions: t.quickActions,
                view: t.view,
                edit: t.edit,
                send: t.send,
                sendInvoice: t.sendInvoice,
                sendReminder: t.sendReminder,
                downloadPdf: t.downloadPdf,
                delete: t.delete,
              }}
              locale={locale as 'en' | 'fr'}
            />
            </div>

            <div data-tour-invoices-totals>
              <FinancialTotalsBar metrics={invoiceMetrics} locale={locale as 'en' | 'fr'} />
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

      {selectedInvoiceIds.length > 0 ? (
        <div className="fixed right-4 bottom-4 left-4 z-40 rounded-xl border border-border/70 bg-card/95 p-3 shadow-lg backdrop-blur sm:max-w-[calc(100vw-2rem)] md:left-auto md:min-w-105">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <p className="min-w-0 text-sm font-medium text-foreground sm:max-w-64">
              {locale === 'fr'
                ? `${selectedInvoiceIds.length} facture(s) sélectionnée(s)`
                : `${selectedInvoiceIds.length} invoice(s) selected`}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setBulkReminderOpen(true)}
                disabled={bulkSending}
              >
                <SendIcon className="size-4" />
                {t.bulkSendButton}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full sm:w-auto">
                      <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" disabled>
                        {t.bulkExport}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{locale === 'fr' ? 'Bientôt disponible' : 'Coming soon'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => setSelectedInvoiceIds([])}
                disabled={bulkSending}
              >
                {t.bulkClear}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={bulkReminderOpen}
        onOpenChange={(nextOpen) => {
          if (!bulkSending) {
            setBulkReminderOpen(nextOpen);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.bulkReminderTitle}</DialogTitle>
            <DialogDescription>{t.bulkReminderDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <RadioGroup
              value={bulkReminderMode}
              onValueChange={(value) => {
                const nextValue = value === '1' || value === '2' || value === '3' ? value : 'auto';
                setBulkReminderMode(nextValue);
              }}
              className="space-y-2"
            >
              <label className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm">
                <RadioGroupItem value="auto" />
                {t.bulkLevelAuto}
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm">
                <RadioGroupItem value="1" />
                {t.bulkLevel1}
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm">
                <RadioGroupItem value="2" />
                {t.bulkLevel2}
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm">
                <RadioGroupItem value="3" />
                {t.bulkLevel3}
              </label>
            </RadioGroup>

            {bulkSending ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Loader2Icon className="size-4 animate-spin" />
                  <span>{t.bulkProcessed(bulkProgress.done, bulkProgress.total)}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{t.bulkSuccessFailed(bulkProgress.success, bulkProgress.failed)}</p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBulkReminderOpen(false)} disabled={bulkSending}>
              {t.bulkCancel}
            </Button>
            <Button type="button" onClick={() => void sendReminderToSelectedSequentially()} disabled={bulkSending || selectedInvoices.length === 0}>
              {bulkSending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              {bulkSending ? t.bulkSending : t.bulkStart}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <Button type="button" variant="destructive" onClick={handleDeleteInvoice} disabled={isDeleting}>
                {isDeleting ? t.deleting : t.deleteInvoice}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sendTarget ? (
        <SendInvoiceModal
          open={Boolean(sendTarget)}
          onOpenChange={(next) => (!next ? setSendTarget(null) : undefined)}
          invoiceId={sendTarget._id}
          invoiceNumber={sendTarget.invoiceNumber}
          clientEmail={sendTarget.clientSnapshot.email}
          clientName={sendTarget.clientSnapshot.fullName}
          locale={locale as 'en' | 'fr'}
          onSent={() => {
            refetch();
          }}
        />
      ) : null}

      {reminderTarget ? (
        <SendReminderModal
          open={Boolean(reminderTarget)}
          onOpenChange={(next) => (!next ? setReminderTarget(null) : undefined)}
          invoiceId={reminderTarget._id}
          invoiceNumber={reminderTarget.invoiceNumber}
          clientName={reminderTarget.clientSnapshot.fullName}
          dueDate={reminderTarget.dueDate}
          invoiceDate={reminderTarget.date}
          amountDue={reminderTarget.remainingAmount ?? reminderTarget.totalIncludingTax}
          locale={locale as 'en' | 'fr'}
          nextLevel={getNextReminderLevel(reminderTarget.reminderState?.level)}
          onSent={() => {
            refetch();
          }}
        />
      ) : null}
    </CrmShell>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement...</div>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
