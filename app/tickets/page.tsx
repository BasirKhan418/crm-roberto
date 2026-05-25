'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FilterIcon, Loader2Icon, MessageSquarePlusIcon, RefreshCwIcon, SearchIcon } from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { CreateTicketDialog } from '@/components/tickets/create-ticket-dialog';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketUnreadIndicator } from '@/components/tickets/ticket-unread-indicator';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthMe } from '@/hooks/useAuthMe';
import { type TicketListItem, useTickets } from '@/hooks/useTickets';
import {
  TICKET_LINKED_TYPES,
  TICKET_STATUSES,
  TICKET_TYPES,
  type TicketLinkedType,
  type TicketStatus,
  type TicketType,
} from '@/lib/tickets/constants';
import { hasPermission } from '@/lib/permissions';

function parseBoolean(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function formatDateTime(value: string | undefined, locale: 'en' | 'fr') {
  if (!value) return '-';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getUserDisplayName(user: unknown, fallback: string) {
  if (!user || typeof user !== 'object') {
    return fallback;
  }

  const candidate = user as { name?: string; email?: string };
  return candidate.name?.trim() || candidate.email?.trim() || fallback;
}

function getLinkedEntityId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    const maybeId = (value as { _id?: unknown })._id;
    if (typeof maybeId === 'string') {
      return maybeId;
    }
  }

  return null;
}

function buildLinkedRecordPath(ticket: TicketListItem): string | null {
  const linkedId = getLinkedEntityId(ticket.linkedId);
  if (!ticket.linkedType || !linkedId) {
    return null;
  }

  if (ticket.linkedType === 'expense') return `/expenses/${linkedId}`;
  if (ticket.linkedType === 'invoice') return `/invoices/${linkedId}`;
  if (ticket.linkedType === 'supplier') return `/suppliers/${linkedId}`;
  if (ticket.linkedType === 'client') return `/clients/${linkedId}`;

  return null;
}

function buildTypeLabel(type: TicketType, locale: 'en' | 'fr') {
  const labels = {
    en: {
      accounting: 'Accounting',
      validation: 'Validation',
      document: 'Document',
      dispute: 'Dispute',
    },
    fr: {
      accounting: 'Comptabilité',
      validation: 'Validation',
      document: 'Document',
      dispute: 'Litige',
    },
  } as const;

  return labels[locale][type] || type;
}

function buildLinkedTypeLabel(type: TicketLinkedType, locale: 'en' | 'fr') {
  const labels = {
    en: {
      expense: 'Expense',
      invoice: 'Invoice',
      supplier: 'Supplier',
      client: 'Client',
    },
    fr: {
      expense: 'Dépense',
      invoice: 'Facture',
      supplier: 'Fournisseur',
      client: 'Client',
    },
  } as const;

  return labels[locale][type] || type;
}

