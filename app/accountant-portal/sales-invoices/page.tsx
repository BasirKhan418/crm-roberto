'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

import { FinancialPeriodSelector } from '@/components/dashboard/financial-period-selector';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { InvoiceStatusBadge, type InvoiceStatus } from '@/components/ui/InvoiceStatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { createAccountantInvoiceTicket } from '@/hooks/useAccountantTickets';
import { buildFinancialPeriodSearchParams, getDefaultFinancialPeriodSelection, type FinancialPeriodSelection } from '@/lib/financial-periods';
import { ACCOUNTANT_SALES_TICKET_REASONS, type AccountantSalesTicketReason } from '@/lib/tickets/accountant-sales-ticket';
import { cn } from '@/lib/utils';

type SalesInvoiceItem = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientCompanyName: string | null;
  date: string | null;
  dueDate: string | null;
  status: InvoiceStatus;
  totalExcludingTaxCents: number;
  totalVatCents: number;
  totalIncludingTaxCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  pdfDownloadUrl: string;
};

type SalesInvoiceResponse = {
  items: SalesInvoiceItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totals: { totalIncludingTaxCents: number; totalPaidCents: number; totalRemainingCents: number };
};

const salesCopy = {
  en: {
    title: 'Sales invoices',
    subtitle: 'Company-wide receivables with accountant-safe PDF access.',
    search: 'Search invoice number or client',
    status: 'Status',
    all: 'All',
    date: 'Date',
    dueDate: 'Due date',
    invoice: 'Invoice',
    client: 'Client',
    amounts: 'Amounts',
    paid: 'Paid',
    remaining: 'Remaining',
    pdf: 'PDF',
    empty: 'No sales invoices match these filters.',
    total: 'Total incl. VAT',
    filterHint: 'Accounting-safe visibility into invoice status, collection progress, and document access.',
    pageSummary: 'results',
    prev: 'Prev',
    next: 'Next',
    exVat: 'ex VAT',
    ticketAction: 'Create ticket',
    ticketActionHint: 'Open an invoice-linked thread in ROBY',
    ticketDialogTitle: 'Create invoice ticket',
    ticketDialogDescription: 'Start a linked ticket from this invoice and open the conversation immediately.',
    ticketDialogReason: 'Issue type',
    ticketDialogMessage: 'Accountant note',
    ticketDialogMessagePlaceholder: 'Add the exact clarification or document request the team should answer.',
    ticketDialogInvoice: 'Selected invoice',
    ticketDialogClient: 'Client',
    ticketDialogCancel: 'Cancel',
    ticketDialogSubmit: 'Create ticket and open thread',
    ticketDialogSubmitting: 'Creating ticket...',
    ticketCreated: 'Ticket created. Opening thread...',
    ticketCreateFailed: 'Failed to create invoice ticket',
    ticketReason_payment_clarification: 'Payment clarification',
    ticketReason_payment_clarification_hint: 'Ask the team to clarify what was paid and what remains outstanding.',
    ticketReason_missing_payment_proof: 'Missing payment proof',
    ticketReason_missing_payment_proof_hint: 'Request transfer proof, receipt, or supporting payment evidence.',
    ticketReason_accounting_question: 'Accounting question',
    ticketReason_accounting_question_hint: 'Raise a question about treatment, status, or collection handling.',
    ticketReason_invoice_dispute: 'Invoice dispute',
    ticketReason_invoice_dispute_hint: 'Open a dispute thread for amount, terms, or invoice content.',
  },
  fr: {
    title: 'Factures de vente',
    subtitle: 'Creances de l entreprise avec acces PDF securise pour le comptable.',
    search: 'Rechercher numero de facture ou client',
    status: 'Statut',
    all: 'Tous',
    date: 'Date',
    dueDate: 'Echeance',
    invoice: 'Facture',
    client: 'Client',
    amounts: 'Montants',
    paid: 'Paye',
    remaining: 'Reste',
    pdf: 'PDF',
    empty: 'Aucune facture de vente ne correspond a ces filtres.',
    total: 'Total TTC',
    filterHint: 'Visibilite comptable sur les statuts facture, l avancement des encaissements et les documents.',
    pageSummary: 'resultats',
    prev: 'Prec',
    next: 'Suiv',
    exVat: 'HT',
    ticketAction: 'Creer un ticket',
    ticketActionHint: 'Ouvrir un fil lie a la facture dans ROBY',
    ticketDialogTitle: 'Creer un ticket facture',
    ticketDialogDescription: 'Demarrez un ticket lie a cette facture et ouvrez la conversation immediatement.',
    ticketDialogReason: 'Type de demande',
    ticketDialogMessage: 'Note comptable',
    ticketDialogMessagePlaceholder: 'Ajoutez la clarification precise ou la demande documentaire a traiter.',
    ticketDialogInvoice: 'Facture selectionnee',
    ticketDialogClient: 'Client',
    ticketDialogCancel: 'Annuler',
    ticketDialogSubmit: 'Creer le ticket et ouvrir le fil',
    ticketDialogSubmitting: 'Creation du ticket...',
    ticketCreated: 'Ticket cree. Ouverture du fil...',
    ticketCreateFailed: 'Impossible de creer le ticket facture',
    ticketReason_payment_clarification: 'Clarification de paiement',
    ticketReason_payment_clarification_hint: 'Demandez a l equipe de clarifier ce qui a ete paye et ce qui reste ouvert.',
    ticketReason_missing_payment_proof: 'Preuve de paiement manquante',
    ticketReason_missing_payment_proof_hint: 'Demandez la preuve de virement, le recu ou tout justificatif de paiement.',
    ticketReason_accounting_question: 'Question comptable',
    ticketReason_accounting_question_hint: 'Soulevez une question sur le traitement, le statut ou le recouvrement.',
    ticketReason_invoice_dispute: 'Litige sur facture',
    ticketReason_invoice_dispute_hint: 'Ouvrez un fil de litige sur le montant, les conditions ou le contenu.',
  },
} as const;

