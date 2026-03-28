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
      deleteFailed: 'Failed to delete quote',
      deleted: 'Quote deleted',
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
      view: 'View',
      edit: 'Edit',
      delete: 'Delete',
      downloadPdf: 'PDF',
      lockEdit: 'Accepted and refused quotes cannot be edited',
      deleteTitle: 'Delete quote?',
      deleteDescription: 'Are you sure you want to delete this quote?',
      cancel: 'Cancel',
      deleting: 'Deleting...',
      deleteQuote: 'Delete quote',
    },
    fr: {
      shellTitle: 'Devis',
      heading: 'Devis',
      subtitle: 'Suivez le cycle des devis du brouillon a la decision.',
      deleteFailed: 'Impossible de supprimer le devis',
      deleted: 'Devis supprime',
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
      view: 'Voir',
      edit: 'Modifier',
      delete: 'Supprimer',
      downloadPdf: 'PDF',
      lockEdit: 'Les devis acceptes et refuses ne peuvent pas etre modifies',
      deleteTitle: 'Supprimer le devis ?',
      deleteDescription: 'Voulez-vous vraiment supprimer ce devis ?',
      cancel: 'Annuler',
      deleting: 'Suppression...',
      deleteQuote: 'Supprimer le devis',
    },
  }[locale];

  const [searchInput, setSearchInput] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [status, setStatus] = useState<QuoteStatusFilter>('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');

  const [deleteTarget, setDeleteTarget] = useState<QuoteListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { quotes, loading, error, refetch } = useQuotes(status, searchDebounced, sort);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearchDebounced(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

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
      await refetch();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : t.deleteFailed);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDownloadPdf(quote: QuoteListItem) {
    try {
      const response = await fetch(`/api/quotes/${quote._id}/pdf`);
      if (!response.ok) {
        throw new Error(t.downloadFailed);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${quote.quoteNumber}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t.downloadFailed);
    }
  }

  return (
    <CrmShell title={t.shellTitle}>
      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-10 pl-9" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={t.search} />
            </div>
            <Select value={sort} onValueChange={(value) => setSort(value === 'amount' ? 'amount' : 'date')}>
              <SelectTrigger className="h-10 w-full sm:w-44">
                <SelectValue placeholder={t.sortDate} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">{t.sortDate}</SelectItem>
                <SelectItem value="amount">{t.sortAmount}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={status} onValueChange={(value) => setStatus(value as QuoteStatusFilter)}>
            <TabsList className="h-auto rounded-lg border border-border/80 bg-transparent p-1">
              <TabsTrigger value="all" className="rounded-md border border-transparent px-3 py-1 text-foreground/80 hover:bg-background hover:text-foreground data-active:bg-primary data-active:text-primary-foreground">{t.tabAll}</TabsTrigger>
              <TabsTrigger value="draft" className="rounded-md border border-border/80 px-3 py-1 text-foreground/80 hover:bg-background hover:text-foreground data-active:bg-primary data-active:text-primary-foreground">{t.tabDraft}</TabsTrigger>
              <TabsTrigger value="sent" className="rounded-md border border-border/80 px-3 py-1 text-foreground/80 hover:bg-background hover:text-foreground data-active:bg-primary data-active:text-primary-foreground">{t.tabSent}</TabsTrigger>
              <TabsTrigger value="accepted" className="rounded-md border border-border/80 px-3 py-1 text-foreground/80 hover:bg-background hover:text-foreground data-active:bg-primary data-active:text-primary-foreground">{t.tabAccepted}</TabsTrigger>
              <TabsTrigger value="refused" className="rounded-md border border-border/80 px-3 py-1 text-foreground/80 hover:bg-background hover:text-foreground data-active:bg-primary data-active:text-primary-foreground">{t.tabRefused}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {error ? <ErrorMessage message={error} /> : null}

        {!loading && quotes.length === 0 ? (
          <EmptyState message={t.empty} actionLabel={t.newQuote} onAction={() => router.push('/quotes/new')} />
        ) : (
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
              view: t.view,
              edit: t.edit,
              delete: t.delete,
              downloadPdf: t.downloadPdf,
              lockEdit: t.lockEdit,
            }}
          />
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
