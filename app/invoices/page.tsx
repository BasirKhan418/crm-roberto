'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import InvoiceTable from '@/components/invoices/InvoiceTable';
import SendInvoiceModal from '@/components/invoices/SendInvoiceModal';
import CrmShell from '@/components/crm-shell';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useInvoices, type InvoiceListItem, type InvoiceStatusFilter } from '@/hooks/useInvoices';
import { useInvoicesActionCount } from '@/hooks/useInvoicesActionCount';

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
      depositAmount: 'Deposit',
      depositPaymentDate: 'Deposit paid',
      status: 'Status',
      actions: 'Actions',
      quickActions: 'Main action',
      view: 'View',
      edit: 'Edit',
      send: 'Send',
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
      actionOverdue: (n: number) => `${n} invoice${n === 1 ? '' : 's'} overdue — collect now`,
      actionOverdueHint: 'Disappears when invoice is paid',
      actionInitialPaid: (n: number) => `${n} invoice${n === 1 ? '' : 's'} partially paid — remaining balance due`,
      actionInitialPaidHint: 'Disappears when fully paid',
      seeOverdue: 'See overdue',
      seeInitialPaid: 'See partially paid',
      markAsPaid: 'Add payment',
      markingAsPaid: 'Recording...',
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
      depositAmount: 'Acompte',
      depositPaymentDate: 'Acompte payé',
      status: 'Statut',
      actions: 'Actions',
      quickActions: 'Action principale',
      view: 'Voir',
      edit: 'Modifier',
      send: 'Envoyer',
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
      actionOverdue: (n: number) => `${n} facture${n === 1 ? '' : 's'} en retard — encaissez maintenant`,
      actionOverdueHint: 'Disparaît lorsque la facture est marquée comme payée',
      actionInitialPaid: (n: number) => `${n} facture${n === 1 ? '' : 's'} partiellement payée(s)`,
      actionInitialPaidHint: 'Disparaît lorsque la facture est intégralement payée',
      seeOverdue: 'Voir en retard',
      seeInitialPaid: 'Voir paiements partiels',
      markAsPaid: 'Ajouter un paiement',
      markingAsPaid: 'Enregistrement...',
    },
  }[locale];

  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [status, setStatus] = useState<InvoiceStatusFilter>('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sendTarget, setSendTarget] = useState<InvoiceListItem | null>(null);
  const { invoices, pagination, loading, error, refetch } = useInvoices(status, searchDebounced, sort, page, limit);
  const { allCount, unpaidCount, partialPaidCount, paidCount, overdueCount } = useInvoicesActionCount(
    pagination.total + invoices.length + Number(loading)
  );

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

        <div data-tour-invoices-filters className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
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
              labels={{
                invoiceNumber: t.invoiceNumber,
                client: t.client,
                date: t.date,
                dueDate: t.dueDate,
                totalIncludingTax: t.totalIncludingTax,
                depositAmount: t.depositAmount,
                depositPaymentDate: t.depositPaymentDate,
                status: t.status,
                actions: t.actions,
                quickActions: t.quickActions,
                view: t.view,
                edit: t.edit,
                send: t.send,
                downloadPdf: t.downloadPdf,
                delete: t.delete,
              }}
              locale={locale as 'en' | 'fr'}
            />
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
    </CrmShell>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading...</div>}>
      <InvoicesPageContent />
    </Suspense>
  );
}
