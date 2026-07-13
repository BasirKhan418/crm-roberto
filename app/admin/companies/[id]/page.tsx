'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Activity, ChevronLeft, ChevronRight, Clock3, FileClock, Loader2, RefreshCw, Settings2, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import { getAuditActionLabel, getAuditDescription, getAuditSecondaryBadge, getAuditTargetLabel } from '@/lib/audit-log-presenter';
import { getCompanyFeatureLabel, getCompanyStatusLabel, getConnectionEventLabel, getConnectionEventMeta, getUserAccountStatusLabel } from '@/lib/admin-presenters';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
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

type CompanyDetailPayload = {
  company: {
    _id: string;
    name: string;
    slug: string;
    status: 'active' | 'suspended';
    ownerUserId?: { name?: string; email?: string } | null;
    featureFlags: Record<string, boolean>;
  };
  users: Array<{ _id: string; name?: string; email: string; role?: string; account_status?: string }>;
  auditLogs: Array<{ _id: string; action: string; entityType: string; entityId?: string; fieldName?: string | null; source?: string | null; newValue?: unknown; performedAt?: string; performedBy?: { name?: string; email?: string } | null }>;
  auditPagination: PaginationMeta;
  connectionLogs: Array<{ _id: string; eventType: string; ipAddress?: string | null; deviceLabel?: string | null; role?: string | null; createdAt?: string; userId?: { name?: string; email?: string; role?: string } | null }>;
  connectionPagination: PaginationMeta;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const LOG_LIMIT = 8;
const emptyPagination: PaginationMeta = { page: 1, limit: LOG_LIMIT, total: 0, totalPages: 0 };

const messages = {
  en: {
    eyebrow: 'Company workspace',
    refresh: 'Refresh',
    featureFlags: 'Feature access',
    companyUsers: 'Users',
    auditLogs: 'Audit logs',
    connectionLogs: 'Connection logs',
    companyOverview: 'Company overview',
    auditDescription: 'Recent business actions for this company.',
    connectionDescription: 'Recent sign-in and access activity for this company.',
    usersDescription: 'Assigned users and current account state.',
    featureDescription: 'Enable or disable platform modules for this company.',
    activeUsers: 'Active users',
    activeModules: 'Active modules',
    owner: 'Owner',
    slug: 'Slug',
    showing: 'showing',
    of: 'of',
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    noAuditLogs: 'No audit activity recorded yet for this company.',
    noConnectionLogs: 'No connection activity recorded yet for this company.',
    noUsers: 'No users are assigned to this company yet.',
    changedArea: 'Changed area',
    source: 'Source',
    notRecorded: 'not recorded',
    saveFlags: 'Save flags',
    saveSuccess: 'Feature flags updated.',
    saveError: 'Failed to update feature flags.',
    statusSuccess: 'Company status updated.',
    statusError: 'Failed to update company status.',
    loadError: 'Failed to load company.',
    suspend: 'Suspend company',
    activate: 'Activate company',
    cancel: 'Cancel',
    proceed: 'Proceed',
    companyFallback: 'Company',
    system: 'System',
  },
  fr: {
    eyebrow: 'Espace entreprise',
    refresh: 'Actualiser',
    featureFlags: 'Fonctionnalites',
    companyUsers: 'Utilisateurs',
    auditLogs: 'Journaux d activite',
    connectionLogs: 'Journaux de connexion',
    companyOverview: 'Vue entreprise',
    auditDescription: 'Dernieres actions metier enregistrees pour cette entreprise.',
    connectionDescription: 'Historique recent des connexions et acces pour cette entreprise.',
    usersDescription: 'Utilisateurs assignes et etat actuel du compte.',
    featureDescription: 'Activez ou desactivez les modules disponibles pour cette entreprise.',
    activeUsers: 'Utilisateurs actifs',
    activeModules: 'Modules actifs',
    owner: 'Proprietaire',
    slug: 'Slug',
    showing: 'affichage',
    of: 'sur',
    previous: 'Precedent',
    next: 'Suivant',
    page: 'Page',
    noAuditLogs: 'Aucune activite metier enregistree pour cette entreprise.',
    noConnectionLogs: 'Aucune activite de connexion enregistree pour cette entreprise.',
    noUsers: 'Aucun utilisateur assigne a cette entreprise.',
    changedArea: 'Zone modifiee',
    source: 'Source',
    notRecorded: 'non renseigne',
    saveFlags: 'Enregistrer les modifications',
    saveSuccess: 'Fonctionnalites mises a jour.',
    saveError: 'Echec de la mise a jour des fonctionnalites.',
    statusSuccess: 'Statut de l entreprise mis a jour.',
    statusError: 'Echec de la mise a jour du statut.',
    loadError: 'Echec du chargement de l entreprise.',
    suspend: 'Suspendre l entreprise',
    activate: 'Reactiver l entreprise',
    cancel: 'Annuler',
    proceed: 'Confirmer',
    companyFallback: 'Entreprise',
    system: 'Systeme',
  },
} as const;

function toneClass(tone: 'green' | 'red' | 'amber' | 'blue' | 'slate') {
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (tone === 'red') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300';
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300';
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300';
}

function formatDateTime(value?: string, locale: 'en' | 'fr' = 'en') {
  if (!value) return locale === 'fr' ? 'Date indisponible' : 'Date not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return locale === 'fr' ? 'Date indisponible' : 'Date not recorded';
  return date.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function MetricCard({ title, value, icon: Icon }: { title: string; value: number | string; icon: typeof Users }) {
  return (
    <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
      <CardContent className="relative flex items-center gap-3 p-4">
        <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-sky-400 via-blue-500 to-indigo-500" />
        <div className="rounded-2xl bg-blue-50 p-2.5 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60">
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

export default function AdminCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useLocale();
  const t = messages[locale];
  const companyId = typeof params?.id === 'string' ? params.id : '';

  const [data, setData] = useState<CompanyDetailPayload | null>(null);
  const [draftFlags, setDraftFlags] = useState<Record<string, boolean>>({});
  const [auditPage, setAuditPage] = useState(1);
  const [connectionPage, setConnectionPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [confirmDisableFlags, setConfirmDisableFlags] = useState(false);

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        auditPage: String(auditPage),
        auditLimit: String(LOG_LIMIT),
        connectionPage: String(connectionPage),
        connectionLimit: String(LOG_LIMIT),
      });
      const response = await fetch(`/api/admin/companies/${companyId}?${query.toString()}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: CompanyDetailPayload; message?: string } | null;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message || t.loadError);
      }
      setData(payload.data);
      setDraftFlags(payload.data.company.featureFlags);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.loadError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [auditPage, companyId, connectionPage, t.loadError]);

  useEffect(() => {
    void loadCompany();
  }, [loadCompany]);

  const hasFlagChanges = useMemo(() => JSON.stringify(draftFlags) !== JSON.stringify(data?.company.featureFlags || {}), [data?.company.featureFlags, draftFlags]);
  const disabledFlagKeys = useMemo(() => {
    if (!data) {
      return [] as string[];
    }

    return Object.entries(draftFlags)
      .filter(([key, value]) => data.company.featureFlags[key] && !value)
      .map(([key]) => key);
  }, [data, draftFlags]);

  const activeUsers = useMemo(() => data?.users.filter((user) => user.account_status === 'active').length ?? 0, [data?.users]);
  const activeModules = useMemo(() => Object.values(data?.company.featureFlags || {}).filter(Boolean).length, [data?.company.featureFlags]);
  const ownerLabel = data?.company.ownerUserId?.name || data?.company.ownerUserId?.email || '-';

  async function saveFlags() {
    if (!data) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/companies/${data.company._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featureFlags: draftFlags }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.saveError);
      }
      toast.success(t.saveSuccess);
      await loadCompany();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus() {
    if (!data) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/companies/${data.company._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: data.company.status === 'active' ? 'suspended' : 'active' }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.statusError);
      }
      toast.success(t.statusSuccess);
      setConfirmStatus(false);
      await loadCompany();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.statusError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AlertDialog open={confirmStatus} onOpenChange={setConfirmStatus}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{data?.company.status === 'active' ? t.suspend : t.activate}</AlertDialogTitle>
            <AlertDialogDescription>{data?.company.name}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void updateStatus()}>{t.proceed}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDisableFlags} onOpenChange={setConfirmDisableFlags}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.saveFlags}</AlertDialogTitle>
            <AlertDialogDescription>{disabledFlagKeys.join(', ')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmDisableFlags(false);
              void saveFlags();
            }}>{t.proceed}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <div className="flex flex-col gap-3 rounded-2xl bg-card/70 p-3 shadow-sm sm:p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
              <ShieldCheck className="size-3.5" />
              {t.eyebrow}
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{data?.company.name || t.companyFallback}</h1>
              <p className="text-sm text-muted-foreground">{t.slug}: {data?.company.slug || '-'} • {t.owner}: {ownerLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-9 rounded-full px-3" onClick={() => void loadCompany()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </Button>
            {data ? (
              <Button className="h-9 rounded-full px-3" variant={data.company.status === 'active' ? 'destructive' : 'default'} onClick={() => setConfirmStatus(true)} disabled={saving}>
                {data.company.status === 'active' ? t.suspend : t.activate}
              </Button>
            ) : null}
          </div>
        </div>

        {loading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : data ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard title={t.companyOverview} value={getCompanyStatusLabel(data.company.status, locale)} icon={ShieldAlert} />
            <MetricCard title={t.companyUsers} value={data.users.length} icon={Users} />
            <MetricCard title={t.activeUsers} value={activeUsers} icon={Users} />
            <MetricCard title={t.activeModules} value={activeModules} icon={Settings2} />
          </div>
        ) : null}

        {loading && !data ? null : data ? (
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="space-y-4">
              <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
                <CardHeader>
                  <CardTitle className="font-heading text-xl">{t.featureFlags}</CardTitle>
                  <CardDescription>{t.featureDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(draftFlags).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-3 dark:border-slate-800/70 dark:bg-slate-900/30">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{getCompanyFeatureLabel(key, locale)}</span>
                      </div>
                      <Switch checked={enabled} onCheckedChange={(checked) => setDraftFlags((current) => ({ ...current, [key]: checked }))} />
                    </div>
                  ))}
                  <Button className="h-10 rounded-full px-4" onClick={() => {
                    if (disabledFlagKeys.length > 0) {
                      setConfirmDisableFlags(true);
                      return;
                    }
                    void saveFlags();
                  }} disabled={!hasFlagChanges || saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                    {t.saveFlags}
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
                <CardHeader>
                  <CardTitle className="font-heading text-xl">{t.companyUsers}</CardTitle>
                  <CardDescription>{t.usersDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.users.length > 0 ? data.users.map((user) => (
                    <div key={user._id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm dark:border-slate-800/70 dark:bg-slate-900/30">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-slate-950 dark:text-slate-50">{user.name || user.email}</div>
                        <Badge variant={user.account_status === 'active' ? 'default' : 'destructive'} className="rounded-full">{getUserAccountStatusLabel(user.account_status, locale)}</Badge>
                        <Badge variant="outline" className="rounded-full">{user.role || t.notRecorded}</Badge>
                      </div>
                      <div className="mt-1 text-muted-foreground">{user.email}</div>
                    </div>
                  )) : <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-slate-800">{t.noUsers}</div>}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-xl"><Activity className="size-5 text-blue-600" />{t.auditLogs}</CardTitle>
                  <CardDescription>{t.auditDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.auditLogs.length > 0 ? data.auditLogs.map((log) => {
                    const actor = log.performedBy?.name || log.performedBy?.email || t.system;
                    const action = getAuditActionLabel(log.action, locale);
                    const target = getAuditTargetLabel(log, locale);
                    const secondaryBadge = getAuditSecondaryBadge(log);
                    return (
                      <div key={log._id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm dark:border-slate-800/70 dark:bg-slate-900/30">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 font-medium text-slate-950 dark:text-slate-50">
                              <span>{actor} {action} {target}</span>
                              {secondaryBadge ? <Badge variant="outline" className="rounded-full">{secondaryBadge}</Badge> : null}
                            </div>
                            <div className="text-muted-foreground">{getAuditDescription(log, locale)}</div>
                          </div>
                          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{formatDateTime(log.performedAt, locale)}</div>
                        </div>
                      </div>
                    );
                  }) : <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-slate-800">{t.noAuditLogs}</div>}
                  <PaginationControls
                    label={t.auditLogs}
                    pagination={data.auditPagination || emptyPagination}
                    loading={loading}
                    previousLabel={t.previous}
                    nextLabel={t.next}
                    pageLabel={t.page}
                    showingLabel={t.showing}
                    ofLabel={t.of}
                    onPageChange={setAuditPage}
                  />
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/70 dark:bg-slate-950/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-heading text-xl"><FileClock className="size-5 text-emerald-600" />{t.connectionLogs}</CardTitle>
                  <CardDescription>{t.connectionDescription}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {data.connectionLogs.length > 0 ? data.connectionLogs.map((log) => {
                    const event = getConnectionEventMeta(log.eventType, locale);
                    return (
                      <div key={log._id} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm dark:border-slate-800/70 dark:bg-slate-900/30">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium text-slate-950 dark:text-slate-50">{event.title}</div>
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneClass(event.tone)}`}>{getConnectionEventLabel(log.eventType, locale)}</span>
                            </div>
                            <div className="text-muted-foreground">{event.description}</div>
                            <div className="text-muted-foreground">{log.userId?.name || log.userId?.email || '-'} • {log.deviceLabel || log.ipAddress || t.notRecorded}</div>
                          </div>
                          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3.5" />{formatDateTime(log.createdAt, locale)}</div>
                        </div>
                      </div>
                    );
                  }) : <div className="rounded-xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-slate-800">{t.noConnectionLogs}</div>}
                  <PaginationControls
                    label={t.connectionLogs}
                    pagination={data.connectionPagination || emptyPagination}
                    loading={loading}
                    previousLabel={t.previous}
                    nextLabel={t.next}
                    pageLabel={t.page}
                    showingLabel={t.showing}
                    ofLabel={t.of}
                    onPageChange={setConnectionPage}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}