const STATUS_ROW_BG: Record<InvoiceStatus, string> = {
  unpaid: 'rgba(100, 116, 139, 0.04)',
  partial_paid: 'rgba(217, 119, 6, 0.06)',
  paid: 'rgba(34, 197, 94, 0.05)',
  overdue: 'rgba(239, 68, 68, 0.055)',
};

const STATUS_ACCENT: Record<InvoiceStatus, string> = {
  unpaid: '#475569',
  partial_paid: '#b45309',
  paid: '#15803d',
  overdue: '#b91c1c',
};

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export default function AccountantPortalSalesInvoicesPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = salesCopy[locale];
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';

  const [period, setPeriod] = useState<FinancialPeriodSelection>(getDefaultFinancialPeriodSelection());
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SalesInvoiceResponse | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketTarget, setTicketTarget] = useState<SalesInvoiceItem | null>(null);
  const [ticketReason, setTicketReason] = useState<AccountantSalesTicketReason>('payment_clarification');
  const [ticketNote, setTicketNote] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [period, search, status]);

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
        if (status !== 'all') params.set('status', status);

        const response = await fetch(`/api/accountant/sales-invoices?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: SalesInvoiceResponse } | null;

        if (!response.ok || !payload?.success || !payload.data) {
          setError(payload?.message || 'Failed to load sales invoices');
          setData(null);
          return;
        }

        setData(payload.data);
      } catch (fetchError) {
        if (controller.signal.aborted || isAbortError(fetchError)) return;
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load sales invoices');
        setData(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadInvoices();
    return () => controller.abort();
  }, [period, search, status, page]);

  const totals = useMemo(() => data?.totals, [data]);

  function openTicketDialog(item: SalesInvoiceItem) {
    setTicketTarget(item);
    setTicketReason('payment_clarification');
    setTicketNote('');
    setTicketDialogOpen(true);
  }

  async function createTicketFromInvoice() {
    if (!ticketTarget || creatingTicket) {
      return;
    }

    setCreatingTicket(true);
    try {
      const payload = await createAccountantInvoiceTicket({
        invoiceId: ticketTarget.id,
        reason: ticketReason,
        note: ticketNote.trim() || null,
        locale,
      });

      const createdTicketId = payload.data?.ticketId || payload.ticket?._id;
      if (!createdTicketId) {
        throw new Error(t.ticketCreateFailed);
      }

      setTicketDialogOpen(false);
      toast.success(t.ticketCreated);
      router.push(`/accountant-portal/tickets/${createdTicketId}`);
    } catch (ticketError) {
      toast.error(ticketError instanceof Error ? ticketError.message : t.ticketCreateFailed);
    } finally {
      setCreatingTicket(false);
    }
  }

  const ticketReasonOptions = ACCOUNTANT_SALES_TICKET_REASONS.map((reason) => ({
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
          <p className="text-sm text-muted-foreground">{t.filterHint}</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.all}</SelectItem>
                <SelectItem value="unpaid">unpaid</SelectItem>
                <SelectItem value="partial_paid">partial paid</SelectItem>
                <SelectItem value="paid">paid</SelectItem>
                <SelectItem value="overdue">overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {totals ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="overflow-hidden rounded-[24px] border-sky-200/80 bg-sky-50/70 shadow-sm dark:border-sky-950/50 dark:bg-sky-950/20"><CardHeader className="pb-2"><CardDescription>{t.total}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={totals.totalIncludingTaxCents} locale={priceLocale} /></div></CardContent></Card>
          <Card className="overflow-hidden rounded-[24px] border-emerald-200/80 bg-emerald-50/70 shadow-sm dark:border-emerald-950/50 dark:bg-emerald-950/20"><CardHeader className="pb-2"><CardDescription>{t.paid}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={totals.totalPaidCents} locale={priceLocale} /></div></CardContent></Card>
          <Card className="overflow-hidden rounded-[24px] border-amber-200/80 bg-amber-50/70 shadow-sm dark:border-amber-950/50 dark:bg-amber-950/20"><CardHeader className="pb-2"><CardDescription>{t.remaining}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={totals.totalRemainingCents} locale={priceLocale} /></div></CardContent></Card>
        </div>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}

      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-white/92 shadow-sm dark:bg-slate-950/45">
        <CardContent className="pt-4">
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
                    <TableHead>{t.invoice}</TableHead>
                    <TableHead>{t.client}</TableHead>
                    <TableHead>{t.date}</TableHead>
                    <TableHead>{t.dueDate}</TableHead>
                    <TableHead>{t.status}</TableHead>
                    <TableHead>{t.amounts}</TableHead>
                    <TableHead>{t.paid}</TableHead>
                    <TableHead>{t.remaining}</TableHead>
                    <TableHead>{t.pdf}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((item) => (
                    <TableRow
                      key={item.id}
                      className="border-b border-slate-200/70 dark:border-slate-800/70"
                      style={{ backgroundColor: STATUS_ROW_BG[item.status] }}
                    >
                      <TableCell
                        className="border-l-4"
                        style={{ borderLeftColor: STATUS_ACCENT[item.status] }}
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-950 dark:text-slate-50">{item.invoiceNumber}</p>
                          <p className="text-[11px] text-muted-foreground">{item.status.replace('_', ' ')}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-44 whitespace-normal">
                          <p className="font-medium text-slate-950">{item.clientName}</p>
                          {item.clientCompanyName ? <p className="text-xs text-muted-foreground">{item.clientCompanyName}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell>{item.date ? new Date(item.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</TableCell>
                      <TableCell>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</TableCell>
                      <TableCell><InvoiceStatusBadge status={item.status} locale={locale} /></TableCell>
                      <TableCell>
                        <div className="space-y-1.5 text-xs">
                          <div className="text-sm font-semibold text-slate-950 dark:text-slate-50"><PriceDisplay cents={item.totalIncludingTaxCents} locale={priceLocale} /></div>
                          <div className="text-muted-foreground">{t.exVat} <PriceDisplay cents={item.totalExcludingTaxCents} locale={priceLocale} /></div>
                          <div className="text-muted-foreground">VAT <PriceDisplay cents={item.totalVatCents} locale={priceLocale} /></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-slate-900 dark:text-slate-100"><PriceDisplay cents={item.amountPaidCents} locale={priceLocale} /></span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'font-medium',
                          item.amountRemainingCents > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'
                        )}>
                          <PriceDisplay cents={item.amountRemainingCents} locale={priceLocale} />
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-2.5">
                          <a
                            href={item.pdfDownloadUrl}
                            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300 dark:hover:bg-sky-950/50"
                          >
                            <Download className="size-3" />
                            PDF
                          </a>
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
                              <span className="min-w-0">
                                <span className="block font-semibold text-slate-900">{t.ticketAction}</span>
                                <span className="block text-xs font-normal text-muted-foreground">{t.ticketActionHint}</span>
                              </span>
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
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t.ticketDialogInvoice}</p>
                <div className="mt-2 space-y-1.5 text-sm text-slate-700">
                  <p className="text-base font-semibold text-slate-950">{ticketTarget.invoiceNumber}</p>
                  <p>{t.ticketDialogClient}: {ticketTarget.clientName}</p>
                  {ticketTarget.clientCompanyName ? <p>{ticketTarget.clientCompanyName}</p> : null}
                  <p>{t.date}: {ticketTarget.date ? new Date(ticketTarget.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</p>
                  <p>{t.dueDate}: {ticketTarget.dueDate ? new Date(ticketTarget.dueDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</p>
                  <p>{t.total}: <span className="font-semibold"><PriceDisplay cents={ticketTarget.totalIncludingTaxCents} locale={priceLocale} /></span></p>
                  <p>{t.paid}: <span className="font-semibold"><PriceDisplay cents={ticketTarget.amountPaidCents} locale={priceLocale} /></span></p>
                  <p>{t.remaining}: <span className="font-semibold"><PriceDisplay cents={ticketTarget.amountRemainingCents} locale={priceLocale} /></span></p>
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
                <Label htmlFor="invoice-ticket-note">{t.ticketDialogMessage}</Label>
                <Textarea
                  id="invoice-ticket-note"
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
            <Button type="button" onClick={() => void createTicketFromInvoice()} disabled={!ticketTarget || creatingTicket}>
              {creatingTicket ? <Loader2 className="size-4 animate-spin" /> : <MessageSquarePlus className="size-4" />}
              {creatingTicket ? t.ticketDialogSubmitting : t.ticketDialogSubmit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}