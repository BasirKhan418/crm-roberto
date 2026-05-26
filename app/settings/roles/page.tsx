'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, Save } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthMe } from '@/hooks/useAuthMe';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import EmptyState from '@/components/ui/EmptyState';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale } from '@/components/providers/locale-provider';
import { COMPANY_ASSIGNABLE_ROLES } from '@/lib/permissions';
import type { PermissionModuleKey } from '@/lib/permissions';

type RoleMatrixRow = {
  moduleKey: PermissionModuleKey;
  permissions: {
    canView: boolean;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canExport: boolean;
    canManage: boolean;
  };
};

const editableRoles = COMPANY_ASSIGNABLE_ROLES;
const permissionKeys = ['canView', 'canCreate', 'canEdit', 'canDelete', 'canExport', 'canManage'] as const;

const texts = {
  en: {
    title: 'Role Matrix',
    subtitle: 'Override module permissions for company roles when Advanced Roles is enabled.',
    role: 'Role',
    refresh: 'Refresh',
    save: 'Save matrix',
    disabled: 'Advanced roles is disabled for this company.',
    module: 'Module',
    users: 'Users',
    expenses: 'Expenses',
    tickets: 'Tickets',
    invoices: 'Invoices',
    clients: 'Clients',
    suppliers: 'Suppliers',
    financialDashboard: 'Financial dashboard',
    settings: 'Settings',
    auditTrail: 'Audit trail',
    canView: 'View',
    canCreate: 'Create',
    canEdit: 'Edit',
    canDelete: 'Delete',
    canExport: 'Export',
    canManage: 'Manage',
    loadError: 'Failed to load role matrix',
    saveError: 'Failed to save role matrix',
    saveSuccess: 'Role matrix saved',
  },
  fr: {
    title: 'Matrice des roles',
    subtitle: 'Surchargez les permissions par module quand Roles avances est active.',
    role: 'Role',
    refresh: 'Actualiser',
    save: 'Enregistrer',
    disabled: 'Les roles avances sont desactives pour cette entreprise.',
    module: 'Module',
    users: 'Utilisateurs',
    expenses: 'Depenses',
    tickets: 'Tickets',
    invoices: 'Factures',
    clients: 'Clients',
    suppliers: 'Fournisseurs',
    financialDashboard: 'Dashboard financier',
    settings: 'Parametres',
    auditTrail: 'Journal audit',
    canView: 'Voir',
    canCreate: 'Creer',
    canEdit: 'Modifier',
    canDelete: 'Supprimer',
    canExport: 'Exporter',
    canManage: 'Gerer',
    loadError: 'Echec du chargement de la matrice',
    saveError: 'Echec de l enregistrement de la matrice',
    saveSuccess: 'Matrice enregistree',
  },
} as const;

export default function SettingsRolesPage() {
  const { user, loading: authLoading } = useAuthMe();
  const { locale } = useLocale();
  const t = texts[locale];

  const [role, setRole] = useState<(typeof editableRoles)[number]>('administrator');
  const [rows, setRows] = useState<RoleMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const roleLabels = useMemo(() => ({
    administrator: locale === 'fr' ? 'Admin' : 'Admin',
    manager: locale === 'fr' ? 'Manager' : 'Manager',
    standard_user: locale === 'fr' ? 'Utilisateur standard' : 'Standard user',
    secretary: locale === 'fr' ? 'Secretaire' : 'Secretary',
    technician: locale === 'fr' ? 'Technicien' : 'Technician',
    read_only: locale === 'fr' ? 'Lecture seule' : 'Read-only user',
    external_accountant: locale === 'fr' ? 'Comptable' : 'Accountant',
  }), [locale]);

  const loadMatrix = useCallback(async (nextRole: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/settings/role-matrix?role=${encodeURIComponent(nextRole)}`, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; rows?: RoleMatrixRow[]; message?: string } | null;
      if (!response.ok || !payload?.success || !payload.rows) {
        throw new Error(payload?.message || t.loadError);
      }
      setRows(payload.rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.loadError);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t.loadError]);

  useEffect(() => {
    if (!authLoading && user?.featureFlags?.advancedRoles) {
      void loadMatrix(role);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, loadMatrix, role, user?.featureFlags?.advancedRoles]);

  async function saveMatrix() {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/role-matrix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, rows }),
      });
      const payload = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || t.saveError);
      }
      toast.success(t.saveSuccess);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.saveError);
    } finally {
      setSaving(false);
    }
  }

  if (!authLoading && !user?.featureFlags?.advancedRoles) {
    return <EmptyState message={t.disabled} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void loadMatrix(role)} disabled={loading || saving}>
              <RefreshCcw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </Button>
            <Button type="button" onClick={() => void saveMatrix()} disabled={loading || saving || rows.length === 0}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {t.save}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1.5">
            <Label>{t.role}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as (typeof editableRoles)[number])}>
              <SelectTrigger>
                <SelectValue placeholder={t.role} />
              </SelectTrigger>
              <SelectContent>
                {editableRoles.map((option) => (
                  <SelectItem key={option} value={option}>{roleLabels[option]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-3 font-medium">{t.module}</th>
                    {permissionKeys.map((key) => (
                      <th key={key} className="px-3 py-3 text-center font-medium">{t[key]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.moduleKey} className="border-t border-border/60">
                      <td className="px-3 py-3 font-medium">{t[row.moduleKey]}</td>
                      {permissionKeys.map((key) => (
                        <td key={key} className="px-3 py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={row.permissions[key]}
                              onCheckedChange={(checked) =>
                                setRows((current) =>
                                  current.map((item) =>
                                    item.moduleKey === row.moduleKey
                                      ? {
                                          ...item,
                                          permissions: {
                                            ...item.permissions,
                                            [key]: checked === true,
                                          },
                                        }
                                      : item
                                  )
                                )
                              }
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}