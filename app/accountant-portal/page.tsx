'use client';

import { useEffect, useState } from 'react';

import { FinancialPeriodSelector } from '@/components/dashboard/financial-period-selector';
import { useLocale } from '@/components/providers/locale-provider';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buildFinancialPeriodSearchParams, getDefaultFinancialPeriodSelection, type FinancialPeriodSelection } from '@/lib/financial-periods';

type DashboardMetrics = {
  totalExpensesExclVatCents: number;
  totalRevenueExclVatCents: number;
  grossProfitCents: number;
  collectedVatCents: number;
  deductibleVatCents: number;
  vatBalanceCents: number;
  unpaidPurchaseCount: number;
  unpaidPurchaseTotalCents: number;
  unpaidSalesCount: number;
  unpaidSalesTotalCents: number;
};

type DashboardPayload = {
  metrics: DashboardMetrics;
  period: { label: string };
  openTicketsAssignedCount: number;
};

const dashboardCopy = {
  en: {
    title: 'Accounting dashboard',
    subtitle: 'Read-only financial view for the assigned company.',
    revenue: 'Revenue excl. VAT',
    expenses: 'Expenses excl. VAT',
    grossProfit: 'Gross profit',
    collectedVat: 'Collected VAT',
    deductibleVat: 'Deductible VAT',
    vatBalance: 'VAT balance',
    unpaidSales: 'Unpaid sales invoices',
    unpaidPurchase: 'Unpaid purchase invoices',
    assignedTickets: 'Open tickets assigned to you',
    empty: 'No dashboard data is available for this period yet.',
  },
  fr: {
    title: 'Tableau comptable',
    subtitle: 'Vue financiere en lecture seule pour l entreprise attribuee.',
    revenue: 'Chiffre d affaires HT',
    expenses: 'Achats HT',
    grossProfit: 'Marge brute',
    collectedVat: 'TVA collectee',
    deductibleVat: 'TVA deductible',
    vatBalance: 'Solde TVA',
    unpaidSales: 'Factures clients impayees',
    unpaidPurchase: 'Factures fournisseurs impayees',
    assignedTickets: 'Tickets ouverts qui vous sont assignes',
    empty: 'Aucune donnee comptable disponible pour cette periode.',
  },
} as const;

function DashboardMetricCard({
  label,
  cents,
  priceLocale,
  footer,
}: {
  label: string;
  cents?: number;
  priceLocale: string;
  footer?: string;
}) {
  return (
    <Card className="border-border/70 bg-white/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold text-slate-950">
          <PriceDisplay cents={cents || 0} locale={priceLocale} />
        </div>
        {footer ? <p className="text-xs text-muted-foreground">{footer}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function AccountantPortalDashboardPage() {
  const { locale } = useLocale();
  const t = dashboardCopy[locale];
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';

  const [period, setPeriod] = useState<FinancialPeriodSelection>(getDefaultFinancialPeriodSelection());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/accountant/dashboard?${buildFinancialPeriodSearchParams(period).toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string; data?: DashboardPayload } | null;

        if (!response.ok || !payload?.success || !payload.data) {
          setError(payload?.message || 'Failed to load dashboard');
          setData(null);
          return;
        }

        setData(payload.data);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard');
        setData(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [period]);

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardHeader>
          <CardTitle>{t.title}</CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent>
          <FinancialPeriodSelector value={period} onChange={setPeriod} />
        </CardContent>
      </Card>

      {error ? <ErrorMessage message={error} /> : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DashboardMetricCard label={t.revenue} cents={data.metrics.totalRevenueExclVatCents} priceLocale={priceLocale} footer={data.period.label} />
            <DashboardMetricCard label={t.expenses} cents={data.metrics.totalExpensesExclVatCents} priceLocale={priceLocale} footer={data.period.label} />
            <DashboardMetricCard label={t.grossProfit} cents={data.metrics.grossProfitCents} priceLocale={priceLocale} footer={data.period.label} />
            <DashboardMetricCard label={t.collectedVat} cents={data.metrics.collectedVatCents} priceLocale={priceLocale} />
            <DashboardMetricCard label={t.deductibleVat} cents={data.metrics.deductibleVatCents} priceLocale={priceLocale} />
            <DashboardMetricCard label={t.vatBalance} cents={data.metrics.vatBalanceCents} priceLocale={priceLocale} />
            <DashboardMetricCard
              label={t.unpaidSales}
              cents={data.metrics.unpaidSalesTotalCents}
              priceLocale={priceLocale}
              footer={`${data.metrics.unpaidSalesCount} item(s)`}
            />
            <DashboardMetricCard
              label={t.unpaidPurchase}
              cents={data.metrics.unpaidPurchaseTotalCents}
              priceLocale={priceLocale}
              footer={`${data.metrics.unpaidPurchaseCount} item(s)`}
            />
            <Card className="border-border/70 bg-white/90 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>{t.assignedTickets}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-slate-950">{data.openTicketsAssignedCount}</div>
                <p className="text-xs text-muted-foreground">{data.period.label}</p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <EmptyState message={t.empty} />
      )}
    </div>
  );
}