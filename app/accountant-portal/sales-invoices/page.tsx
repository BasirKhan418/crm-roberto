'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';

import { FinancialPeriodSelector } from '@/components/dashboard/financial-period-selector';
import { useLocale } from '@/components/providers/locale-provider';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { InvoiceStatusBadge, type InvoiceStatus } from '@/components/ui/InvoiceStatusBadge';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildFinancialPeriodSearchParams, getDefaultFinancialPeriodSelection, type FinancialPeriodSelection } from '@/lib/financial-periods';

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
  },
} as const;

export default function AccountantPortalSalesInvoicesPage() {
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
        if (controller.signal.aborted) return;
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

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FinancialPeriodSelector value={period} onChange={setPeriod} />
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
          <Card className="border-border/70 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{t.total}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold"><PriceDisplay cents={totals.totalIncludingTaxCents} locale={priceLocale} /></div></CardContent></Card>
          <Card className="border-border/70 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{t.paid}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold"><PriceDisplay cents={totals.totalPaidCents} locale={priceLocale} /></div></CardContent></Card>
          <Card className="border-border/70 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{t.remaining}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold"><PriceDisplay cents={totals.totalRemainingCents} locale={priceLocale} /></div></CardContent></Card>
        </div>
      ) : null}

      {error ? <ErrorMessage message={error} /> : null}

      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardContent className="pt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 rounded-lg" />)}
            </div>
          ) : data && data.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
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
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-slate-950">{item.invoiceNumber}</TableCell>
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
                        <div className="space-y-1 text-xs">
                          <div><PriceDisplay cents={item.totalIncludingTaxCents} locale={priceLocale} /></div>
                          <div className="text-muted-foreground">ex VAT <PriceDisplay cents={item.totalExcludingTaxCents} locale={priceLocale} /></div>
                          <div className="text-muted-foreground">VAT <PriceDisplay cents={item.totalVatCents} locale={priceLocale} /></div>
                        </div>
                      </TableCell>
                      <TableCell><PriceDisplay cents={item.amountPaidCents} locale={priceLocale} /></TableCell>
                      <TableCell><PriceDisplay cents={item.amountRemainingCents} locale={priceLocale} /></TableCell>
                      <TableCell>
                        <a
                          href={item.pdfDownloadUrl}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Download className="size-3" />
                          PDF
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{data.pagination.total} item(s)</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-50" disabled={data.pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Prev</button>
                  <span>{data.pagination.page} / {data.pagination.totalPages}</span>
                  <button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-50" disabled={data.pagination.page >= data.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState message={t.empty} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}