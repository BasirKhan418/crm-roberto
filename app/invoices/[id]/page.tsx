'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { CheckCircle2Icon, DownloadIcon, PencilIcon, ReceiptTextIcon, SendIcon, SquarePenIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';

import CrmShell from '@/components/crm-shell';
import EditPaymentEntryModal from '@/components/invoices/EditPaymentEntryModal';
import ManualPaymentModal, { type ManualPaymentType } from '@/components/invoices/ManualPaymentModal';
import SendInvoiceModal from '@/components/invoices/SendInvoiceModal';
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
import { formatInvoiceDisplayNumber, getInvoiceStatusLabel } from '@/lib/i18n/messages';
import { getPaymentMethodLabel, getPaymentTypeLabel } from '@/lib/payments';
import { computeQuoteLine } from '@/lib/quote-calculations';
import { InvoiceStatusBadge, type InvoiceStatus } from '@/components/ui/InvoiceStatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Button } from '@/components/ui/button';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Skeleton } from '@/components/ui/skeleton';
import { getStructuredAddressLines } from '@/lib/address';

type Locale = 'en' | 'fr';

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

interface InvoiceDetail {
  _id: string;
  clientBillingEmail?: string | null;
  invoiceNumber: string;
  quoteId?: string | null;
  quoteNumber?: string | null;
  date: string;
  dueDate?: string | null;
  status: InvoiceStatus;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
  depositPercentage?: number;
  depositAmount?: number;
  notes?: string | null;
  stripePaymentLinkId?: string | null;
  stripeDepositLinkId?: string | null;
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
}

interface PaymentHistoryItem {
  _id: string;
  amount: number;
  method: string;
  source?: 'manual' | 'stripe';
  type: 'full' | 'remaining_balance' | 'deposit';
  status: 'pending' | 'succeeded' | 'failed';
  paidAt?: string | null;
  createdAt?: string;
}

