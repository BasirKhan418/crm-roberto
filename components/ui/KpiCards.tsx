'use client';

import {
  AlertTriangleIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  CircleDollarSignIcon,
  ClockIcon,
  FileTextIcon,
  ReceiptIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  type LucideIcon,
} from 'lucide-react';

import { PriceDisplay } from '@/components/ui/PriceDisplay';
import { cn } from '@/lib/utils';

export type KpiCardVariant =
  | 'default'
  | 'slate'
  | 'red'
  | 'red-bold'
  | 'green'
  | 'green-bold'
  | 'orange'
  | 'orange-bold'
  | 'blue';

export interface KpiCard {
  key: string;
  label: string;
  count?: number;
  amount?: number;
  variant: KpiCardVariant;
  icon?: KpiCardIcon;
  footnote?: string;
  active?: boolean;
  onClick?: () => void;
}

export type KpiCardIcon =
  | 'file-text'
  | 'receipt'
  | 'check-circle'
  | 'alert-triangle'
  | 'clock'
  | 'bar-chart'
  | 'thumbs-up'
  | 'thumbs-down'
  | 'dollar';

export interface KpiCardGroupProps {
  cards: KpiCard[];
  locale: 'en' | 'fr';
  loading?: boolean;
  cols?: 3 | 4;
  skeletonCount?: number;
}

const ICONS: Record<KpiCardIcon, LucideIcon> = {
  'file-text': FileTextIcon,
  'receipt': ReceiptIcon,
  'check-circle': CheckCircle2Icon,
  'alert-triangle': AlertTriangleIcon,
  'clock': ClockIcon,
  'bar-chart': BarChart3Icon,
  'thumbs-up': ThumbsUpIcon,
  'thumbs-down': ThumbsDownIcon,
  'dollar': CircleDollarSignIcon,
};

const variantStyles: Record<
  KpiCardVariant,
  {
    base: string;
    hover: string;
    label: string;
    value: string;
    ring: string;
    icon: string;
  }
> = {
  default: {
    base: 'bg-card border-border/70',
    hover: 'hover:bg-muted/30',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    ring: 'ring-slate-400/30',
    icon: 'text-muted-foreground/60',
  },
  slate: {
    base: 'bg-slate-50/80 border-slate-200 dark:bg-slate-800/20 dark:border-slate-700/40',
    hover: 'hover:bg-slate-100/60 dark:hover:bg-slate-800/35',
    label: 'text-slate-500 dark:text-slate-400',
    value: 'text-slate-700 dark:text-slate-100',
    ring: 'ring-slate-400/40',
    icon: 'text-slate-400/80 dark:text-slate-500/70',
  },
  red: {
    base: 'bg-red-50/60 border-red-200/70 dark:bg-red-950/25 dark:border-red-900/35',
    hover: 'hover:bg-red-50 dark:hover:bg-red-950/40',
    label: 'text-red-600/80 dark:text-red-400/80',
    value: 'text-red-700 dark:text-red-200',
    ring: 'ring-red-400/40',
    icon: 'text-red-400/70 dark:text-red-500/60',
  },
  'red-bold': {
    base: 'bg-red-50 border-red-300 border-l-[3px] border-l-red-500 shadow-md shadow-red-200/60 dark:bg-red-950/45 dark:border-red-700/60 dark:border-l-red-500 dark:shadow-red-950/50',
    hover: 'hover:bg-red-100 hover:shadow-red-300/70 dark:hover:bg-red-950/60',
    label: 'text-red-600 dark:text-red-400',
    value: 'text-red-800 dark:text-red-100',
    ring: 'ring-red-500/50',
    icon: 'text-red-500 dark:text-red-400',
  },
  green: {
    base: 'bg-emerald-50/60 border-emerald-200/70 dark:bg-emerald-950/25 dark:border-emerald-900/35',
    hover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950/40',
    label: 'text-emerald-600/80 dark:text-emerald-400/80',
    value: 'text-emerald-700 dark:text-emerald-200',
    ring: 'ring-emerald-400/40',
    icon: 'text-emerald-400/70 dark:text-emerald-500/60',
  },
  'green-bold': {
    base: 'bg-emerald-50 border-emerald-300 border-l-[3px] border-l-emerald-500 shadow-md shadow-emerald-200/60 dark:bg-emerald-950/45 dark:border-emerald-700/60 dark:border-l-emerald-500 dark:shadow-emerald-950/50',
    hover: 'hover:bg-emerald-100 hover:shadow-emerald-300/70 dark:hover:bg-emerald-950/60',
    label: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-800 dark:text-emerald-100',
    ring: 'ring-emerald-500/50',
    icon: 'text-emerald-500 dark:text-emerald-400',
  },
  orange: {
    base: 'bg-amber-50/60 border-amber-200/70 dark:bg-amber-950/25 dark:border-amber-900/35',
    hover: 'hover:bg-amber-50 dark:hover:bg-amber-950/40',
    label: 'text-amber-600/80 dark:text-amber-400/80',
    value: 'text-amber-700 dark:text-amber-200',
    ring: 'ring-amber-400/40',
    icon: 'text-amber-400/70 dark:text-amber-500/60',
  },
  'orange-bold': {
    base: 'bg-amber-50 border-amber-300 border-l-[3px] border-l-amber-500 shadow-md shadow-amber-200/60 dark:bg-amber-950/45 dark:border-amber-700/60 dark:border-l-amber-500 dark:shadow-amber-950/50',
    hover: 'hover:bg-amber-100 hover:shadow-amber-300/70 dark:hover:bg-amber-950/60',
    label: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-800 dark:text-amber-100',
    ring: 'ring-amber-500/50',
    icon: 'text-amber-500 dark:text-amber-400',
  },
  blue: {
    base: 'bg-sky-50/60 border-sky-200/70 dark:bg-sky-950/25 dark:border-sky-900/35',
    hover: 'hover:bg-sky-50 dark:hover:bg-sky-950/40',
    label: 'text-sky-600/80 dark:text-sky-400/80',
    value: 'text-sky-700 dark:text-sky-200',
    ring: 'ring-sky-400/40',
    icon: 'text-sky-400/70 dark:text-sky-500/60',
  },
};

