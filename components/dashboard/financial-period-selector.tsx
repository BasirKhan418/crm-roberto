'use client';

import { useMemo } from 'react';

import { useLocale } from '@/components/providers/locale-provider';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getDefaultFinancialPeriodSelection, type FinancialPeriodKind, type FinancialPeriodSelection } from '@/lib/financial-periods';

type FinancialPeriodSelectorProps = {
  value: FinancialPeriodSelection;
  onChange: (nextValue: FinancialPeriodSelection) => void;
};

function buildPeriodDefaults(kind: FinancialPeriodKind): FinancialPeriodSelection {
  const now = new Date();
  const defaults = getDefaultFinancialPeriodSelection(now);

  if (kind === 'quarter') {
    return {
      kind,
      year: now.getUTCFullYear(),
      quarter: Math.floor(now.getUTCMonth() / 3) + 1,
    };
  }

  if (kind === 'year') {
    return {
      kind,
      year: now.getUTCFullYear(),
    };
  }

  if (kind === 'custom') {
    const isoDate = now.toISOString().slice(0, 10);
    return {
      kind,
      startDate: isoDate,
      endDate: isoDate,
    };
  }

  return {
    kind,
    year: defaults.year,
    month: defaults.month,
  };
}

export function FinancialPeriodSelector({ value, onChange }: FinancialPeriodSelectorProps) {
  const { locale } = useLocale();
  const t = {
    en: {
      period: 'Period',
      month: 'Month',
      quarter: 'Quarter',
      year: 'Year',
      custom: 'Custom',
      yearLabel: 'Year',
      quarterLabel: 'Quarter',
      startDate: 'Start date',
      endDate: 'End date',
    },
    fr: {
      period: 'Periode',
      month: 'Mois',
      quarter: 'Trimestre',
      year: 'Annee',
      custom: 'Personnalisee',
      yearLabel: 'Annee',
      quarterLabel: 'Trimestre',
      startDate: 'Date debut',
      endDate: 'Date fin',
    },
  }[locale];

  const monthLabels = useMemo(
    () =>
      Array.from({ length: 12 }, (_, monthIndex) => ({
        value: monthIndex + 1,
        label: new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
          month: 'long',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(2026, monthIndex, 1))),
      })),
    [locale]
  );

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.period}</p>
        <Select
          value={value.kind}
          onValueChange={(nextValue) => onChange(buildPeriodDefaults(nextValue as FinancialPeriodKind))}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="month">{t.month}</SelectItem>
            <SelectItem value="quarter">{t.quarter}</SelectItem>
            <SelectItem value="year">{t.year}</SelectItem>
            <SelectItem value="custom">{t.custom}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.kind === 'month' ? (
        <>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.month}</p>
            <Select
              value={String(value.month ?? getDefaultFinancialPeriodSelection().month ?? 1)}
              onValueChange={(nextValue) => onChange({ ...value, month: Number(nextValue) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthLabels.map((month) => (
                  <SelectItem key={month.value} value={String(month.value)}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.yearLabel}</p>
            <Input
              type="number"
              inputMode="numeric"
              min={2000}
              max={9999}
              value={String(value.year ?? new Date().getUTCFullYear())}
              onChange={(event) => onChange({ ...value, year: Number(event.target.value || new Date().getUTCFullYear()) })}
            />
          </div>
        </>
      ) : null}

      {value.kind === 'quarter' ? (
        <>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.quarterLabel}</p>
            <Select
              value={String(value.quarter ?? 1)}
              onValueChange={(nextValue) => onChange({ ...value, quarter: Number(nextValue) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Q1</SelectItem>
                <SelectItem value="2">Q2</SelectItem>
                <SelectItem value="3">Q3</SelectItem>
                <SelectItem value="4">Q4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.yearLabel}</p>
            <Input
              type="number"
              inputMode="numeric"
              min={2000}
              max={9999}
              value={String(value.year ?? new Date().getUTCFullYear())}
              onChange={(event) => onChange({ ...value, year: Number(event.target.value || new Date().getUTCFullYear()) })}
            />
          </div>
        </>
      ) : null}

      {value.kind === 'year' ? (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.yearLabel}</p>
          <Input
            type="number"
            inputMode="numeric"
            min={2000}
            max={9999}
            value={String(value.year ?? new Date().getUTCFullYear())}
            onChange={(event) => onChange({ ...value, year: Number(event.target.value || new Date().getUTCFullYear()) })}
          />
        </div>
      ) : null}

      {value.kind === 'custom' ? (
        <>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.startDate}</p>
            <Input
              type="date"
              value={value.startDate ?? ''}
              onChange={(event) => onChange({ ...value, startDate: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t.endDate}</p>
            <Input
              type="date"
              value={value.endDate ?? ''}
              onChange={(event) => onChange({ ...value, endDate: event.target.value })}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}