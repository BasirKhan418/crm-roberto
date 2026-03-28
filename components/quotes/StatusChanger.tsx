'use client';

import { useMemo, useState } from 'react';

import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';

import { type QuoteStatus } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NEXT_STATUSES: Record<QuoteStatus, QuoteStatus[]> = {
  draft: ['sent'],
  sent: ['accepted', 'refused', 'draft'],
  accepted: ['draft'],
  refused: ['draft'],
};

interface StatusChangerProps {
  quoteId: string;
  status: QuoteStatus;
  locale: 'en' | 'fr';
  onStatusChanged: (newStatus: QuoteStatus) => void;
  onStatusCommitted?: () => void;
}

function statusLabel(status: QuoteStatus, locale: 'en' | 'fr') {
  const labels = {
    en: {
      draft: 'Draft',
      sent: 'Sent',
      accepted: 'Accepted',
      refused: 'Refused',
    },
    fr: {
      draft: 'Brouillon',
      sent: 'Envoye',
      accepted: 'Accepte',
      refused: 'Refuse',
    },
  } as const;

  return labels[locale][status];
}

export default function StatusChanger({ quoteId, status, locale, onStatusChanged, onStatusCommitted }: StatusChangerProps) {
  const t = {
    en: {
      placeholder: 'Change status',
      apply: 'Apply',
      failed: 'Could not change status. Please try again.',
      success: 'Status updated',
    },
    fr: {
      placeholder: 'Changer le statut',
      apply: 'Appliquer',
      failed: 'Impossible de changer le statut. Veuillez reessayer.',
      success: 'Statut mis a jour',
    },
  }[locale];

  const [selected, setSelected] = useState<QuoteStatus | ''>('');
  const [changing, setChanging] = useState(false);

  const nextOptions = useMemo(() => NEXT_STATUSES[status] ?? [], [status]);

  async function submitChange() {
    if (!selected) {
      return;
    }

    const nextStatus = selected;
    const previousStatus = status;
    setChanging(true);

    // Optimistic UI update — parent re-syncs with server after request.
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
      setSelected('');
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
    <div className="flex items-center gap-2">
      <Select value={selected} onValueChange={(value) => setSelected(value as QuoteStatus)}>
        <SelectTrigger className="h-8 w-44">
          <SelectValue placeholder={t.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {nextOptions.map((nextStatus) => (
            <SelectItem key={nextStatus} value={nextStatus}>
              {statusLabel(nextStatus, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" size="sm" onClick={submitChange} disabled={!selected || changing}>
        {changing ? <Loader2Icon className="size-3.5 animate-spin" /> : null}
        {t.apply}
      </Button>
    </div>
  );
}
