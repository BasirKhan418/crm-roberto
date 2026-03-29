'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { PlusIcon, SearchIcon } from 'lucide-react';
import { toast } from 'sonner';

import QuoteTable, { type QuoteListItem } from '@/components/quotes/QuoteTable';
import CrmShell from '@/components/crm-shell';
import { useQuotes, type QuoteStatusFilter } from '@/hooks/useQuotes';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function QuotesPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = {
    en: {
      shellTitle: 'Quotes',
      heading: 'Quotes',
      subtitle: 'Track quote lifecycle from draft to decision.',
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
      tabAll: 'All',
      tabDraft: 'Draft',
      tabSent: 'Sent',
      tabAccepted: 'Accepted',
      tabRefused: 'Refused',
      empty: 'No quotes yet - create your first quote',
      quoteNumber: 'Quote number',
      client: 'Client',
      date: 'Date',
      totalIncludingTax: 'Total incl. tax',
      status: 'Status',
      actions: 'Actions',
      quickActions: 'Quick actions',
      view: 'View',
      edit: 'Edit',
      duplicate: 'Duplicate',
      delete: 'Delete',
      downloadPdf: 'PDF',
      lockEdit: 'Accepted and refused quotes cannot be edited',
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
    },
    fr: {
      shellTitle: 'Devis',
      heading: 'Devis',
      subtitle: 'Suivez le cycle des devis du brouillon a la decision.',
      totalResults: 'resultats au total',
      currentFilter: 'Filtre actuel',
      deleteFailed: 'Impossible de supprimer le devis',
      deleted: 'Devis supprime',
      duplicated: 'Devis duplique',
      duplicateFailed: 'Impossible de dupliquer le devis',
      downloadFailed: 'Impossible de telecharger le PDF',
      newQuote: 'Nouveau devis',
      search: 'Rechercher par numero de devis ou nom client...',
      sortDate: 'Date',
      sortAmount: 'Montant',
      tabAll: 'Tous',
      tabDraft: 'Brouillon',
      tabSent: 'Envoye',
      tabAccepted: 'Accepte',
      tabRefused: 'Refuse',
      empty: 'Aucun devis - creez votre premier devis',
      quoteNumber: 'Numero',
      client: 'Client',
      date: 'Date',
      totalIncludingTax: 'Total TTC',
      status: 'Statut',
      actions: 'Actions',
      quickActions: 'Actions rapides',
      view: 'Voir',
      edit: 'Modifier',
      duplicate: 'Dupliquer',
      delete: 'Supprimer',
      downloadPdf: 'PDF',
      lockEdit: 'Les devis acceptes et refuses ne peuvent pas etre modifies',
      deleteTitle: 'Supprimer le devis ?',
      deleteDescription: 'Voulez-vous vraiment supprimer ce devis ?',
      cancel: 'Annuler',
      deleting: 'Suppression...',
      deleteQuote: 'Supprimer le devis',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Precedent',
      next: 'Suivant',
    },
  }[locale];

  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [status, setStatus] = useState<QuoteStatusFilter>('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [page, setPage] = useState(1);
  const limit = 10;

  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { quotes, pagination, loading, error, refetch } = useQuotes(status, searchDebounced, sort, page, limit);

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
    }
  }

  const currentFilterLabel =
    status === 'all' ? t.tabAll : status === 'draft' ? t.tabDraft : status === 'sent' ? t.tabSent : status === 'accepted' ? t.tabAccepted : t.tabRefused;

  return (
    <CrmShell title={t.shellTitle}>
      <section className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
          <Button type="button" className="w-full sm:w-auto" asChild>
            <Link href="/quotes/new">
              <PlusIcon className="size-4" />
              {t.newQuote}
            </Link>
          </Button>
        </div>

        <div className="space-y-3 rounded-xl border border-border/70 bg-card/40 p-3 sm:p-4">
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

          <Tabs value={status} onValueChange={(value) => setStatus(value as QuoteStatusFilter)}>
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsList className="inline-flex h-auto min-w-max items-center gap-1 rounded-lg border border-border/80 bg-transparent p-1">
                <TabsTrigger value="all" className="rounded-md border border-transparent px-3 py-1 text-sm text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground">{t.tabAll}</TabsTrigger>
                <TabsTrigger value="draft" className="rounded-md border border-border/80 px-3 py-1 text-sm text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground">{t.tabDraft}</TabsTrigger>
                <TabsTrigger value="sent" className="rounded-md border border-border/80 px-3 py-1 text-sm text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground">{t.tabSent}</TabsTrigger>
                <TabsTrigger value="accepted" className="rounded-md border border-border/80 px-3 py-1 text-sm text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground">{t.tabAccepted}</TabsTrigger>
                <TabsTrigger value="refused" className="rounded-md border border-border/80 px-3 py-1 text-sm text-foreground/80 hover:bg-muted/60 hover:text-foreground data-active:border-transparent data-active:bg-primary data-active:text-primary-foreground">{t.tabRefused}</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {error ? <ErrorMessage message={error} /> : null}

        {!loading && quotes.length === 0 ? (
          <EmptyState message={t.empty} actionLabel={t.newQuote} onAction={() => router.push('/quotes/new')} />
        ) : (
          <>
            <QuoteTable
              items={quotes}
              loading={loading}
              formatDate={formatDate}
              onDelete={setDeleteTarget}
              onDownload={handleDownloadPdf}
              labels={{
                quoteNumber: t.quoteNumber,
                client: t.client,
                date: t.date,
                totalIncludingTax: t.totalIncludingTax,
                status: t.status,
                actions: t.actions,
                quickActions: t.quickActions,
                view: t.view,
                edit: t.edit,
                duplicate: t.duplicate,
                delete: t.delete,
                downloadPdf: t.downloadPdf,
                lockEdit: t.lockEdit,
              }}
              onDuplicate={handleDuplicateQuote}
            />

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
    </CrmShell>
  );
}