function formatDate(value: string | null | undefined, locale: Locale): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { locale } = useLocale();

  const t = {
    en: {
      shellTitle: 'Invoice Detail',
      back: 'Back to invoices',
      edit: 'Edit',
      sendToClient: 'Send invoice',
      download: 'Download PDF',
      addPayment: 'Record payment',
      addingPayment: 'Saving payment...',
      paymentAdded: 'Payment added successfully',
      addPaymentFailed: 'Failed to add payment',
      paymentUpdated: 'Payment entry updated',
      paymentDeleted: 'Payment entry deleted',
      paymentUpdateFailed: 'Failed to update payment entry',
      paymentDeleteFailed: 'Failed to delete payment entry',
      invoice: 'Invoice',
      date: 'Date',
      dueDate: 'Due date',
      status: 'Status',
      convertedFrom: 'Converted from',
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
      paymentSummary: 'Payment summary',
      totalInvoiceAmount: 'Total invoice amount',
      remaining: 'Remaining',
      totalPaid: 'Total paid',
      paymentHistory: 'Payment history',
      paymentMethod: 'Method',
      paymentAmount: 'Amount',
      paymentDate: 'Date',
      paymentType: 'Type',
      paymentActions: 'Actions',
      paymentSourceStripe: 'Stripe payment',
      paymentSourceManual: 'Manual payment',
      editPayment: 'Edit payment',
      deletePayment: 'Delete payment',
      stripeLocked: 'Stripe payments are locked',
      noPaymentActions: 'No actions',
      confirmDeleteTitle: 'Delete this payment entry?',
      confirmDeleteDescription: 'This removes only the selected payment history row. Invoice and quote totals stay unchanged.',
      confirmDeleteAction: 'Delete payment',
      confirmDeleteCancel: 'Cancel',
      paymentTypeDeposit: 'Deposit',
      noPayments: 'No completed payments yet.',
      paymentActionTitle: 'Payment shortcut',
      paymentActionDescription: 'Record a received payment here without hunting through the page.',
      paymentSettledTitle: 'Invoice settled',
      paymentSettledDescription: 'No payment action is needed for this invoice.',
      notes: 'Notes',
      loadFailed: 'Failed to load invoice detail',
      notFound: 'Invoice not found',
      downloadFailed: 'Failed to download PDF',
      paymentTypeFull: 'Full payment',
      paymentTypeRemaining: 'Partial payment',
      noData: '-',
    },
    fr: {
      shellTitle: 'D\u00e9tail de la facture',
      back: 'Retour aux factures',
      edit: 'Modifier',
      sendToClient: 'Envoyer la facture',
      download: 'T\u00e9l\u00e9charger PDF',
      addPayment: 'Enregistrer un paiement',
      addingPayment: 'Ajout du paiement...',
      paymentAdded: 'Paiement ajoute avec succes',
      addPaymentFailed: 'Impossible d\'ajouter le paiement',
      paymentUpdated: 'Ligne de paiement modifiee',
      paymentDeleted: 'Ligne de paiement supprimee',
      paymentUpdateFailed: 'Impossible de modifier la ligne de paiement',
      paymentDeleteFailed: 'Impossible de supprimer la ligne de paiement',
      invoice: 'Facture',
      date: 'Date',
      dueDate: '\u00c9ch\u00e9ance',
      status: 'Statut',
      convertedFrom: 'Convert\u00ede depuis',
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
      paymentSummary: 'R\u00e9sum\u00e9 des paiements',
      totalInvoiceAmount: 'Montant total facture',
      remaining: 'Reste',
      totalPaid: 'Total paye',
      paymentHistory: 'Historique des paiements',
      paymentMethod: 'M\u00e9thode',
      paymentAmount: 'Montant',
      paymentDate: 'Date',
      paymentType: 'Type',
      paymentActions: 'Actions',
      paymentSourceStripe: 'Paiement Stripe',
      paymentSourceManual: 'Paiement manuel',
      editPayment: 'Modifier',
      deletePayment: 'Supprimer',
      stripeLocked: 'Paiement Stripe verrouille',
      noPaymentActions: 'Aucune action',
      confirmDeleteTitle: 'Supprimer cette ligne de paiement ?',
      confirmDeleteDescription: 'Seule cette ligne d historique est supprimee. Les totaux facture/devis ne changent pas.',
      confirmDeleteAction: 'Supprimer le paiement',
      confirmDeleteCancel: 'Annuler',
      paymentTypeDeposit: 'Acompte',
      noPayments: 'Aucun paiement finalis\u00e9 pour le moment.',
      paymentActionTitle: 'Raccourci paiement',
      paymentActionDescription: 'Enregistrez ici un paiement recu sans devoir chercher le bouton.',
      paymentSettledTitle: 'Facture reglee',
      paymentSettledDescription: 'Aucune action de paiement n est necessaire pour cette facture.',
      notes: 'Notes',
      loadFailed: 'Impossible de charger le d\u00e9tail de la facture',
      notFound: 'Facture introuvable',
      downloadFailed: 'Impossible de t\u00e9l\u00e9charger le PDF',
      paymentTypeFull: 'Paiement complet',
      paymentTypeRemaining: 'Paiement partiel',
      noData: '-',
    },
  }[locale as Locale];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [sendOpen, setSendOpen] = useState(false);
  const [manualPaymentOpen, setManualPaymentOpen] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentHistoryItem | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<PaymentHistoryItem | null>(null);
  const [savingPaymentEdit, setSavingPaymentEdit] = useState(false);
  const [deletingPaymentEntry, setDeletingPaymentEntry] = useState(false);

  const loadData = useCallback(async () => {
    if (!params?.id) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [invoiceRes, companyRes, paymentsRes] = await Promise.all([
        fetch(`/api/invoices/${params.id}`, { cache: 'no-store' }),
        fetch('/api/cprofile', { cache: 'no-store' }),
        fetch(`/api/invoices/${params.id}/payments`, { cache: 'no-store' }),
      ]);

      const invoicePayload = (await invoiceRes.json()) as { success?: boolean; message?: string; data?: InvoiceDetail };
      if (!invoiceRes.ok || !invoicePayload.success || !invoicePayload.data) {
        throw new Error(invoicePayload.message || t.notFound);
      }

      const companyPayload = (await companyRes.json()) as {
        success?: boolean;
        profile?: CompanyProfile;
      };

      const paymentsPayload = (await paymentsRes.json().catch(() => null)) as
        | { success?: boolean; data?: PaymentHistoryItem[] }
        | null;

      setInvoice(invoicePayload.data);
      setCompany(companyRes.ok && companyPayload.success ? companyPayload.profile ?? null : null);
      setPayments(paymentsRes.ok && paymentsPayload?.success ? paymentsPayload.data ?? [] : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : t.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [params?.id, t.loadFailed, t.notFound]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const derivedTotals = useMemo(() => {
    if (!invoice) {
      return null;
    }

    const lineComputed = invoice.lineItems.map((item) =>
      computeQuoteLine({
        quantity: item.quantity,
        unitPriceExcludingTax: item.unitPriceExcludingTax,
        baseUnitPriceExcludingTax: item.baseUnitPriceExcludingTax,
        discountPercentage: item.discountPercentage,
        vatRate: item.vatRate,
      })
    );

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
  }, [invoice]);

  const totalPaidAmount = Math.max(
    0,
    payments
      .filter((payment) => payment.status === 'succeeded')
      .reduce((sum, payment) => sum + Math.max(0, Math.round(payment.amount || 0)), 0)
  );
  const remainingAmount = Math.max(0, (invoice?.totalIncludingTax ?? 0) - totalPaidAmount);
  const canEdit = invoice?.status === 'unpaid';
  const canRecordPayment = Boolean(invoice && invoice.status !== 'paid' && remainingAmount > 0);
  const displayInvoiceNumber = invoice ? formatInvoiceDisplayNumber(locale as Locale, invoice.invoiceNumber) : '';
  const displayInvoiceStatus = invoice ? getInvoiceStatusLabel(locale as Locale, invoice.status) : '';

  function paymentTypeLabel(type: PaymentHistoryItem['type']): string {
    if (type === 'deposit') {
      return t.paymentTypeDeposit;
    }

    return getPaymentTypeLabel(type, locale as Locale);
  }

  function paymentMethodLabel(method: string): string {
    return getPaymentMethodLabel(method, locale as Locale);
  }

  function isManualPaymentEntry(payment: PaymentHistoryItem): boolean {
    return payment.source === 'manual';
  }

  async function downloadPdf() {
    if (!invoice?._id) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoice._id}/pdf?locale=${locale}`, { credentials: 'include' });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || t.downloadFailed);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${displayInvoiceNumber}.pdf`;
      anchor.style.display = 'none';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      toast.error(downloadError instanceof Error ? downloadError.message : t.downloadFailed);
    }
  }

  async function markAsPaidManually(manualPayload?: { amount: number; paymentType: ManualPaymentType; method: string; customMethod?: string }) {
    if (!invoice?._id || markingPaid) {
      return;
    }

    setMarkingPaid(true);
    try {
      const response = await fetch(`/api/invoices/${invoice._id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: manualPayload?.amount ?? remainingAmount,
          method: manualPayload?.method ?? 'bank_transfer',
          customMethod: manualPayload?.customMethod,
          paymentType: manualPayload?.paymentType ?? 'full',
        }),
      });

      const responsePayload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !responsePayload.success) {
        throw new Error(responsePayload.message || t.addPaymentFailed);
      }

      toast.success(t.paymentAdded);
      setManualPaymentOpen(false);
      await loadData();
    } catch (paidError) {
      toast.error(paidError instanceof Error ? paidError.message : t.addPaymentFailed);
    } finally {
      setMarkingPaid(false);
    }
  }

  async function updatePaymentEntry(payload: { amount: number; method: string; customMethod?: string; paidAt: string }) {
    if (!invoice?._id || !editingPayment || savingPaymentEdit) {
      return;
    }

    setSavingPaymentEdit(true);
    try {
      const response = await fetch(`/api/invoices/${invoice._id}/payments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: editingPayment._id,
          amount: payload.amount,
          method: payload.method,
          customMethod: payload.customMethod,
          paidAt: payload.paidAt,
        }),
      });

      const responsePayload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !responsePayload.success) {
        throw new Error(responsePayload.message || t.paymentUpdateFailed);
      }

      toast.success(t.paymentUpdated);
      setEditingPayment(null);
      await loadData();
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : t.paymentUpdateFailed);
    } finally {
      setSavingPaymentEdit(false);
    }
  }

  async function deletePaymentEntry() {
    if (!invoice?._id || !deletingPayment || deletingPaymentEntry) {
      return;
    }

    setDeletingPaymentEntry(true);
    try {
      const response = await fetch(`/api/invoices/${invoice._id}/payments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: deletingPayment._id }),
      });

      const responsePayload = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !responsePayload.success) {
        throw new Error(responsePayload.message || t.paymentDeleteFailed);
      }

      toast.success(t.paymentDeleted);
      setDeletingPayment(null);
      await loadData();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : t.paymentDeleteFailed);
    } finally {
      setDeletingPaymentEntry(false);
    }
  }

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

      {!loading && !error && invoice ? (
        <section className="space-y-5 print:space-y-3">
          <div data-tour-invoice-detail-actions className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-card/80 px-3.5 py-3 print:hidden sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5 sm:py-2.5">
            <Button type="button" variant="outline" size="sm" className="h-10 w-full justify-start sm:h-9 sm:w-auto sm:justify-center" onClick={() => router.push('/invoices')}>
              <ReceiptTextIcon className="size-3.5" />
              {t.back}
            </Button>

            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:items-center">
              {canRecordPayment ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-10 w-full justify-start shadow-sm sm:h-9 sm:w-auto sm:justify-center"
                  onClick={() => setManualPaymentOpen(true)}
                  disabled={markingPaid}
                >
                  <CheckCircle2Icon className="size-3.5" />
                  {markingPaid ? t.addingPayment : t.addPayment}
                </Button>
              ) : null}
              {canEdit ? (
                <Button type="button" variant="outline" size="sm" className="h-10 w-full justify-start sm:h-9 sm:w-auto sm:justify-center" asChild>
                  <Link href={`/invoices/${invoice._id}/edit`}>
                    <PencilIcon className="size-3.5" />
                    {t.edit}
                  </Link>
                </Button>
              ) : null}
              <Button type="button" variant="outline" size="sm" className="h-10 w-full justify-start sm:h-9 sm:w-auto sm:justify-center" onClick={() => setSendOpen(true)}>
                <SendIcon className="size-3.5" />
                {t.sendToClient}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 w-full justify-start sm:h-9 sm:w-auto sm:justify-center" onClick={downloadPdf}>
                <DownloadIcon className="size-3.5" />
                {t.download}
              </Button>
            </div>
          </div>

          <article data-tour-invoice-document className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none sm:p-6">
            <header className="mb-5 rounded-xl border border-border/60 bg-linear-to-b from-background to-secondary/15 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.invoice}</p>
                  <h1 className="font-heading text-3xl font-semibold tracking-tight">{displayInvoiceNumber}</h1>
                  {invoice.quoteId && invoice.quoteNumber ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.convertedFrom}{' '}
                      <Link href={`/quotes/${invoice.quoteId}`} className="font-medium text-(--color-text-info) hover:underline">
                        {invoice.quoteNumber}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <InvoiceStatusBadge status={invoice.status} locale={locale as Locale} className="px-3 py-1 text-xs" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                  <p className="font-medium">{formatDate(invoice.date, locale as Locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.dueDate}</p>
                  <p className="font-medium">{formatDate(invoice.dueDate, locale as Locale)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t.status}</p>
                  <p className="font-medium">{displayInvoiceStatus}</p>
                </div>
              </div>
            </header>

            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.companyInfo}</h2>
                {company?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logoUrl} alt={company.companyName || 'Company logo'} className="mb-3 h-14 w-14 rounded-md border border-border/70 object-contain" />
                ) : null}
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.owner}</dt><dd className="text-right font-medium">{company?.ownerName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.phone}</dt><dd className="text-right font-medium">{company?.phone || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.email}</dt><dd className="text-right font-medium">{company?.businessEmail || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.address}</dt><dd className="text-right font-medium">{(() => { const lines = getStructuredAddressLines({ streetNumber: company?.streetNumber, streetName: company?.streetName, postalCode: company?.postalCode, city: company?.city, country: company?.country }); if (lines) return <>{lines.line1 && <p>{lines.line1}</p>}{lines.line2 && <p>{lines.line2}</p>}</>; return company?.address || t.noData; })()}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.vat}</dt><dd className="text-right font-medium">{company?.vatNumber || t.noData}</dd></div>
                </dl>
              </section>

              <section className="rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.clientInfo}</h2>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Name</dt><dd className="text-right font-medium">{invoice.clientSnapshot.fullName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Company</dt><dd className="text-right font-medium">{invoice.clientSnapshot.companyName || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.phone}</dt><dd className="text-right font-medium">{invoice.clientSnapshot.phone || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.email}</dt><dd className="text-right font-medium">{invoice.clientSnapshot.email || t.noData}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.address}</dt><dd className="text-right font-medium">{(() => { const lines = getStructuredAddressLines(invoice.clientSnapshot.addressDetails); if (lines) return <>{lines.line1 && <p>{lines.line1}</p>}{lines.line2 && <p>{lines.line2}</p>}</>; return invoice.clientSnapshot.address || t.noData; })()}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t.vat}</dt><dd className="text-right font-medium">{invoice.clientSnapshot.vatNumber || t.noData}</dd></div>
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
                    {invoice.lineItems.map((item, index) => {
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
                    })}
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

            <section className="mb-4 rounded-xl border border-border/70 bg-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="font-heading text-base font-semibold">{t.paymentSummary}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {canRecordPayment ? t.paymentActionDescription : t.paymentSettledDescription}
                  </p>
                </div>

                <div className={`rounded-xl border px-3.5 py-3 lg:w-full lg:max-w-sm ${canRecordPayment ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20' : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/20'}`}>
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${canRecordPayment ? 'text-amber-900 dark:text-amber-300' : 'text-emerald-900 dark:text-emerald-300'}`}>
                    {canRecordPayment ? t.paymentActionTitle : t.paymentSettledTitle}
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{t.remaining}</p>
                      <PriceDisplay cents={remainingAmount} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-base font-semibold text-foreground" />
                    </div>
                    {canRecordPayment ? (
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 w-full justify-center text-xs sm:h-8 sm:w-auto sm:text-sm"
                        onClick={() => setManualPaymentOpen(true)}
                        disabled={markingPaid}
                      >
                        <CheckCircle2Icon className="size-3.5" />
                        {markingPaid ? t.addingPayment : t.addPayment}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <p className="text-xs text-muted-foreground">{t.totalInvoiceAmount}</p>
                  <PriceDisplay cents={invoice.totalIncludingTax} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="mt-1 text-base font-semibold text-foreground" />
                </div>
                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <p className="text-xs text-muted-foreground">{t.totalPaid}</p>
                  <PriceDisplay cents={totalPaidAmount} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="mt-1 text-base font-semibold text-foreground" />
                </div>
                <div className="rounded-xl border border-border/60 bg-background px-3 py-3">
                  <p className="text-xs text-muted-foreground">{t.remaining}</p>
                  <PriceDisplay cents={remainingAmount} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="mt-1 text-base font-semibold text-foreground" />
                </div>
              </div>
            </section>

            <section className="mb-4 rounded-xl border border-border/70 bg-card p-4">
              <h2 className="mb-2 font-heading text-base font-semibold">{t.paymentHistory}</h2>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.noPayments}</p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2 md:hidden">
                    {payments.map((payment) => {
                      const canMutate = isManualPaymentEntry(payment);

                      return (
                        <article
                          key={payment._id}
                          className={`rounded-xl border p-3 ${canMutate ? 'border-emerald-200/80 bg-linear-to-br from-white via-background to-emerald-50/40 dark:border-emerald-900/40 dark:from-background dark:to-emerald-950/10' : 'border-slate-200/80 bg-linear-to-br from-white via-background to-slate-100/60 dark:border-slate-700/70 dark:from-background dark:to-slate-900/40'}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground">{t.paymentDate}</p>
                              <p className="text-sm font-medium">{formatDateTime(payment.paidAt || payment.createdAt, locale as Locale)}</p>
                            </div>
                            <PriceDisplay cents={payment.amount} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-base font-semibold" />
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:text-sm">
                            <div>
                              <p className="text-muted-foreground">{t.paymentMethod}</p>
                              <p className="font-medium">{payment.method ? paymentMethodLabel(payment.method) : t.noData}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.paymentType}</p>
                              <p className="font-medium">{paymentTypeLabel(payment.type)}</p>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="text-[11px] text-muted-foreground">{canMutate ? t.paymentSourceManual : t.paymentSourceStripe}</p>
                            {!canMutate ? (
                              <p className="text-[11px] text-muted-foreground">{t.stripeLocked}</p>
                            ) : null}
                          </div>

                          {canMutate ? (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <Button type="button" size="sm" variant="outline" className="h-8 min-w-0 px-2 text-xs" onClick={() => setEditingPayment(payment)}>
                                <SquarePenIcon className="size-3.5" />
                                {t.editPayment}
                              </Button>
                              <Button type="button" size="sm" variant="outline" className="h-8 min-w-0 px-2 text-xs text-destructive hover:text-destructive" onClick={() => setDeletingPayment(payment)}>
                                <Trash2Icon className="size-3.5" />
                                {t.deletePayment}
                              </Button>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-sm">
                      <thead className="bg-secondary/30 text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">{t.paymentDate}</th>
                          <th className="px-3 py-2 text-left font-medium">{t.paymentMethod}</th>
                          <th className="px-3 py-2 text-left font-medium">{t.paymentType}</th>
                          <th className="px-3 py-2 text-right font-medium">{t.paymentAmount}</th>
                          <th className="px-3 py-2 text-right font-medium">{t.paymentActions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => {
                          const canMutate = isManualPaymentEntry(payment);

                          return (
                            <tr key={payment._id} className="border-t border-border/60 odd:bg-background even:bg-secondary/10">
                              <td className="px-3 py-2">{formatDateTime(payment.paidAt || payment.createdAt, locale as Locale)}</td>
                              <td className="px-3 py-2">{payment.method ? paymentMethodLabel(payment.method) : t.noData}</td>
                              <td className="px-3 py-2">{paymentTypeLabel(payment.type)}</td>
                              <td className="px-3 py-2 text-right font-medium"><PriceDisplay cents={payment.amount} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} /></td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-1.5">
                                  {canMutate ? (
                                    <>
                                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setEditingPayment(payment)}>
                                        <SquarePenIcon className="size-3.5" />
                                        {t.editPayment}
                                      </Button>
                                      <Button type="button" variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={() => setDeletingPayment(payment)}>
                                        <Trash2Icon className="size-3.5" />
                                        {t.deletePayment}
                                      </Button>
                                    </>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">{t.stripeLocked}</p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>

            {invoice.notes ? (
              <section className="mb-4 rounded-xl border border-border/70 bg-card p-4">
                <h2 className="mb-2 font-heading text-base font-semibold">{t.notes}</h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{invoice.notes}</p>
              </section>
            ) : null}
          </article>
        </section>
      ) : null}

      {invoice ? (
        <SendInvoiceModal
          open={sendOpen}
          onOpenChange={setSendOpen}
          invoiceId={invoice._id}
          invoiceNumber={invoice.invoiceNumber}
          clientEmail={invoice.clientBillingEmail ?? invoice.clientSnapshot.email}
          clientName={invoice.clientSnapshot.fullName}
          companyName={company?.companyName ?? company?.ownerName ?? null}
          locale={locale as 'en' | 'fr'}
          onSent={loadData}
        />
      ) : null}

      {invoice && manualPaymentOpen ? (
        <ManualPaymentModal
          open={manualPaymentOpen}
          onOpenChange={setManualPaymentOpen}
          loading={markingPaid}
          locale={locale as 'en' | 'fr'}
          totalAmount={invoice.totalIncludingTax}
          totalPaidAmount={totalPaidAmount}
          remainingAmount={remainingAmount}
          onConfirm={async (payload) => {
            await markAsPaidManually(payload);
          }}
        />
      ) : null}

      {invoice && editingPayment ? (
        <EditPaymentEntryModal
          open={Boolean(editingPayment)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditingPayment(null);
            }
          }}
          loading={savingPaymentEdit}
          locale={locale as 'en' | 'fr'}
          amount={editingPayment.amount}
          method={editingPayment.method}
          paidAt={editingPayment.paidAt ?? editingPayment.createdAt}
          remainingBaseAmount={Math.max(0, remainingAmount + editingPayment.amount)}
          onConfirm={updatePaymentEntry}
        />
      ) : null}

      <AlertDialog open={Boolean(deletingPayment)} onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setDeletingPayment(null);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmDeleteDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" disabled={deletingPaymentEntry}>{t.confirmDeleteCancel}</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" disabled={deletingPaymentEntry} onClick={deletePaymentEntry}>
                {t.confirmDeleteAction}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CrmShell>
  );
}
