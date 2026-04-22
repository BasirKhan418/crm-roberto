import dayjs from 'dayjs';

import { formatInvoiceDisplayNumber } from '@/lib/i18n/messages';
import type { ReminderVariables } from '@/lib/reminders/substitute-variables';

export type ReminderLevel = 1 | 2 | 3 | 4;
export type ReminderLevelKey = 'soft' | 'medium' | 'firm' | 'formalNotice';

type ReminderOffsets = {
  soft: number;
  medium: number;
  firm: number;
  formalNotice: number;
};

export type ReminderLateFeeType = 'fixed' | 'percentage';

export type ReminderLateFeeStageConfig = {
  enabled?: boolean | null;
  type?: ReminderLateFeeType | null;
  value?: number | null;
};

type NormalizedLateFeeStageConfig = {
  enabled: boolean;
  type: ReminderLateFeeType;
  value: number;
};

type LegacyLateFeeConfig = ReminderLateFeeStageConfig & {
  applyFrom?: 'medium' | 'firm' | 'formalNotice' | null;
};

export type LateFeeConfig =
  | (LegacyLateFeeConfig & {
      stages?: Partial<Record<ReminderLevelKey, ReminderLateFeeStageConfig>> | null;
    })
  | null
  | undefined;

const LEVEL_TO_OFFSET_KEY: Record<number, keyof ReminderOffsets> = {
  1: 'soft',
  2: 'medium',
  3: 'firm',
  4: 'formalNotice',
};

const LEVEL_TO_KEY: Record<ReminderLevel, ReminderLevelKey> = {
  1: 'soft',
  2: 'medium',
  3: 'firm',
  4: 'formalNotice',
};

const APPLY_FROM_LEVEL: Record<'medium' | 'firm' | 'formalNotice', ReminderLevel> = {
  medium: 2,
  firm: 3,
  formalNotice: 4,
};

const DEFAULT_LATE_FEE_STAGE: NormalizedLateFeeStageConfig = {
  enabled: false,
  type: 'percentage',
  value: 0,
};

const REMINDER_LEVEL_KEYS: ReminderLevelKey[] = ['soft', 'medium', 'firm', 'formalNotice'];

function normalizeLateFeeStageConfig(stage?: ReminderLateFeeStageConfig | null): NormalizedLateFeeStageConfig {
  return {
    enabled: stage?.enabled === true,
    type: stage?.type === 'fixed' ? 'fixed' : 'percentage',
    value: Math.max(0, Number(stage?.value ?? 0)),
  };
}

function hasConfiguredLateFeeStages(stages?: Partial<Record<ReminderLevelKey, ReminderLateFeeStageConfig>> | null): boolean {
  if (!stages) {
    return false;
  }

  return REMINDER_LEVEL_KEYS.some((key) => {
    const stage = stages[key];
    if (!stage) {
      return false;
    }

    return stage.enabled === true || Math.max(0, Number(stage.value ?? 0)) > 0;
  });
}

export function normalizeLateFeeStages(
  lateFee?: LateFeeConfig
): Record<ReminderLevelKey, NormalizedLateFeeStageConfig> {
  const stages = lateFee?.stages;
  if (stages && hasConfiguredLateFeeStages(stages)) {
    return {
      soft: normalizeLateFeeStageConfig(stages.soft),
      medium: normalizeLateFeeStageConfig(stages.medium),
      firm: normalizeLateFeeStageConfig(stages.firm),
      formalNotice: normalizeLateFeeStageConfig(stages.formalNotice),
    };
  }

  const legacyEnabled = lateFee?.enabled === true;
  const threshold = APPLY_FROM_LEVEL[lateFee?.applyFrom ?? 'formalNotice'];
  const legacyType = lateFee?.type === 'fixed' ? 'fixed' : 'percentage';
  const legacyValue = Math.max(0, Number(lateFee?.value ?? 0));

  return {
    soft: DEFAULT_LATE_FEE_STAGE,
    medium: {
      enabled: legacyEnabled && 2 >= threshold,
      type: legacyType,
      value: legacyValue,
    },
    firm: {
      enabled: legacyEnabled && 3 >= threshold,
      type: legacyType,
      value: legacyValue,
    },
    formalNotice: {
      enabled: legacyEnabled && 4 >= threshold,
      type: legacyType,
      value: legacyValue,
    },
  };
}

