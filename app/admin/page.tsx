'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Building2,
  ClipboardList,
  PieChart as PieChartIcon,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

type PlatformStats = {
  companyCount: number;
  activeCompanies: number;
  activeUsers: number;
  activeAccountants: number;
  moduleUsage: Record<string, number>;
  recentAuditEvents: Array<{
    _id: string;
    entityType: string;
    action: string;
    performedBy?: { name?: string; email?: string } | null;
  }>;
};

type ModuleUsageKey = 'expenses' | 'tickets' | 'financialDashboard' | 'accountantPortal' | 'exports' | 'advancedRoles';

const metricToneClasses = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
} as const;

const MODULE_COLORS: Record<ModuleUsageKey, string> = {
  expenses: '#0f766e',
  tickets: '#0284c7',
  financialDashboard: '#2563eb',
  accountantPortal: '#10b981',
  exports: '#f59e0b',
  advancedRoles: '#7c3aed',
};

const COMPANY_STATUS_COLORS = ['#10b981', '#f43f5e'];

const messages = {
  en: {
    heading: 'Super Admin',
    subtitle: 'Monitor platform health, adoption, and admin signals from one operations dashboard.',
    eyebrow: 'Platform control center',
    refresh: 'Refresh',
    totalCompanies: 'Companies',
    activeCompanies: 'Active companies',
    activeUsers: 'Active users',
    activeAccountants: 'Active accountants',
    moduleUsage: 'Module adoption',
    moduleDescription: 'How many workspaces currently have each feature enabled.',
    companyStatus: 'Company status mix',
    companyStatusDescription: 'Fast view of live versus suspended workspaces across the platform.',
    workforceMix: 'User access mix',
    workforceMixDescription: 'Compare internal CRM seats against external accountant access.',
    recentAuditEvents: 'Recent audit events',
    recentAuditDescription: 'Latest meaningful admin-facing platform changes and actions.',
    noAuditEvents: 'No recent audit events yet.',
    platformPulse: 'Platform pulse',
    platformPulseDescription: 'Three quick operational checks to spot risk before opening details.',
    activationRate: 'Workspace activation rate',
    accountantShare: 'Accountant share of active users',
    featureCoverage: 'Average feature coverage',
    workspacesLive: 'workspaces live',
    seatsCovered: 'active seats covered',
    featuresEnabled: 'feature toggles enabled',
    companiesActionTitle: 'Company operations',
    companiesActionDescription: 'Open the dedicated companies workspace to manage ownership, flags, and status changes.',
    companiesActionCta: 'Open companies',
    logsActionTitle: 'Platform logs',
    logsActionDescription: 'Review sign-ins, exports, access failures, and operational traces in one place.',
    logsActionCta: 'Open logs',
    active: 'Active',
    suspended: 'Suspended',
    internalUsers: 'Internal users',
    externalAccountants: 'External accountants',
    loadError: 'Failed to load platform data.',
  },
  fr: {
    heading: 'Super Admin',
    subtitle: 'Suivez la sante plateforme, l adoption et les signaux admin depuis un tableau operations unique.',
    eyebrow: 'Centre de controle plateforme',
    refresh: 'Actualiser',
    totalCompanies: 'Entreprises',
    activeCompanies: 'Entreprises actives',
    activeUsers: 'Utilisateurs actifs',
    activeAccountants: 'Comptables actifs',
    moduleUsage: 'Adoption modules',
    moduleDescription: 'Nombre d espaces qui ont chaque fonctionnalite activee.',
    companyStatus: 'Repartition des entreprises',
    companyStatusDescription: 'Vue rapide des espaces actifs versus suspendus sur la plateforme.',
    workforceMix: 'Repartition des acces',
    workforceMixDescription: 'Comparez les comptes CRM internes avec les acces comptables externes.',
    recentAuditEvents: 'Evenements audit recents',
    recentAuditDescription: 'Dernieres actions plateforme visibles cote administration.',
    noAuditEvents: 'Aucun evenement audit recent.',
    platformPulse: 'Pulse plateforme',
    platformPulseDescription: 'Trois controles rapides pour detecter un risque avant de plonger dans le detail.',
    activationRate: 'Taux d activation des espaces',
    accountantShare: 'Part des comptables parmi les utilisateurs actifs',
    featureCoverage: 'Couverture moyenne des modules',
    workspacesLive: 'espaces en ligne',
    seatsCovered: 'comptes actifs couverts',
    featuresEnabled: 'modules actives',
    companiesActionTitle: 'Operations entreprises',
    companiesActionDescription: 'Ouvrez l espace entreprises dedie pour gerer les proprietaires, flags et statuts.',
    companiesActionCta: 'Ouvrir entreprises',
    logsActionTitle: 'Journaux plateforme',
    logsActionDescription: 'Consultez les connexions, exports, erreurs d acces et traces operationnelles.',
    logsActionCta: 'Ouvrir logs',
    active: 'Active',
    suspended: 'Suspendue',
    internalUsers: 'Utilisateurs internes',
    externalAccountants: 'Comptables externes',
    loadError: 'Echec du chargement des donnees plateforme.',
  },
} as const;

