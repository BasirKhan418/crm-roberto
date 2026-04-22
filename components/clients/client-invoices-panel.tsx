'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import SendInvoiceModal from '@/components/invoices/SendInvoiceModal';
import InvoiceTable from '@/components/invoices/InvoiceTable';
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
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import FinancialTotalsBar from '@/components/ui/FinancialTotalsBar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInvoices, type InvoiceListItem, type InvoiceStatusFilter } from '@/hooks/useInvoices';
import { useInvoicesActionCount } from '@/hooks/useInvoicesActionCount';

interface ClientInvoicesPanelProps {
  clientId: string;
}

export default function ClientInvoicesPanel({ clientId }: ClientInvoicesPanelProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      heading: 'Client invoices',
      subtitle: 'Track all invoices for this client with the same filters and actions as the main invoice workspace.',
      totalResults: 'total results',
      currentFilter: 'Current filter',
      search: 'Search by invoice number...',
      sortDate: 'Date',
      sortAmount: 'Amount',
      tabAll: 'All',
      tabUnpaid: 'Unpaid',
      tabPartialPaid: 'Partially paid',
      tabPaid: 'Paid',
      tabOverdue: 'Overdue',
      newInvoice: 'New invoice',
      empty: 'No invoices yet for this client.',
      deleteFailed: 'Failed to delete invoice',
      deleted: 'Invoice deleted',
      downloadFailed: 'Failed to download PDF',
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
      actions: 'Actions',
      quickActions: 'Main action',
      view: 'View',
      edit: 'Edit',
      send: 'Send',
      sendInvoice: 'Send invoice',
      sendReminder: 'Send reminder',
      downloadPdf: 'Download PDF',
      delete: 'Delete',
      numberOfDocuments: 'Number of documents',
      totalHT: 'Total HT',
      totalTVA: 'Total TVA',
      totalTTC: 'Total TTC',
      totalPaid: 'Total paid',
      totalDue: 'Total due',
    },
    fr: {
      heading: 'Factures client',
      subtitle: 'Suivez toutes les factures de ce client avec les memes filtres et actions que dans le module factures.',
      totalResults: 'resultats au total',
      currentFilter: 'Filtre actuel',
      search: 'Rechercher par numero de facture...',
      sortDate: 'Date',
      sortAmount: 'Montant',
      tabAll: 'Tous',
      tabUnpaid: 'Impayees',
      tabPartialPaid: 'Partiellement payees',
      tabPaid: 'Payees',
      tabOverdue: 'En retard',
      newInvoice: 'Nouvelle facture',
      empty: 'Aucune facture pour ce client.',
      deleteFailed: 'Impossible de supprimer la facture',
      deleted: 'Facture supprimee',
      downloadFailed: 'Impossible de telecharger le PDF',
      deleteTitle: 'Supprimer la facture ?',
      deleteDescription: 'Voulez-vous vraiment supprimer cette facture ?',
      cancel: 'Annuler',
      deleting: 'Suppression...',
      deleteInvoice: 'Supprimer la facture',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Precedent',
      next: 'Suivant',
      invoiceNumber: 'Numero',
      client: 'Client',
      date: 'Date',
      dueDate: 'Echeance',
      totalIncludingTax: 'Total TTC',
      amountPaid: 'Montant paye',
      remainingAmount: 'Reste a payer',
      paymentProgress: 'Paye',
      depositAmount: 'Acompte',
      depositPaymentDate: 'Acompte paye',
      status: 'Statut',
      actions: 'Actions',
      quickActions: 'Action principale',
      view: 'Voir',
      edit: 'Modifier',
      send: 'Envoyer',
      sendInvoice: 'Envoyer facture',
      sendReminder: 'Envoyer rappel',
      downloadPdf: 'Telecharger PDF',
      delete: 'Supprimer',
      numberOfDocuments: 'Nombre de documents',
      totalHT: 'Total HT',
      totalTVA: 'Total TVA',
      totalTTC: 'Total TTC',
      totalPaid: 'Total paye',
      totalDue: 'Total reste',
    },
  }[locale];

  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [status, setStatus] = useState<InvoiceStatusFilter>('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendTarget, setSendTarget] = useState<InvoiceListItem | null>(null);
  const limit = 10;

  const { invoices, pagination, loading, error, refetch } = useInvoices(status, searchDebounced, sort, page, limit, { clientId });
  const { allCount, unpaidCount, partialPaidCount, paidCount, overdueCount } = useInvoicesActionCount(
    pagination.total + invoices.length + Number(loading),
    { clientId }
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearchDebounced(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, sort, status]);

  useEffect(() => {
    if (loading) {
      return;
    }

    const pageIsOutOfRange = page > 1 && (pagination.totalPages === 0 || page > pagination.totalPages);
    if (pageIsOutOfRange) {
      setPage(Math.max(1, pagination.totalPages));
    }
  }, [loading, page, pagination.totalPages]);

  const currentFilterLabel =
    status === 'all'
      ? t.tabAll
      : status === 'unpaid'
        ? t.tabUnpaid
        : status === 'partial_paid'
          ? t.tabPartialPaid
          : status === 'paid'
            ? t.tabPaid
            : t.tabOverdue;

  const formatDate = useCallback(
    (value: string | null | undefined) => {
      if (!value) {
        return '—';
      }

      return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value));
    },
    [locale]
  );

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t.heading}</h2>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button type="button" className="h-9 w-full sm:w-auto" asChild>
            <Link href={`/invoices/new?clientId=${encodeURIComponent(clientId)}`}>
              <PlusIcon className="size-4" />
              {t.newInvoice}
            </Link>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-muted-foreground">
            {pagination.total} {t.totalResults}
          </span>
          <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-muted-foreground">
            {t.currentFilter}: {currentFilterLabel}
          </span>
        </div>

        <div className="grid gap-2.5 lg:grid-cols-[1fr_auto] lg:items-center">
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
                <span>{t.tabPartialPaid}</span>
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

      {!loading && invoices.length === 0 ? (
        <EmptyState message={t.empty} actionLabel={t.newInvoice} onAction={() => { window.location.href = `/invoices/new?clientId=${encodeURIComponent(clientId)}`; }} />
      ) : (
        <>
          <InvoiceTable
            items={invoices}
            loading={loading}
            formatDate={formatDate}
            onDelete={setDeleteTarget}
            onDownload={handleDownloadPdf}
            onSend={setSendTarget}
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

          <FinancialTotalsBar metrics={invoiceMetrics} locale={locale as 'en' | 'fr'} />

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
    </div>
  );
}