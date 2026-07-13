'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Building2, ChevronRight, LayoutGrid, List, Mail, MapPin, Phone, PlusIcon, SearchIcon, User, Users } from 'lucide-react';

import AddClientModal from '@/components/modals/AddClientModal';
import CrmShell from '@/components/crm-shell';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { QuoteStatus } from '@/components/ui/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuthMe } from '@/hooks/useAuthMe';
import { getDefaultCrmLandingPath, hasModuleActionAccess } from '@/lib/route-access';

interface Client {
  _id: string;
  clientType?: 'company' | 'individual';
  fullName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  companyName?: string | null;
  vatNumber?: string | null;
  createdAt: string;
  lastQuoteStatus?: QuoteStatus | null;
  lastQuoteDate?: string | null;
  totalRevenue?: number;
  totalInvoiced?: number;
  totalDue?: number;
  lastActivityAt?: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const initialPagination: Pagination = { page: 1, limit: 12, total: 0, totalPages: 0 };
const CLIENTS_VIEW_STORAGE_KEY = 'crm.clients.viewMode.v1';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-teal-600',
  'bg-sky-600',
  'bg-emerald-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-cyan-600',
];

function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? 'bg-indigo-600';
}

function getClientOperationalStatus(client: Client): 'due' | 'paid' | 'active' | 'new' {
  if ((client.totalDue ?? 0) > 0) return 'due';
  if ((client.totalInvoiced ?? 0) > 0) return 'paid';
  if (client.lastQuoteStatus) return 'active';
  return 'new';
}