export function normalizeOffsets(offsets?: Partial<ReminderOffsets> | null): ReminderOffsets {
  return {
    soft: Math.max(1, Math.round(offsets?.soft ?? 7)),
    medium: Math.max(1, Math.round(offsets?.medium ?? 15)),
    firm: Math.max(1, Math.round(offsets?.firm ?? 30)),
    formalNotice: Math.max(1, Math.round(offsets?.formalNotice ?? 35)),
  };
}

export function getTargetReminderLevel(daysOverdue: number, offsets: ReminderOffsets): ReminderLevel | null {
  if (daysOverdue >= offsets.formalNotice) {
    return 4;
  }
  if (daysOverdue >= offsets.firm) {
    return 3;
  }
  if (daysOverdue >= offsets.medium) {
    return 2;
  }
  if (daysOverdue >= offsets.soft) {
    return 1;
  }
  return null;
}

export function getReminderLevelKey(level: ReminderLevel): ReminderLevelKey {
  return LEVEL_TO_KEY[level];
}

export function computeDaysOverdue(dueDate: Date | string | null | undefined): number {
  if (!dueDate) {
    return 0;
  }

  return Math.max(0, dayjs().diff(dayjs(dueDate), 'day'));
}

export function computeNextScheduledAt(
  dueDate: Date | string | null | undefined,
  sentLevel: ReminderLevel,
  offsets: ReminderOffsets
): Date | null {
  if (!dueDate || sentLevel >= 3) {
    return null;
  }

  const nextLevel = (sentLevel + 1) as ReminderLevel;
  const nextOffset = offsets[LEVEL_TO_OFFSET_KEY[nextLevel]];

  return dayjs(dueDate).add(nextOffset, 'day').toDate();
}

export function shouldApplyLateFee(level: ReminderLevel, lateFee?: LateFeeConfig | null): boolean {
  return normalizeLateFeeStages(lateFee)[getReminderLevelKey(level)].enabled;
}

export function computeLateFeeAmountCents(
  remainingAmountCents: number,
  level: ReminderLevel,
  lateFee?: LateFeeConfig | null
): number {
  const stageConfig = normalizeLateFeeStages(lateFee)[getReminderLevelKey(level)];
  if (!stageConfig.enabled) {
    return 0;
  }

  const value = stageConfig.value;

  if (stageConfig.type === 'fixed') {
    return Math.max(0, Math.round(value * 100));
  }

  return Math.max(0, Math.round((remainingAmountCents * value) / 100));
}

export function formatLateFeeText(amountCents: number, locale: 'en' | 'fr'): string {
  if (amountCents <= 0) {
    return '';
  }

  return formatCurrencyText(amountCents, locale);
}

function formatCurrencyText(amountCents: number, locale: 'en' | 'fr'): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountCents / 100);
}

export function buildFallbackReminderSubject(level: ReminderLevel, invoiceNumber: string, locale: 'en' | 'fr'): string {
  const label = level === 1 ? 'Soft' : level === 2 ? 'Medium' : level === 3 ? 'Firm' : 'Formal notice';
  return `${label} reminder - invoice ${formatInvoiceDisplayNumber(locale, invoiceNumber)}`;
}

export function getTemplateForLevel(
  templates: {
    en?: Record<ReminderLevelKey, { subject: string; body: string }>;
    fr?: Record<ReminderLevelKey, { subject: string; body: string }>;
  } | null | undefined,
  locale: 'en' | 'fr',
  levelKey: ReminderLevelKey
): { subject: string; body: string } {
  const localized = templates?.[locale]?.[levelKey];

  if (localized?.subject && localized?.body) {
    return localized;
  }

  const fallback = templates?.fr?.[levelKey] ?? templates?.en?.[levelKey];

  return {
    subject: fallback?.subject || '',
    body: fallback?.body || '',
  };
}

export function buildBodyPreview(text: string): string {
  return text.slice(0, 280);
}

export function mergeLateFeeIntoVariables(vars: ReminderVariables, lateFeeAmountCents: number, locale: 'en' | 'fr'): ReminderVariables {
  const baseAmountDueCents =
    typeof vars.__amountDueCents === 'number' ? Math.max(0, Math.round(vars.__amountDueCents)) : null;

  return {
    ...vars,
    amountDue:
      baseAmountDueCents === null
        ? vars.amountDue
        : formatCurrencyText(baseAmountDueCents + Math.max(0, lateFeeAmountCents), locale),
    lateFees: formatLateFeeText(lateFeeAmountCents, locale),
  };
}
