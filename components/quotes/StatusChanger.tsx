'use client';

import { useMemo, useState } from 'react';

import { ChevronDownIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { type QuoteStatus } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const NEXT_STATUSES: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'refused'],
  accepted: [],
  refused: [],
};

interface StatusChangerProps {
  quoteId: string;
  status: QuoteStatus;
  locale: 'en' | 'fr';
  onStatusChanged: (newStatus: QuoteStatus) => void;
  onStatusCommitted?: () => void;
  containerClassName?: string;
  selectClassName?: string;
  /** @deprecated No longer used — Apply button has been removed */
  buttonClassName?: string;
}

function statusLabel(status: QuoteStatus, locale: 'en' | 'fr') {
  const labels = {
    en: { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', refused: 'Refused' },
    fr: { draft: 'Brouillon', sent: 'Envoye', accepted: 'Accepte', refused: 'Refuse' },
  } as const;

  return labels[locale][status];
}

export default function StatusChanger({
  quoteId,
  status,
  locale,
  onStatusChanged,
  onStatusCommitted,
  containerClassName,
  selectClassName,
}: StatusChangerProps) {
  const t = {
    en: {
      placeholder: 'Change status…',
      failed: 'Could not change status. Please try again.',
      success: 'Status updated',
    },
    fr: {
      placeholder: 'Changer le statut…',
      failed: 'Impossible de changer le statut. Veuillez reessayer.',
      success: 'Statut mis a jour',
    },
  }[locale];

  const [changing, setChanging] = useState(false);

  const nextOptions = useMemo(() => NEXT_STATUSES[status] ?? [], [status]);

  async function handleValueChange(value: string) {
    const nextStatus = value as QuoteStatus;
    const previousStatus = status;
    setChanging(true);

    // Optimistic update
    onStatusChanged(nextStatus);

    try {
      const response = await fetch(`/api/quotes/${quoteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: nextStatus }),
      });

      const payload = (await response.json()) as { success?: boolean; message?: string; data?: { status?: QuoteStatus } };
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || t.failed);
      }

      onStatusChanged((payload.data?.status as QuoteStatus | undefined) ?? nextStatus);
      onStatusCommitted?.();
      toast.success(t.success);
    } catch (error) {
      onStatusChanged(previousStatus);
      toast.error(error instanceof Error ? error.message : t.failed);
    } finally {
      setChanging(false);
    }
  }

  if (nextOptions.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex w-full sm:w-auto', containerClassName)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={changing}
            className={cn('h-10 w-full gap-1.5 sm:h-8 sm:w-auto', selectClassName)}
          >
            {changing ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
            {t.placeholder}
            <ChevronDownIcon className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {nextOptions.map((nextStatus) => (
            <DropdownMenuItem key={nextStatus} onSelect={() => handleValueChange(nextStatus)}>
              {statusLabel(nextStatus, locale)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

