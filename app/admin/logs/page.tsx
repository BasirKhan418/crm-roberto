'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Clock3, FileClock, Filter, Laptop, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { getAuditActionLabel, getAuditDescription, getAuditEntityLabel, getAuditSecondaryBadge, getAuditTargetLabel } from '@/lib/audit-log-presenter';
import { getConnectionEventLabel, getConnectionEventMeta } from '@/lib/admin-presenters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

type CompanyItem = { _id: string; name: string; slug?: string };

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PopulatedUser = {
  name?: string;
  email?: string;
  role?: string;
};

type PopulatedCompany = {
  name?: string;
  slug?: string;
};

type ConnectionLog = {
  _id?: string;
  eventType?: string;
  ipAddress?: string | null;
  deviceLabel?: string | null;
  userAgent?: string | null;
  role?: string | null;
  userId?: PopulatedUser | string | null;
  companyId?: PopulatedCompany | string | null;
  createdAt?: string;
};

type AuditLog = {
  _id?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  fieldName?: string | null;
  source?: string | null;
  newValue?: unknown;
  performedBy?: PopulatedUser | string | null;
  performedAt?: string;
  createdAt?: string;
  companyId?: PopulatedCompany | string | null;
};

const LOG_LIMIT = 8;
const emptyPagination: PaginationMeta = { page: 1, limit: LOG_LIMIT, total: 0, totalPages: 0 };

const messages = {
  en: {
    eyebrow: 'Platform activity',
    heading: 'Logs',
    subtitle: 'Review sign-ins, blocked access, exports, feature changes, and important account activity in plain language.',
    clearFilters: 'Clear filters',
    refresh: 'Refresh',
    filters: 'Filters',
    filtersDescription: 'Use these controls to narrow both log sections. Search only applies to sign-in logs.',
    activeFilters: (count: number) => `${count} active`,
    companyPlaceholder: 'Company',
    allCompanies: 'All companies',
    signInEventPlaceholder: 'Sign-in event',
    activityTypePlaceholder: 'Activity type',
    periodPlaceholder: 'Period',
    searchPlaceholder: 'Search IP, browser, device',
    allLoginEvents: 'All login events',
    allActivityTypes: 'All activity types',
    allTime: 'All time',
    last24Hours: 'Last 24 hours',
    last7Days: 'Last 7 days',
    last30Days: 'Last 30 days',
    signInLogs: 'Sign-in and access logs',
    signInDescription: 'Who tried to enter the CRM or accountant portal, and whether access worked.',
    noSignInLogs: 'No sign-in or access logs match these filters.',
    signInPagination: 'Sign-in logs',
    activityLogs: 'Business activity logs',
    activityDescription: 'Important platform activity such as exports, downloads, edits, and status changes.',
    noActivityLogs: 'No business activity logs match these filters.',
    activityPagination: 'Activity logs',
    unknownUser: 'Unknown user',
    companyFallback: 'Company',
    dateNotRecorded: 'Date not recorded',
    roleNotRecorded: 'Role not recorded',
    deviceNotRecorded: 'Device not recorded',
    source: 'Source',
    system: 'system',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    showing: 'showing',
    of: 'of',
  },
  fr: {
    eyebrow: 'Activite plateforme',
    heading: 'Journaux',
    subtitle: 'Consultez les connexions, acces bloques, exports, changements de fonctionnalites et activites importantes avec un libelle clair.',
    clearFilters: 'Effacer les filtres',
    refresh: 'Actualiser',
    filters: 'Filtres',
    filtersDescription: 'Utilisez ces controles pour filtrer les deux sections. La recherche s applique uniquement aux journaux de connexion.',
    activeFilters: (count: number) => `${count} actif${count > 1 ? 's' : ''}`,
    companyPlaceholder: 'Entreprise',
    allCompanies: 'Toutes les entreprises',
    signInEventPlaceholder: 'Evenement de connexion',
    activityTypePlaceholder: 'Type d activite',
    periodPlaceholder: 'Periode',
    searchPlaceholder: 'Rechercher IP, navigateur, appareil',
    allLoginEvents: 'Tous les evenements de connexion',
    allActivityTypes: 'Tous les types d activite',
    allTime: 'Toute la periode',
    last24Hours: 'Dernieres 24 heures',
    last7Days: '7 derniers jours',
    last30Days: '30 derniers jours',
    signInLogs: 'Journaux de connexion et d acces',
    signInDescription: 'Qui a tente d entrer dans le CRM ou le portail comptable, et si l acces a fonctionne.',
    noSignInLogs: 'Aucun journal de connexion ou d acces ne correspond a ces filtres.',
    signInPagination: 'Journaux de connexion',
    activityLogs: 'Journaux d activite metier',
    activityDescription: 'Activites plateforme importantes, comme les exports, telechargements, modifications et changements de statut.',
    noActivityLogs: 'Aucun journal d activite metier ne correspond a ces filtres.',
    activityPagination: 'Journaux d activite',
    unknownUser: 'Utilisateur inconnu',
    companyFallback: 'Entreprise',
    dateNotRecorded: 'Date indisponible',
    roleNotRecorded: 'Role non renseigne',
    deviceNotRecorded: 'Appareil non renseigne',
    source: 'Source',
    system: 'systeme',
    previous: 'Precedent',
    next: 'Suivant',
    page: 'Page',
    showing: 'affichage',
    of: 'sur',
  },
} as const;

