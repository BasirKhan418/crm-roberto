'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, Clock3, FileClock, Filter, Laptop, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';

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
  action?: string;
  fieldName?: string | null;
  source?: string | null;
  performedBy?: PopulatedUser | string | null;
  performedAt?: string;
  createdAt?: string;
  companyId?: PopulatedCompany | string | null;
};

const LOG_LIMIT = 8;
const emptyPagination: PaginationMeta = { page: 1, limit: LOG_LIMIT, total: 0, totalPages: 0 };

const connectionEventLabels: Record<string, { title: string; description: string; tone: 'green' | 'red' | 'amber' | 'blue' | 'slate' }> = {
  login_success: { title: 'CRM login succeeded', description: 'A company user signed in successfully.', tone: 'green' },
  login_failed: { title: 'CRM login failed', description: 'Someone tried to sign in with incorrect credentials.', tone: 'red' },
  logout: { title: 'User logged out', description: 'A user ended their session.', tone: 'slate' },
  portal_login_success: { title: 'Accountant login succeeded', description: 'An external accountant entered the portal.', tone: 'green' },
  portal_login_failed: { title: 'Accountant login failed', description: 'An accountant portal login attempt failed.', tone: 'red' },
  force_logout: { title: 'Forced logout', description: 'Access was changed and the user session was forced out.', tone: 'amber' },
  revoke_access: { title: 'Access revoked', description: 'A pending invitation or user access was revoked.', tone: 'amber' },
  impersonation_start: { title: 'Support session started', description: 'A support impersonation session was started.', tone: 'blue' },
  impersonation_stop: { title: 'Support session ended', description: 'A support impersonation session was ended.', tone: 'blue' },
};

const auditActionLabels: Record<string, string> = {
  created: 'created',
  updated: 'updated',
  deleted: 'deleted',
  archived: 'archived',
  duplicated: 'duplicated',
  status_changed: 'changed status for',
  marked_paid: 'marked as paid',
  payment_added: 'added payment to',
  exported: 'exported',
  downloaded: 'downloaded',
};

const entityLabels: Record<string, string> = {
  expense: 'expense',
  invoice: 'invoice',
  supplier: 'supplier',
  user: 'user or company setting',
  ticket: 'ticket',
  report: 'report',
};

const eventFilterOptions = [
  { value: 'all', label: 'All login events' },
  { value: 'login_success', label: 'CRM login success' },
  { value: 'login_failed', label: 'CRM login failed' },
  { value: 'logout', label: 'Logout' },
  { value: 'portal_login_success', label: 'Accountant login success' },
  { value: 'portal_login_failed', label: 'Accountant login failed' },
  { value: 'force_logout', label: 'Forced logout' },
  { value: 'revoke_access', label: 'Revoked access' },
] as const;

const entityFilterOptions = [
  { value: 'all', label: 'All activity types' },
  { value: 'expense', label: 'Expenses' },
  { value: 'invoice', label: 'Invoices' },
  { value: 'supplier', label: 'Suppliers' },
  { value: 'user', label: 'Users/settings' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'report', label: 'Reports' },
] as const;

const periodOptions = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
] as const;

function getPersonName(value: PopulatedUser | string | null | undefined) {
  if (!value || typeof value === 'string') return 'Unknown user';
  return value.name || value.email || 'Unknown user';
}

function getCompanyName(value: PopulatedCompany | string | null | undefined, companyLookup: Map<string, string>) {
  if (!value) return 'All companies';
  if (typeof value === 'string') return companyLookup.get(value) || 'Company';
  return value.name || value.slug || 'Company';
}