function MetricCard({ title, value, icon: Icon, tone }: { title: string; value: number; icon: typeof Building2; tone: keyof typeof metricToneClasses }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800/70 dark:bg-slate-950/40">
      <CardContent className="relative flex items-center gap-3 p-4 sm:p-5">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sky-400 via-blue-500 to-indigo-500" />
        <div className={`rounded-2xl p-2.5 ring-1 ${metricToneClasses[tone]}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardChartEmpty({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-10 text-center text-sm text-muted-foreground dark:border-slate-800/70">{message}</div>;
}

function percent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function PulseBar({ label, percentage, summary }: { label: string; percentage: number; summary: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-slate-900 dark:text-slate-100">{label}</span>
        <span className="text-muted-foreground">{percentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-2 rounded-full bg-linear-to-r from-sky-500 via-blue-500 to-emerald-500" style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{summary}</p>
    </div>
  );
}

function ModuleUsageChart({ data, title, description }: { data: Array<{ label: string; count: number; fill: string }>; title: string; description: string }) {
  const chartConfig = Object.fromEntries(data.map((item) => [item.label, { label: item.label, color: item.fill }])) satisfies ChartConfig;

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40 xl:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-xl"><BarChart3 className="size-5 text-blue-600" />{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <DashboardChartEmpty message={description} />
        ) : (
          <ChartContainer className="h-72 w-full" config={chartConfig}>
            <BarChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-12} textAnchor="end" height={56} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
                <div className="flex min-w-40 items-center justify-between gap-3">
                  <span className="text-muted-foreground">{String(name)}</span>
                  <span className="font-medium text-foreground">{Number(value)}</span>
                </div>
              )} />} />
              <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                {data.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function CompanyStatusChart({ data, title, description }: { data: Array<{ name: string; value: number; fill: string }>; title: string; description: string }) {
  const chartConfig = Object.fromEntries(data.map((item) => [item.name, { label: item.name, color: item.fill }])) satisfies ChartConfig;

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-xl"><PieChartIcon className="size-5 text-emerald-600" />{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-72 w-full" config={chartConfig}>
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
              <div className="flex min-w-40 items-center justify-between gap-3">
                <span className="text-muted-foreground">{String(name)}</span>
                <span className="font-medium text-foreground">{Number(value)}</span>
              </div>
            )} />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={68} outerRadius={96} paddingAngle={4}>
              {data.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.map((item) => (
            <Badge key={item.name} variant="outline" className="rounded-full px-3 py-1">
              <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: item.fill }} />
              {item.name}: {item.value}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function UserMixChart({ data, title, description }: { data: Array<{ label: string; count: number; fill: string }>; title: string; description: string }) {
  const chartConfig = Object.fromEntries(data.map((item) => [item.label, { label: item.label, color: item.fill }])) satisfies ChartConfig;

  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-xl"><Users className="size-5 text-amber-600" />{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-72 w-full" config={chartConfig}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={128} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => (
              <div className="flex min-w-40 items-center justify-between gap-3">
                <span className="text-muted-foreground">{String(name)}</span>
                <span className="font-medium text-foreground">{Number(value)}</span>
              </div>
            )} />} />
            <Bar dataKey="count" radius={[0, 10, 10, 0]}>
              {data.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function ActionCard({ title, description, href, cta, icon: Icon }: { title: string; description: string; href: string; cta: string; icon: typeof Building2 }) {
  return (
    <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
      <CardHeader className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-2xl border border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200">
          <Icon className="size-5" />
        </div>
        <div>
          <CardTitle className="font-heading text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline" className="h-10 rounded-full px-4">
          <Link href={href}>
            {cta}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = messages[locale];

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stats', { cache: 'no-store' });

      if (response.status === 401 || response.status === 403) {
        router.replace('/admin/login');
        return;
      }

      const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: PlatformStats } | null;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(t.loadError);
      }

      setStats(payload.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.loadError);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [router, t.loadError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const moduleUsageData = useMemo(() => {
    if (!stats) return [];

    const labels: Record<ModuleUsageKey, string> = {
      expenses: 'Expenses',
      tickets: 'Tickets',
      financialDashboard: 'Financial dashboard',
      accountantPortal: 'Accountant portal',
      exports: 'Exports',
      advancedRoles: 'Advanced roles',
    };

    const labelsFr: Record<ModuleUsageKey, string> = {
      expenses: 'Depenses',
      tickets: 'Tickets',
      financialDashboard: 'Tableau financier',
      accountantPortal: 'Portail comptable',
      exports: 'Exports',
      advancedRoles: 'Roles avances',
    };

    const activeLabels = locale === 'fr' ? labelsFr : labels;

    return (Object.keys(MODULE_COLORS) as ModuleUsageKey[]).map((key) => ({
      label: activeLabels[key],
      count: stats.moduleUsage?.[key] || 0,
      fill: MODULE_COLORS[key],
    }));
  }, [locale, stats]);

  const companyStatusData = useMemo(() => {
    if (!stats) return [];
    return [
      { name: t.active, value: stats.activeCompanies, fill: COMPANY_STATUS_COLORS[0] },
      { name: t.suspended, value: Math.max(stats.companyCount - stats.activeCompanies, 0), fill: COMPANY_STATUS_COLORS[1] },
    ];
  }, [stats, t.active, t.suspended]);

  const userMixData = useMemo(() => {
    if (!stats) return [];
    return [
      { label: t.internalUsers, count: Math.max(stats.activeUsers - stats.activeAccountants, 0), fill: '#2563eb' },
      { label: t.externalAccountants, count: stats.activeAccountants, fill: '#f59e0b' },
    ];
  }, [stats, t.externalAccountants, t.internalUsers]);

  const pulseStats = useMemo(() => {
    if (!stats) return null;

    const featureTotal = moduleUsageData.reduce((total, item) => total + item.count, 0);
    const maxFeatures = stats.companyCount * moduleUsageData.length;

    return {
      activationRate: percent(stats.activeCompanies, stats.companyCount),
      accountantShare: percent(stats.activeAccountants, stats.activeUsers),
      featureCoverage: percent(featureTotal, maxFeatures),
      featureTotal,
    };
  }, [moduleUsageData, stats]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-card/70 p-3 text-left shadow-sm sm:p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
            <ShieldAlert className="size-3.5" />
            {t.eyebrow}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <Button variant="outline" className="h-9 rounded-full px-3" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </Button>
      </div>

      {loading && !stats ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
        </div>
      ) : stats ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title={t.totalCompanies} value={stats.companyCount} icon={Building2} tone="blue" />
          <MetricCard title={t.activeCompanies} value={stats.activeCompanies} icon={BarChart3} tone="emerald" />
          <MetricCard title={t.activeUsers} value={stats.activeUsers} icon={Users} tone="amber" />
          <MetricCard title={t.activeAccountants} value={stats.activeAccountants} icon={UserRound} tone="slate" />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
          <CardHeader>
            <CardTitle className="font-heading text-xl">{t.platformPulse}</CardTitle>
            <CardDescription>{t.platformPulseDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading || !stats || !pulseStats ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-xl" />)}
              </div>
            ) : (
              <>
                <PulseBar label={t.activationRate} percentage={pulseStats.activationRate} summary={`${stats.activeCompanies}/${stats.companyCount} ${t.workspacesLive}`} />
                <PulseBar label={t.accountantShare} percentage={pulseStats.accountantShare} summary={`${stats.activeAccountants}/${stats.activeUsers} ${t.seatsCovered}`} />
                <PulseBar label={t.featureCoverage} percentage={pulseStats.featureCoverage} summary={`${pulseStats.featureTotal} ${t.featuresEnabled}`} />
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <ActionCard title={t.companiesActionTitle} description={t.companiesActionDescription} href="/admin/companies" cta={t.companiesActionCta} icon={Building2} />
          <ActionCard title={t.logsActionTitle} description={t.logsActionDescription} href="/admin/logs" cta={t.logsActionCta} icon={ClipboardList} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {loading ? <Skeleton className="h-[26rem] rounded-2xl xl:col-span-2" /> : <ModuleUsageChart data={moduleUsageData} title={t.moduleUsage} description={t.moduleDescription} />}
        {loading ? <Skeleton className="h-[26rem] rounded-2xl" /> : <CompanyStatusChart data={companyStatusData} title={t.companyStatus} description={t.companyStatusDescription} />}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {loading ? <Skeleton className="h-[26rem] rounded-2xl" /> : <UserMixChart data={userMixData} title={t.workforceMix} description={t.workforceMixDescription} />}

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl"><Activity className="size-5 text-blue-600" />{t.recentAuditEvents}</CardTitle>
            <CardDescription>{t.recentAuditDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
              </div>
            ) : stats?.recentAuditEvents?.length ? (
              stats.recentAuditEvents.map((event) => (
                <div key={event._id} className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-sm dark:border-slate-800/70 dark:bg-slate-900/40">
                  <div className="mt-0.5 rounded-full bg-white p-1.5 text-blue-600 shadow-sm dark:bg-slate-950">
                    <TrendingUp className="size-3.5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900 dark:text-slate-50">{event.entityType} / {event.action}</span>
                      <Badge variant="outline" className="rounded-full">{event.entityType}</Badge>
                    </div>
                    <p className="truncate text-muted-foreground">{event.performedBy?.name || event.performedBy?.email || 'System'}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-slate-800">{t.noAuditEvents}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}