function getPersonName(value: PopulatedUser | string | null | undefined, unknownUserLabel: string) {
  if (!value || typeof value === 'string') return unknownUserLabel;
  return value.name || value.email || unknownUserLabel;
}

function getCompanyName(value: PopulatedCompany | string | null | undefined, companyLookup: Map<string, string>, allCompaniesLabel: string, companyFallbackLabel: string) {
  if (!value) return allCompaniesLabel;
  if (typeof value === 'string') return companyLookup.get(value) || companyFallbackLabel;
  return value.name || value.slug || companyFallbackLabel;
}

function formatDateTime(value: string | undefined, locale: 'en' | 'fr', dateNotRecordedLabel: string) {
  if (!value) return dateNotRecordedLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateNotRecordedLabel;
  return date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toneClass(tone: 'green' | 'red' | 'amber' | 'blue' | 'slate') {
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (tone === 'red') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300';
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300';
}

function PaginationControls({
  label,
  pagination,
  loading,
  previousLabel,
  nextLabel,
  pageLabel,
  showingLabel,
  ofLabel,
  onPageChange,
}: {
  label: string;
  pagination: PaginationMeta;
  loading: boolean;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
  showingLabel: string;
  ofLabel: string;
  onPageChange: (page: number) => void;
}) {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);
  const hasPrevious = pagination.page > 1;
  const hasNext = pagination.totalPages > 0 && pagination.page < pagination.totalPages;

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200/70 pt-3 text-sm text-muted-foreground dark:border-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
      <span>{label}: {showingLabel} {start}-{end} {ofLabel} {pagination.total}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" disabled={loading || !hasPrevious} onClick={() => onPageChange(pagination.page - 1)}>
          <ChevronLeft className="size-4" />
          {previousLabel}
        </Button>
        <span className="min-w-20 text-center text-xs font-medium text-slate-500">{pageLabel} {pagination.totalPages === 0 ? 0 : pagination.page} / {pagination.totalPages}</span>
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" disabled={loading || !hasNext} onClick={() => onPageChange(pagination.page + 1)}>
          {nextLabel}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
    </div>
  );
}