function formatDateTime(value?: string) {
  if (!value) return 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleString('en-GB', {
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
  onPageChange,
}: {
  label: string;
  pagination: PaginationMeta;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  const start = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);
  const hasPrevious = pagination.page > 1;
  const hasNext = pagination.totalPages > 0 && pagination.page < pagination.totalPages;

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200/70 pt-3 text-sm text-muted-foreground dark:border-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
      <span>{label}: showing {start}-{end} of {pagination.total}</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" disabled={loading || !hasPrevious} onClick={() => onPageChange(pagination.page - 1)}>
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="min-w-20 text-center text-xs font-medium text-slate-500">Page {pagination.totalPages === 0 ? 0 : pagination.page} / {pagination.totalPages}</span>
        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" disabled={loading || !hasNext} onClick={() => onPageChange(pagination.page + 1)}>
          Next
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
            Platform activity
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Logs</h1>
            <p className="text-sm text-muted-foreground">Review sign-ins, blocked access, exports, feature changes, and important account activity in plain language.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9 rounded-full px-3" onClick={resetFilters} disabled={loading || activeFilterCount === 0}>
            Clear filters
          </Button>
          <Button type="button" variant="outline" className="h-9 rounded-full px-3" onClick={refreshLogs} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 font-heading text-xl">
                <Filter className="size-5 text-blue-600" />
                Filters
              </CardTitle>
              <CardDescription>Use these controls to narrow both log sections. Search only applies to sign-in logs.</CardDescription>
            </div>
            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">{activeFilterCount} active</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((company) => <SelectItem key={company._id} value={company._id}>{company.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Sign-in event" /></SelectTrigger>
              <SelectContent>
                {eventFilterOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Activity type" /></SelectTrigger>
              <SelectContent>
                {entityFilterOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Period" /></SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative md:col-span-2 xl:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-10 rounded-xl pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search IP, browser, device" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl">
              <ShieldCheck className="size-5 text-emerald-600" />
              Sign-in and access logs
            </CardTitle>
            <CardDescription>Who tried to enter the CRM or accountant portal, and whether access worked.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <LoadingRows /> : connectionLogs.length > 0 ? connectionLogs.map((log, index) => {
              const event = connectionEventLabels[log.eventType || ''] || { title: 'Access event', description: 'A sign-in or access event was recorded.', tone: 'slate' as const };
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
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass(event.tone)}`}>{log.eventType || 'event'}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{event.description}</p>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{getPersonName(log.userId)}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{getCompanyName(log.companyId, companyLookup)}</span>
                          <span>{log.role || 'role not recorded'}</span>
                          <span className="inline-flex items-center gap-1"><Laptop className="size-3.5" />{log.deviceLabel || log.ipAddress || 'device not recorded'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                      <Clock3 className="size-3.5" />
                      {formatDateTime(log.createdAt)}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground dark:border-slate-800">No sign-in or access logs match these filters.</div>
            )}
            <PaginationControls label="Sign-in logs" pagination={connectionPagination} loading={loading} onPageChange={setConnectionPage} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-xl">
              <Activity className="size-5 text-blue-600" />
              Business activity logs
            </CardTitle>
            <CardDescription>Important platform activity such as exports, downloads, edits, and status changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? <LoadingRows /> : auditLogs.length > 0 ? auditLogs.map((log, index) => {
              const entity = entityLabels[log.entityType || ''] || 'record';
              const action = auditActionLabels[log.action || ''] || 'changed';
              return (
                <div key={String(log._id || index)} className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-colors hover:bg-white dark:border-slate-800/70 dark:bg-slate-900/30 dark:hover:bg-slate-900/60">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-950">
                        <FileClock className="size-5" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-slate-950 dark:text-slate-50">{getPersonName(log.performedBy)} {action} {entity}</h2>
                          <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300">{log.entityType || 'activity'}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{log.fieldName ? `Changed area: ${log.fieldName}` : 'No extra detail was recorded for this activity.'}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{getCompanyName(log.companyId, companyLookup)}</span>
                          <span>Source: {log.source || 'system'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                      <Clock3 className="size-3.5" />
                      {formatDateTime(log.performedAt || log.createdAt)}
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-muted-foreground dark:border-slate-800">No business activity logs match these filters.</div>
            )}
            <PaginationControls label="Activity logs" pagination={auditPagination} loading={loading} onPageChange={setAuditPage} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}