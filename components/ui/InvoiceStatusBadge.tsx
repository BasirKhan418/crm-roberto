'use client';

import { cn } from '@/lib/utils';

export type InvoiceStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'overdue';

const STATUS_STYLES: Record<InvoiceStatus, { backgroundColor: string; color: string }> = {
  unpaid: {
    backgroundColor: 'rgba(100, 116, 139, 0.11)',
    color: '#475569',
  },
  deposit_paid: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    color: '#b45309',
  },
  paid: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    color: '#15803d',
  },
  overdue: {
    backgroundColor: 'rgba(239, 68, 68, 0.16)',
    color: '#b91c1c',
  },
};

function getStatusLabel(status: InvoiceStatus, locale: 'en' | 'fr'): string {
  if (locale === 'fr') {
    if (status === 'unpaid') return 'Impayee';
    if (status === 'deposit_paid') return 'Acompte paye';
    if (status === 'paid') return 'Payee';
    return 'En retard';
  }

  if (status === 'unpaid') return 'Unpaid';
  if (status === 'deposit_paid') return 'Deposit paid';
  if (status === 'paid') return 'Paid';
  return 'Overdue';
}

type InvoiceStatusBadgeProps = {
  status: InvoiceStatus;
  locale: 'en' | 'fr';
  className?: string;
};

export function InvoiceStatusBadge({ status, locale, className }: InvoiceStatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const label = getStatusLabel(status, locale);

  if (status === 'paid' || status === 'overdue') {
    return (
      <span
        className={cn('inline-flex items-center gap-1 rounded-[10px] px-2.25 py-0.75 text-[11px] font-semibold ring-1 ring-inset', className)}
        style={{ backgroundColor: style.backgroundColor, color: style.color, boxShadow: `inset 0 0 0 1px ${style.color}` }}
      >
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: style.color }} />
          <span className="relative inline-flex size-1.5 rounded-full" style={{ backgroundColor: style.color }} />
        </span>
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn('inline-block rounded-[10px] px-2.25 py-0.75 text-[11px] font-semibold', className)}
      style={{ backgroundColor: style.backgroundColor, color: style.color }}
    >
      {label}
    </span>
  );
}