interface SkeletonCardProps { hasCount?: boolean; }
function SkeletonCard({ hasCount = true }: SkeletonCardProps) {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-4 min-h-27.5">
      <div className="h-3 w-24 rounded bg-muted/50" />
      {hasCount && <div className="h-10 w-16 rounded bg-muted/40 mt-1" />}
      <div className={cn('h-4 w-28 rounded bg-muted/30', hasCount ? '' : 'mt-auto h-8 w-24')} />
    </div>
  );
}

export default function KpiCards({ cards, locale, loading = false, cols = 4, skeletonCount = cols }: KpiCardGroupProps) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';
  const gridClass = cols === 3 ? 'grid grid-cols-2 gap-4 sm:grid-cols-3' : 'grid grid-cols-2 gap-4 sm:grid-cols-4';

  if (loading) {
    return (
      <div className={gridClass}>
        {[...Array(skeletonCount)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {cards.map((card) => {
        const s = variantStyles[card.variant];
        const isClickable = Boolean(card.onClick);
        const IconComponent = card.icon ? ICONS[card.icon] : undefined;
        const count = card.count;
        const hasCount = card.count !== undefined;

        return (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            disabled={!isClickable}
            aria-pressed={isClickable ? card.active : undefined}
            className={cn(
              'flex min-h-27.5 flex-col rounded-xl border p-4 text-left shadow-sm transition-all duration-150',
              s.base,
              isClickable && [s.hover, 'cursor-pointer hover:-translate-y-1 hover:shadow-lg'],
              !isClickable && 'cursor-default',
              card.active && `ring-2 ${s.ring}`,
            )}
          >
            {/* Top row: label + icon */}
            <div className="flex items-center justify-between">
              <p className={cn('text-[11px] font-semibold uppercase tracking-wide', s.label)}>
                {card.label}
              </p>
              {IconComponent && (
                <IconComponent className={cn('size-4 shrink-0', s.icon)} aria-hidden="true" />
              )}
            </div>

            {/* Count cards stay bottom-weighted; amount-only totals are centered. */}
            <div className={cn('mt-2 flex flex-1 flex-col gap-1', hasCount ? 'justify-end' : 'justify-center')}>
              {count !== undefined && (
                <p className={cn('text-4xl font-bold tabular-nums leading-none', s.value)}>
                  {new Intl.NumberFormat(priceLocale).format(count)}
                </p>
              )}

              {card.amount !== undefined && (
                <PriceDisplay
                  cents={card.amount}
                  locale={priceLocale}
                  compactAfterDigits={hasCount ? undefined : 8}
                  className={cn(
                    hasCount
                      ? 'text-sm font-medium tabular-nums opacity-90'
                      : 'mx-auto block w-full text-center text-base font-bold leading-tight tracking-tight whitespace-nowrap tabular-nums sm:text-2xl',
                    s.value,
                  )}
                />
              )}

              {card.footnote && (
                <p className={cn('text-[10px] font-semibold tabular-nums tracking-wide opacity-80', s.label)}>
                  {card.footnote}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
