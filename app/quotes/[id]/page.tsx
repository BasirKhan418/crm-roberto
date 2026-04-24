'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

import { CopyIcon, DownloadIcon, FileTextIcon, PencilIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import ConvertToInvoiceModal from '@/components/quotes/ConvertToInvoiceModal';
import { useLocale } from '@/components/providers/locale-provider';
import QuoteHistoryBar from '@/components/quotes/QuoteHistoryBar';
import SendQuoteModal from '@/components/quotes/SendQuoteModal';
import StatusChanger from '@/components/quotes/StatusChanger';
import { formatInvoiceDisplayNumber, getQuoteStatusLabel, resolveTranslatedError, translate } from '@/lib/i18n/messages';
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
import { formatStructuredAddress, hasStructuredAddress } from '@/lib/address';

type Locale = 'en' | 'fr';

interface QuoteDetail {
  _id: string;
  quoteNumber: string;
  date: string;
  status: QuoteStatus;
  signedStatus?: 'not_signed' | 'signed';
  convertedToInvoice?: boolean;
  invoiceId?: string | null;
  signatureToken?: string | null;
  clientSnapshot: {
    fullName: string;
    companyName?: string | null;
    address?: string | null;
    addressDetails?: {
      streetNumber?: string | null;
      streetName?: string | null;
      postalCode?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
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
  rejectionComment?: string | null;
  adminReplyMessage?: string | null;
  conversationMessages?: Array<{ role: 'admin' | 'client'; text: string; sentAt?: string }>;
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
  streetNumber?: string | null;
  streetName?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
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
  return getQuoteStatusLabel(locale, status);
}

function QuoteDetailPageContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { locale } = useLocale();

  const t = {
    en: {
      shellTitle: 'Quote Detail',
      backToDashboard: 'Dashboard',
      back: 'Back to quotes',
      edit: 'Edit',
      duplicate: 'Duplicate',
      convertToInvoice: 'Convert to invoice',
      convertingToInvoice: 'Converting...',
      convertedToInvoiceLabel: 'Converted to invoice',
      download: 'Download PDF',
      sendToClient: 'Send to client',
      sendForSigning: 'Send for signing',
      resendSigningLink: 'Resend signing link',
      editAndResend: 'Edit & Resend Quote',
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
      lockEdit: 'Accepted quotes cannot be edited',
      rejectionBannerTitle: 'This quote was rejected by the client',
      rejectionAlertTop: 'Quote rejected by client',
      rejectionBannerBody: 'The client has rejected this quote. Review the comment below, update the quote, and resend it.',
      rejectionComment: 'Client rejection comment',
      replyToClient: 'Reply to client',
      replyPlaceholder: 'Write your message here... (e.g. We have updated the quote to meet your requirements and will resend it shortly.)',
      sendResponse: 'Send response',
      sendingResponse: 'Sending...',
      responseSent: 'Response sent to client',
      replyRequired: 'Please write a reply message before sending.',
      replyFailed: 'Failed to send response',
      conversationThread: 'Conversation thread',
      youLabel: 'You',
      clientLabel: 'Client',
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
      shellTitle: 'D\u00e9tail du devis',
      backToDashboard: 'Tableau de bord',
      back: 'Retour aux devis',
      edit: 'Modifier',
      duplicate: 'Dupliquer',
      convertToInvoice: 'Convertir en facture',
      convertingToInvoice: 'Conversion...',
      convertedToInvoiceLabel: 'Converti en facture',
      download: 'T\u00e9l\u00e9charger PDF',
      sendToClient: 'Envoyer au client',
      sendForSigning: 'Envoyer pour signature',
      resendSigningLink: 'Renvoyer le lien de signature',
      editAndResend: 'Modifier et renvoyer le devis',
      delete: 'Supprimer',
      quote: 'Devis',
      date: 'Date',
      status: 'Statut',
      companyInfo: 'Informations soci\u00e9t\u00e9',
      clientInfo: 'Informations client',
      owner: 'Responsable',
      phone: 'T\u00e9l\u00e9phone',
      email: 'E-mail',
      address: 'Adresse',
      vat: 'TVA',
      lineItems: 'Lignes',
      no: '#',
      description: 'Description',
      qty: 'Qt\u00e9',
      unitExcl: 'Unitaire HT',
      discount: 'Remise\u00a0%',
      discountHt: 'Remise HT',
      vatRate: 'TVA\u00a0%',
      lineTotal: 'Total',
      totalExcl: 'Total HT',
      discountAmount: 'Remise',
      totalNet: 'Total HT (net)',
      totalVat: 'TVA',
      totalIncl: 'Total TTC',
      notes: 'Notes / Conditions',
      paymentTerms: 'Conditions de paiement',
      validity: 'Validit\u00e9',
      validityDays: 'jours',
      expires: "Valable jusqu'au",
      expired: 'Expir\u00e9 le',
      history: 'Historique des statuts',
      historyEmpty: 'Aucune transition de statut pour le moment.',
      lockEdit: 'Les devis accept\u00e9s ne peuvent pas \u00eatre modifi\u00e9s',
      rejectionBannerTitle: 'Ce devis a \u00e9t\u00e9 refus\u00e9 par le client',
      rejectionAlertTop: 'Devis refus\u00e9 par le client',
      rejectionBannerBody: 'Le client a refus\u00e9 ce devis. Consultez le commentaire ci-dessous, mettez le devis \u00e0 jour et renvoyez-le.',
      rejectionComment: 'Commentaire de refus du client',
      replyToClient: 'R\u00e9pondre au client',
      replyPlaceholder: "R\u00e9digez votre message ici... (ex.\u00a0: Nous avons mis \u00e0 jour le devis pour r\u00e9pondre \u00e0 vos demandes et allons vous le renvoyer tr\u00e8s prochainement.)",
      sendResponse: 'Envoyer la r\u00e9ponse',
      sendingResponse: 'Envoi en cours...',
      responseSent: 'R\u00e9ponse envoy\u00e9e au client',
      replyRequired: "Veuillez r\u00e9diger un message avant d'envoyer.",
      replyFailed: "Impossible d'envoyer la r\u00e9ponse",
      conversationThread: 'Fil de conversation',
      youLabel: 'Vous',
      clientLabel: 'Client',
      deleteTitle: 'Supprimer le devis\u00a0?',
      deleteDescription: 'Voulez-vous vraiment supprimer ce devis\u00a0? Cette action est irr\u00e9versible.',
      cancel: 'Annuler',
      deleting: 'Suppression...',
      deleteConfirm: 'Supprimer le devis',
      loadFailed: 'Impossible de charger le d\u00e9tail du devis',
      notFound: 'Devis introuvable',
      deleteFailed: 'Impossible de supprimer le devis',
      deleted: 'Devis supprim\u00e9',
      duplicated: 'Devis dupliqu\u00e9',
      duplicateFailed: 'Impossible de dupliquer le devis',
      downloadFailed: 'Impossible de t\u00e9l\u00e9charger le PDF',
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
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertingToInvoice, setConvertingToInvoice] = useState(false);
  const [convertedInvoiceNumber, setConvertedInvoiceNumber] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [threadExpanded, setThreadExpanded] = useState(false);

  const canEdit = quote
    ? quote.status === 'draft' || quote.status === 'sent' || quote.status === 'rejected' || quote.status === 'refused'
    : false;
  const canConvertToInvoice = Boolean(
    quote &&
      quote.status === 'accepted' &&
      quote.signedStatus === 'signed' &&
      !quote.convertedToInvoice &&
      !quote.invoiceId
  );
  const hasConvertedInvoice = Boolean(quote?.convertedToInvoice && quote?.invoiceId);
  const actionButtonClass = 'h-10 w-full justify-start sm:h-9 sm:w-full sm:justify-center text-center';

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

      let nextConvertedInvoiceNumber: string | null = null;
      const convertedInvoiceId = quotePayload.data.invoiceId;
      if (typeof convertedInvoiceId === 'string' && convertedInvoiceId) {
        const invoiceRes = await fetch(`/api/invoices/${convertedInvoiceId}`, { cache: 'no-store' });
        const invoicePayload = (await invoiceRes.json().catch(() => null)) as
          | { success?: boolean; data?: { invoiceNumber?: string } }
          | null;

        if (invoiceRes.ok && invoicePayload?.success && invoicePayload.data?.invoiceNumber) {
          nextConvertedInvoiceNumber = invoicePayload.data.invoiceNumber;
        }
      }

      const companyPayload = (await companyRes.json()) as {
        success?: boolean;
        profile?: CompanyProfile;
      };

      setQuote(quotePayload.data);
      setConvertedInvoiceNumber(nextConvertedInvoiceNumber);
      setCompany(companyRes.ok && companyPayload.success ? companyPayload.profile ?? null : null);
      setThreadExpanded(false);
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

  useEffect(() => {
    if (!loading && quote && searchParams.get('convert') === '1' && canConvertToInvoice) {
      setConvertOpen(true);
      window.history.replaceState(null, '', `/quotes/${params?.id}`);
    }
  }, [loading, quote, searchParams, params?.id, canConvertToInvoice]);

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
      toast.error(resolveTranslatedError(locale, error, t.downloadFailed));
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
      toast.error(resolveTranslatedError(locale, deleteError, t.deleteFailed));
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
      toast.error(resolveTranslatedError(locale, duplicateError, t.duplicateFailed));
    } finally {
      setDuplicating(false);
    }
  }

  async function handleConverted(invoiceId: string) {
    if (convertingToInvoice) {
      return;
    }

    setConvertingToInvoice(true);
    try {
      router.push(`/invoices/${invoiceId}`);
    } finally {
      setConvertingToInvoice(false);
    }
  }

  async function sendReplyToClient() {
    if (!quote?._id) return;

    const trimmed = replyMessage.trim();
    if (!trimmed) {
      toast.error(t.replyRequired);
      return;
    }

    setSendingReply(true);
    try {
      const response = await fetch(`/api/quotes/${quote._id}/reject-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, locale }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        message?: string;
        conversationMessages?: Array<{ role: 'admin' | 'client'; text: string; sentAt?: string }>;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.replyFailed);
      }

      setReplyMessage('');
      setQuote((prev) =>
        prev
          ? {
              ...prev,
              adminReplyMessage: trimmed,
              conversationMessages: payload.conversationMessages ?? [
                ...(prev.conversationMessages ?? []),
                { role: 'admin' as const, text: trimmed, sentAt: new Date().toISOString() },
              ],
            }
          : prev,
      );
      toast.success(t.responseSent);
    } catch (replyError) {
      toast.error(resolveTranslatedError(locale, replyError, t.replyFailed));
    } finally {
      setSendingReply(false);
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
        <section className="space-y-5 print:space-y-3">
          {quote.status === 'rejected' ? (
            <section className="overflow-hidden rounded-xl border border-red-300 bg-red-50 print:hidden">
              <div className="border-b border-red-200 px-4 py-3 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">{t.rejectionAlertTop}</p>
                <p className="mt-1 text-sm leading-6 text-red-900">{t.rejectionBannerBody}</p>
              </div>

              {/* Rejection comment */}
              <div className="border-b border-red-200 px-4 py-3 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">{t.rejectionComment}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-red-950">
                  {quote.rejectionComment || t.noData}
                </p>
              </div>

              {/* Conversation thread */}
              {(() => {
                const msgs = quote.conversationMessages ?? [];
                if (msgs.length === 0) return null;
                const older = msgs.slice(0, -2);
                const latest = msgs.slice(-2);
                return (
                  <div className="border-b border-red-200 px-4 py-3 sm:px-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">{t.conversationThread}</p>
                      {older.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setThreadExpanded(v => !v)}
                          className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-100 hover:text-red-800 sm:text-xs"
                        >
                          {threadExpanded
                            ? 'Collapse'
                            : `+${older.length} older`}
                          <svg
                            className={`size-3 transition-transform duration-200 ${threadExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-2">
                      {/* Collapsed older messages placeholder */}
                      {older.length > 0 && !threadExpanded ? (
                        <button
                          type="button"
                          onClick={() => setThreadExpanded(true)}
                          className="w-full rounded-lg border border-dashed border-red-200 py-2 text-center text-xs text-red-400 hover:border-red-300 hover:text-red-600"
                        >
                          View {older.length} earlier message{older.length > 1 ? 's' : ''}
                        </button>
                      ) : null}
                      {/* Older messages shown when expanded */}
                      {threadExpanded
                        ? older.map((msg, i) => (
                            <div
                              key={`old-${i}`}
                              className={msg.role === 'admin' ? 'rounded-lg border border-slate-200 bg-white p-3' : 'rounded-lg border border-red-200 bg-red-100 p-3'}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                {msg.role === 'admin' ? t.youLabel : t.clientLabel}
                              </p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{msg.text}</p>
                              {msg.sentAt ? <p className="mt-0.5 text-[10px] text-slate-400">{new Date(msg.sentAt).toLocaleString()}</p> : null}
                            </div>
                          ))
                        : null}
                      {/* Always-visible latest 2 */}
                      {latest.map((msg, i) => (
                        <div
                          key={`latest-${i}`}
                          className={msg.role === 'admin' ? 'rounded-lg border border-slate-200 bg-white p-3' : 'rounded-lg border border-red-200 bg-red-100 p-3'}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {msg.role === 'admin' ? t.youLabel : t.clientLabel}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{msg.text}</p>
                          {msg.sentAt ? <p className="mt-0.5 text-[10px] text-slate-400">{new Date(msg.sentAt).toLocaleString()}</p> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Admin reply section — always visible */}
              <div className="px-4 py-3 sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">{t.replyToClient}</p>
                <div className="mt-2 space-y-2">
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder={t.replyPlaceholder}
                    disabled={sendingReply}
                    className="w-full resize-none rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-red-500/70">{replyMessage.length}/2000</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button type="button" variant="outline" size="sm" className="h-9 w-full sm:w-auto" asChild>
                        <Link href={`/quotes/${quote._id}/edit`}>
                          <PencilIcon className="size-3.5" />
                          {t.editAndResend}
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full sm:w-auto"
                        onClick={sendReplyToClient}
                        disabled={sendingReply || !replyMessage.trim()}
                      >
                        <SendIcon className="size-3.5" />
                        {sendingReply ? t.sendingResponse : t.sendResponse}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <div data-tour-quote-detail-actions className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/80 px-3.5 py-3 print:hidden sm:grid sm:grid-flow-col sm:auto-cols-fr sm:items-center sm:gap-2.5 sm:py-2.5">
            {quote.status !== 'rejected' ? (
              <div className="w-full">
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
            ) : null}

            <div className="w-full">
              <Button type="button" variant="outline" size="sm" className={actionButtonClass} disabled={duplicating} onClick={duplicateQuote}>
                <CopyIcon className="size-3.5" />
                {t.duplicate}
              </Button>
            </div>

            {canConvertToInvoice ? (
              <div className="w-full">
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  data-tour-quote-convert
                  className={`${actionButtonClass} bg-black text-white hover:bg-black/90 dark:bg-black dark:text-white dark:hover:bg-black/90`}
                  disabled={convertingToInvoice}
                  onClick={() => setConvertOpen(true)}
                >
                  <FileTextIcon className="size-3.5" />
                  {convertingToInvoice ? t.convertingToInvoice : t.convertToInvoice}
                </Button>
              </div>
            ) : null}

            {hasConvertedInvoice && quote?.invoiceId ? (
              <div className="w-full">
                <Link
                  href={`/invoices/${quote.invoiceId}`}
                  className="inline-flex h-10 w-full items-center justify-start rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-100 sm:h-9 sm:w-full sm:justify-center"
                >
                  {t.convertedToInvoiceLabel} {convertedInvoiceNumber ? formatInvoiceDisplayNumber(locale as Locale, convertedInvoiceNumber) : ''}
                </Link>
              </div>
            ) : null}

            <StatusChanger
              quoteId={quote._id}
              status={quote.status}
              locale={locale as Locale}
              onStatusChanged={handleOptimisticStatusChange}
              onStatusCommitted={loadData}
              containerClassName="w-full"
              selectClassName="h-10 w-full sm:h-9 sm:w-full"
              buttonClassName="h-10 w-full justify-start sm:h-8 sm:w-auto sm:justify-center"
            />

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:items-center">
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
                className={quote.status === 'draft' ? actionButtonClass : 'col-span-2 h-10 w-full justify-start sm:col-span-1 sm:h-8 sm:w-full sm:justify-center'}
                onClick={downloadPdf}
              >
                <DownloadIcon className="size-3.5" />
                {t.download}
              </Button>
            </div>

            <div className="w-full">
              <Button type="button" variant="destructive" size="sm" className={actionButtonClass} onClick={() => setDeleteOpen(true)}>
                <Trash2Icon className="size-3.5" />
                {t.delete}
              </Button>
            </div>
          </div>

          <article data-tour-quote-document className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-6">
            <header className="mb-5 rounded-xl border border-border/60 bg-linear-to-b from-background to-secondary/15 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.quote}</p>
                  <h1 className="font-heading text-3xl font-semibold tracking-tight">{quote.quoteNumber}</h1>
                </div>
                <StatusBadge status={quote.status} className="px-3 py-1 text-xs" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logoUrl} alt={company.companyName || translate(locale, 'common.companyLogo')} className="mb-3 h-14 w-14 rounded-md border border-border/70 object-contain" />
                ) : null}
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.owner}</dt><dd className="text-right font-medium">{company?.ownerName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.phone}</dt><dd className="text-right font-medium">{company?.phone || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.email}</dt><dd className="text-right font-medium">{company?.businessEmail || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.address}</dt><dd className="text-right font-medium whitespace-pre-line">{(hasStructuredAddress(company) ? formatStructuredAddress(company) : company?.address) || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.vat}</dt><dd className="text-right font-medium">{company?.vatNumber || t.noData}</dd></div>
                </dl>
              </section>

              <section className="rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.clientInfo}</h2>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{translate(locale, 'common.name')}</dt><dd className="text-right font-medium">{quote.clientSnapshot.fullName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{translate(locale, 'common.company')}</dt><dd className="text-right font-medium">{quote.clientSnapshot.companyName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.phone}</dt><dd className="text-right font-medium">{quote.clientSnapshot.phone || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.email}</dt><dd className="text-right font-medium">{quote.clientSnapshot.email || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.address}</dt><dd className="text-right font-medium whitespace-pre-line">{(hasStructuredAddress(quote.clientSnapshot.addressDetails) ? formatStructuredAddress(quote.clientSnapshot.addressDetails) : quote.clientSnapshot.address) || t.noData}</dd></div>
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
                              // eslint-disable-next-line @next/next/no-img-element
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

      {quote && canConvertToInvoice ? (
        <ConvertToInvoiceModal
          open={convertOpen}
          onOpenChange={setConvertOpen}
          quoteId={quote._id}
          quoteNumber={quote.quoteNumber}
          initialNotes={quote.notes ?? null}
          locale={locale as 'en' | 'fr'}
          onConverted={handleConverted}
        />
      ) : null}
    </CrmShell>
  );
}

export default function QuoteDetailPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Chargement...</div>}>
      <QuoteDetailPageContent />
    </Suspense>
  );
}
