'use client';

import { useEffect, useState } from 'react';
import { BadgeEuro, CircleDollarSign, FileClock, LineChart as LineChartIcon, PieChartIcon, ReceiptText, Ticket, TrendingUp, Truck } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { FinancialPeriodSelector } from '@/components/dashboard/financial-period-selector';
import { useLocale } from '@/components/providers/locale-provider';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import type {
  FinancialCategorySpendPoint,
  FinancialComparisonPoint,
  FinancialDashboardData,
  FinancialMonthlyTrendPoint,
  FinancialSupplierSpendPoint,
} from '@/hooks/useFinancialDashboard';
import { buildFinancialPeriodSearchParams, getDefaultFinancialPeriodSelection, type FinancialPeriodSelection } from '@/lib/financial-periods';
import { formatCurrencyFromCents } from '@/lib/price';

const PIE_COLORS = ['#0f766e', '#0284c7', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#84cc16'];

type DashboardPayload = FinancialDashboardData & {
  openTicketsAssignedCount: number;
};

const dashboardCopy = {
  en: {
    eyebrow: 'Accounting overview',
    title: 'Accounting dashboard',
    snapshotTitle: 'Period snapshot',
    subtitle: 'Read-only financial view for the assigned company with the same structured UX as the main workspace.',
    snapshotSubtitle: 'A focused summary of the selected reporting window, with key balances and workload signals at a glance.',
    periodLabel: 'Reporting period',
    periodHint: 'The selector drives every KPI on this page.',
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
    items: 'items',
    assignedNow: 'Assigned right now',
    chartsTitle: 'Financial visibility',
    chartsSubtitle: 'Trend and composition charts for the current accounting window.',
    trendTitle: 'Revenue vs expenses trend',
    trendDescription: 'Rolling monthly movement across the last 12 months.',
    trendEmpty: 'No monthly trend is available yet.',
    revenueShort: 'Revenue',
    expensesShort: 'Expenses',
    comparisonTitle: 'Current vs previous period',
    comparisonDescription: 'Fast comparison for the main financial signals.',
    comparisonEmpty: 'No comparison data is available yet.',
    current: 'Current',
    previous: 'Previous',
    categoryTitle: 'Expenses by category',
    categoryDescription: 'Current-period spend composition.',
    categoryEmpty: 'No category split is available for this period.',
    supplierTitle: 'Top suppliers by spend',
    supplierDescription: 'Largest purchase exposure in the selected window.',
    supplierEmpty: 'No supplier spend is available for this period.',
    spend: 'Spend',
  },
  fr: {
    eyebrow: 'Vue comptable',
    title: 'Tableau comptable',
    snapshotTitle: 'Vue rapide de la periode',
    subtitle: 'Vue financiere en lecture seule pour l entreprise attribuee avec une UX alignee sur l espace principal.',
    snapshotSubtitle: 'Un resume cible de la fenetre comptable selectionnee avec les soldes clefs et la charge en cours.',
    periodLabel: 'Periode d analyse',
    periodHint: 'Le selecteur pilote tous les indicateurs de cette page.',
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
    items: 'elements',
    assignedNow: 'Assignes maintenant',
    chartsTitle: 'Visibilite financiere',
    chartsSubtitle: 'Graphiques de tendance et de repartition pour la periode comptable courante.',
    trendTitle: 'Tendance revenus vs depenses',
    trendDescription: 'Evolution mensuelle glissante sur 12 mois.',
    trendEmpty: 'Aucune tendance mensuelle disponible.',
    revenueShort: 'Revenus',
    expensesShort: 'Depenses',
    comparisonTitle: 'Periode actuelle vs precedente',
    comparisonDescription: 'Comparaison rapide des principaux signaux financiers.',
    comparisonEmpty: 'Aucune comparaison disponible.',
    current: 'Actuelle',
    previous: 'Precedente',
    categoryTitle: 'Depenses par categorie',
    categoryDescription: 'Repartition des depenses sur la periode.',
    categoryEmpty: 'Aucune repartition categorie disponible sur cette periode.',
    supplierTitle: 'Top fournisseurs par depense',
    supplierDescription: 'Exposition achat la plus forte sur la fenetre selectionnee.',
    supplierEmpty: 'Aucune depense fournisseur disponible sur cette periode.',
    spend: 'Depense',
  },
} as const;

const metricToneClasses = {
  sky: 'from-sky-500/18 via-sky-500/8 to-transparent text-sky-700 dark:text-sky-300',
  emerald: 'from-emerald-500/18 via-emerald-500/8 to-transparent text-emerald-700 dark:text-emerald-300',
  amber: 'from-amber-500/18 via-amber-500/8 to-transparent text-amber-700 dark:text-amber-300',
  violet: 'from-violet-500/18 via-violet-500/8 to-transparent text-violet-700 dark:text-violet-300',
  rose: 'from-rose-500/18 via-rose-500/8 to-transparent text-rose-700 dark:text-rose-300',
} as const;

function DashboardMetricCard({
  label,
  cents,
  priceLocale,
  footer,
  icon: Icon,
  tone,
}: {
  label: string;
  cents?: number;
  priceLocale: string;
  footer?: string;
  icon: typeof CircleDollarSign;
  tone: keyof typeof metricToneClasses;
}) {
  return (
    <Card className="overflow-hidden rounded-[24px] border-border/70 bg-white/90 shadow-sm dark:bg-slate-950/45">
      <CardHeader className="relative gap-3 pb-2">
        <div className={`absolute inset-x-0 top-0 h-20 bg-linear-to-br ${metricToneClasses[tone]}`} />
        <div className="relative flex items-start justify-between gap-3">
          <CardDescription className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</CardDescription>
          <div className="rounded-2xl border border-white/70 bg-white/80 p-2 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70">
            <Icon className="size-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative space-y-2">
        <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
          <PriceDisplay cents={cents || 0} locale={priceLocale} />
        </div>
        {footer ? <p className="text-xs text-muted-foreground">{footer}</p> : null}
      </CardContent>
    </Card>
  );
}

function ChartEmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-border/70 px-4 py-10 text-center text-sm text-muted-foreground">{message}</div>;
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function MonthlyTrendChart({ data, loading, locale, title, description, empty, revenueLabel, expensesLabel }: {
  data: FinancialMonthlyTrendPoint[];
  loading: boolean;
  locale: string;
  title: string;
  description: string;
  empty: string;
  revenueLabel: string;
  expensesLabel: string;
}) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const chartConfig = {
    revenueExclVatCents: { label: revenueLabel, color: '#0f766e' },
    expensesExclVatCents: { label: expensesLabel, color: '#b45309' },
  } satisfies ChartConfig;

  return (
    <Card className="overflow-hidden rounded-[24px] border-border/70 bg-white/90 shadow-sm dark:bg-slate-950/45 xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><LineChartIcon className="size-4" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-2xl" />
        ) : data.length === 0 ? (
          <ChartEmptyState message={empty} />
        ) : (
          <ChartContainer className="h-72 w-full" config={chartConfig}>
            <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrencyFromCents(Number(value), priceLocale, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={(value, name) => (
                      <div className="flex min-w-48 items-center justify-between gap-3">
                        <span className="text-muted-foreground">{String(name)}</span>
                        <span className="font-medium text-foreground">{formatCurrencyFromCents(Number(value), priceLocale)}</span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="revenueExclVatCents" stroke="var(--color-revenueExclVatCents)" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="expensesExclVatCents" stroke="var(--color-expensesExclVatCents)" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ComparisonChart({ data, loading, locale, title, description, empty, currentLabel, previousLabel }: {
  data: FinancialComparisonPoint[];
  loading: boolean;
  locale: string;
  title: string;
  description: string;
  empty: string;
  currentLabel: string;
  previousLabel: string;
}) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const chartConfig = {
    currentCents: { label: currentLabel, color: '#0f766e' },
    previousCents: { label: previousLabel, color: '#94a3b8' },
  } satisfies ChartConfig;

  return (
    <Card className="overflow-hidden rounded-[24px] border-border/70 bg-white/90 shadow-sm dark:bg-slate-950/45">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="size-4" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-2xl" />
        ) : data.length === 0 ? (
          <ChartEmptyState message={empty} />
        ) : (
          <ChartContainer className="h-72 w-full" config={chartConfig}>
            <BarChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={52} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrencyFromCents(Number(value), priceLocale, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-48 items-center justify-between gap-3">
                        <span className="text-muted-foreground">{String(name)}</span>
                        <span className="font-medium text-foreground">{formatCurrencyFromCents(Number(value), priceLocale)}</span>
                      </div>
                    )}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="currentCents" radius={[8, 8, 0, 0]} fill="var(--color-currentCents)" />
              <Bar dataKey="previousCents" radius={[8, 8, 0, 0]} fill="var(--color-previousCents)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function CategorySpendChart({ data, loading, locale, title, description, empty }: {
  data: FinancialCategorySpendPoint[];
  loading: boolean;
  locale: string;
  title: string;
  description: string;
  empty: string;
}) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const chartConfig = Object.fromEntries(
    data.map((row, index) => [row.label, { label: row.label, color: PIE_COLORS[index % PIE_COLORS.length] }])
  ) satisfies ChartConfig;

  return (
    <Card className="overflow-hidden rounded-[24px] border-border/70 bg-white/90 shadow-sm dark:bg-slate-950/45">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><PieChartIcon className="size-4" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-2xl" />
        ) : data.length === 0 ? (
          <ChartEmptyState message={empty} />
        ) : (
          <ChartContainer className="h-72 w-full" config={chartConfig}>
            <PieChart>
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-48 items-center justify-between gap-3">
                        <span className="text-muted-foreground">{String(name)}</span>
                        <span className="font-medium text-foreground">{formatCurrencyFromCents(Number(value), priceLocale)}</span>
                      </div>
                    )}
                  />
                }
              />
              <Pie data={data} dataKey="totalCents" nameKey="label" innerRadius={64} outerRadius={92} paddingAngle={3}>
                {data.map((entry, index) => (
                  <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="label" className="flex-wrap gap-2 pt-4" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function SupplierSpendChart({ data, loading, locale, title, description, empty, spendLabel }: {
  data: FinancialSupplierSpendPoint[];
  loading: boolean;
  locale: string;
  title: string;
  description: string;
  empty: string;
  spendLabel: string;
}) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const chartConfig = {
    totalCents: { label: spendLabel, color: '#0369a1' },
  } satisfies ChartConfig;

  return (
    <Card className="overflow-hidden rounded-[24px] border-border/70 bg-white/90 shadow-sm dark:bg-slate-950/45 xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Truck className="size-4" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-2xl" />
        ) : data.length === 0 ? (
          <ChartEmptyState message={empty} />
        ) : (
          <ChartContainer className="h-72 w-full" config={chartConfig}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatCurrencyFromCents(Number(value), priceLocale, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })}
              />
              <YAxis type="category" dataKey="label" width={120} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => (
                      <div className="flex min-w-48 items-center justify-between gap-3">
                        <span className="text-muted-foreground">{String(name)}</span>
                        <span className="font-medium text-foreground">{formatCurrencyFromCents(Number(value), priceLocale)}</span>
                      </div>
                    )}
                  />
                }
              />
              <Bar dataKey="totalCents" radius={[0, 8, 8, 0]} fill="var(--color-totalCents)" />
            </BarChart>
          </ChartContainer>
        )}
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

  const overviewPills = data
    ? [
        { key: 'sales', label: t.unpaidSales, value: `${data.metrics.unpaidSalesCount} ${t.items}` },
        { key: 'purchase', label: t.unpaidPurchase, value: `${data.metrics.unpaidPurchaseCount} ${t.items}` },
        { key: 'tickets', label: t.assignedNow, value: `${data.openTicketsAssignedCount}` },
      ]
    : [];

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
      <Card className="overflow-hidden rounded-[28px] border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] shadow-sm dark:bg-[linear-gradient(135deg,rgba(2,6,23,0.92),rgba(15,23,42,0.82))]">
        <CardContent className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)] xl:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300">
                {t.eyebrow}
              </span>
              <div className="space-y-2">
                <CardTitle className="text-2xl tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
                  {data?.period.label || t.snapshotTitle}
                </CardTitle>
                <CardDescription className="max-w-2xl text-sm leading-6">{t.snapshotSubtitle}</CardDescription>
              </div>
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : overviewPills.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {overviewPills.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/50">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">{item.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[24px] border border-slate-200/80 bg-white/88 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/55">
            <div className="mb-3 space-y-1">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{t.periodLabel}</p>
              <p className="text-xs text-muted-foreground">{t.periodHint}</p>
            </div>
            <FinancialPeriodSelector value={period} onChange={setPeriod} />
          </div>
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
            <DashboardMetricCard label={t.revenue} cents={data.metrics.totalRevenueExclVatCents} priceLocale={priceLocale} footer={data.period.label} icon={CircleDollarSign} tone="sky" />
            <DashboardMetricCard label={t.expenses} cents={data.metrics.totalExpensesExclVatCents} priceLocale={priceLocale} footer={data.period.label} icon={ReceiptText} tone="amber" />
            <DashboardMetricCard label={t.grossProfit} cents={data.metrics.grossProfitCents} priceLocale={priceLocale} footer={data.period.label} icon={BadgeEuro} tone="emerald" />
            <DashboardMetricCard label={t.collectedVat} cents={data.metrics.collectedVatCents} priceLocale={priceLocale} icon={CircleDollarSign} tone="sky" />
            <DashboardMetricCard label={t.deductibleVat} cents={data.metrics.deductibleVatCents} priceLocale={priceLocale} icon={BadgeEuro} tone="violet" />
            <DashboardMetricCard label={t.vatBalance} cents={data.metrics.vatBalanceCents} priceLocale={priceLocale} icon={FileClock} tone="rose" />
            <DashboardMetricCard
              label={t.unpaidSales}
              cents={data.metrics.unpaidSalesTotalCents}
              priceLocale={priceLocale}
              footer={`${data.metrics.unpaidSalesCount} ${t.items}`}
              icon={ReceiptText}
              tone="sky"
            />
            <DashboardMetricCard
              label={t.unpaidPurchase}
              cents={data.metrics.unpaidPurchaseTotalCents}
              priceLocale={priceLocale}
              footer={`${data.metrics.unpaidPurchaseCount} ${t.items}`}
              icon={FileClock}
              tone="amber"
            />
            <Card className="overflow-hidden rounded-[24px] border-border/70 bg-white/90 shadow-sm dark:bg-slate-950/45">
              <CardHeader className="relative gap-3 pb-2">
                <div className="absolute inset-x-0 top-0 h-20 bg-linear-to-br from-violet-500/18 via-violet-500/8 to-transparent" />
                <div className="relative flex items-start justify-between gap-3">
                  <CardDescription className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.assignedTickets}</CardDescription>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-2 shadow-sm dark:border-slate-800/70 dark:bg-slate-950/70">
                    <Ticket className="size-4 text-violet-700 dark:text-violet-300" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{data.openTicketsAssignedCount}</div>
                <p className="text-xs text-muted-foreground">{data.period.label}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4 pt-2">
            <SectionHeading title={t.chartsTitle} description={t.chartsSubtitle} />
            <div className="grid gap-4 xl:grid-cols-3">
              <MonthlyTrendChart
                data={data.charts.monthlyTrend}
                loading={loading}
                locale={locale}
                title={t.trendTitle}
                description={t.trendDescription}
                empty={t.trendEmpty}
                revenueLabel={t.revenueShort}
                expensesLabel={t.expensesShort}
              />
              <ComparisonChart
                data={data.charts.currentPeriodVsPreviousPeriod}
                loading={loading}
                locale={locale}
                title={t.comparisonTitle}
                description={t.comparisonDescription}
                empty={t.comparisonEmpty}
                currentLabel={t.current}
                previousLabel={t.previous}
              />
              <CategorySpendChart
                data={data.charts.expensesByCategory}
                loading={loading}
                locale={locale}
                title={t.categoryTitle}
                description={t.categoryDescription}
                empty={t.categoryEmpty}
              />
              <SupplierSpendChart
                data={data.charts.topSuppliersBySpend}
                loading={loading}
                locale={locale}
                title={t.supplierTitle}
                description={t.supplierDescription}
                empty={t.supplierEmpty}
                spendLabel={t.spend}
              />
            </div>
          </div>
        </>
      ) : (
        <EmptyState message={t.empty} />
      )}
    </div>
  );
}