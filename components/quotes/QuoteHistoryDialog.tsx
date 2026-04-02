'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { HistoryIcon, Loader2Icon } from 'lucide-react';

import QuoteHistoryBar from '@/components/quotes/QuoteHistoryBar';
import type { QuoteStatus } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface HistoryEntry {
  from?: QuoteStatus;
  to: QuoteStatus;
  changedAt: string;
}

interface QuoteHistoryDialogProps {
  quoteId: string;
  quoteNumber: string;
  currentStatus: QuoteStatus;
  locale: 'en' | 'fr';
  label: string;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  hideTrigger?: boolean;
  trigger?: ReactElement;
}

const MESSAGES = {
  en: { title: 'Quote history', loading: 'Loading history…', error: 'Could not load history.' },
  fr: { title: 'Historique du devis', loading: 'Chargement…', error: 'Impossible de charger l\'historique.' },
} as const;

export default function QuoteHistoryDialog({ quoteId, quoteNumber, currentStatus, locale, label, open, onOpenChange, hideTrigger = false, trigger }: QuoteHistoryDialogProps) {
  const t = MESSAGES[locale];
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dialogOpen = open ?? internalOpen;

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { cache: 'no-store' });
      const payload = (await res.json()) as { success?: boolean; data?: { statusHistory?: HistoryEntry[] } };
      const raw = payload.data?.statusHistory ?? [];
      setHistory([...raw].sort((a, b) => +new Date(a.changedAt) - +new Date(b.changedAt)));
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [quoteId, t.error]);

  useEffect(() => {
    if (!dialogOpen) {
      return;
    }

    void loadHistory();
  }, [dialogOpen, loadHistory]);

  function handleOpenChange(next: boolean) {
    if (open === undefined) {
      setInternalOpen(next);
    }

    onOpenChange?.(next);

    if (!next) {
      setHistory(null);
      setError(null);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button" size="sm" variant="outline">
              <HistoryIcon className="size-3.5" />
              {label}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="size-4" />
            {t.title} — {quoteNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="pt-2">
          {loading ? (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
              {t.loading}
            </div>
          ) : error ? (
            <p className="py-4 text-center text-sm text-destructive">{error}</p>
          ) : history ? (
            <QuoteHistoryBar history={history} currentStatus={currentStatus} locale={locale} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