export default function AdminLogsPage() {
  const { locale } = useLocale();
  const t = messages[locale];
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [companyId, setCompanyId] = useState('all');
  const [period, setPeriod] = useState('all');
  const [eventType, setEventType] = useState('all');
  const [entityType, setEntityType] = useState('all');
  const [search, setSearch] = useState('');
  const [connectionPage, setConnectionPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [connectionPagination, setConnectionPagination] = useState<PaginationMeta>(emptyPagination);
  const [auditPagination, setAuditPagination] = useState<PaginationMeta>(emptyPagination);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const companyLookup = useMemo(() => new Map(companies.map((company) => [company._id, company.name])), [companies]);
  const eventFilterOptions = useMemo(() => [
    { value: 'all', label: t.allLoginEvents },
    { value: 'login_success', label: getConnectionEventLabel('login_success', locale) },
    { value: 'login_failed', label: getConnectionEventLabel('login_failed', locale) },
    { value: 'logout', label: getConnectionEventLabel('logout', locale) },
    { value: 'portal_login_success', label: getConnectionEventLabel('portal_login_success', locale) },
    { value: 'portal_login_failed', label: getConnectionEventLabel('portal_login_failed', locale) },
    { value: 'force_logout', label: getConnectionEventLabel('force_logout', locale) },
    { value: 'revoke_access', label: getConnectionEventLabel('revoke_access', locale) },
  ] as const, [locale, t.allLoginEvents]);
  const entityFilterOptions = useMemo(() => [
    { value: 'all', label: t.allActivityTypes },
    { value: 'expense', label: getAuditEntityLabel('expense', locale) },
    { value: 'invoice', label: getAuditEntityLabel('invoice', locale) },
    { value: 'supplier', label: getAuditEntityLabel('supplier', locale) },
    { value: 'user', label: getAuditEntityLabel('user', locale) },
    { value: 'ticket', label: getAuditEntityLabel('ticket', locale) },
    { value: 'report', label: getAuditEntityLabel('report', locale) },
  ] as const, [locale, t.allActivityTypes]);
  const periodOptions = useMemo(() => [
    { value: 'all', label: t.allTime },
    { value: '24h', label: t.last24Hours },
    { value: '7d', label: t.last7Days },
    { value: '30d', label: t.last30Days },
  ] as const, [t.allTime, t.last24Hours, t.last30Days, t.last7Days]);
  const activeFilterCount = [companyId !== 'all', period !== 'all', eventType !== 'all', entityType !== 'all', search.trim().length > 0].filter(Boolean).length;

  useEffect(() => {
    setConnectionPage(1);
    setAuditPage(1);
  }, [companyId, entityType, eventType, period, search]);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setLoading(true);
      try {
        const connectionParams = new URLSearchParams({ page: String(connectionPage), limit: String(LOG_LIMIT) });
        const auditParams = new URLSearchParams({ page: String(auditPage), limit: String(LOG_LIMIT) });

        if (companyId !== 'all') {
          connectionParams.set('companyId', companyId);
          auditParams.set('companyId', companyId);
        }
        if (search.trim()) connectionParams.set('search', search.trim());
        if (period !== 'all') connectionParams.set('period', period);
        if (eventType !== 'all') connectionParams.set('eventType', eventType);
        if (entityType !== 'all') auditParams.set('entityType', entityType);
        if (period !== 'all') auditParams.set('period', period);

        const [companiesResponse, connectionResponse, auditResponse] = await Promise.all([
          fetch('/api/admin/companies?limit=100', { cache: 'no-store' }),
          fetch(`/api/admin/connection-logs?${connectionParams.toString()}`, { cache: 'no-store' }),
          fetch(`/api/admin/audit-logs?${auditParams.toString()}`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        const companiesPayload = (await companiesResponse.json().catch(() => null)) as { data?: { items?: CompanyItem[] } } | null;
        const connectionPayload = (await connectionResponse.json().catch(() => null)) as { data?: { items?: ConnectionLog[]; pagination?: PaginationMeta } } | null;
        const auditPayload = (await auditResponse.json().catch(() => null)) as { data?: { items?: AuditLog[]; pagination?: PaginationMeta } } | null;

        setCompanies(companiesPayload?.data?.items || []);
        setConnectionLogs(connectionPayload?.data?.items || []);
        setAuditLogs(auditPayload?.data?.items || []);
        setConnectionPagination(connectionPayload?.data?.pagination || emptyPagination);
        setAuditPagination(auditPayload?.data?.pagination || emptyPagination);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [auditPage, companyId, connectionPage, entityType, eventType, period, refreshKey, search]);

  function refreshLogs() {
    setLoading(true);
    setRefreshKey((current) => current + 1);
  }

  function resetFilters() {
    setCompanyId('all');
    setPeriod('all');
    setEventType('all');
    setEntityType('all');
    setSearch('');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-card/70 p-3 shadow-sm sm:p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
            <FileClock className="size-3.5" />
            {t.eyebrow}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{t.heading}</h1>
            <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-full px-3" onClick={resetFilters} disabled={loading || activeFilterCount === 0}>
            {t.clearFilters}
          </Button>
          <Button type="button" variant="outline" className="h-9 rounded-full px-3" onClick={refreshLogs} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-heading text-xl">
                <Filter className="size-5 text-blue-600" />
                {t.filters}
              </CardTitle>
              <CardDescription>{t.filtersDescription}</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">{t.activeFilters(activeFilterCount)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={t.companyPlaceholder} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allCompanies}</SelectItem>
                {companies.map((company) => <SelectItem key={company._id} value={company._id}>{company.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={t.signInEventPlaceholder} /></SelectTrigger>
              <SelectContent>
                {eventFilterOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={t.activityTypePlaceholder} /></SelectTrigger>
              <SelectContent>
                {entityFilterOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder={t.periodPlaceholder} /></SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-10 rounded-xl pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t.searchPlaceholder} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl">
              <ShieldCheck className="size-5 text-emerald-600" />
              {t.signInLogs}
            </CardTitle>
            <CardDescription>{t.signInDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <LoadingRows /> : connectionLogs.length > 0 ? connectionLogs.map((log, index) => {
              const event = getConnectionEventMeta(log.eventType, locale);
              return (
                <div key={String(log._id || index)} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-white dark:border-slate-800/70 dark:bg-slate-900/30 dark:hover:bg-slate-900/60">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-950">
                        <UserRound className="size-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-950 dark:text-slate-50">{event.title}</h2>
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass(event.tone)}`}>{getConnectionEventLabel(log.eventType, locale)}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{getPersonName(log.userId, t.unknownUser)}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{getCompanyName(log.companyId, companyLookup, t.allCompanies, t.companyFallback)}</span>
                          <span>{log.role || t.roleNotRecorded}</span>
                          <span className="inline-flex items-center gap-1"><Laptop className="size-3.5" />{log.deviceLabel || log.ipAddress || t.deviceNotRecorded}</span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                      <Clock3 className="size-3.5" />
                      {formatDateTime(log.createdAt, locale, t.dateNotRecorded)}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground dark:border-slate-800">{t.noSignInLogs}</div>
            )}
            <PaginationControls label={t.signInPagination} pagination={connectionPagination} loading={loading} previousLabel={t.previous} nextLabel={t.next} pageLabel={t.page} showingLabel={t.showing} ofLabel={t.of} onPageChange={setConnectionPage} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl">
              <Activity className="size-5 text-blue-600" />
              {t.activityLogs}
            </CardTitle>
            <CardDescription>{t.activityDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <LoadingRows /> : auditLogs.length > 0 ? auditLogs.map((log, index) => {
              const action = getAuditActionLabel(log.action, locale);
              const target = getAuditTargetLabel(log, locale);
              const secondaryBadge = getAuditSecondaryBadge(log);
              return (
                <div key={String(log._id || index)} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-white dark:border-slate-800/70 dark:bg-slate-900/30 dark:hover:bg-slate-900/60">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-950">
                        <FileClock className="size-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-950 dark:text-slate-50">{getPersonName(log.performedBy, t.unknownUser)} {action} {target}</h2>
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">{getAuditEntityLabel(log.entityType, locale)}</span>
                          {secondaryBadge ? <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">{secondaryBadge}</span> : null}
                        </div>
                        <p className="text-sm text-muted-foreground">{getAuditDescription(log, locale)}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{getCompanyName(log.companyId, companyLookup, t.allCompanies, t.companyFallback)}</span>
                          <span>{t.source}: {log.source || t.system}</span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                      <Clock3 className="size-3.5" />
                      {formatDateTime(log.performedAt || log.createdAt, locale, t.dateNotRecorded)}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground dark:border-slate-800">{t.noActivityLogs}</div>
            )}
            <PaginationControls label={t.activityPagination} pagination={auditPagination} loading={loading} previousLabel={t.previous} nextLabel={t.next} pageLabel={t.page} showingLabel={t.showing} ofLabel={t.of} onPageChange={setAuditPage} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}