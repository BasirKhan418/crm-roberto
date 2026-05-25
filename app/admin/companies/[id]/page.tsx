'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

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
  auditLogs: Array<{ _id: string; action: string; entityType: string; performedBy?: { name?: string; email?: string } | null }>;
  connectionLogs: Array<{ _id: string; eventType: string; ipAddress?: string; userId?: { name?: string; email?: string } | null }>;
};

const messages = {
  en: {
    refresh: 'Refresh',
    featureFlags: 'Feature flags',
    companyUsers: 'Users',
    auditLogs: 'Audit logs',
    connectionLogs: 'Connection logs',
    saveFlags: 'Save flags',
    saveSuccess: 'Feature flags updated.',
    saveError: 'Failed to update feature flags.',
    statusSuccess: 'Company status updated.',
    statusError: 'Failed to update company status.',
    suspend: 'Suspend company',
    activate: 'Activate company',
  },
  fr: {
    refresh: 'Actualiser',
    featureFlags: 'Feature flags',
    companyUsers: 'Utilisateurs',
    auditLogs: 'Audit logs',
    connectionLogs: 'Logs de connexion',
    saveFlags: 'Enregistrer les flags',
    saveSuccess: 'Feature flags mis a jour.',
    saveError: 'Echec de mise a jour des flags.',
    statusSuccess: 'Statut entreprise mis a jour.',
    statusError: 'Echec de mise a jour du statut.',
    suspend: 'Suspendre entreprise',
    activate: 'Activer entreprise',
  },
} as const;

export default function AdminCompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const { locale } = useLocale();
  const t = messages[locale];
  const companyId = typeof params?.id === 'string' ? params.id : '';

  const [data, setData] = useState<CompanyDetailPayload | null>(null);
  const [draftFlags, setDraftFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState(false);
  const [confirmDisableFlags, setConfirmDisableFlags] = useState(false);

  const loadCompany = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/companies/${companyId}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; data?: CompanyDetailPayload; message?: string } | null;
      if (!response.ok || !payload?.success || !payload.data) {
        throw new Error(payload?.message || 'Failed to load company');
      }
      setData(payload.data);
      setDraftFlags(payload.data.company.featureFlags);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load company');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void updateStatus()}>Proceed</AlertDialogAction>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmDisableFlags(false);
              void saveFlags();
            }}>Proceed</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{data?.company.name || 'Company'}</h1>
            <p className="text-sm text-muted-foreground">{data?.company.slug}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void loadCompany()} disabled={loading}>
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </Button>
            {data ? (
              <Button variant={data.company.status === 'active' ? 'destructive' : 'default'} onClick={() => setConfirmStatus(true)} disabled={saving}>
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
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t.featureFlags}</CardTitle>
                  <CardDescription>{data.company.ownerUserId?.name || data.company.ownerUserId?.email || '-'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(draftFlags).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
                      <span className="text-sm font-medium text-slate-900">{key}</span>
                      <Switch checked={enabled} onCheckedChange={(checked) => setDraftFlags((current) => ({ ...current, [key]: checked }))} />
                    </div>
                  ))}
                  <Button onClick={() => {
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

              <Card>
                <CardHeader><CardTitle>{t.companyUsers}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data.users.map((user) => (
                    <div key={user._id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-950">{user.name || user.email}</div>
                      <div className="text-muted-foreground">{user.email} - {user.role} - {user.account_status}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>{t.auditLogs}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data.auditLogs.map((log) => (
                    <div key={log._id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-950">{log.entityType} / {log.action}</div>
                      <div className="text-muted-foreground">{log.performedBy?.name || log.performedBy?.email || 'System'}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{t.connectionLogs}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {data.connectionLogs.map((log) => (
                    <div key={log._id} className="rounded-lg border border-border/60 px-3 py-2 text-sm">
                      <div className="font-medium text-slate-950">{log.eventType}</div>
                      <div className="text-muted-foreground">{log.userId?.name || log.userId?.email || '-'} {log.ipAddress ? `- ${log.ipAddress}` : ''}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}