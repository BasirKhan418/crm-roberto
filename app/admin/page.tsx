'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldOff,
  Users,
  Loader2,
  ShieldAlert,
  Mail,
  Calendar,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocale } from '@/components/providers/locale-provider';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  account_status: 'active' | 'suspended';
  isEmailVerified: boolean;
  isOnboardingComplete: boolean;
  createdAt: string;
}

const adminMessages = {
  en: {
    heading: 'User Management',
    subtitle: 'Manage user accounts — activate or suspend access.',
    totalUsers: 'Total Users',
    activeUsers: 'Active',
    suspendedUsers: 'Suspended',
    userList: 'All Users',
    name: 'Name',
    email: 'Email',
    status: 'Status',
    emailVerified: 'Email Verified',
    joined: 'Joined',
    actions: 'Actions',
    activate: 'Activate',
    suspend: 'Suspend',
    active: 'Active',
    suspended: 'Suspended',
    yes: 'Yes',
    no: 'No',
    loadError: 'Could not load users.',
    updateSuccess: 'Account status updated.',
    updateError: 'Failed to update account status.',
    confirmSuspendTitle: 'Suspend User',
    confirmSuspendDesc: (name: string) => `"${name}" will immediately lose access and cannot log in until reactivated.`,
    confirmActivateTitle: 'Activate User',
    confirmActivateDesc: (name: string) => `"${name}" will regain full access to their account.`,
    cancel: 'Cancel',
    confirmSuspend: 'Yes, Suspend',
    confirmActivate: 'Yes, Activate',
    searchPlaceholder: 'Search by name or email…',
    filterAll: 'All statuses',
    filterActive: 'Active only',
    filterSuspended: 'Suspended only',
    noResults: 'No users match your filters.',
    refresh: 'Refresh',
    verifiedAll: 'Any verification',
    verifiedOnly: 'Verified only',
    unverifiedOnly: 'Unverified only',
    clearFilters: 'Clear filters',
    showingOf: (shown: number, total: number) => `Showing ${shown} of ${total} users`,
  },
  fr: {
    heading: 'Gestion des utilisateurs',
    subtitle: "Gérez les comptes utilisateurs — activez ou suspendez l'accès.",
    totalUsers: 'Total Utilisateurs',
    activeUsers: 'Actifs',
    suspendedUsers: 'Suspendus',
    userList: 'Tous les utilisateurs',
    name: 'Nom',
    email: 'E-mail',
    status: 'Statut',
    emailVerified: 'E-mail vérifié',
    joined: 'Inscrit le',
    actions: 'Actions',
    activate: 'Activer',
    suspend: 'Suspendre',
    active: 'Actif',
    suspended: 'Suspendu',
    yes: 'Oui',
    no: 'Non',
    loadError: 'Impossible de charger les utilisateurs.',
    updateSuccess: 'Statut mis à jour.',
    updateError: 'Échec de la mise à jour.',
    confirmSuspendTitle: "Suspendre l'utilisateur",
    confirmSuspendDesc: (name: string) => `« ${name} » perdra immédiatement l'accès et ne pourra plus se connecter.`,
    confirmActivateTitle: "Activer l'utilisateur",
    confirmActivateDesc: (name: string) => `« ${name} » retrouvera un accès complet à son compte.`,
    cancel: 'Annuler',
    confirmSuspend: 'Oui, suspendre',
    confirmActivate: 'Oui, activer',
    searchPlaceholder: 'Rechercher par nom ou e-mail…',
    filterAll: 'Tous les statuts',
    filterActive: 'Actifs uniquement',
    filterSuspended: 'Suspendus uniquement',
    noResults: 'Aucun utilisateur ne correspond aux filtres.',
    refresh: 'Actualiser',
    verifiedAll: 'Toute vérification',
    verifiedOnly: 'Vérifiés uniquement',
    unverifiedOnly: 'Non vérifiés uniquement',
    clearFilters: 'Effacer les filtres',
    showingOf: (shown: number, total: number) => `${shown} sur ${total} utilisateurs`,
  },
} as const;

