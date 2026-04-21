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
    card: string;
    label: string;
    value: string;
    ring: string;
    icon: string;
  }
> = {
  default: {
    card: 'bg-card border-border/70 hover:bg-muted/30',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    ring: 'ring-slate-400/30',
    icon: 'text-muted-foreground/60',
  },
  slate: {
    card: 'bg-card border-border/70 hover:bg-muted/30',
    label: 'text-muted-foreground',
    value: 'text-foreground',
    ring: 'ring-slate-400/30',
    icon: 'text-muted-foreground/60',
  },
  red: {
    card: 'bg-red-50/60 border-red-200/70 hover:bg-red-50 dark:bg-red-950/25 dark:border-red-900/35 dark:hover:bg-red-950/40',
    label: 'text-red-600/80 dark:text-red-400/80',
    value: 'text-red-700 dark:text-red-200',
    ring: 'ring-red-400/40',
    icon: 'text-red-400/70 dark:text-red-500/60',
  },
  'red-bold': {
    card: 'bg-red-50 border-red-300 hover:bg-red-100 dark:bg-red-950/45 dark:border-red-700/60 dark:hover:bg-red-950/60 border-l-[3px] border-l-red-500 dark:border-l-red-500',
    label: 'text-red-600 dark:text-red-400',
    value: 'text-red-800 dark:text-red-100',
    ring: 'ring-red-500/50',
    icon: 'text-red-500 dark:text-red-400',
  },
  green: {
    card: 'bg-emerald-50/60 border-emerald-200/70 hover:bg-emerald-50 dark:bg-emerald-950/25 dark:border-emerald-900/35 dark:hover:bg-emerald-950/40',
    label: 'text-emerald-600/80 dark:text-emerald-400/80',
    value: 'text-emerald-700 dark:text-emerald-200',
    ring: 'ring-emerald-400/40',
    icon: 'text-emerald-400/70 dark:text-emerald-500/60',
  },
  'green-bold': {
    card: 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/45 dark:border-emerald-700/60 dark:hover:bg-emerald-950/60 border-l-[3px] border-l-emerald-500 dark:border-l-emerald-500',
    label: 'text-emerald-600 dark:text-emerald-400',
    value: 'text-emerald-800 dark:text-emerald-100',
    ring: 'ring-emerald-500/50',
    icon: 'text-emerald-500 dark:text-emerald-400',
  },
  orange: {
    card: 'bg-amber-50/60 border-amber-200/70 hover:bg-amber-50 dark:bg-amber-950/25 dark:border-amber-900/35 dark:hover:bg-amber-950/40',
    label: 'text-amber-600/80 dark:text-amber-400/80',
    value: 'text-amber-700 dark:text-amber-200',
    ring: 'ring-amber-400/40',
    icon: 'text-amber-400/70 dark:text-amber-500/60',
  },
  'orange-bold': {
    card: 'bg-amber-50 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/45 dark:border-amber-700/60 dark:hover:bg-amber-950/60 border-l-[3px] border-l-amber-500 dark:border-l-amber-500',
    label: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-800 dark:text-amber-100',
    ring: 'ring-amber-500/50',
    icon: 'text-amber-500 dark:text-amber-400',
  },
  blue: {
    card: 'bg-sky-50/60 border-sky-200/70 hover:bg-sky-50 dark:bg-sky-950/25 dark:border-sky-900/35 dark:hover:bg-sky-950/40',
    label: 'text-sky-600/80 dark:text-sky-400/80',
    value: 'text-sky-700 dark:text-sky-200',
    ring: 'ring-sky-400/40',
    icon: 'text-sky-400/70 dark:text-sky-500/60',
  },
};

function SkeletonCard() {
  return (
    <div className="flex animate-pulse flex-col gap-2 rounded-xl border border-border/50 bg-muted/20 p-4">
      <div className="h-3 w-24 rounded bg-muted/50" />
      <div className="h-8 w-16 rounded bg-muted/40" />
      <div className="h-4 w-28 rounded bg-muted/30" />
    </div>
  );
}

export default function KpiCards({ cards, locale, loading = false }: KpiCardGroupProps) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => {
        const s = variantStyles[card.variant];
        const isClickable = Boolean(card.onClick);
        const IconComponent = card.icon ? ICONS[card.icon] : undefined;

        return (
          <button
            key={card.key}
            type="button"
            onClick={card.onClick}
            disabled={!isClickable}
            aria-pressed={isClickable ? card.active : undefined}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-4 text-left shadow-sm transition-all duration-150',
              s.card,
              isClickable && 'cursor-pointer hover:-translate-y-1 hover:shadow-lg',
              !isClickable && 'cursor-default',
              card.active && `ring-2 ${s.ring}`,
            )}
          >
            <div className="flex items-center justify-between">
              <p className={cn('text-[11px] font-semibold uppercase tracking-wide', s.label)}>
                {card.label}
              </p>
              {IconComponent && (
                <IconComponent className={cn('size-4 shrink-0', s.icon)} aria-hidden="true" />
              )}
            </div>

            {card.count !== undefined && (
              <p className={cn('text-4xl font-bold tabular-nums leading-none', s.value)}>
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
