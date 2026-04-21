'use client';

import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { cn } from '@/lib/utils';

export type KpiCardVariant = 'default' | 'red' | 'green' | 'orange' | 'blue' | 'slate';

export interface KpiCard {
  key: string;
  label: string;
  count?: number;
  amount?: number; 
  variant: KpiCardVariant;
  active?: boolean;
  onClick?: () => void;
}

export interface KpiCardGroupProps {
  cards: KpiCard[];
  locale: 'en' | 'fr';
  loading?: boolean;
}

const variantStyles: Record<
  KpiCardVariant,
  {
    card: string;
    label: string;
    value: string;
    ring: string;
  }
> = {
  default: {
    card: 'bg-card border-border/70 hover:bg-muted/30',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    ring: 'ring-slate-400/30',
  },
  slate: {
    card: 'bg-card border-border/70 hover:bg-muted/30',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    ring: 'ring-slate-400/30',
  },
  red: {
    card: 'bg-red-50 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900/40 dark:hover:bg-red-950/50',
    label: 'text-red-700/80 dark:text-red-400/80',
    value: 'text-red-800 dark:text-red-200',
    ring: 'ring-red-400/40',
  },
  green: {
    card: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:hover:bg-emerald-950/50',
    label: 'text-emerald-700/80 dark:text-emerald-400/80',
    value: 'text-emerald-800 dark:text-emerald-200',
    ring: 'ring-emerald-400/40',
  },
  orange: {
    card: 'bg-amber-50 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-900/40 dark:hover:bg-amber-950/50',
    label: 'text-amber-700/80 dark:text-amber-400/80',
    value: 'text-amber-800 dark:text-amber-200',
    ring: 'ring-amber-400/40',
  },
  blue: {
    card: 'bg-sky-50 border-sky-200 hover:bg-sky-100 dark:bg-sky-950/30 dark:border-sky-900/40 dark:hover:bg-sky-950/50',
    label: 'text-sky-700/80 dark:text-sky-400/80',
    value: 'text-sky-800 dark:text-sky-200',
    ring: 'ring-sky-400/40',
  },
};

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="h-3 w-24 rounded bg-muted/50" />
      <div className="h-7 w-16 rounded bg-muted/40" />
      <div className="h-4 w-28 rounded bg-muted/30" />
    </div>
  );
}

export default function KpiCards({ cards, locale, loading = false }: KpiCardGroupProps) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => {
        const s = variantStyles[card.variant];
        const isClickable = Boolean(card.onClick);

        return (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            disabled={!isClickable}
            aria-pressed={isClickable ? card.active : undefined}
            className={cn(
              'flex flex-col gap-1.5 rounded-xl border p-4 text-left shadow-sm transition-all duration-150',
              s.card,
              isClickable && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
              !isClickable && 'cursor-default',
              card.active && `ring-2 ${s.ring}`,
            )}
          >
            <p className={cn('text-[11px] font-semibold uppercase tracking-wide', s.label)}>
              {card.label}
            </p>

            {card.count !== undefined && (
              <p className={cn('text-3xl font-bold tabular-nums leading-none', s.value)}>
                {new Intl.NumberFormat(priceLocale).format(card.count)}
              </p>
            )}

            {card.amount !== undefined && (
              <PriceDisplay
                cents={card.amount}
                locale={priceLocale}
                className={cn(
                  card.count !== undefined
                    ? 'text-sm font-medium tabular-nums opacity-90'
                    : 'text-2xl font-bold tabular-nums leading-none',
                  s.value,
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
