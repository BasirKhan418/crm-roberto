'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, Paperclip } from 'lucide-react';

import { FinancialPeriodSelector } from '@/components/dashboard/financial-period-selector';
import { useLocale } from '@/components/providers/locale-provider';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { buildFinancialPeriodSearchParams, getDefaultFinancialPeriodSelection, type FinancialPeriodSelection } from '@/lib/financial-periods';

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
    empty: 'No purchase invoices match these filters.',
    total: 'Total',
    paidTotal: 'Paid',
    remaining: 'Remaining',
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
    empty: 'Aucune facture d achat ne correspond a ces filtres.',
    total: 'Total',
    paidTotal: 'Paye',
    remaining: 'Reste',
  },
} as const;

export default function AccountantPortalPurchaseInvoicesPage() {
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

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FinancialPeriodSelector value={period} onChange={setPeriod} />
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
          <Card className="border-border/70 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{t.total}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold"><PriceDisplay cents={totals.totalTtcCents} locale={priceLocale} /></div></CardContent></Card>
          <Card className="border-border/70 bg-white/90 shadow-sm"><CardHeader className="pb-2"><CardDescription>{t.paidTotal}</CardDescription></CardHeader><CardContent><div className="text-xl font-semibold"><PriceDisplay cents={totals.totalPaidCents} locale={priceLocale} /></div></CardContent></Card>
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
                    <TableRow key={item.id}>
                      <TableCell>{item.expenseDate ? new Date(item.expenseDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</TableCell>
                      <TableCell>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB') : '-'}</TableCell>
                      <TableCell>
                        <div className="min-w-40 whitespace-normal">
                          <p className="font-medium text-slate-950">{item.supplier?.fullName || item.supplierRef || '-'}</p>
                          {item.supplier?.companyName ? <p className="text-xs text-muted-foreground">{item.supplier.companyName}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell>{locale === 'fr' ? item.category?.nameFr || item.category?.name || '-' : item.category?.nameEn || item.category?.name || '-'}</TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div><PriceDisplay cents={item.amountInclVatCents} locale={priceLocale} /></div>
                          <div className="text-muted-foreground">VAT <PriceDisplay cents={item.vatAmountCents} locale={priceLocale} /></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div className="rounded-full bg-slate-100 px-2 py-1 font-medium capitalize text-slate-700">{item.paymentStatus.replace('_', ' ')}</div>
                          <div className="text-muted-foreground">Paid <PriceDisplay cents={item.amountPaidCents} locale={priceLocale} /></div>
                          <div className="text-muted-foreground">Left <PriceDisplay cents={item.amountRemainingCents} locale={priceLocale} /></div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.attachments.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {item.attachments.slice(0, 2).map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                <Download className="size-3" />
                                {attachment.displayName}
                              </a>
                            ))}
                            {item.attachmentsCount > item.attachments.length ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-200 px-2 py-1 text-xs text-muted-foreground">
                                <Paperclip className="size-3" />
                                +{item.attachmentsCount - item.attachments.length}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
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