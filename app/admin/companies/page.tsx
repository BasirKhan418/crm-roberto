'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, BarChart3, Building2, ChevronLeft, ChevronRight, Loader2, RefreshCw, Search, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';

import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type CompanyListItem = {
  _id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  ownerUserId?: { name?: string; email?: string } | null;
  featureFlags: Record<string, boolean>;
  userSummary: {
    totalUsers: number;
    activeUsers: number;
    accountantUsers: number;
  };
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PlatformStats = {
  companyCount: number;
  activeCompanies: number;
  activeUsers: number;
  activeAccountants: number;
};

const COMPANY_LIMIT = 10;

const messages = {
  en: {
    heading: 'Companies',
    subtitle: 'Manage companies, feature flags, and platform activity from one workspace.',
    search: 'Search company or slug',
    status: 'Status',
    all: 'All',
    active: 'Active',
    suspended: 'Suspended',
    refresh: 'Refresh',
    view: 'View',
    suspend: 'Suspend',
    activate: 'Activate',
    owner: 'Owner user',
    users: 'Users',
    accountants: 'Accountants',
    totalCompanies: 'Companies',
    activeCompanies: 'Active companies',
    activeUsers: 'Active users',
    activeAccountants: 'Active accountants',
    loadError: 'Failed to load company data.',
    updateError: 'Failed to update company status.',
    updateSuccess: 'Company status updated.',
    noCompanies: 'No companies match the selected filters.',
    enabled: 'Enabled',
    disabled: 'Disabled',
    previous: 'Previous',
    next: 'Next',
    pagination: (start: number, end: number, total: number) => `Showing ${start}-${end} of ${total}`,
    pageLabel: (page: number, totalPages: number) => `Page ${page} / ${totalPages}`,
  },
  fr: {
    heading: 'Entreprises',
    subtitle: 'Gerez les entreprises, les flags produit et l activite plateforme depuis un seul espace.',
    search: 'Rechercher une entreprise ou un slug',
    status: 'Statut',
    all: 'Tous',
    active: 'Active',
    suspended: 'Suspendue',
    refresh: 'Actualiser',
    view: 'Voir',
    suspend: 'Suspendre',
    activate: 'Activer',
    owner: 'Utilisateur proprietaire',
    users: 'Utilisateurs',
    accountants: 'Comptables',
    totalCompanies: 'Entreprises',
    activeCompanies: 'Entreprises actives',
    activeUsers: 'Utilisateurs actifs',
    activeAccountants: 'Comptables actifs',
    loadError: 'Echec du chargement des donnees entreprise.',
    updateError: 'Echec de mise a jour du statut entreprise.',
    updateSuccess: 'Statut entreprise mis a jour.',
    noCompanies: 'Aucune entreprise ne correspond aux filtres.',
    enabled: 'Active',
    disabled: 'Desactive',
    previous: 'Precedent',
    next: 'Suivant',
    pagination: (start: number, end: number, total: number) => `Affichage ${start}-${end} sur ${total}`,
    pageLabel: (page: number, totalPages: number) => `Page ${page} / ${totalPages}`,
  },
} as const;

const metricToneClasses = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
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

function featureBadgeClass(enabled: boolean) {
  return enabled
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400';
}

export default function AdminCompaniesPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = messages[locale];

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: COMPANY_LIMIT, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [page, setPage] = useState(1);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(COMPANY_LIMIT) });
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const [statsResponse, companiesResponse] = await Promise.all([
        fetch('/api/admin/stats', { cache: 'no-store' }),
        fetch(`/api/admin/companies?${params.toString()}`, { cache: 'no-store' }),
      ]);

      if ([statsResponse, companiesResponse].some((response) => response.status === 401 || response.status === 403)) {
        router.replace('/admin/login');
        return;
      }

      const statsPayload = (await statsResponse.json().catch(() => null)) as { success?: boolean; data?: PlatformStats } | null;
      const companiesPayload = (await companiesResponse.json().catch(() => null)) as { success?: boolean; data?: { items?: CompanyListItem[]; pagination?: PaginationMeta } } | null;

      if (!statsResponse.ok || !statsPayload?.success || !statsPayload.data) {
        throw new Error(t.loadError);
      }

      if (!companiesResponse.ok || !companiesPayload?.success) {
        throw new Error(t.loadError);
      }

      setStats(statsPayload.data);
      setCompanies(companiesPayload.data?.items || []);
      setPagination(companiesPayload.data?.pagination || { page: 1, limit: COMPANY_LIMIT, total: 0, totalPages: 0 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.loadError);
      setStats(null);
      setCompanies([]);
      setPagination({ page: 1, limit: COMPANY_LIMIT, total: 0, totalPages: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, router, search, statusFilter, t.loadError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  async function updateCompanyStatus(company: CompanyListItem) {
    setMutatingId(company._id);
    try {
      const nextStatus = company.status === 'active' ? 'suspended' : 'active';
      const response = await fetch(`/api/admin/companies/${company._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.updateError);
      }
      toast.success(t.updateSuccess);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.updateError);
    } finally {
      setMutatingId(null);
    }
  }

  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4">
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

      <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="lg:max-w-sm">
            <CardTitle className="font-heading text-xl">{t.heading}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
          <div className="grid w-full min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_16rem_auto] lg:max-w-4xl lg:flex-1">
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-11 w-full rounded-xl pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.search} />
            </div>
            <div className="min-w-0">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'suspended')}>
                <SelectTrigger className="h-11 w-full rounded-xl">
                  <SelectValue placeholder={t.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  <SelectItem value="active">{t.active}</SelectItem>
                  <SelectItem value="suspended">{t.suspended}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" className="h-11 rounded-xl px-4" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
            </div>
          ) : companies.length > 0 ? (
            companies.map((company) => (
              <div key={company._id} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-white dark:border-slate-800/70 dark:bg-slate-900/30 dark:hover:bg-slate-900/60">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{company.name}</h2>
                      <Badge variant={company.status === 'active' ? 'default' : 'destructive'} className="rounded-full">{company.status}</Badge>
                      <Badge variant="outline" className="rounded-full">{company.slug}</Badge>
                    </div>
                    <div className="grid gap-1 text-sm text-muted-foreground md:grid-cols-3">
                      <span>{t.owner}: {company.ownerUserId?.name || company.ownerUserId?.email || '-'}</span>
                      <span>{t.users}: {company.userSummary.totalUsers}</span>
                      <span>{t.accountants}: {company.userSummary.accountantUsers}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(company.featureFlags).map(([key, enabled]) => (
                        <span key={key} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${featureBadgeClass(enabled)}`} title={enabled ? t.enabled : t.disabled}>
                          <span className={`size-1.5 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" className="h-9 rounded-full px-3">
                      <Link href={`/admin/companies/${company._id}`}>
                        {t.view}
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant={company.status === 'active' ? 'destructive' : 'default'}
                      className="h-9 rounded-full px-3"
                      disabled={mutatingId === company._id}
                      onClick={() => void updateCompanyStatus(company)}
                    >
                      {mutatingId === company._id ? <Loader2 className="size-4 animate-spin" /> : null}
                      {company.status === 'active' ? t.suspend : t.activate}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-slate-800">{t.noCompanies}</p>
          )}

          <div className="flex flex-col gap-2 border-t border-slate-200/70 pt-3 text-sm text-muted-foreground dark:border-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
            <span>{t.pagination(start, end, pagination.total)}</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" disabled={loading || pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                <ChevronLeft className="size-4" />
                {t.previous}
              </Button>
              <span className="min-w-24 text-center text-xs font-medium text-slate-500">{t.pageLabel(pagination.totalPages === 0 ? 0 : pagination.page, pagination.totalPages)}</span>
              <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" disabled={loading || pagination.totalPages === 0 || pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
                {t.next}
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}