export default function TicketsPage() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();

  const initialStatusParam = searchParams.get('status');
  const initialTypeParam = searchParams.get('type');
  const initialLinkedTypeParam = searchParams.get('linkedType');

  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>(
    TICKET_STATUSES.includes(initialStatusParam as TicketStatus) ? (initialStatusParam as TicketStatus) : ''
  );
  const [typeFilter, setTypeFilter] = useState<TicketType | ''>(
    TICKET_TYPES.includes(initialTypeParam as TicketType) ? (initialTypeParam as TicketType) : ''
  );
  const [linkedTypeFilter, setLinkedTypeFilter] = useState<TicketLinkedType | ''>(
    TICKET_LINKED_TYPES.includes(initialLinkedTypeParam as TicketLinkedType)
      ? (initialLinkedTypeParam as TicketLinkedType)
      : ''
  );
  const [linkedIdFilter, setLinkedIdFilter] = useState(searchParams.get('linkedId') || '');
  const [assignedToMe, setAssignedToMe] = useState(parseBoolean(searchParams.get('assignedToMe')));
  const [createdByMe, setCreatedByMe] = useState(parseBoolean(searchParams.get('createdByMe')));
  const [unreadOnly, setUnreadOnly] = useState(parseBoolean(searchParams.get('unreadOnly')));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const canViewTickets = hasPermission(user?.role, 'tickets.view');

  const { tickets, pagination, loading, error, refetch } = useTickets(
    {
      page,
      limit,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      linkedType: linkedTypeFilter || undefined,
      linkedId: linkedIdFilter.trim() || undefined,
      assignedToMe,
      createdByMe,
      unreadOnly,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    },
    canViewTickets
  );

  const t = {
    en: {
      shellTitle: 'Tickets',
      heading: 'Tickets Workspace',
      subtitle: 'Track support threads, unblock waiting items, and keep internal communication moving.',
      forbiddenTitle: 'You do not have access to tickets',
      forbiddenHelp: 'Ask an administrator to grant tickets permissions.',
      search: 'Search',
      searchPlaceholder: 'Search title or message...',
      status: 'Status',
      type: 'Type',
      linkedType: 'Linked type',
      linkedId: 'Linked record ID',
      assignedToMe: 'Assigned to me',
      createdByMe: 'Created by me',
      unreadOnly: 'Unread only',
      rows: 'Rows',
      all: 'All',
      filters: 'Filters',
      resetFilters: 'Reset filters',
      refresh: 'Refresh',
      newTicket: 'New ticket',
      noTickets: 'No tickets found for these filters.',
      ticketTitle: 'Ticket',
      participants: 'Participants',
      linked: 'Linked',
      lastUpdate: 'Last update',
      open: 'Open',
      createdBy: 'Created by',
      assigned: 'Assigned',
      unassigned: 'Unassigned',
      pageInfo: (current: number, total: number, count: number) => `Page ${current}/${total || 1} - ${count} tickets`,
      previous: 'Previous',
      next: 'Next',
      linkedRecord: 'Linked record',
      loadError: 'Could not load tickets.',
      statusLabels: { open: 'Open', waiting: 'Waiting', replied: 'Replied', resolved: 'Resolved', archived: 'Archived' },
    },
    fr: {
      shellTitle: 'Tickets',
      heading: 'Espace Tickets',
      subtitle: 'Suivez les discussions, débloquez les attentes, et fluidifiez la communication interne.',
      forbiddenTitle: "Vous n'avez pas accès aux tickets",
      forbiddenHelp: "Demandez à un administrateur d'activer les permissions tickets.",
      search: 'Recherche',
      searchPlaceholder: 'Rechercher titre ou message...',
      status: 'Statut',
      type: 'Type',
      linkedType: 'Type lié',
      linkedId: 'ID de la ressource',
      assignedToMe: 'Assignés à moi',
      createdByMe: 'Créés par moi',
      unreadOnly: 'Non lus uniquement',
      rows: 'Lignes',
      all: 'Tous',
      filters: 'Filtres',
      resetFilters: 'Réinitialiser',
      refresh: 'Actualiser',
      newTicket: 'Nouveau ticket',
      noTickets: 'Aucun ticket pour ces filtres.',
      ticketTitle: 'Ticket',
      participants: 'Participants',
      linked: 'Lié',
      lastUpdate: 'Dernière mise à jour',
      open: 'Ouvrir',
      createdBy: 'Créé par',
      assigned: 'Assigné',
      unassigned: 'Non assigné',
      pageInfo: (current: number, total: number, count: number) => `Page ${current}/${total || 1} - ${count} tickets`,
      previous: 'Précédent',
      next: 'Suivant',
      linkedRecord: 'Ressource liée',
      loadError: 'Impossible de charger les tickets.',
      statusLabels: { open: 'Ouvert', waiting: 'En attente', replied: 'Répondu', resolved: 'Résolu', archived: 'Archivé' },
    },
  }[locale];

  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setLinkedTypeFilter('');
    setLinkedIdFilter('');
    setAssignedToMe(false);
    setCreatedByMe(false);
    setUnreadOnly(false);
    setLimit(20);
    setPage(1);
  }

  const hasFiltersApplied = Boolean(
    searchInput || statusFilter || typeFilter || linkedTypeFilter || linkedIdFilter.trim() || assignedToMe || createdByMe || unreadOnly
  );

  const renderedError = !canViewTickets && !authLoading
    ? t.forbiddenHelp
    : error
      ? t.loadError
      : null;

  return (
    <CrmShell title={t.shellTitle} contentClassName="gap-4 px-4 py-3 lg:px-6 lg:py-4">
      <div className="flex flex-col gap-2.5 rounded-2xl bg-card/70 p-3 text-left shadow-sm sm:p-4 lg:flex-row lg:items-end lg:justify-between" data-tour-tickets-header>
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{t.heading}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => void refetch()} disabled={!canViewTickets || loading}>
            {loading ? <Loader2Icon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
            {t.refresh}
          </Button>
          <Button type="button" onClick={() => setCreateOpen(true)} disabled={!canViewTickets} data-tour-new-ticket>
            <MessageSquarePlusIcon className="size-4" />
            {t.newTicket}
          </Button>
        </div>
      </div>

      {!authLoading && !canViewTickets ? (
        <ErrorMessage message={`${t.forbiddenTitle}. ${t.forbiddenHelp}`} />
      ) : null}

      <section className="space-y-3 rounded-2xl border border-border/70 bg-card p-3 sm:p-4" aria-label={t.filters} data-tour-tickets-filters>
        <div className="flex items-center gap-2">
          <FilterIcon className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">{t.filters}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5 xl:col-span-2">
            <Label>{t.search}</Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input className="pl-8" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setPage(1); }} placeholder={t.searchPlaceholder} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.status}</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter((event.target.value || '') as TicketStatus | ''); setPage(1); }}>
              <option value="">{t.all}</option>
              {TICKET_STATUSES.map((status) => (
                <option key={status} value={status}>{t.statusLabels[status as keyof typeof t.statusLabels] ?? status}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.type}</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm" value={typeFilter} onChange={(event) => { setTypeFilter((event.target.value || '') as TicketType | ''); setPage(1); }}>
              <option value="">{t.all}</option>
              {TICKET_TYPES.map((type) => (
                <option key={type} value={type}>{buildTypeLabel(type, locale)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.linkedType}</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm" value={linkedTypeFilter} onChange={(event) => { setLinkedTypeFilter((event.target.value || '') as TicketLinkedType | ''); setPage(1); }}>
              <option value="">{t.all}</option>
              {TICKET_LINKED_TYPES.map((linkedType) => (
                <option key={linkedType} value={linkedType}>{buildLinkedTypeLabel(linkedType, locale)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 xl:col-span-2">
            <Label>{t.linkedId}</Label>
            <Input value={linkedIdFilter} onChange={(event) => { setLinkedIdFilter(event.target.value); setPage(1); }} />
          </div>

          <div className="space-y-1.5">
            <Label>{t.rows}</Label>
            <select className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm" value={String(limit)} onChange={(event) => { setLimit(Number(event.target.value) || 20); setPage(1); }}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={assignedToMe} onChange={(event) => { setAssignedToMe(event.target.checked); setPage(1); }} />
            {t.assignedToMe}
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={createdByMe} onChange={(event) => { setCreatedByMe(event.target.checked); setPage(1); }} />
            {t.createdByMe}
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={unreadOnly} onChange={(event) => { setUnreadOnly(event.target.checked); setPage(1); }} />
            {t.unreadOnly}
          </label>

          {hasFiltersApplied ? (
            <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={resetFilters}>
              {t.resetFilters}
            </Button>
          ) : null}
        </div>
      </section>

      {renderedError && canViewTickets ? <ErrorMessage message={renderedError || t.loadError} /> : null}

      <section className="space-y-2" data-tour-tickets-list>
        {loading ? (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-3 sm:p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`ticket-skeleton-${index}`} className="rounded-xl border border-border/60 p-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3.5 w-60" />
              </div>
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <EmptyState message={t.noTickets} />
          </div>
        ) : (
          <div className="space-y-2 rounded-2xl border border-border/70 bg-card p-2 sm:p-3">
            {tickets.map((ticket) => {
              const assignedNames = Array.isArray(ticket.assignedTo) && ticket.assignedTo.length > 0
                ? ticket.assignedTo.map((entry) => getUserDisplayName(entry, '-')).join(', ')
                : t.unassigned;
              const createdByLabel = getUserDisplayName(ticket.createdBy, '-');
              const linkedPath = buildLinkedRecordPath(ticket);
              const linkedLabel = ticket.linkedType
                ? `${buildLinkedTypeLabel(ticket.linkedType, locale)} ${getLinkedEntityId(ticket.linkedId) || ''}`.trim()
                : '-';

              return (
                <div key={ticket._id} className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/tickets/${ticket._id}`} className="truncate text-sm font-semibold text-foreground hover:underline">
                          {ticket.title}
                        </Link>
                        <TicketStatusBadge status={ticket.status} locale={locale} />
                        <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                      </div>

                      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>
                          {t.type}: <span className="font-medium text-foreground">{buildTypeLabel(ticket.type, locale)}</span>
                        </p>
                        <p>
                          {t.lastUpdate}: <span className="font-medium text-foreground">{formatDateTime(ticket.lastMessageAt || ticket.updatedAt, locale)}</span>
                        </p>
                        <p className="truncate">
                          {t.createdBy}: <span className="font-medium text-foreground">{createdByLabel}</span>
                        </p>
                        <p className="truncate">
                          {t.assigned}: <span className="font-medium text-foreground">{assignedNames}</span>
                        </p>
                        <p className="truncate sm:col-span-2">
                          {t.linked}: <span className="font-medium text-foreground">{linkedLabel}</span>
                          {linkedPath ? (
                            <Link href={linkedPath} className="ml-2 text-xs text-primary hover:underline">
                              {t.linkedRecord}
                            </Link>
                          ) : null}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:pl-3">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/tickets/${ticket._id}`}>{t.open}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {canViewTickets ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">{t.pageInfo(pagination.page, pagination.totalPages, pagination.total)}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((previous) => Math.max(1, previous - 1))} disabled={page <= 1 || loading}>
              {t.previous}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPage((previous) => previous + 1)} disabled={loading || pagination.totalPages === 0 || page >= pagination.totalPages}>
              {t.next}
            </Button>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <CreateTicketDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          locale={locale}
          onCreated={async () => {
            await refetch();
          }}
        />
      ) : null}
    </CrmShell>
  );
}
