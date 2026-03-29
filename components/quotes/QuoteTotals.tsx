'use client';

import { useMemo } from 'react';

import { computeQuoteTotals } from '@/lib/quote-calculations';
import { useLocale } from '@/components/providers/locale-provider';
import { PriceDisplay } from '@/components/ui/PriceDisplay';

interface QuoteTotalsProps {
  lineItems: Array<{
    baseUnitPriceExcludingTax: number;
    discountPercentage: number;
    unitPriceExcludingTax: number;
    quantity: number;
    vatRate: number;
  }>;
}

function TotalRow({
  label,
  cents,
  bold = false,
  negative = false,
}: {
  label: string;
  cents: number;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between border-b border-border/60 py-2 ${bold ? 'font-semibold' : ''}`}>
      <span className={bold ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
      <span className={negative ? 'text-destructive' : ''}>
        {negative ? '- ' : ''}
        <PriceDisplay cents={cents} className={bold ? 'font-semibold' : ''} />
      </span>
    </div>
  );
}

export default function QuoteTotals({ lineItems }: QuoteTotalsProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      summary: 'Summary',
      totalExclTax: 'Total HT',
      discount: 'Discount',
      totalExclTaxNet: 'Total HT (net)',
      vat: 'VAT',
      totalInclTax: 'TOTAL TTC',
      beforeDiscount: 'Before discount',
    },
    fr: {
      summary: 'Resume',
      totalExclTax: 'Total HT',
      discount: 'Remise',
      totalExclTaxNet: 'Total HT (net)',
      vat: 'TVA',
      totalInclTax: 'TOTAL TTC',
      beforeDiscount: 'Avant remise',
    },
  }[locale];

  const totals = useMemo(() => computeQuoteTotals(lineItems), [lineItems]);
  const uniqueVatRates = useMemo(() => {
    return Array.from(new Set(lineItems.map((item) => Number(item.vatRate).toFixed(2))));
  }, [lineItems]);

  const totalIncludingTaxBeforeDiscount = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const quantity = Math.max(1, Math.round(Number(item.quantity) || 1));
      const baseUnit = Number.isFinite(item.baseUnitPriceExcludingTax) && item.baseUnitPriceExcludingTax > 0
        ? Math.round(item.baseUnitPriceExcludingTax)
        : Math.max(0, Math.round(Number(item.unitPriceExcludingTax) || 0));
      const vatRate = Math.max(0, Math.min(100, Number(item.vatRate) || 0));
      const grossHt = baseUnit * quantity;
      const grossVat = Math.round(grossHt * (vatRate / 100));
      return sum + grossHt + grossVat;
    }, 0);
  }, [lineItems]);

  const vatLabel = uniqueVatRates.length === 1 ? `${t.vat} (${Number(uniqueVatRates[0])}%)` : t.vat;

  return (
    <div className="rounded-xl border border-border/70 bg-linear-to-b from-background to-secondary/25 p-4 shadow-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t.summary}</p>
      <TotalRow label={t.totalExclTax} cents={totals.totalExcludingTaxBeforeDiscount} />
      <TotalRow label={t.discount} cents={totals.totalDiscountExcludingTax} negative={totals.totalDiscountExcludingTax > 0} />
      <TotalRow label={t.totalExclTaxNet} cents={totals.totalExcludingTax} />
      <TotalRow label={vatLabel} cents={totals.totalVat} />
      <div className="mt-3 rounded-lg border border-(--color-text-info)/25 bg-(--color-background-info) px-3 py-3">
        <div className="flex items-center justify-between text-base font-semibold sm:text-lg">
          <span>{t.totalInclTax}</span>
          <PriceDisplay cents={totals.totalIncludingTax} className="font-semibold text-(--color-text-info)" />
        </div>
        {totals.totalDiscountExcludingTax > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {t.beforeDiscount}: <PriceDisplay cents={totalIncludingTaxBeforeDiscount} className="text-xs" />
          </p>
        ) : null}
      </div>
    </div>
  );
}
