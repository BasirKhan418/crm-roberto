'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, MessageSquarePlus, Paperclip } from 'lucide-react';
import { toast } from 'sonner';

import { FinancialPeriodSelector } from '@/components/dashboard/financial-period-selector';
import { useLocale } from '@/components/providers/locale-provider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { createAccountantExpenseTicket } from '@/hooks/useAccountantTickets';
import { buildFinancialPeriodSearchParams, getDefaultFinancialPeriodSelection, type FinancialPeriodSelection } from '@/lib/financial-periods';
import { ACCOUNTANT_PURCHASE_TICKET_REASONS, type AccountantPurchaseTicketReason } from '@/lib/tickets/accountant-purchase-ticket';
import { cn } from '@/lib/utils';

type LookupData = {
  suppliers: Array<{ id: string; fullName: string; companyName: string | null }>;
  categories: Array<{ id: string; name: string; nameEn: string | null; nameFr: string | null }>;
};

type PurchaseInvoiceItem = {
  id: string;
  paymentStatus: string;
  expenseDate: string | null;
  dueDate: string | null;
  amountExclVatCents: number;
  vatAmountCents: number;
  amountInclVatCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  supplierRef: string | null;
  attachmentsCount: number;
  attachments: Array<{ id: string; displayName: string; url: string }>;
  supplier: { fullName: string; companyName: string | null } | null;
  category: { name: string; nameEn: string | null; nameFr: string | null } | null;
  notes?: string | null;
};

type PurchaseInvoiceResponse = {
  items: PurchaseInvoiceItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals?: { totalTtcCents: number; totalPaidCents: number; totalRemainingCents: number };
};

