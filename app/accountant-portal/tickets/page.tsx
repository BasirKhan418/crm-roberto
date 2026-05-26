'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FilterIcon, RefreshCwIcon, SearchIcon } from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { TicketStatusBadge } from '@/components/tickets/ticket-status-badge';
import { TicketUnreadIndicator } from '@/components/tickets/ticket-unread-indicator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountantTickets } from '@/hooks/useAccountantTickets';
import { TICKET_STATUSES, type TicketStatus, type TicketType } from '@/lib/tickets/constants';

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

function resolveUserName(user: unknown, fallback: string) {
  if (!user || typeof user !== 'object') return fallback;
  const candidate = user as { name?: string; email?: string };
  return candidate.name?.trim() || candidate.email?.trim() || fallback;
}

function resolveTypeLabel(type: TicketType, locale: 'en' | 'fr') {
  const labels = {
    en: { accounting: 'Accounting', validation: 'Validation', document: 'Document', dispute: 'Dispute' },
    fr: { accounting: 'Comptabilite', validation: 'Validation', document: 'Document', dispute: 'Litige' },
  } as const;

  return labels[locale][type] || type;
}

const copy = {
  en: {
    title: 'Tickets',
    subtitle: 'Assigned support threads for the current company. Reply and resolve from the portal.',
    filters: 'Filters',
    search: 'Search title or message',
    status: 'Status',
    all: 'All',
    unreadOnly: 'Unread only',
    refresh: 'Refresh',
    open: 'Open',
    createdBy: 'Created by',
    assignedTo: 'Assigned to',
    messages: 'Messages',
    updatedAt: 'Updated',
    empty: 'No assigned tickets match these filters.',
    page: 'Page',
    previous: 'Previous',
    next: 'Next',
  },
  fr: {
    title: 'Tickets',
    subtitle: 'Discussions assignees pour cette entreprise. Repondez et resolvez depuis le portail.',
    filters: 'Filtres',
    search: 'Rechercher titre ou message',
    status: 'Statut',
    all: 'Tous',
    unreadOnly: 'Non lus seulement',
    refresh: 'Actualiser',
    open: 'Ouvrir',
    createdBy: 'Cree par',
    assignedTo: 'Assigne a',
    messages: 'Messages',
    updatedAt: 'Mis a jour',
    empty: 'Aucun ticket assigne ne correspond a ces filtres.',
    page: 'Page',
    previous: 'Precedent',
    next: 'Suivant',
  },
} as const;

export default function AccountantPortalTicketsPage() {
  const { locale } = useLocale();
  const t = copy[locale];

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { tickets, pagination, loading, error, refetch } = useAccountantTickets({
    page,
    limit: 12,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    unreadOnly,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-white/90 py-0 shadow-sm">
        <CardHeader className="flex flex-col gap-4 pt-3 lg:flex-row lg:items-start lg:justify-between xl:pt-4">
          <div>
            <CardTitle>{t.title}</CardTitle>
            <CardDescription>{t.subtitle}</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void refetch()} disabled={loading}>
            <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4 pb-4 xl:pb-5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FilterIcon className="size-4 text-muted-foreground" />
            {t.filters}
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
            <div className="space-y-1.5">
              <Label>{t.search}</Label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input className="pl-8" value={searchInput} onChange={(event) => { setSearchInput(event.target.value); setPage(1); }} placeholder={t.search} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t.status}</Label>
              <Select value={statusFilter || 'all'} onValueChange={(value) => { setStatusFilter(value === 'all' ? '' : (value as TicketStatus)); setPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder={t.status} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.all}</SelectItem>
                  {TICKET_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{status.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-muted-foreground">
              <Checkbox checked={unreadOnly} onCheckedChange={(value) => { setUnreadOnly(value === true); setPage(1); }} />
              <span>{t.unreadOnly}</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {error ? <ErrorMessage message={error} /> : null}

      <Card className="border-border/70 bg-white/90 shadow-sm">
        <CardContent className="pt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
            </div>
          ) : tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map((ticket) => {
                const assignedNames = Array.isArray(ticket.assignedTo)
                  ? ticket.assignedTo.map((user) => resolveUserName(user, '-')).filter(Boolean).join(', ')
                  : '-';

                return (
                  <div key={ticket._id} className="rounded-2xl border border-border/70 bg-slate-50/80 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-950">{ticket.title}</h2>
                          <Badge variant="secondary">{resolveTypeLabel(ticket.type, locale)}</Badge>
                          <TicketStatusBadge status={ticket.status} locale={locale} />
                          <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                          <span>{t.createdBy}: {resolveUserName(ticket.createdBy, '-')}</span>
                          <span>{t.assignedTo}: {assignedNames || '-'}</span>
                          <span>{t.messages}: {ticket.messageCount || 0}</span>
                          <span>{t.updatedAt}: {formatDateTime(ticket.updatedAt || ticket.lastMessageAt, locale)}</span>
                        </div>
                      </div>
                      <Button asChild>
                        <Link href={`/accountant-portal/tickets/${ticket._id}`}>{t.open}</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>{t.page} {pagination.page} / {pagination.totalPages || 1}</span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>{t.previous}</Button>
                  <Button type="button" variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>{t.next}</Button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState message={t.empty} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}