export default function ClientsPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();
  const t = {
    en: {
      fetchFailed: 'Failed to fetch clients',
      shellTitle: 'Clients',
      heading: 'Clients',
      subtitle: 'Manage clients and keep contextual timeline notes.',
      addClient: 'Add Client',
      directory: 'Client directory',
      search: 'Search by name, email, company...',
      empty: 'No clients yet. Add your first client to start building relationship history.',
      createdCol: 'Created',
      page: 'Page',
      of: 'of',
      total: 'total',
      previous: 'Previous',
      next: 'Next',
      open: 'Open',
      noData: '—',
      totalClients: 'Total clients',
      viewProfile: 'View profile',
      typeAll: 'All',
      typeCompany: 'Company',
      typeIndividual: 'Individual',
      cardView: 'Card view',
      listView: 'List view',
      nameCompanyCol: 'Name / Company',
      typeCol: 'Type',
      emailCol: 'Email',
      phoneCol: 'Phone',
      totalInvoicedCol: 'Total invoiced',
      totalDueCol: 'Total due',
      lastActivityCol: 'Last activity',
      statusCol: 'Status',
      statusDue: 'Due',
      statusPaid: 'Paid',
      statusActive: 'Active',
      statusNew: 'New',
    },
    fr: {
      fetchFailed: 'Impossible de récupérer les clients',
      shellTitle: 'Clients',
      heading: 'Clients',
      subtitle: 'Gérez les clients et conservez un historique contextuel.',
      addClient: 'Ajouter un client',
      directory: 'Répertoire des clients',
      search: 'Rechercher par nom, e-mail, entreprise...',
      empty: 'Aucun client. Ajoutez votre premier client pour commencer.',
      createdCol: 'Créé le',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Précédent',
      next: 'Suivant',
      open: 'Ouvrir',
      noData: '—',
      totalClients: 'Total clients',
      viewProfile: 'Voir le profil',
      typeAll: 'Tous',
      typeCompany: 'Entreprise',
      typeIndividual: 'Particulier',
      cardView: 'Vue cartes',
      listView: 'Vue liste',
      nameCompanyCol: 'Nom / Entreprise',
      typeCol: 'Type',
      emailCol: 'E-mail',
      phoneCol: 'Téléphone',
      totalInvoicedCol: 'Total facturé',
      totalDueCol: 'Total dû',
      lastActivityCol: 'Dernière activité',
      statusCol: 'Statut',
      statusDue: 'Impayés',
      statusPaid: 'Réglé',
      statusActive: 'Actif',
      statusNew: 'Nouveau',
    },
  }[locale];

  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'company' | 'individual'>('all');
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const canViewClients = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'clients', action: 'view' });
  const canManageClients = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'clients', action: 'manage' });

  useEffect(() => {
    if (authLoading || canViewClients) {
      return;
    }

    router.replace(getDefaultCrmLandingPath(user?.role, user?.modulePermissions, user?.featureFlags));
  }, [authLoading, canViewClients, router, user?.featureFlags, user?.modulePermissions, user?.role]);

  useEffect(() => {
    if (authLoading || !canViewClients) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(CLIENTS_VIEW_STORAGE_KEY);
      if (raw === 'card' || raw === 'list') {
        setViewMode(raw);
      }
    } catch {
      // Ignore storage errors.
    }
  }, [authLoading, canViewClients]);

  useEffect(() => {
    if (!canViewClients) {
      return;
    }

    try {
      window.localStorage.setItem(CLIENTS_VIEW_STORAGE_KEY, viewMode);
    } catch {
      // Ignore storage errors.
    }
  }, [canViewClients, viewMode]);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('limit', String(pagination.limit));
    params.set('sortBy', 'createdAt');
    params.set('sortOrder', 'desc');
    if (search) params.set('search', search);
    if (typeFilter !== 'all') params.set('clientType', typeFilter);
    return params.toString();
  }, [pagination.page, pagination.limit, search, typeFilter]);

  const loadClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients?${query}`, { cache: 'no-store' });
      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        data?: Client[];
        pagination?: Pagination;
      };
      if (!response.ok || !data.success) throw new Error(data.message || t.fetchFailed);
      setClients(data.data ?? []);
      setPagination((prev) => data.pagination ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.fetchFailed);
      setClients([]);
      setPagination((prev) => ({ ...prev, total: 0, totalPages: 0 }));
    } finally {
      setLoading(false);
    }
  }, [query, t.fetchFailed]);

  useEffect(() => {
    if (!authLoading && canViewClients) {
      void loadClients();
    }
  }, [authLoading, canViewClients, loadClients]);

  if (authLoading) {
    return (
      <CrmShell title={t.shellTitle}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </CrmShell>
    );
  }

  if (!canViewClients) {
    return null;
  }

  return (
    <CrmShell title={t.shellTitle}>
      {/* Page header */}
      <div data-tour-clients-header className="flex flex-col gap-3 pb-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.heading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <Button className="h-10" data-tour-add-client onClick={() => setIsAddOpen(true)} disabled={!canManageClients}>
          <PlusIcon />
          {t.addClient}
        </Button>
      </div>

      {/* Stat bar */}
      {!loading && !error ? (
        <div className="flex w-fit items-center gap-4 rounded-xl bg-primary/8 px-5 py-3.5 dark:bg-primary/15">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary shadow-sm">
            <Users className="size-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/60 dark:text-primary/50">{t.totalClients}</p>
            <p className="text-2xl font-bold leading-tight text-primary dark:text-primary/80">{pagination.total}</p>
          </div>
        </div>
      ) : null}

      {/* Search + filters row */}
      <div className="space-y-3 rounded-xl bg-card/60 p-3 sm:p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full sm:max-w-md">
            <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              data-tour-clients-search
              className="h-10 pl-8"
              placeholder={t.search}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPagination((prev) => ({ ...prev, page: 1 }));
                  setSearch(searchInput.trim());
                }
              }}
            />
          </div>

          <div className="inline-flex w-full rounded-lg border bg-background p-1 md:w-auto">
            <Button
              type="button"
              variant={viewMode === 'card' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 gap-1.5 md:flex-none"
              onClick={() => setViewMode('card')}
            >
              <LayoutGrid className="size-3.5" />
              {t.cardView}
            </Button>
            <Button
              type="button"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 gap-1.5 md:flex-none"
              onClick={() => setViewMode('list')}
            >
              <List className="size-3.5" />
              {t.listView}
            </Button>
          </div>
        </div>
        {/* Type filter pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'company', 'individual'] as const).map((type) => {
            const active = typeFilter === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setTypeFilter(type);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all sm:text-sm ${
                  active
                    ? type === 'company'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : type === 'individual'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {type === 'company' && <Building2 className="size-3" />}
                {type === 'individual' && <User className="size-3" />}
                {type === 'all' ? t.typeAll : type === 'company' ? t.typeCompany : t.typeIndividual}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error ? <ErrorMessage message={error} /> : null}

      {/* Results */}
      {loading ? (
        viewMode === 'list' ? (
          <div className="rounded-xl border bg-card">
            <Table className="min-w-245">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.nameCompanyCol}</TableHead>
                  <TableHead>{t.typeCol}</TableHead>
                  <TableHead>{t.emailCol}</TableHead>
                  <TableHead>{t.phoneCol}</TableHead>
                  <TableHead className="text-right">{t.totalInvoicedCol}</TableHead>
                  <TableHead className="text-right">{t.totalDueCol}</TableHead>
                  <TableHead>{t.lastActivityCol}</TableHead>
                  <TableHead>{t.statusCol}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="space-y-3 rounded-2xl bg-card p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        )
      ) : clients.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <Table className="min-w-245">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.nameCompanyCol}</TableHead>
                    <TableHead>{t.typeCol}</TableHead>
                    <TableHead>{t.emailCol}</TableHead>
                    <TableHead>{t.phoneCol}</TableHead>
                    <TableHead className="text-right">{t.totalInvoicedCol}</TableHead>
                    <TableHead className="text-right">{t.totalDueCol}</TableHead>
                    <TableHead>{t.lastActivityCol}</TableHead>
                    <TableHead>{t.statusCol}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((client) => {
                    const status = getClientOperationalStatus(client);
                    const statusLabel =
                      status === 'due'
                        ? t.statusDue
                        : status === 'paid'
                          ? t.statusPaid
                          : status === 'active'
                            ? t.statusActive
                            : t.statusNew;

                    return (
                      <TableRow key={client._id}>
                        <TableCell>
                          <div className="min-w-0">
                            <Link href={`/clients/${client._id}`} className="truncate text-sm font-semibold text-foreground hover:text-primary">
                              {client.fullName}
                            </Link>
                            <p className="truncate text-xs text-muted-foreground">{client.companyName || t.noData}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            client.clientType === 'individual'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          }`}>
                            {client.clientType === 'individual' ? t.typeIndividual : t.typeCompany}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-55 truncate">{client.email || t.noData}</TableCell>
                        <TableCell>{client.phone || t.noData}</TableCell>
                        <TableCell className="text-right font-medium">
                          <PriceDisplay cents={client.totalInvoiced ?? 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                        </TableCell>
                        <TableCell className={`text-right font-medium ${(client.totalDue ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                          <PriceDisplay cents={client.totalDue ?? 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                        </TableCell>
                        <TableCell>
                          {new Date(client.lastActivityAt || client.lastQuoteDate || client.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            status === 'due'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                              : status === 'paid'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : status === 'active'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                                  : 'bg-muted text-muted-foreground'
                          }`}>
                            {statusLabel}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div data-tour-clients-grid className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <Link
                  key={client._id}
                  href={`/clients/${client._id}`}
                  className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {/* Colored top accent strip by client type */}
                  <div className={`h-1.5 w-full ${client.clientType === 'individual' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />

                  <div className="flex flex-col gap-3 p-5">
                    {/* Avatar + name + type badge */}
                    <div className="flex items-start gap-3">
                      <div className={`flex size-12 shrink-0 items-center justify-center text-sm font-bold text-white shadow-sm ${
                        client.clientType === 'individual'
                          ? 'rounded-full bg-emerald-500'
                          : `rounded-xl ${avatarColor(client._id)}`
                      }`}>
                        {getInitials(client.fullName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="truncate text-sm font-bold text-foreground transition-colors group-hover:text-primary dark:group-hover:text-primary/80">
                            {client.fullName}
                          </p>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            client.clientType === 'individual'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                          }`}>
                            {client.clientType === 'individual'
                              ? <><User className="size-2.5" />{t.typeIndividual}</>
                              : <><Building2 className="size-2.5" />{t.typeCompany}</>}
                          </span>
                        </div>
                        {client.companyName ? (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Building2 className="size-3 shrink-0" strokeWidth={1.75} />
                            {client.companyName}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Contact details */}
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {client.email ? (
                        <p className="flex items-center gap-2 truncate">
                          <Mail className="size-3.5 shrink-0 text-primary/50" strokeWidth={1.75} />
                          {client.email}
                        </p>
                      ) : null}
                      {client.phone ? (
                        <p className="flex items-center gap-2 truncate">
                          <Phone className="size-3.5 shrink-0 text-primary/50" strokeWidth={1.75} />
                          {client.phone}
                        </p>
                      ) : null}
                      {client.address ? (
                        <p className="flex items-center gap-2 truncate">
                          <MapPin className="size-3.5 shrink-0 text-primary/50" strokeWidth={1.75} />
                          {client.address}
                        </p>
                      ) : null}
                    </div>

                    {/* Quote status + revenue badge row */}
                    {(client.lastQuoteStatus || (client.totalRevenue && client.totalRevenue > 0)) ? (
                      <div className="flex items-center justify-between gap-2">
                        {client.lastQuoteStatus ? <StatusBadge status={client.lastQuoteStatus} /> : <span />}
                        {client.totalRevenue && client.totalRevenue > 0 ? (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <PriceDisplay cents={client.totalRevenue} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-3">
                      <p className="text-[11px] text-muted-foreground/60">
                        {new Date(client.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground/50 transition-colors group-hover:text-primary/80 dark:group-hover:text-primary/70">
                        {t.viewProfile} <ChevronRight className="size-3 shrink-0" />
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="flex flex-col gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {t.page} {pagination.page} {t.of} {Math.max(pagination.totalPages, 1)} — {pagination.total} {t.total}
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                {t.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {t.next}
              </Button>
            </div>
          </div>
        </>
      )}

      {isAddOpen && canManageClients ? (
        <AddClientModal
          onClose={() => setIsAddOpen(false)}
          onSuccess={async () => {
            setPagination((prev) => ({ ...prev, page: 1 }));
            await loadClients();
          }}
        />
      ) : null}
    </CrmShell>
  );
}