const purchaseCopy = {
  en: {
    title: 'Purchase invoices',
    subtitle: 'Read-only company expenses with accounting filters and attachment access.',
    search: 'Search supplier or reference',
    paymentStatus: 'Payment status',
    supplier: 'Supplier',
    category: 'Category',
    all: 'All',
    unpaid: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
    date: 'Date',
    dueDate: 'Due date',
    supplierColumn: 'Supplier',
    categoryColumn: 'Category',
    amounts: 'Amounts',
    payment: 'Payment',
    attachments: 'Attachments',
    selectAll: 'Select all with attachments',
    selectedCount: 'selected',
    downloadZip: 'Download ZIP',
    downloadZipBusy: 'Preparing ZIP...',
    zipFailed: 'Failed to download attachment ZIP',
    zipHint: 'The ZIP bundles selected receipt and invoice attachments only.',
    zipBusyHint: 'Collecting files and building the archive. This can take a moment for larger selections.',
    empty: 'No purchase invoices match these filters.',
    total: 'Total',
    paidTotal: 'Paid',
    remaining: 'Remaining',
    paidLabel: 'Paid',
    remainingLabel: 'Left',
    referenceLabel: 'Reference',
    statusFilterHint: 'Accounting-ready filters for supplier costs, due dates, and attachments.',
    pageSummary: 'results',
    prev: 'Prev',
    next: 'Next',
    ticketAction: 'Create ticket',
    ticketDialogTitle: 'Create purchase ticket',
    ticketDialogDescription: 'Start a linked ticket from this purchase and open the conversation immediately.',
    ticketDialogReason: 'Issue type',
    ticketDialogMessage: 'Accountant note',
    ticketDialogMessagePlaceholder: 'Add the exact clarification or document request the client should answer.',
    ticketDialogPurchase: 'Selected purchase',
    ticketDialogAttachments: 'Attachments linked automatically',
    ticketDialogNotes: 'Purchase note',
    ticketDialogCancel: 'Cancel',
    ticketDialogSubmit: 'Create ticket and open thread',
    ticketDialogSubmitting: 'Creating ticket...',
    ticketCreated: 'Ticket created. Opening thread...',
    ticketCreateFailed: 'Failed to create purchase ticket',
    ticketReason_missing_invoice: 'Missing invoice',
    ticketReason_missing_invoice_hint: 'Ask the client to add the missing invoice file.',
    ticketReason_need_clarification: 'Need clarification',
    ticketReason_need_clarification_hint: 'Ask for missing business details or context.',
    ticketReason_wrong_vat: 'Wrong VAT',
    ticketReason_wrong_vat_hint: 'Request confirmation or correction of the VAT treatment.',
    ticketReason_need_supporting_document: 'Need supporting document',
    ticketReason_need_supporting_document_hint: 'Request a receipt, contract, or other supporting evidence.',
  },
  fr: {
    title: 'Factures d achat',
    subtitle: 'Depenses de l entreprise en lecture seule avec filtres comptables et acces aux pieces jointes.',
    search: 'Rechercher un fournisseur ou une reference',
    paymentStatus: 'Statut de paiement',
    supplier: 'Fournisseur',
    category: 'Categorie',
    all: 'Tous',
    unpaid: 'Impayee',
    partial: 'Partielle',
    paid: 'Payee',
    date: 'Date',
    dueDate: 'Echeance',
    supplierColumn: 'Fournisseur',
    categoryColumn: 'Categorie',
    amounts: 'Montants',
    payment: 'Paiement',
    attachments: 'Pieces jointes',
    selectAll: 'Tout selectionner avec pieces jointes',
    selectedCount: 'selectionnes',
    downloadZip: 'Telecharger ZIP',
    downloadZipBusy: 'Preparation du ZIP...',
    zipFailed: 'Echec du telechargement ZIP',
    zipHint: 'Le ZIP regroupe uniquement les pieces jointes selectionnees.',
    zipBusyHint: 'Recuperation des fichiers et generation de l archive. Cela peut prendre un moment si la selection est large.',
    empty: 'Aucune facture d achat ne correspond a ces filtres.',
    total: 'Total',
    paidTotal: 'Paye',
    remaining: 'Reste',
    paidLabel: 'Paye',
    remainingLabel: 'Reste',
    referenceLabel: 'Reference',
    statusFilterHint: 'Filtres comptables pour les fournisseurs, echeances et pieces jointes.',
    pageSummary: 'resultats',
    prev: 'Prec',
    next: 'Suiv',
    ticketAction: 'Creer un ticket',
    ticketDialogTitle: 'Creer un ticket pour la depense',
    ticketDialogDescription: 'Demarrez un ticket lie a cette depense et ouvrez la conversation immediatement.',
    ticketDialogReason: 'Type de demande',
    ticketDialogMessage: 'Note comptable',
    ticketDialogMessagePlaceholder: 'Ajoutez la clarification precise ou le document que le client doit fournir.',
    ticketDialogPurchase: 'Depense selectionnee',
    ticketDialogAttachments: 'Pieces jointes liees automatiquement',
    ticketDialogNotes: 'Note de depense',
    ticketDialogCancel: 'Annuler',
    ticketDialogSubmit: 'Creer le ticket et ouvrir le fil',
    ticketDialogSubmitting: 'Creation du ticket...',
    ticketCreated: 'Ticket cree. Ouverture du fil...',
    ticketCreateFailed: 'Impossible de creer le ticket de depense',
    ticketReason_missing_invoice: 'Facture manquante',
    ticketReason_missing_invoice_hint: 'Demandez au client d ajouter la facture manquante.',
    ticketReason_need_clarification: 'Besoin de clarification',
    ticketReason_need_clarification_hint: 'Demandez les details metier ou le contexte manquant.',
    ticketReason_wrong_vat: 'TVA incorrecte',
    ticketReason_wrong_vat_hint: 'Demandez confirmation ou correction du traitement TVA.',
    ticketReason_need_supporting_document: 'Document justificatif requis',
    ticketReason_need_supporting_document_hint: 'Demandez un recu, contrat ou autre justificatif.',
  },
} as const;

const STATUS_ROW_BG: Record<string, string> = {
  unpaid: 'rgba(244, 63, 94, 0.045)',
  partial: 'rgba(245, 158, 11, 0.06)',
  paid: 'rgba(16, 185, 129, 0.05)',
};

