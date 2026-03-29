'use client';

import { useMemo } from 'react';

import { calcQuoteTotals } from '@/lib/price';
import { useLocale } from '@/components/providers/locale-provider';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

interface QuoteTotalsProps {
  lineItems: Array<{
    unitPriceExcludingTax: number;
    quantity: number;
    vatRate: number;
  }>;
}

function TotalRow({ label, cents, bold = false }: { label: string; cents: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-b border-border/60 py-2 ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      <PriceDisplay cents={cents} className={bold ? 'font-semibold' : ''} />
    </div>
  );
}

export default function QuoteTotals({ lineItems }: QuoteTotalsProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      summary: 'Summary',
      totalExclTax: 'Total excl. tax',
      vat: 'VAT',
      totalInclTax: 'Total incl. tax',
    },
    fr: {
      summary: 'Resume',
      totalExclTax: 'Total HT',
      vat: 'TVA',
      totalInclTax: 'Total TTC',
    },
  }[locale];

  const totals = useMemo(() => calcQuoteTotals(lineItems), [lineItems]);

  return (
    <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-secondary/25 p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.summary}</p>
      <TotalRow label={t.totalExclTax} cents={totals.totalExcludingTax} />
      <TotalRow label={t.vat} cents={totals.totalVat} />
      <div className="mt-3 rounded-lg border border-(--color-text-info)/25 bg-(--color-background-info) px-3 py-3">
        <div className="flex items-center justify-between text-base font-semibold sm:text-lg">
          <span>{t.totalInclTax}</span>
          <PriceDisplay cents={totals.totalIncludingTax} className="font-semibold text-(--color-text-info)" />
        </div>
      </div>
    </div>
  );
}
