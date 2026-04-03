'use client';

import { CheckIcon, XIcon } from 'lucide-react';

import type { QuoteStatus } from '@/components/ui/StatusBadge';
import { getQuoteStatusLabel } from '@/lib/i18n/messages';

interface HistoryEntry {
  from?: QuoteStatus;
  to: QuoteStatus;
  changedAt: string;
}

interface QuoteHistoryBarProps {
  history: HistoryEntry[];
  currentStatus: QuoteStatus;
  locale: 'en' | 'fr';
}

const HISTORY_LABELS = {
  en: 'Quote history',
  fr: 'Historique du devis',
} as const;

const STEPS: QuoteStatus[] = ['draft', 'sent', 'accepted'];

type StepState = 'completed' | 'active' | 'pending';

function getStepDate(history: HistoryEntry[], status: QuoteStatus): string | null {
  const entries = history.filter((h) => h.to === status);
  if (entries.length === 0) return null;
  return entries[entries.length - 1].changedAt;
}

function formatDate(value: string, locale: 'en' | 'fr'): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function QuoteHistoryBar({ history, currentStatus, locale }: QuoteHistoryBarProps) {
  const isRefused = currentStatus === 'refused';
  const isRejected = currentStatus === 'rejected';

  const steps: QuoteStatus[] = isRefused
    ? ['draft', 'sent', 'refused']
    : isRejected
      ? ['draft', 'sent', 'rejected']
      : STEPS;

  function getState(stepStatus: QuoteStatus): StepState {
    if (stepStatus === currentStatus) return 'active';
    const reached = history.some((h) => h.to === stepStatus);
    if (reached && stepStatus !== currentStatus) return 'completed';
    return 'pending';
  }

  const stepColors: Record<StepState, { circle: string; label: string; line: string }> = {
    completed: {
      circle: 'bg-(--color-background-info) text-(--color-text-info) border-2 border-(--color-text-info)/30',
      label: 'text-(--color-text-info) font-semibold',
      line: 'bg-(--color-text-info)/40',
    },
    active: {
      circle: (isRefused && currentStatus === 'refused') || isRejected
        ? 'bg-(--color-background-danger) text-(--color-text-danger) border-2 border-(--color-text-danger)/40'
        : 'bg-(--color-background-success) text-(--color-text-success) border-2 border-(--color-text-success)/40',
      label: (isRefused && currentStatus === 'refused') || isRejected
        ? 'text-(--color-text-danger) font-bold'
        : 'text-(--color-text-success) font-bold',
      line: (isRefused || isRejected) ? 'bg-(--color-text-danger)/30' : 'bg-(--color-text-success)/30',
    },
    pending: {
      circle: 'bg-muted border-2 border-border text-muted-foreground',
      label: 'text-muted-foreground',
      line: 'bg-border/60',
    },
  };

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4">
      <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {HISTORY_LABELS[locale]}
      </h2>

      <div className="relative flex items-start justify-between gap-0">
        {steps.map((stepStatus, index) => {
          const state = getState(stepStatus);
          const colors = stepColors[state];
          const date = getStepDate(history, stepStatus);
          const isLast = index === steps.length - 1;

          return (
            <div key={stepStatus} className="relative flex flex-1 flex-col items-center">
              {!isLast ? (
                <div className="absolute top-4.5 left-1/2 h-0.5 w-full z-0" style={{ left: '50%' }}>
                  <div className={`h-full w-full ${stepColors[getState(steps[index + 1])].line}`} />
                </div>
              ) : null}

              <div
                className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all ${colors.circle}`}
              >
                {state === 'completed' ? (
                  <CheckIcon className="size-4" />
                ) : state === 'active' && (stepStatus === 'refused' || stepStatus === 'rejected') ? (
                  <XIcon className="size-4" />
                ) : state === 'active' && stepStatus === 'accepted' ? (
                  <CheckIcon className="size-4" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>

              {/* Label + date */}
              <div className="mt-2 flex flex-col items-center gap-0.5 text-center">
                <span className={`text-xs ${colors.label}`}>{getQuoteStatusLabel(locale, stepStatus)}</span>
                {date ? (
                  <span className="text-[10px] text-muted-foreground">{formatDate(date, locale)}</span>
                ) : (
                  <span className="text-[10px] text-transparent select-none">–</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