const STATUS_ACCENT: Record<string, string> = {
  unpaid: '#e11d48',
  partial: '#d97706',
  paid: '#059669',
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

type PurchaseCopy = (typeof purchaseCopy)[keyof typeof purchaseCopy];

function getPaymentLabel(status: string, copy: PurchaseCopy) {
  if (status === 'paid') {
    return copy.paid;
  }

  if (status === 'partial') {
    return copy.partial;
  }

  return copy.unpaid;
}

function getPaymentBadgeClass(status: string) {
  if (status === 'paid') {
    return 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300 dark:bg-emerald-950/45 dark:text-emerald-200 dark:ring-emerald-800';
  }

  if (status === 'partial') {
    return 'bg-orange-100 text-orange-800 ring-1 ring-orange-300 dark:bg-orange-950/45 dark:text-orange-200 dark:ring-orange-800';
  }

  return 'bg-rose-100 text-rose-800 ring-1 ring-rose-300 dark:bg-rose-950/45 dark:text-rose-200 dark:ring-rose-800';
}

export default function AccountantPortalPurchaseInvoicesPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = purchaseCopy[locale];
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';

  const [period, setPeriod] = useState<FinancialPeriodSelection>(getDefaultFinancialPeriodSelection());
  const [search, setSearch] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [supplierId, setSupplierId] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [page, setPage] = useState(1);

  const [lookups, setLookups] = useState<LookupData>({ suppliers: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PurchaseInvoiceResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketTarget, setTicketTarget] = useState<PurchaseInvoiceItem | null>(null);
  const [ticketReason, setTicketReason] = useState<AccountantPurchaseTicketReason>('missing_invoice');
  const [ticketNote, setTicketNote] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  function extractFileName(disposition: string | null, fallback: string) {
    if (!disposition) return fallback;
    const match = disposition.match(/filename="?([^\"]+)"?/i);
    return match?.[1] || fallback;
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadLookups() {
      setLookupLoading(true);
      try {
        const response = await fetch('/api/accountant/lookups', { cache: 'no-store', signal: controller.signal });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: LookupData } | null;
        if (response.ok && payload?.success && payload.data) {
          setLookups(payload.data);
        }
      } catch (lookupError) {
        if (controller.signal.aborted || isAbortError(lookupError)) {
          return;
        }
      } finally {
        if (!controller.signal.aborted) {
          setLookupLoading(false);
        }
      }
    }

    void loadLookups();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [period, search, paymentStatus, supplierId, categoryId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInvoices() {
      setLoading(true);
      setError(null);

      try {
        const params = buildFinancialPeriodSearchParams(period);
        params.set('page', String(page));
        params.set('limit', '12');
        if (search.trim()) params.set('search', search.trim());
        if (paymentStatus !== 'all') params.set('paymentStatus', paymentStatus);
        if (supplierId !== 'all') params.set('supplierId', supplierId);
        if (categoryId !== 'all') params.set('categoryId', categoryId);

        const response = await fetch(`/api/accountant/purchase-invoices?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: PurchaseInvoiceResponse } | null;

        if (!response.ok || !payload?.success || !payload.data) {
          setError(payload?.message || 'Failed to load purchase invoices');
          setData(null);
          return;
        }

        setData(payload.data);
      } catch (fetchError) {
        if (controller.signal.aborted) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load purchase invoices');
        setData(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadInvoices();
    return () => controller.abort();
  }, [period, search, paymentStatus, supplierId, categoryId, page]);

  const totals = useMemo(() => data?.totals, [data]);
  const selectableIds = useMemo(
    () => (data?.items || []).filter((item) => item.attachmentsCount > 0).map((item) => item.id),
    [data]
  );
  const allSelectableChecked = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => selectableIds.includes(id)));
  }, [selectableIds]);

  async function downloadSelectedAttachments() {
    if (selectedIds.length === 0 || downloadingZip) {
      return;
    }

    setDownloadingZip(true);
    try {
      const response = await fetch('/api/accountant/purchase-invoices/attachments-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseIds: selectedIds }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        throw new Error(payload?.message || t.zipFailed);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = extractFileName(response.headers.get('Content-Disposition'), 'purchase-invoice-attachments.zip');
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (zipError) {
      toast.error(zipError instanceof Error ? zipError.message : t.zipFailed);
    } finally {
      setDownloadingZip(false);
    }
  }

  function openTicketDialog(item: PurchaseInvoiceItem) {
    setTicketTarget(item);
    setTicketReason('missing_invoice');
    setTicketNote('');
    setTicketDialogOpen(true);
  }

  async function createTicketFromPurchase() {
    if (!ticketTarget || creatingTicket) {
      return;
    }

    setCreatingTicket(true);
    try {
      const payload = await createAccountantExpenseTicket({
        expenseId: ticketTarget.id,
        reason: ticketReason,
        note: ticketNote.trim() || null,
        locale,
      });

      const createdTicketId = payload.data?.ticketId || payload.ticket?._id;
      if (!createdTicketId) {
        throw new Error(t.ticketCreateFailed);
      }

      toast.success(t.ticketCreated);
      setTicketDialogOpen(false);
      router.push(`/accountant-portal/tickets/${createdTicketId}`);
    } catch (ticketError) {
      toast.error(ticketError instanceof Error ? ticketError.message : t.ticketCreateFailed);
    } finally {
      setCreatingTicket(false);
    }
  }

  const ticketReasonOptions = ACCOUNTANT_PURCHASE_TICKET_REASONS.map((reason) => ({
    value: reason,
    label: t[`ticketReason_${reason}`],
    hint: t[`ticketReason_${reason}_hint`],
  }));

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] py-0 shadow-sm dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.92),rgba(15,23,42,0.82))]">
        <CardHeader className="pt-3 xl:pt-4">
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-4 xl:pb-5">
          <FinancialPeriodSelector value={period} onChange={setPeriod} />
          <p className="text-sm text-muted-foreground">{t.statusFilterHint}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} />
            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t.paymentStatus} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                <SelectItem value="unpaid">{t.unpaid}</SelectItem>
                <SelectItem value="partial">{t.partial}</SelectItem>
                <SelectItem value="paid">{t.paid}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierId} onValueChange={setSupplierId} disabled={lookupLoading}>
              <SelectTrigger>
                <SelectValue placeholder={t.supplier} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                {lookups.suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={lookupLoading}>
              <SelectTrigger>
                <SelectValue placeholder={t.category} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                {lookups.categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{locale === 'fr' ? category.nameFr || category.name : category.nameEn || category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {totals ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden rounded-[24px] border-sky-200/80 bg-sky-50/70 shadow-sm dark:border-sky-950/50 dark:bg-sky-950/20"><CardHeader className="pb-2"><CardDescription>{t.total}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={totals.totalTtcCents} locale={priceLocale} /></div></CardContent></Card>
          <Card className="overflow-hidden rounded-[24px] border-emerald-200/80 bg-emerald-50/70 shadow-sm dark:border-emerald-950/50 dark:bg-emerald-950/20"><CardHeader className="pb-2"><CardDescription>{t.paidTotal}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={totals.totalPaidCents} locale={priceLocale} /></div></CardContent></Card>
          <Card className="overflow-hidden rounded-[24px] border-amber-200/80 bg-amber-50/70 shadow-sm dark:border-amber-950/50 dark:bg-amber-950/20"><CardHeader className="pb-2"><CardDescription>{t.remaining}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={totals.totalRemainingCents} locale={priceLocale} /></div></CardContent></Card>
        </div>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}

      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/92 shadow-sm dark:bg-slate-950/45">
        <CardContent className="pt-4">
          {selectableIds.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 md:flex-row md:items-center md:justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={allSelectableChecked} onCheckedChange={(checked) => setSelectedIds(checked === true ? selectableIds : [])} />
                <span>{t.selectAll}</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">{selectedIds.length} {t.selectedCount}</p>
                  <p className="text-xs text-muted-foreground">{downloadingZip ? t.zipBusyHint : t.zipHint}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => void downloadSelectedAttachments()} disabled={selectedIds.length === 0 || downloadingZip}>
                  {downloadingZip ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {downloadingZip ? t.downloadZipBusy : t.downloadZip}
                </Button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 rounded-lg" />)}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/80 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/30">
              <Table>
                <TableHeader className="bg-slate-50/90 dark:bg-slate-900/70">
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>{t.date}</TableHead>
                    <TableHead>{t.dueDate}</TableHead>
                    <TableHead>{t.supplierColumn}</TableHead>
                    <TableHead>{t.categoryColumn}</TableHead>
                    <TableHead>{t.amounts}</TableHead>
                    <TableHead>{t.payment}</TableHead>
                    <TableHead>{t.attachments}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="border-b border-slate-200/70 dark:border-slate-800/70"
                      style={{ backgroundColor: STATUS_ROW_BG[item.paymentStatus] ?? 'transparent' }}
                    >
                      <TableCell
                        className="border-l-4"
                        style={{ borderLeftColor: STATUS_ACCENT[item.paymentStatus] ?? 'transparent' }}
                      >
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          disabled={item.attachmentsCount === 0}
                          onCheckedChange={(checked) => setSelectedIds((current) => checked === true ? [...current, item.id] : current.filter((id) => id !== item.id))}
                        />
                      </TableCell>
                      <TableCell>{item.expenseDate ? new Date(item.expenseDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</TableCell>
                      <TableCell>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</TableCell>
                      <TableCell>
                        <div className="min-w-40 whitespace-normal">
                          <p className="font-medium text-slate-950">{item.supplier?.fullName || item.supplierRef || '-'}</p>
                          {item.supplier?.companyName ? <p className="text-xs text-muted-foreground">{item.supplier.companyName}</p> : null}
                          {item.supplierRef ? <p className="mt-1 text-[11px] text-muted-foreground">{t.referenceLabel}: {item.supplierRef}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.category ? (
                          <Badge className="bg-slate-100 text-slate-700 ring-1 ring-slate-300 dark:bg-slate-900/60 dark:text-slate-200 dark:ring-slate-700">
                            {locale === 'fr' ? item.category.nameFr || item.category.name : item.category.nameEn || item.category.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5 text-xs">
                          <div className="text-sm font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={item.amountInclVatCents} locale={priceLocale} /></div>
                          <div className="text-muted-foreground">VAT <PriceDisplay cents={item.vatAmountCents} locale={priceLocale} /></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2 text-xs">
                          <Badge className={cn('capitalize', getPaymentBadgeClass(item.paymentStatus))}>
                            {getPaymentLabel(item.paymentStatus, t)}
                          </Badge>
                          <div className="rounded-xl border border-slate-200/70 bg-white/70 px-2.5 py-2 dark:border-slate-800/70 dark:bg-slate-950/40">
                            <div className="flex items-center justify-between gap-3 text-muted-foreground">
                              <span>{t.paidLabel}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200"><PriceDisplay cents={item.amountPaidCents} locale={priceLocale} /></span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-3 text-muted-foreground">
                              <span>{t.remainingLabel}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-200"><PriceDisplay cents={item.amountRemainingCents} locale={priceLocale} /></span>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2.5">
                          {item.attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {item.attachments.slice(0, 2).map((attachment) => (
                                <a
                                  key={attachment.id}
                                  href={attachment.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50"
                                >
                                  <Download className="size-3" />
                                  {attachment.displayName}
                                </a>
                              ))}
                              {item.attachmentsCount > item.attachments.length ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs text-muted-foreground dark:border-slate-700">
                                  <Paperclip className="size-3" />
                                  +{item.attachmentsCount - item.attachments.length}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-auto w-full justify-start whitespace-normal rounded-xl border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                            onClick={() => openTicketDialog(item)}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                                <MessageSquarePlus className="size-4" />
                              </span>
                              <span className="min-w-0 font-semibold text-slate-900">{t.ticketAction}</span>
                            </span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{data.pagination.total} {t.pageSummary}</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={data.pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t.prev}</Button>
                  <span>{data.pagination.page} / {data.pagination.totalPages}</span>
                  <Button type="button" variant="outline" size="sm" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>{t.next}</Button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState message={t.empty} />
          )}
        </CardContent>
      </Card>

      <Dialog open={ticketDialogOpen} onOpenChange={(open) => {
        if (!creatingTicket) {
          setTicketDialogOpen(open);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.ticketDialogTitle}</DialogTitle>
            <DialogDescription>{t.ticketDialogDescription}</DialogDescription>
          </DialogHeader>

          {ticketTarget ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.ticketDialogPurchase}</p>
                <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                  <p className="text-base font-semibold text-slate-950">{ticketTarget.supplier?.fullName || ticketTarget.supplierRef || '-'}</p>
                  <p>{t.referenceLabel}: {ticketTarget.supplierRef || '-'}</p>
                  <p>{t.date}: {ticketTarget.expenseDate ? new Date(ticketTarget.expenseDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</p>
                  <p>{t.total}: <span className="font-semibold"><PriceDisplay cents={ticketTarget.amountInclVatCents} locale={priceLocale} /></span></p>
                  <p>{t.ticketDialogAttachments}: {ticketTarget.attachmentsCount}</p>
                  {ticketTarget.notes ? <p>{t.ticketDialogNotes}: {ticketTarget.notes}</p> : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.ticketDialogReason}</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ticketReasonOptions.map((option) => {
                    const active = ticketReason === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTicketReason(option.value)}
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-left transition-colors',
                          active
                            ? 'border-[#001e3c] bg-[#001e3c]/5 shadow-sm'
                            : 'border-slate-200 bg-white hover:bg-slate-50'
                        )}
                      >
                        <span className="block font-semibold text-slate-950">{option.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase-ticket-note">{t.ticketDialogMessage}</Label>
                <Textarea
                  id="purchase-ticket-note"
                  rows={4}
                  value={ticketNote}
                  onChange={(event) => setTicketNote(event.target.value)}
                  placeholder={t.ticketDialogMessagePlaceholder}
                  maxLength={2500}
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTicketDialogOpen(false)} disabled={creatingTicket}>
              {t.ticketDialogCancel}
            </Button>
            <Button type="button" onClick={() => void createTicketFromPurchase()} disabled={!ticketTarget || creatingTicket}>
              {creatingTicket ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
              {creatingTicket ? t.ticketDialogSubmitting : t.ticketDialogSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}