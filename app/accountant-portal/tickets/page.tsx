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
import { formatInvoiceReferencesInText } from '@/lib/i18n/messages';
import { TICKET_STATUSES, type TicketStatus, type TicketType } from '@/lib/tickets/constants';

const STATUS_ROW_BG: Record<TicketStatus, string> = {
  open: 'rgba(14, 165, 233, 0.05)',
  waiting: 'rgba(245, 158, 11, 0.07)',
  replied: 'rgba(99, 102, 241, 0.06)',
  resolved: 'rgba(16, 185, 129, 0.06)',
  archived: 'rgba(100, 116, 139, 0.05)',
};

const STATUS_ACCENT: Record<TicketStatus, string> = {
  open: '#0284c7',
  waiting: '#d97706',
  replied: '#4f46e5',
  resolved: '#059669',
  archived: '#64748b',
};

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
    filterHint: 'Color-coded ticket cards make status, unread state, and ownership easier to scan.',
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
    filterHint: 'Les cartes colorees rendent le statut, les non lus et l attribution plus faciles a lire.',
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
          <p className="text-sm text-muted-foreground">{t.filterHint}</p>
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
                  <div
                    key={ticket._id}
                    className="rounded-2xl border border-border/70 p-4 shadow-sm transition-colors"
                    style={{
                      borderLeftWidth: '4px',
                      borderLeftColor: STATUS_ACCENT[ticket.status],
                      backgroundColor: STATUS_ROW_BG[ticket.status],
                    }}
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-slate-950">{formatInvoiceReferencesInText(locale, ticket.title)}</h2>
                          <Badge variant="secondary" className="border-white/70 bg-white/80 text-slate-700 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200">
                            {resolveTypeLabel(ticket.type, locale)}
                          </Badge>
                          <TicketStatusBadge status={ticket.status} locale={locale} />
                          <TicketUnreadIndicator unreadCount={ticket.unreadCount} locale={locale} />
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                          <span><span className="font-medium text-slate-700 dark:text-slate-200">{t.createdBy}:</span> {resolveUserName(ticket.createdBy, '-')}</span>
                          <span><span className="font-medium text-slate-700 dark:text-slate-200">{t.assignedTo}:</span> {assignedNames || '-'}</span>
                          <span><span className="font-medium text-slate-700 dark:text-slate-200">{t.messages}:</span> {ticket.messageCount || 0}</span>
                          <span><span className="font-medium text-slate-700 dark:text-slate-200">{t.updatedAt}:</span> {formatDateTime(ticket.updatedAt || ticket.lastMessageAt, locale)}</span>
                        </div>
                      </div>
                      <Button asChild className="shrink-0 rounded-xl shadow-sm">
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