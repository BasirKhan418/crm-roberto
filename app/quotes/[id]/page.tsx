'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { ArrowLeftIcon, DownloadIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import StatusChanger from '@/components/quotes/StatusChanger';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { StatusBadge, type QuoteStatus } from '@/components/ui/StatusBadge';
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
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';

type Locale = 'en' | 'fr';

interface QuoteDetail {
  _id: string;
  quoteNumber: string;
  date: string;
  status: QuoteStatus;
  clientSnapshot: {
    fullName: string;
    companyName?: string | null;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    vatNumber?: string | null;
  };
  lineItems: Array<{
    _id?: string;
    name: string;
    quantity: number;
    unitPriceExcludingTax: number;
    vatRate: number;
    totalExcludingTax: number;
  }>;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
  statusHistory?: Array<{
    from?: QuoteStatus;
    to: QuoteStatus;
    changedAt: string;
  }>;
}

interface CompanyProfile {
  companyName?: string;
  ownerName?: string;
  address?: string;
  phone?: string;
  businessEmail?: string;
  vatNumber?: string;
  logoUrl?: string | null;
}

function formatDate(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function statusLabel(status: QuoteStatus, locale: Locale): string {
  const labels = {
    en: {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      refused: 'Refused',
    },
    fr: {
      draft: 'Brouillon',
      sent: 'Envoye',
      accepted: 'Accepte',
      refused: 'Refuse',
    },
  } as const;

  return labels[locale][status];
}

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { locale } = useLocale();

  const t = {
    en: {
      shellTitle: 'Quote Detail',
      back: 'Back to quotes',
      edit: 'Edit',
      download: 'Download PDF',
      delete: 'Delete',
      quote: 'Quote',
      date: 'Date',
      status: 'Status',
      companyInfo: 'Company info',
      clientInfo: 'Client info',
      owner: 'Owner',
      phone: 'Phone',
      email: 'Email',
      address: 'Address',
      vat: 'VAT',
      lineItems: 'Line items',
      no: '#',
      description: 'Description',
      qty: 'Qty',
      unitExcl: 'Unit excl.',
      vatRate: 'VAT %',
      lineTotal: 'Total',
      totalExcl: 'Total excl. tax',
      totalVat: 'VAT',
      totalIncl: 'Total incl. tax',
      notes: 'Notes / Conditions',
      history: 'Status history',
      historyEmpty: 'No status transitions yet.',
      lockEdit: 'Accepted and refused quotes cannot be edited',
      deleteTitle: 'Delete quote?',
      deleteDescription: 'Are you sure you want to delete this quote? This action cannot be undone.',
      cancel: 'Cancel',
      deleting: 'Deleting...',
      deleteConfirm: 'Delete quote',
      loadFailed: 'Failed to load quote detail',
      notFound: 'Quote not found',
      deleteFailed: 'Failed to delete quote',
      deleted: 'Quote deleted',
      downloadFailed: 'Failed to download PDF',
      noData: '-',
    },
    fr: {
      shellTitle: 'Detail du devis',
      back: 'Retour aux devis',
      edit: 'Modifier',
      download: 'Telecharger PDF',
      delete: 'Supprimer',
      quote: 'Devis',
      date: 'Date',
      status: 'Statut',
      companyInfo: 'Informations societe',
      clientInfo: 'Informations client',
      owner: 'Responsable',
      phone: 'Telephone',
      email: 'E-mail',
      address: 'Adresse',
      vat: 'TVA',
      lineItems: 'Lignes',
      no: '#',
      description: 'Description',
      qty: 'Qte',
      unitExcl: 'Unitaire HT',
      vatRate: 'TVA %',
      lineTotal: 'Total',
      totalExcl: 'Total HT',
      totalVat: 'TVA',
      totalIncl: 'Total TTC',
      notes: 'Notes / Conditions',
      history: 'Historique des statuts',
      historyEmpty: 'Aucune transition de statut pour le moment.',
      lockEdit: 'Les devis acceptes et refuses ne peuvent pas etre modifies',
      deleteTitle: 'Supprimer le devis ?',
      deleteDescription: 'Voulez-vous vraiment supprimer ce devis ? Cette action est irreversible.',
      cancel: 'Annuler',
      deleting: 'Suppression...',
      deleteConfirm: 'Supprimer le devis',
      loadFailed: 'Impossible de charger le detail du devis',
      notFound: 'Devis introuvable',
      deleteFailed: 'Impossible de supprimer le devis',
      deleted: 'Devis supprime',
      downloadFailed: 'Impossible de telecharger le PDF',
      noData: '-',
    },
  }[locale as Locale];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canEdit = quote ? quote.status === 'draft' || quote.status === 'sent' : false;

  const loadData = useCallback(async () => {
    if (!params?.id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [quoteRes, companyRes] = await Promise.all([
        fetch(`/api/quotes/${params.id}`, { cache: 'no-store' }),
        fetch('/api/cprofile', { cache: 'no-store' }),
      ]);

      const quotePayload = (await quoteRes.json()) as { success?: boolean; message?: string; data?: QuoteDetail };
      if (!quoteRes.ok || !quotePayload.success || !quotePayload.data) {
        throw new Error(quotePayload.message || t.notFound);
      }

      const companyPayload = (await companyRes.json()) as {
        success?: boolean;
        profile?: CompanyProfile;
      };

      setQuote(quotePayload.data);
      setCompany(companyRes.ok && companyPayload.success ? companyPayload.profile ?? null : null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [params?.id, t.loadFailed, t.notFound]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function downloadPdf() {
    if (!quote?._id) {
      return;
    }

    try {
      const response = await fetch(`/api/quotes/${quote._id}/pdf`);
      if (!response.ok) {
        throw new Error(t.downloadFailed);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${quote.quoteNumber}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(t.downloadFailed);
    }
  }

  async function deleteQuote() {
    if (!quote?._id) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/quotes/${quote._id}`, { method: 'DELETE' });
      const payload = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.deleteFailed);
      }

      toast.success(t.deleted);
      router.push('/quotes');
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : t.deleteFailed);
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  function handleOptimisticStatusChange(newStatus: QuoteStatus) {
    setQuote((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        status: newStatus,
      };
    });
  }

  const history = useMemo(() => {
    if (!quote?.statusHistory) {
      return [];
    }

    return [...quote.statusHistory].sort((a, b) => +new Date(a.changedAt) - +new Date(b.changedAt));
  }, [quote?.statusHistory]);

  return (
    <CrmShell title={t.shellTitle}>
      {loading ? (
        <section className="space-y-4">
          <Skeleton className="h-9 w-72" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <Skeleton className="h-72 w-full rounded-xl" />
        </section>
      ) : null}

      {!loading && error ? <ErrorMessage message={error} /> : null}

      {!loading && !error && quote ? (
        <section className="space-y-4 print:space-y-3">
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card px-3 py-2 print:hidden sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href="/quotes">
                  <ArrowLeftIcon className="size-3.5" />
                  {t.back}
                </Link>
              </Button>

              <Button type="button" variant="outline" size="sm" disabled={!canEdit} asChild={canEdit} title={!canEdit ? t.lockEdit : t.edit}>
                {canEdit ? (
                  <Link href={`/quotes/${quote._id}/edit`}>
                    <PencilIcon className="size-3.5" />
                    {t.edit}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <PencilIcon className="size-3.5" />
                    {t.edit}
                  </span>
                )}
              </Button>

              <StatusChanger
                quoteId={quote._id}
                status={quote.status}
                locale={locale as Locale}
                onStatusChanged={handleOptimisticStatusChange}
                onStatusCommitted={loadData}
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadPdf}>
                <DownloadIcon className="size-3.5" />
                {t.download}
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2Icon className="size-3.5" />
                {t.delete}
              </Button>
            </div>
          </div>

          <article className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-6">
            <header className="mb-4 rounded-xl border border-border/70 bg-linear-to-b from-background to-secondary/20 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.quote}</p>
                  <h1 className="font-heading text-3xl font-semibold tracking-tight">{quote.quoteNumber}</h1>
                </div>
                <StatusBadge status={quote.status} className="px-3 py-1 text-xs" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                  <p className="font-medium">{formatDate(quote.date, locale as Locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.status}</p>
                  <p className="font-medium">{statusLabel(quote.status, locale as Locale)}</p>
                </div>
              </div>
            </header>

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.companyInfo}</h2>
                {company?.logoUrl ? (
                  <img src={company.logoUrl} alt={company.companyName || 'Company logo'} className="mb-3 h-14 w-14 rounded-md border border-border/70 object-contain" />
                ) : null}
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.owner}</dt><dd className="text-right font-medium">{company?.ownerName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.phone}</dt><dd className="text-right font-medium">{company?.phone || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.email}</dt><dd className="text-right font-medium">{company?.businessEmail || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.address}</dt><dd className="text-right font-medium">{company?.address || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.vat}</dt><dd className="text-right font-medium">{company?.vatNumber || t.noData}</dd></div>
                </dl>
              </section>

              <section className="rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.clientInfo}</h2>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Name</dt><dd className="text-right font-medium">{quote.clientSnapshot.fullName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Company</dt><dd className="text-right font-medium">{quote.clientSnapshot.companyName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.phone}</dt><dd className="text-right font-medium">{quote.clientSnapshot.phone || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.email}</dt><dd className="text-right font-medium">{quote.clientSnapshot.email || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.address}</dt><dd className="text-right font-medium">{quote.clientSnapshot.address || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.vat}</dt><dd className="text-right font-medium">{quote.clientSnapshot.vatNumber || t.noData}</dd></div>
                </dl>
              </section>
            </div>

            <section className="mb-4 overflow-hidden rounded-xl border border-border/70 bg-card">
              <h2 className="border-b border-border/70 px-4 py-3 font-heading text-base font-semibold">{t.lineItems}</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-secondary/30 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t.no}</th>
                      <th className="px-3 py-2 text-left font-medium">{t.description}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.qty}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.unitExcl}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.vatRate}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.lineTotal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, index) => (
                      <tr key={item._id || `${item.name}-${index}`} className="border-t border-border/60 odd:bg-background even:bg-secondary/10">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right"><PriceDisplay cents={item.unitPriceExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                        <td className="px-3 py-2 text-right">{item.vatRate}%</td>
                        <td className="px-3 py-2 text-right font-semibold"><PriceDisplay cents={item.totalExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-4 flex justify-end">
              <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
                  <span className="text-muted-foreground">{t.totalExcl}</span>
                  <PriceDisplay cents={quote.totalExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                </div>
                <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
                  <span className="text-muted-foreground">{t.totalVat}</span>
                  <PriceDisplay cents={quote.totalVat} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                </div>
                <div className="flex items-center justify-between py-2 text-base font-semibold">
                  <span>{t.totalIncl}</span>
                  <PriceDisplay cents={quote.totalIncludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="font-semibold" />
                </div>
              </div>
            </section>

            {quote.notes ? (
              <section className="mb-4 rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.notes}</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{quote.notes}</p>
              </section>
            ) : null}

            <section className="rounded-xl border border-border/70 bg-card p-4">
              <h2 className="mb-2 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t.history}</h2>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.historyEmpty}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {history.map((item, index) => (
                    <div key={`${item.to}-${item.changedAt}-${index}`} className="inline-flex items-center gap-2">
                      <span className="rounded-md border border-border/70 bg-secondary/30 px-2 py-1 text-xs font-medium">
                        {statusLabel(item.to, locale as Locale)} · {formatDate(item.changedAt, locale as Locale)}
                      </span>
                      {index < history.length - 1 ? <span className="text-muted-foreground">→</span> : null}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </article>
        </section>
      ) : null}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.deleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={deleting}>{t.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" disabled={deleting} onClick={deleteQuote}>
                {deleting ? t.deleting : t.deleteConfirm}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmShell>
  );
}
