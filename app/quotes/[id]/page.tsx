'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { ArrowLeftIcon, CopyIcon, DownloadIcon, PencilIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import QuoteHistoryBar from '@/components/quotes/QuoteHistoryBar';
import SendQuoteModal from '@/components/quotes/SendQuoteModal';
import StatusChanger from '@/components/quotes/StatusChanger';
import { computeQuoteLine } from '@/lib/quote-calculations';
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
  signatureToken?: string | null;
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
    productImageUrl?: string | null;
    name: string;
    quantity: number;
    baseUnitPriceExcludingTax: number;
    unitPriceExcludingTax: number;
    discountPercentage: number;
    vatRate: number;
    totalExcludingTaxBeforeDiscount: number;
    discountAmountExcludingTax: number;
    totalExcludingTax: number;
    vatAmount: number;
    totalIncludingTax: number;
  }>;
  totalExcludingTaxBeforeDiscount: number;
  totalDiscountExcludingTax: number;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  notes?: string | null;
  paymentTerms?: string | null;
  validityDays?: number;
  statusHistory?: Array<{
    from?: QuoteStatus;
    to: QuoteStatus;
    changedAt: string;
  }>;
}

function buildSignUrlFromToken(token?: string | null): string | null {
  if (!token || typeof window === 'undefined') {
    return null;
  }

  return `${window.location.origin}/sign/${token}`;
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
  const searchParams = useSearchParams();
  const { locale } = useLocale();

  const t = {
    en: {
      shellTitle: 'Quote Detail',
      back: 'Back to quotes',
      edit: 'Edit',
      duplicate: 'Duplicate',
      download: 'Download PDF',
      sendToClient: 'Send to client',
      sendForSigning: 'Send for signing',
      resendSigningLink: 'Resend signing link',
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
      discount: 'Discount %',
      discountHt: 'Discount HT',
      vatRate: 'VAT %',
      lineTotal: 'Total',
      totalExcl: 'Total excl. tax',
      discountAmount: 'Discount',
      totalNet: 'Total excl. tax (net)',
      totalVat: 'VAT',
      totalIncl: 'Total incl. tax',
      notes: 'Notes / Conditions',
      paymentTerms: 'Payment terms',
      validity: 'Validity',
      validityDays: 'days',
      expires: 'Expires on',
      expired: 'Expired on',
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
      duplicated: 'Quote duplicated',
      duplicateFailed: 'Failed to duplicate quote',
      downloadFailed: 'Failed to download PDF',
      noData: '-',
    },
    fr: {
      shellTitle: 'Detail du devis',
      back: 'Retour aux devis',
      edit: 'Modifier',
      duplicate: 'Dupliquer',
      download: 'Telecharger PDF',
      sendToClient: 'Envoyer au client',
      sendForSigning: 'Envoyer pour signature',
      resendSigningLink: 'Renvoyer le lien de signature',
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
      discount: 'Remise %',
      discountHt: 'Remise HT',
      vatRate: 'TVA %',
      lineTotal: 'Total',
      totalExcl: 'Total HT',
      discountAmount: 'Remise',
      totalNet: 'Total HT (net)',
      totalVat: 'TVA',
      totalIncl: 'Total TTC',
      notes: 'Notes / Conditions',
      paymentTerms: 'Conditions de paiement',
      validity: 'Validite',
      validityDays: 'jours',
      expires: 'Valable jusqu au',
      expired: 'Expire le',
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
      duplicated: 'Devis duplique',
      duplicateFailed: 'Impossible de dupliquer le devis',
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
  const [sendOpen, setSendOpen] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  const canEdit = quote ? quote.status === 'draft' || quote.status === 'sent' : false;
  const actionButtonClass = 'h-10 w-full justify-start sm:h-8 sm:w-auto sm:justify-center text-center';

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

  // Auto-open send modal when redirected from "Save and Send"
  useEffect(() => {
    if (!loading && quote && searchParams.get('send') === '1') {
      setSendOpen(true);
      // Clean up the URL param without a navigation
      window.history.replaceState(null, '', `/quotes/${params?.id}`);
    }
  }, [loading, quote, searchParams, params?.id]);

  async function downloadPdf() {
    if (!quote?._id) {
      return;
    }

    try {
      const response = await fetch(`/api/quotes/${quote._id}/pdf?locale=${locale}`, { credentials: 'include' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || t.downloadFailed);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${quote.quoteNumber}.pdf`;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.downloadFailed);
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

  async function duplicateQuote() {
    if (!quote?._id || duplicating) {
      return;
    }
    setDuplicating(true);

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
      setDuplicating(false);
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

  const derivedTotals = useMemo(() => {
    if (!quote) {
      return null;
    }

    const lineComputed = quote.lineItems.map((item) =>
      computeQuoteLine({
        quantity: item.quantity,
        unitPriceExcludingTax: item.unitPriceExcludingTax,
        baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
        discountPercentage: item.discountPercentage,
        vatRate: item.vatRate,
      })
    );

    // Always use freshly computed values — never fall back to stale DB totals
    const sumGross = lineComputed.reduce((sum, item) => sum + item.totalExcludingTaxBeforeDiscount, 0);
    const sumDiscount = lineComputed.reduce((sum, item) => sum + item.discountAmountExcludingTax, 0);
    const sumNet = lineComputed.reduce((sum, item) => sum + item.totalExcludingTax, 0);
    const sumVat = lineComputed.reduce((sum, item) => sum + item.vatAmount, 0);
    const sumTtc = lineComputed.reduce((sum, item) => sum + item.totalIncludingTax, 0);

    return {
      totalExcludingTaxBeforeDiscount: sumGross,
      totalDiscountExcludingTax: sumDiscount,
      totalExcludingTax: sumNet,
      totalVat: sumVat,
      totalIncludingTax: sumTtc,
      lineComputed,
    };
  }, [quote]);

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
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card px-3 py-3 print:hidden sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:py-2">
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <Button type="button" variant="outline" size="sm" className={actionButtonClass} asChild>
                <Link href="/quotes">
                  <ArrowLeftIcon className="size-3.5" />
                  {t.back}
                </Link>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className={actionButtonClass}
                disabled={!canEdit}
                asChild={canEdit}
                title={!canEdit ? t.lockEdit : t.edit}
              >
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
            </div>

            {!canEdit ? (
              <div className="w-full sm:w-auto">
                <Button type="button" variant="outline" size="sm" className={actionButtonClass} disabled={duplicating} onClick={duplicateQuote}>
                  <CopyIcon className="size-3.5" />
                  {t.duplicate}
                </Button>
              </div>
            ) : null}

            <StatusChanger
              quoteId={quote._id}
              status={quote.status}
              locale={locale as Locale}
              onStatusChanged={handleOptimisticStatusChange}
              onStatusCommitted={loadData}
              containerClassName="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center"
              selectClassName="h-10 w-full sm:h-8 sm:w-44"
              buttonClassName="h-10 w-full justify-start sm:h-8 sm:w-auto sm:justify-center"
            />

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
              {(quote.status === 'draft' || quote.status === 'sent') ? (
                <Button type="button" variant="default" size="sm" className={actionButtonClass} onClick={() => setSendOpen(true)}>
                  <SendIcon className="size-3.5" />
                  {quote.status === 'sent' ? t.resendSigningLink : t.sendForSigning}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={quote.status === 'draft' ? actionButtonClass : 'col-span-2 h-10 w-full justify-start sm:col-span-1 sm:h-8 sm:w-auto sm:justify-center'}
                onClick={downloadPdf}
              >
                <DownloadIcon className="size-3.5" />
                {t.download}
              </Button>
            </div>

            <div className="w-full sm:w-auto">
              <Button type="button" variant="destructive" size="sm" className={actionButtonClass} onClick={() => setDeleteOpen(true)}>
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
                      <th className="px-3 py-2 text-right font-medium">{t.discount}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.discountHt}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.vatRate}</th>
                      <th className="px-3 py-2 text-right font-medium">{t.lineTotal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, index) => (
                      (() => {
                        const computed = derivedTotals?.lineComputed[index] ?? null;
                        return (
                      <tr key={item._id || `${item.name}-${index}`} className="border-t border-border/60 odd:bg-background even:bg-secondary/10">
                        <td className="px-3 py-2">{index + 1}</td>
                        <td className="px-3 py-2 font-medium">
                          <span className="inline-flex items-center gap-2">
                            {item.productImageUrl ? (
                              <img
                                src={item.productImageUrl}
                                alt={item.name}
                                className="h-7 w-7 rounded border border-border/60 object-cover"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span>{item.name}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right"><PriceDisplay cents={computed?.baseUnitPriceExcludingTax ?? item.baseUnitPriceExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                        <td className="px-3 py-2 text-right">{Number(computed?.discountPercentage ?? item.discountPercentage).toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right text-destructive">- <PriceDisplay cents={computed?.discountAmountExcludingTax ?? item.discountAmountExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                        <td className="px-3 py-2 text-right">{item.vatRate}%</td>
                        <td className="px-3 py-2 text-right font-semibold"><PriceDisplay cents={computed?.totalExcludingTax ?? item.totalExcludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                      </tr>
                        );
                      })()
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-4 flex justify-end">
              <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
                  <span className="text-muted-foreground">{t.totalExcl}</span>
                  <PriceDisplay cents={derivedTotals?.totalExcludingTaxBeforeDiscount ?? 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                </div>
                <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
                  <span className="text-muted-foreground">{t.discountAmount}</span>
                  <span className="text-destructive">- <PriceDisplay cents={derivedTotals?.totalDiscountExcludingTax ?? 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></span>
                </div>
                <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
                  <span className="text-muted-foreground">{t.totalNet}</span>
                  <PriceDisplay cents={derivedTotals?.totalExcludingTax ?? 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                </div>
                <div className="flex items-center justify-between border-b border-border/60 py-2 text-sm">
                  <span className="text-muted-foreground">{t.totalVat}</span>
                  <PriceDisplay cents={derivedTotals?.totalVat ?? 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                </div>
                <div className="flex items-center justify-between py-2 text-base font-semibold">
                  <span>{t.totalIncl}</span>
                  <PriceDisplay cents={derivedTotals?.totalIncludingTax ?? 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="font-semibold" />
                </div>
              </div>
            </section>

            {(quote.paymentTerms || quote.validityDays) ? (
              <section className="mb-4 rounded-xl border border-border/70 bg-card p-4">
                <dl className="space-y-2 text-sm">
                  {quote.paymentTerms ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">{t.paymentTerms}</dt>
                      <dd className="text-right font-medium">{quote.paymentTerms}</dd>
                    </div>
                  ) : null}
                  {quote.validityDays ? (() => {
                    const expiryDate = new Date(new Date(quote.date).getTime() + quote.validityDays! * 86400000);
                    const isExpired = new Date() > expiryDate && quote.status === 'sent';
                    const formattedExpiry = formatDate(expiryDate.toISOString(), locale as Locale);
                    return (
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">{t.validity}</dt>
                        <dd className={`text-right font-medium ${isExpired ? 'text-destructive' : ''}`}>
                          {quote.validityDays} {t.validityDays} &mdash; {isExpired ? t.expired : t.expires} {formattedExpiry}
                        </dd>
                      </div>
                    );
                  })() : null}
                </dl>
              </section>
            ) : null}

            {quote.notes ? (
              <section className="mb-4 rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.notes}</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{quote.notes}</p>
              </section>
            ) : null}

            <QuoteHistoryBar
              history={history}
              currentStatus={quote.status}
              locale={locale as 'en' | 'fr'}
            />
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
              <Button type="button" variant="outline" disabled={deleting} >{t.cancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" disabled={deleting} onClick={deleteQuote}>
                {deleting ? t.deleting : t.deleteConfirm}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {quote ? (
        <SendQuoteModal
          open={sendOpen}
          onOpenChange={setSendOpen}
          quoteId={quote._id}
          quoteNumber={quote.quoteNumber}
          clientEmail={quote.clientSnapshot.email}
          clientName={quote.clientSnapshot.fullName}
          companyName={undefined}
          quoteStatus={quote.status}
          initialSignUrl={buildSignUrlFromToken(quote.signatureToken)}
          locale={locale as 'en' | 'fr'}
          onSent={loadData}
        />
      ) : null}
    </CrmShell>
  );
}
