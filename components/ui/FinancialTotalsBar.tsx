'use client';

import { PriceDisplay } from '@/components/ui/PriceDisplay';

type FinancialMetricTone = 'neutral' | 'success' | 'danger';

export interface FinancialTotalsMetric {
  key: string;
  label: string;
  value: number;
  kind: 'count' | 'currency';
  tone?: FinancialMetricTone;
}

interface FinancialTotalsBarProps {
  metrics: FinancialTotalsMetric[];
  locale: 'en' | 'fr';
}

const toneClassName: Record<FinancialMetricTone, string> = {
  neutral: 'text-foreground',
  success: 'text-emerald-600 dark:text-emerald-400',
  danger: 'text-red-600 dark:text-red-400',
};

export default function FinancialTotalsBar({ metrics, locale }: FinancialTotalsBarProps) {
  const priceLocale = locale === 'fr' ? 'fr-FR' : 'en-GB';

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70 bg-card/70">
      <div className="flex min-w-max items-stretch">
        {metrics.map((metric, index) => {
          const tone = metric.tone ?? 'neutral';
          return (
            <div
              key={metric.key}
              className={`min-w-42 px-3 py-2.5 text-right ${index > 0 ? 'border-l border-border/60' : ''}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{metric.label}</p>
              {metric.kind === 'currency' ? (
                <PriceDisplay
                  cents={metric.value}
                  locale={priceLocale}
                  className={`mt-1 block text-sm font-semibold tabular-nums ${toneClassName[tone]}`}
                />
              ) : (
                <p className={`mt-1 text-sm font-semibold tabular-nums ${toneClassName[tone]}`}>
                  {new Intl.NumberFormat(priceLocale).format(metric.value)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}