function formatDate(dateStr: string, locale: 'en' | 'fr'): string {
  const d = new Date(dateStr);
  if (!Number.isFinite(d.getTime())) return '--';
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = adminMessages[locale];

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ userId: string; name: string; newStatus: 'active' | 'suspended' } | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.status === 403 || res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      } else {
        setError(data.message || t.loadError);
      }
    } catch {
      setError(t.loadError);
    } finally {
      setLoading(false);
    }
  }, [t.loadError, router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all' && u.account_status !== statusFilter) return false;
      if (verifiedFilter === 'verified' && !u.isEmailVerified) return false;
      if (verifiedFilter === 'unverified' && u.isEmailVerified) return false;
      return true;
    });
  }, [users, search, statusFilter, verifiedFilter]);

  function requestStatusChange(userId: string, name: string, newStatus: 'active' | 'suspended') {
    setConfirmModal({ userId, name, newStatus });
  }

  async function handleStatusChange() {
    if (!confirmModal) return;
    const { userId, newStatus } = confirmModal;
    setConfirmModal(null);
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, account_status: newStatus }),
      });
      if (res.status === 403 || res.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        toast.success(t.updateSuccess);
        setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, account_status: newStatus } : u)));
      } else {
        toast.error(data.message || t.updateError);
      }
    } catch {
      toast.error(t.updateError);
    } finally {
      setUpdatingId(null);
    }
  }

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setVerifiedFilter('all');
  }

  const isSuspendAction = confirmModal?.newStatus === 'suspended';

  const activeCount = users.filter((u) => u.account_status === 'active').length;
  const suspendedCount = users.filter((u) => u.account_status === 'suspended').length;
  const hasActiveFilters = search !== '' || statusFilter !== 'all' || verifiedFilter !== 'all';

  return (
    <>
      {/* Confirm modal */}
      <Dialog open={!!confirmModal} onOpenChange={(open) => { if (!open) setConfirmModal(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-xl sm:rounded-xl">
          <DialogHeader className="gap-3">
            <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${isSuspendAction ? 'bg-red-100 dark:bg-red-950/40' : 'bg-emerald-100 dark:bg-emerald-950/40'}`}>
              {isSuspendAction
                ? <ShieldOff className="size-6 text-red-600 dark:text-red-400" strokeWidth={1.75} />
                : <ShieldCheck className="size-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />}
            </div>
            <DialogTitle className="text-center text-base">
              {isSuspendAction ? t.confirmSuspendTitle : t.confirmActivateTitle}
            </DialogTitle>
            <DialogDescription className="text-center text-sm leading-relaxed">
              {confirmModal
                ? isSuspendAction
                  ? t.confirmSuspendDesc(confirmModal.name)
                  : t.confirmActivateDesc(confirmModal.name)
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 flex-col-reverse gap-2 sm:flex-row sm:gap-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setConfirmModal(null)}
            >
              {t.cancel}
            </Button>
            <Button
              className={`w-full sm:w-auto ${isSuspendAction ? 'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600' : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600'}`}
              onClick={handleStatusChange}
            >
              {isSuspendAction ? t.confirmSuspend : t.confirmActivate}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-primary" strokeWidth={1.75} />
            <h1 className="text-xl font-bold tracking-tight">{t.heading}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchUsers} disabled={loading} className="w-full gap-1.5 sm:w-auto">
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t.refresh}
        </Button>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <XCircle className="size-5 shrink-0 text-destructive" />
            <p className="text-sm font-medium text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-2 border-primary/20">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="hidden rounded-lg bg-primary/10 p-2 sm:flex">
              <Users className="size-4 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t.totalUsers}</p>
              {loading ? <Skeleton className="mt-1 h-7 w-8" /> : <p className="text-xl font-bold text-primary">{users.length}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-emerald-400/25">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="hidden rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/40 sm:flex">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t.activeUsers}</p>
              {loading ? <Skeleton className="mt-1 h-7 w-8" /> : <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{activeCount}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-red-400/25">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="hidden rounded-lg bg-red-100 p-2 dark:bg-red-900/40 sm:flex">
              <ShieldOff className="size-4 text-red-600 dark:text-red-400" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{t.suspendedUsers}</p>
              {loading ? <Skeleton className="mt-1 h-7 w-8" /> : <p className="text-xl font-bold text-red-600 dark:text-red-400">{suspendedCount}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card className="overflow-hidden pt-0">
        <CardHeader className="border-b bg-muted/30 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {t.userList}
            </CardTitle>
            {!loading && (
              <span className="text-xs text-muted-foreground">{t.showingOf(filteredUsers.length, users.length)}</span>
            )}
          </div>

          {/* Search + Filters */}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="h-8 w-full gap-1 text-xs sm:w-38">
                  <Filter className="size-3 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.filterAll}</SelectItem>
                  <SelectItem value="active">{t.filterActive}</SelectItem>
                  <SelectItem value="suspended">{t.filterSuspended}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={verifiedFilter} onValueChange={(v) => setVerifiedFilter(v as typeof verifiedFilter)}>
                <SelectTrigger className="h-8 w-full gap-1 text-xs sm:w-38">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.verifiedAll}</SelectItem>
                  <SelectItem value="verified">{t.verifiedOnly}</SelectItem>
                  <SelectItem value="unverified">{t.unverifiedOnly}</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={clearFilters}>
                  <XCircle className="size-3.5" />
                  {t.clearFilters}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="divide-y">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-7 w-20" />
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
              <Users className="size-9 opacity-30" />
              <p className="text-sm">{hasActiveFilters ? t.noResults : t.loadError}</p>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={clearFilters}>
                  {t.clearFilters}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.name}</th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.email}</th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.status}</th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.emailVerified}</th>
                      <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.joined}</th>
                      <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className={`transition-colors hover:bg-muted/20 ${u.account_status === 'suspended' ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-foreground">{u.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-muted-foreground">{u.email}</td>
                        <td className="px-5 py-3.5">
                          <Badge variant="outline" className={`text-[10px] ${u.account_status === 'active' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                            {u.account_status === 'active' ? t.active : t.suspended}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.isEmailVerified
                            ? <CheckCircle2 className="size-4 text-emerald-500" />
                            : <XCircle className="size-4 text-muted-foreground/40" />}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(u.createdAt, locale)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {u.account_status === 'active' ? (
                            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40" disabled={updatingId === u._id} onClick={() => requestStatusChange(u._id, u.name, 'suspended')}>
                              {updatingId === u._id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" strokeWidth={2} />}
                              {t.suspend}
                            </Button>
                          ) : (
                            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40" disabled={updatingId === u._id} onClick={() => requestStatusChange(u._id, u.name, 'active')}>
                              {updatingId === u._id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" strokeWidth={2} />}
                              {t.activate}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y lg:hidden">
                {filteredUsers.map((u) => (
                  <div key={u._id} className={`px-4 py-4 ${u.account_status === 'suspended' ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">{u.name}</p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="size-3 shrink-0" />
                          <span className="truncate">{u.email}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${u.account_status === 'active' ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/30 dark:text-red-400'}`}>
                            {u.account_status === 'active' ? t.active : t.suspended}
                          </Badge>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            {u.isEmailVerified ? <CheckCircle2 className="size-3 text-emerald-500" /> : <XCircle className="size-3 text-muted-foreground/40" />}
                            {u.isEmailVerified ? t.yes : t.no}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Calendar className="size-3" />
                            {formatDate(u.createdAt, locale)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      {u.account_status === 'active' ? (
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/40" disabled={updatingId === u._id} onClick={() => requestStatusChange(u._id, u.name, 'suspended')}>
                          {updatingId === u._id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" strokeWidth={2} />}
                          {t.suspend}
                        </Button>
                      ) : (
                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 border-emerald-300 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/40" disabled={updatingId === u._id} onClick={() => requestStatusChange(u._id, u.name, 'active')}>
                          {updatingId === u._id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" strokeWidth={2} />}
                          {t.activate}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
