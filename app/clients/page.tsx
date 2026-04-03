'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Building2, Mail, MapPin, Phone, PlusIcon, SearchIcon, Users } from 'lucide-react';

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
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const initialPagination: Pagination = { page: 1, limit: 12, total: 0, totalPages: 0 };

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

export default function ClientsPage() {
  const { locale } = useLocale();
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
      viewProfile: 'View profile →',
    },
    fr: {
      fetchFailed: 'Impossible de recuperer les clients',
      shellTitle: 'Clients',
      heading: 'Clients',
      subtitle: 'Gerez les clients et conservez un historique contextuel.',
      addClient: 'Ajouter un client',
      directory: 'Repertoire des clients',
      search: 'Rechercher par nom, e-mail, entreprise...',
      empty: 'Aucun client. Ajoutez votre premier client pour commencer.',
      createdCol: 'Cree le',
      page: 'Page',
      of: 'sur',
      total: 'au total',
      previous: 'Precedent',
      next: 'Suivant',
      open: 'Ouvrir',
      noData: '—',
      totalClients: 'Total clients',
      viewProfile: 'Voir le profil →',
    },
  }[locale];

  const [clients, setClients] = useState<Client[]>([]);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [isAddOpen, setIsAddOpen] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(pagination.page));
    params.set('limit', String(pagination.limit));
    params.set('sortBy', 'createdAt');
    params.set('sortOrder', 'desc');
    if (search) params.set('search', search);
    return params.toString();
  }, [pagination.page, pagination.limit, search]);

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

  useEffect(() => { loadClients(); }, [loadClients]);
  return (
    <CrmShell title={t.shellTitle}>
      {/* Page header */}
      <div className="flex flex-col gap-3 border-b border-border/60 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">{t.heading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>

        <Button className="h-10" onClick={() => setIsAddOpen(true)}>
          <PlusIcon />
          {t.addClient}
        </Button>
      </div>

      {/* Stat bar */}
      {!loading && !error ? (
        <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 dark:border-primary/30 dark:bg-primary/10">
          <div className="flex size-9 items-center justify-center rounded-full bg-primary">
            <Users className="size-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-xs font-medium text-primary/70 dark:text-primary/60">{t.totalClients}</p>
            <p className="text-xl font-bold text-primary dark:text-primary/80">{pagination.total}</p>
          </div>
        </div>
      ) : null}

      {/* Search */}
      <div className="relative max-w-md">
        <SearchIcon className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
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

      {/* Error */}
      {error ? <ErrorMessage message={error} /> : null}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="rounded-2xl border border-border/70 p-5 space-y-3">
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
      ) : clients.length === 0 ? (
        <EmptyState message={t.empty} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client._id}
                href={`/clients/${client._id}`}
                className="group relative flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md dark:hover:border-primary/50"
              >
                {/* Avatar + name */}
                <div className="flex items-start gap-3">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor(client._id)}`}>
                    {getInitials(client.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground group-hover:text-primary dark:group-hover:text-primary/80">
                      {client.fullName}
                    </p>
                    {client.companyName ? (
                      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Building2 className="size-3 shrink-0" strokeWidth={1.75} />
                        {client.companyName}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-muted-foreground/50">{t.noData}</p>
                    )}
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
                {client.lastQuoteStatus ? (
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={client.lastQuoteStatus} />
                    {client.totalRevenue ? (
                      <span className="text-[11px] font-medium text-muted-foreground">
                        <PriceDisplay cents={client.totalRevenue} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} />
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border/50 pt-3">
                  <p className="text-[11px] text-muted-foreground/60">
                    {new Date(client.createdAt).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  <span className="text-[11px] font-medium text-primary/70 opacity-0 transition-opacity group-hover:opacity-100 dark:text-primary/60">
                    {t.viewProfile}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground">
              {t.page} {pagination.page} {t.of} {Math.max(pagination.totalPages, 1)} — {pagination.total} {t.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                {t.previous}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                {t.next}
              </Button>
            </div>
          </div>
        </>
      )}

      {isAddOpen ? (
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

