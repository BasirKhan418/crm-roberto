'use client';

import { ActivityIcon, ArrowDownRight, ArrowUpRight, CircleAlert, Landmark, PieChartIcon, ReceiptText, TrendingUp, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, XAxis, YAxis } from 'recharts';

import { useLocale } from '@/components/providers/locale-provider';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Badge } from '@/components/ui/badge';
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
  FinancialMetrics,
} from '@/hooks/useFinancialDashboard';
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { formatCurrencyFromCents } from '@/lib/price';

import { FinancialPeriodSelector } from './financial-period-selector';

const PIE_COLORS = ['#0f766e', '#0284c7', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#84cc16'];

type MetricCardDefinition = {
  key: keyof FinancialMetrics;
  label: string;
  description: string;
  icon: typeof TrendingUp;
  tone: 'positive' | 'neutral' | 'warning';
};

function MetricValue({ cents, locale }: { cents: number; locale: string }) {
  return <PriceDisplay cents={cents} locale={locale} className="text-2xl font-semibold tracking-tight text-foreground" />;
}

function FinancialMetricCards({ metrics, loading }: { metrics: FinancialMetrics; loading: boolean }) {
  const { locale } = useLocale();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const t = {
    en: {
      revenue: 'Revenue',
      revenueHint: 'Issued sales invoices, excl. VAT',
      expenses: 'Expenses',
      expensesHint: 'Active purchase invoices, excl. VAT',
      grossProfit: 'Gross profit',
      grossProfitHint: 'Revenue minus expenses',
      collectedVat: 'Collected VAT',
      collectedVatHint: 'Output VAT on sales',
      deductibleVat: 'Deductible VAT',
      deductibleVatHint: 'Recoverable VAT on purchases',
      vatBalance: 'VAT balance',
      vatBalanceHint: 'Collected minus deductible VAT',
    },
    fr: {
      revenue: 'Revenus',
      revenueHint: 'Factures de vente emises, hors TVA',
      expenses: 'Depenses',
      expensesHint: 'Factures achat actives, hors TVA',
      grossProfit: 'Marge brute',
      grossProfitHint: 'Revenus moins depenses',
      collectedVat: 'TVA collectee',
      collectedVatHint: 'TVA sur les ventes',
      deductibleVat: 'TVA deductible',
      deductibleVatHint: 'TVA recuperable sur les achats',
      vatBalance: 'Solde TVA',
      vatBalanceHint: 'TVA collectee moins deductible',
    },
  }[locale];

  const cardDefinitions: MetricCardDefinition[] = [
    { key: 'totalRevenueExclVatCents', label: t.revenue, description: t.revenueHint, icon: TrendingUp, tone: 'positive' },
    { key: 'totalExpensesExclVatCents', label: t.expenses, description: t.expensesHint, icon: ReceiptText, tone: 'neutral' },
    { key: 'grossProfitCents', label: t.grossProfit, description: t.grossProfitHint, icon: Landmark, tone: 'positive' },
    { key: 'collectedVatCents', label: t.collectedVat, description: t.collectedVatHint, icon: Wallet, tone: 'neutral' },
    { key: 'deductibleVatCents', label: t.deductibleVat, description: t.deductibleVatHint, icon: PieChartIcon, tone: 'neutral' },
    { key: 'vatBalanceCents', label: t.vatBalance, description: t.vatBalanceHint, icon: ActivityIcon, tone: 'warning' },
  ];

  const toneClassNames: Record<MetricCardDefinition['tone'], string> = {
    positive: 'border-emerald-200/80 bg-emerald-50/40',
    neutral: 'border-slate-200/80 bg-card',
    warning: 'border-amber-200/80 bg-amber-50/40',
  };

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cardDefinitions.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.key} className={`border ${toneClassNames[card.tone]} shadow-sm`}>
            <CardHeader className="gap-2 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">{card.label}</CardTitle>
                  <CardDescription className="text-xs">{card.description}</CardDescription>
                </div>
                <div className="rounded-full bg-background p-2 text-muted-foreground ring-1 ring-border/70">
                  <Icon className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-8 w-28" /> : <MetricValue cents={metrics[card.key] as number} locale={priceLocale} />}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function ExpensesByCategoryChart({ data, loading }: { data: FinancialCategorySpendPoint[]; loading: boolean }) {
  const { locale } = useLocale();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const t = {
    en: {
      title: 'Expenses by category',
      description: 'Current selection split by spend',
      empty: 'No category data for this period.',
    },
    fr: {
      title: 'Depenses par categorie',
      description: 'Repartition de la periode selectionnee',
      empty: 'Aucune donnee categorie sur cette periode.',
    },
  }[locale];

  const chartConfig = Object.fromEntries(
    data.map((row, index) => [row.label, { label: row.label, color: PIE_COLORS[index % PIE_COLORS.length] }])
  ) satisfies ChartConfig;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-65 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t.empty}</div>
        ) : (
          <ChartContainer className="h-65 w-full" config={chartConfig}>
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
              <Pie data={data} dataKey="totalCents" nameKey="label" innerRadius={62} outerRadius={88} paddingAngle={3}>
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

function MonthlyTrendChart({ data, loading }: { data: FinancialMonthlyTrendPoint[]; loading: boolean }) {
  const { locale } = useLocale();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const t = {
    en: {
      title: '12-month trend',
      description: 'Rolling revenue and expense movement',
      expenses: 'Expenses',
      revenue: 'Revenue',
      empty: 'No monthly trend yet.',
    },
    fr: {
      title: 'Tendance 12 mois',
      description: 'Evolution glissante revenus et depenses',
      expenses: 'Depenses',
      revenue: 'Revenus',
      empty: 'Aucune tendance mensuelle pour le moment.',
    },
  }[locale];

  const chartConfig = {
    revenueExclVatCents: { label: t.revenue, color: '#0f766e' },
    expensesExclVatCents: { label: t.expenses, color: '#b91c1c' },
  } satisfies ChartConfig;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-65 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t.empty}</div>
        ) : (
          <ChartContainer className="h-65 w-full" config={chartConfig}>
            <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrencyFromCents(Number(value), priceLocale, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })} />
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
              <Line type="monotone" dataKey="revenueExclVatCents" stroke="var(--color-revenueExclVatCents)" strokeWidth={2.25} dot={false} />
              <Line type="monotone" dataKey="expensesExclVatCents" stroke="var(--color-expensesExclVatCents)" strokeWidth={2.25} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function FinancialComparisonChart({ data, loading }: { data: FinancialComparisonPoint[]; loading: boolean }) {
  const { locale } = useLocale();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const t = {
    en: {
      title: 'Current vs previous period',
      description: 'Quick comparison on the main financial signals',
      current: 'Current',
      previous: 'Previous',
      empty: 'No comparison available yet.',
    },
    fr: {
      title: 'Periode actuelle vs precedente',
      description: 'Comparaison rapide des principaux signaux',
      current: 'Actuelle',
      previous: 'Precedente',
      empty: 'Aucune comparaison disponible.',
    },
  }[locale];

  const chartConfig = {
    currentCents: { label: t.current, color: '#0f766e' },
    previousCents: { label: t.previous, color: '#94a3b8' },
  } satisfies ChartConfig;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-65 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t.empty}</div>
        ) : (
          <ChartContainer className="h-65 w-full" config={chartConfig}>
            <BarChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrencyFromCents(Number(value), priceLocale, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })} />
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
              <Bar dataKey="currentCents" radius={[6, 6, 0, 0]} fill="var(--color-currentCents)" />
              <Bar dataKey="previousCents" radius={[6, 6, 0, 0]} fill="var(--color-previousCents)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TopSuppliersChart({ data, loading }: { data: FinancialSupplierSpendPoint[]; loading: boolean }) {
  const { locale } = useLocale();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const t = {
    en: {
      title: 'Top suppliers by spend',
      description: 'Largest purchase exposure in the selected period',
      spend: 'Spend',
      empty: 'No supplier spend data for this period.',
    },
    fr: {
      title: 'Top fournisseurs par depense',
      description: 'Plus forte exposition achat sur la periode',
      spend: 'Depense',
      empty: 'Aucune depense fournisseur sur cette periode.',
    },
  }[locale];

  const chartConfig = {
    totalCents: { label: t.spend, color: '#0369a1' },
  } satisfies ChartConfig;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-65 w-full" />
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">{t.empty}</div>
        ) : (
          <ChartContainer className="h-65 w-full" config={chartConfig}>
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrencyFromCents(Number(value), priceLocale, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })} />
              <YAxis type="category" dataKey="label" width={110} tickLine={false} axisLine={false} />
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
              <Bar dataKey="totalCents" radius={[0, 6, 6, 0]} fill="var(--color-totalCents)" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TodaySnapshotCard({ data, loading }: { data: FinancialDashboardData['myExpensesToday']; loading: boolean }) {
  const { locale } = useLocale();
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-IE';
  const t = {
    en: {
      title: 'My expenses today',
      enteredToday: 'Entered today',
      dueThisWeek: 'Due this week',
      tickets: 'Tickets awaiting reply',
    },
    fr: {
      title: 'Mes depenses aujourd hui',
      enteredToday: 'Saisies aujourd hui',
      dueThisWeek: 'Echeances cette semaine',
      tickets: 'Tickets en attente de reponse',
    },
  }[locale];

  const summaryRows = [
    {
      label: t.enteredToday,
      count: data.expensesEnteredTodayCount,
      value: data.expensesEnteredTodayTotalCents,
    },
    {
      label: t.dueThisWeek,
      count: data.supplierInvoicesDueThisWeekCount,
      value: data.supplierInvoicesDueThisWeekTotalCents,
    },
    {
      label: t.tickets,
      count: data.openTicketsAwaitingReplyCount,
      value: null,
    },
  ];

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {summaryRows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">{row.label}</p>
              <p className="text-xs text-muted-foreground">{row.count} item(s)</p>
            </div>
            {loading ? (
              <Skeleton className="h-6 w-20" />
            ) : row.value !== null ? (
              <PriceDisplay cents={row.value} locale={priceLocale} className="text-sm font-semibold tabular-nums text-foreground" />
            ) : (
              <span className="text-sm font-semibold tabular-nums text-foreground">{row.count}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function FinancialOverviewFoundation() {
  const { locale } = useLocale();
  const { data, period, setPeriod, loading, error } = useFinancialDashboard();
  const t = {
    en: {
      title: 'Financial overview',
      description: 'Sprint 1 foundation for metrics, charts, and period filtering.',
      companyScope: 'Company scope',
      ownScope: 'My scope',
      currentPeriod: 'Current period',
      previousPeriod: 'Previous period',
      positive: 'Up',
      negative: 'Down',
    },
    fr: {
      title: 'Vue financiere',
      description: 'Fondation Sprint 1 pour les indicateurs, graphiques et filtres periode.',
      companyScope: 'Portee entreprise',
      ownScope: 'Ma portee',
      currentPeriod: 'Periode actuelle',
      previousPeriod: 'Periode precedente',
      positive: 'Hausse',
      negative: 'Baisse',
    },
  }[locale];

  const biggestDelta = [...data.charts.currentPeriodVsPreviousPeriod].sort(
    (left, right) => Math.abs(right.deltaCents) - Math.abs(left.deltaCents)
  )[0];

  return (
    <div className="space-y-4">
      <Card className="border shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>{t.title}</CardTitle>
                <Badge variant="outline">{data.scope === 'own' ? t.ownScope : t.companyScope}</Badge>
                {data.period.label ? <Badge variant="secondary">{data.period.label}</Badge> : null}
              </div>
              <CardDescription>{t.description}</CardDescription>
            </div>
            <div className="w-full max-w-4xl">
              <FinancialPeriodSelector value={period} onChange={setPeriod} />
            </div>
          </div>
        </CardHeader>
      </Card>

      {error ? <ErrorMessage message={error} /> : null}

      <FinancialMetricCards metrics={data.metrics} loading={loading} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,0.9fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <MonthlyTrendChart data={data.charts.monthlyTrend} loading={loading} />
            <ExpensesByCategoryChart data={data.charts.expensesByCategory} loading={loading} />
          </div>
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <FinancialComparisonChart data={data.charts.currentPeriodVsPreviousPeriod} loading={loading} />
            <TopSuppliersChart data={data.charts.topSuppliersBySpend} loading={loading} />
          </div>
        </div>

        <div className="space-y-4">
          <TodaySnapshotCard data={data.myExpensesToday} loading={loading} />

          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle>{biggestDelta?.label || t.currentPeriod}</CardTitle>
              <CardDescription>
                {data.period.previousStartDate ? `${t.previousPeriod}: ${new Date(data.period.previousStartDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB')}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-16 w-full" />
              ) : biggestDelta ? (
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{biggestDelta.label}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.currentPeriod}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {biggestDelta.deltaCents >= 0 ? <ArrowUpRight className="size-4 text-emerald-600" /> : <ArrowDownRight className="size-4 text-red-600" />}
                      <span>{formatCurrencyFromCents(Math.abs(biggestDelta.deltaCents), locale === 'fr' ? 'fr-FR' : 'en-IE')}</span>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-background px-3 py-2">
                    <span className="text-xs text-muted-foreground">{biggestDelta.deltaCents >= 0 ? t.positive : t.negative}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {biggestDelta.deltaPercent === null ? 'n/a' : `${biggestDelta.deltaPercent}%`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  <CircleAlert className="mx-auto mb-2 size-5" />
                  No comparison data yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}