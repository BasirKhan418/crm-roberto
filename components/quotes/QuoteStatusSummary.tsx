'use client';

import { BellRingIcon } from 'lucide-react';

import { StatusBadge, type QuoteStatus } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';

interface QuoteStatusSummaryProps {
  status: QuoteStatus;
  statusChangedAt?: string | null;
  locale: 'en' | 'fr';
  showActionRequired?: boolean;
  className?: string;
  badgeClassName?: string;
}

function formatStatusDate(value: string, locale: 'en' | 'fr'): string | null {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function getStatusDateLabel(status: QuoteStatus, formattedDate: string | null, locale: 'en' | 'fr'): string | null {
  if (!formattedDate) {
    return null;
  }

  const labels = {
    en: {
      draft: 'Created on',
      sent: 'Sent on',
      accepted: 'Accepted on',
      refused: 'Refused on',
      rejected: 'Rejected on',
      fallback: 'Updated on',
    },
    fr: {
      draft: 'Cree le',
      sent: 'Envoye le',
      accepted: 'Accepte le',
      refused: 'Refuse le',
      rejected: 'Refuse le',
      fallback: 'Mis a jour le',
    },
  } as const;

  const prefix = labels[locale][status] ?? labels[locale].fallback;
  return `${prefix} ${formattedDate}`;
}

export default function QuoteStatusSummary({ status, statusChangedAt, locale, showActionRequired = false, className, badgeClassName }: QuoteStatusSummaryProps) {
  const formattedStatusDate = statusChangedAt ? formatStatusDate(statusChangedAt, locale) : null;
  const statusDateLabel = getStatusDateLabel(status, formattedStatusDate, locale);
  const actionRequiredLabel = locale === 'fr' ? 'Action requise' : 'Action required';

  return (
    <div className={cn('flex flex-col items-start gap-1', className)}>
      <StatusBadge status={status} className={badgeClassName} />
      {statusDateLabel ? <span className="text-xs text-muted-foreground">{statusDateLabel}</span> : null}
      {showActionRequired && status === 'accepted' ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: 'var(--color-text-success)' }}>
          <BellRingIcon className="size-3.5 shrink-0" />
          {actionRequiredLabel}
        </span>
      ) : null}
    </div>
  );
}
