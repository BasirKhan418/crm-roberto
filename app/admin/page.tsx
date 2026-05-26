'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowUpRight, BarChart3, Building2, Loader2, Plus, RefreshCw, Search, ShieldAlert, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import { useLocale } from '@/components/providers/locale-provider';

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  account_status: 'active' | 'suspended';
};

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

const messages = {
  en: {
    heading: 'Super Admin',
    subtitle: 'Manage companies, feature flags, and platform activity from one workspace.',
    eyebrow: 'Platform control center',
    overview: 'Platform overview',
    createDescription: 'Create a company workspace and assign an active CRM user as owner.',
    moduleDescription: 'Feature adoption and latest platform events.',
    noAuditEvents: 'No recent audit events yet.',
    noCompanies: 'No companies match the selected filters.',
    companies: 'Companies',
    createCompany: 'Create company',
    name: 'Company name',
    slug: 'Slug',
    owner: 'Owner user',
    search: 'Search company or slug',
    status: 'Status',
    all: 'All',
    active: 'Active',
    suspended: 'Suspended',
    refresh: 'Refresh',
    totalCompanies: 'Companies',
    activeCompanies: 'Active companies',
    activeUsers: 'Active users',
    activeAccountants: 'Active accountants',
    recentAuditEvents: 'Recent audit events',
    moduleUsage: 'Module usage',
    users: 'Users',
    accountants: 'Accountants',
    enabled: 'Enabled',
    disabled: 'Disabled',
    openDetails: 'Open details',
    view: 'View',
    suspend: 'Suspend',
    activate: 'Activate',
    create: 'Create',
    loadError: 'Failed to load platform data.',
    createError: 'Failed to create company.',
    createSuccess: 'Company created.',
    updateSuccess: 'Company status updated.',
    updateError: 'Failed to update company status.',
    confirmSuspendTitle: 'Suspend company',
    confirmActivateTitle: 'Activate company',
    confirmSuspendDescription: (name: string) => `${name} will be suspended and sign-in will be blocked for company users.`,
    confirmActivateDescription: (name: string) => `${name} will be reactivated. Suspended users remain suspended until reactivated individually.`,
  },
  fr: {
    heading: 'Super Admin',
    subtitle: 'Gerez les entreprises, les flags produit et l activite plateforme depuis un seul espace.',
    eyebrow: 'Centre de controle plateforme',
    overview: 'Vue plateforme',
    createDescription: 'Creez un espace entreprise et assignez un utilisateur CRM actif comme proprietaire.',
    moduleDescription: 'Adoption des modules et derniers evenements plateforme.',
    noAuditEvents: 'Aucun evenement audit recent.',
    noCompanies: 'Aucune entreprise ne correspond aux filtres.',
    companies: 'Entreprises',
    createCompany: 'Creer une entreprise',
    name: 'Nom de l entreprise',
    slug: 'Slug',
    owner: 'Utilisateur proprietaire',
    search: 'Rechercher une entreprise ou un slug',
    status: 'Statut',
    all: 'Tous',
    active: 'Active',
    suspended: 'Suspendue',
    refresh: 'Actualiser',
    totalCompanies: 'Entreprises',
    activeCompanies: 'Entreprises actives',
    activeUsers: 'Utilisateurs actifs',
    activeAccountants: 'Comptables actifs',
    recentAuditEvents: 'Evenements audit recents',
    moduleUsage: 'Usage modules',
    users: 'Utilisateurs',
    accountants: 'Comptables',
    enabled: 'Active',
    disabled: 'Desactive',
    openDetails: 'Ouvrir le detail',
    view: 'Voir',
    suspend: 'Suspendre',
    activate: 'Activer',
    create: 'Creer',
    loadError: 'Echec du chargement des donnees plateforme.',
    createError: 'Echec de creation de l entreprise.',
    createSuccess: 'Entreprise creee.',
    updateSuccess: 'Statut entreprise mis a jour.',
    updateError: 'Echec de mise a jour du statut.',
    confirmSuspendTitle: 'Suspendre l entreprise',
    confirmActivateTitle: 'Activer l entreprise',
    confirmSuspendDescription: (name: string) => `${name} sera suspendue et la connexion des utilisateurs de cette entreprise sera bloquee.`,
    confirmActivateDescription: (name: string) => `${name} sera reactivee. Les utilisateurs suspendus restent suspendus tant qu ils ne sont pas reactives.`,
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

export default function AdminPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = messages[locale];

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [companies, setCompanies] = useState<CompanyListItem[]>([]);
  const [owners, setOwners] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [confirmCompany, setConfirmCompany] = useState<{ id: string; name: string; nextStatus: 'active' | 'suspended' } | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', ownerUserId: '' });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const [statsResponse, companiesResponse, usersResponse] = await Promise.all([
        fetch('/api/admin/stats', { cache: 'no-store' }),
        fetch(`/api/admin/companies?${params.toString()}`, { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
      ]);

      if ([statsResponse, companiesResponse, usersResponse].some((response) => response.status === 401 || response.status === 403)) {
        router.replace('/admin/login');
        return;
      }

      const statsPayload = (await statsResponse.json().catch(() => null)) as { success?: boolean; data?: PlatformStats } | null;
      const companiesPayload = (await companiesResponse.json().catch(() => null)) as { success?: boolean; data?: { items?: CompanyListItem[] } } | null;
      const usersPayload = (await usersResponse.json().catch(() => null)) as { success?: boolean; users?: AdminUser[] } | null;

      if (!statsResponse.ok || !statsPayload?.success || !statsPayload.data) {
        throw new Error(t.loadError);
      }

      setStats(statsPayload.data);
      setCompanies(companiesPayload?.data?.items || []);
      setOwners((usersPayload?.users || []).filter((user) => user.account_status === 'active'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.loadError);
      setStats(null);
      setCompanies([]);
      setOwners([]);
    } finally {
      setLoading(false);
    }
  }, [router, search, statusFilter, t.loadError]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const moduleBadges = useMemo(() => {
    if (!stats?.moduleUsage) return [];
    return [
      ['expenses', stats.moduleUsage.expenses || 0],
      ['tickets', stats.moduleUsage.tickets || 0],
      ['financialDashboard', stats.moduleUsage.financialDashboard || 0],
      ['accountantPortal', stats.moduleUsage.accountantPortal || 0],
      ['exports', stats.moduleUsage.exports || 0],
      ['advancedRoles', stats.moduleUsage.advancedRoles || 0],
    ] as const;
  }, [stats]);

  async function handleCreateCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.createError);
      }
      toast.success(t.createSuccess);
      setForm({ name: '', slug: '', ownerUserId: '' });
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.createError);
    } finally {
      setCreating(false);
    }
  }

  async function updateCompanyStatus() {
    if (!confirmCompany) return;
    const current = confirmCompany;
    setConfirmCompany(null);
    setMutatingId(current.id);
    try {
      const response = await fetch(`/api/admin/companies/${current.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: current.nextStatus }),
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

  return (
    <>
      <AlertDialog open={Boolean(confirmCompany)} onOpenChange={(open) => { if (!open) setConfirmCompany(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmCompany?.nextStatus === 'suspended' ? t.confirmSuspendTitle : t.confirmActivateTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCompany
                ? confirmCompany.nextStatus === 'suspended'
                  ? t.confirmSuspendDescription(confirmCompany.name)
                  : t.confirmActivateDescription(confirmCompany.name)
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void updateCompanyStatus()}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <CardTitle className="font-heading text-xl">{t.createCompany}</CardTitle>
              <CardDescription>{t.createDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateCompany}>
                <div className="space-y-1.5">
                  <Label>{t.name}</Label>
                  <Input className="h-10 rounded-xl" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
                </div>
                <div className="space-y-1.5">
                  <Label>{t.slug}</Label>
                  <Input className="h-10 rounded-xl" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }))} required />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label>{t.owner}</Label>
                  <Select value={form.ownerUserId} onValueChange={(value) => setForm((current) => ({ ...current, ownerUserId: value }))}>
                    <SelectTrigger className="h-10 rounded-xl">
                      <SelectValue placeholder={t.owner} />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((user) => (
                        <SelectItem key={user._id} value={user._id}>{user.name} - {user.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="h-10 rounded-full px-4" disabled={creating || !form.ownerUserId}>
                    {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    {t.create}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
            <CardHeader>
              <CardTitle className="font-heading text-xl">{t.moduleUsage}</CardTitle>
              <CardDescription>{t.moduleDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {moduleBadges.map(([key, value]) => (
                  <Badge key={key} variant="secondary" className="rounded-full px-3 py-1">{key}: {value}</Badge>
                ))}
              </div>
              <div className="space-y-3">
                {stats?.recentAuditEvents?.length ? stats.recentAuditEvents.map((event) => (
                  <div key={event._id} className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-sm dark:border-slate-800/70 dark:bg-slate-900/40">
                    <div className="mt-0.5 rounded-full bg-white p-1.5 text-blue-600 shadow-sm dark:bg-slate-950">
                      <Activity className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-50">{event.entityType} / {event.action}</div>
                      <div className="truncate text-muted-foreground">{event.performedBy?.name || event.performedBy?.email || 'System'}</div>
                    </div>
                  </div>
                )) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-slate-800">{t.noAuditEvents}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
          <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="lg:max-w-sm">
              <CardTitle className="font-heading text-xl">{t.companies}</CardTitle>
              <CardDescription>{t.subtitle}</CardDescription>
            </div>
            <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 lg:max-w-2xl lg:flex-1">
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
                      <Button asChild variant="outline" className="h-9 rounded-full px-3" title={t.openDetails}>
                        <Link href={`/admin/companies/${company._id}`}>
                          {t.view}
                          <ArrowUpRight className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant={company.status === 'active' ? 'destructive' : 'default'}
                        className="h-9 rounded-full px-3"
                        disabled={mutatingId === company._id}
                        onClick={() => setConfirmCompany({
                          id: company._id,
                          name: company.name,
                          nextStatus: company.status === 'active' ? 'suspended' : 'active',
                        })}
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
          </CardContent>
        </Card>
      </div>
    </>
  );
}