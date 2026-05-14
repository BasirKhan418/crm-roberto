'use client';

import { Badge } from '@/components/ui/badge';
import { type TicketStatus } from '@/lib/tickets/constants';

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'border-sky-200 bg-sky-50 text-sky-700',
  waiting: 'border-amber-200 bg-amber-50 text-amber-700',
  replied: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  archived: 'border-slate-200 bg-slate-100 text-slate-600',
};

const STATUS_LABELS = {
  en: {
    open: 'Open',
    waiting: 'Waiting',
    replied: 'Replied',
    resolved: 'Resolved',
    archived: 'Archived',
  },
  fr: {
    open: 'Ouvert',
    waiting: 'En attente',
    replied: 'Repondu',
    resolved: 'Resolu',
    archived: 'Archive',
  },
} as const;

export function TicketStatusBadge({
  status,
  locale = 'en',
}: {
  status: TicketStatus;
  locale?: 'en' | 'fr';
}) {
  const labels = locale === 'fr' ? STATUS_LABELS.fr : STATUS_LABELS.en;

  return (
    <Badge variant="outline" className={STATUS_STYLES[status]}>
      {labels[status]}
    </Badge>
  );
}
