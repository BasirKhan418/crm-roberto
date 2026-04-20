import dayjs from 'dayjs';

import type { ReminderVariables } from '@/lib/reminders/substitute-variables';

export type ReminderLevel = 1 | 2 | 3 | 4;
export type ReminderLevelKey = 'soft' | 'medium' | 'firm' | 'formalNotice';

type ReminderOffsets = {
  soft: number;
  medium: number;
  firm: number;
  formalNotice: number;
};

type LateFeeConfig = {
  enabled?: boolean | null;
  type?: 'fixed' | 'percentage' | null;
  value?: number | null;
  applyFrom?: 'medium' | 'firm' | 'formalNotice' | null;
};

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
  if (!lateFee?.enabled) {
    return false;
  }

  const threshold = APPLY_FROM_LEVEL[lateFee.applyFrom ?? 'formalNotice'];
  return level >= threshold;
}

export function computeLateFeeAmountCents(
  remainingAmountCents: number,
  level: ReminderLevel,
  lateFee?: LateFeeConfig | null
): number {
  if (!shouldApplyLateFee(level, lateFee)) {
    return 0;
  }

  const value = Math.max(0, Number(lateFee?.value ?? 0));

  if ((lateFee?.type ?? 'percentage') === 'fixed') {
    return Math.max(0, Math.round(value * 100));
  }

  return Math.max(0, Math.round((remainingAmountCents * value) / 100));
}

export function formatLateFeeText(amountCents: number, locale: 'en' | 'fr'): string {
  if (amountCents <= 0) {
    return '';
  }

  return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountCents / 100);
}

export function buildFallbackReminderSubject(level: ReminderLevel, invoiceNumber: string): string {
  const label = level === 1 ? 'Soft' : level === 2 ? 'Medium' : level === 3 ? 'Firm' : 'Formal notice';
  return `${label} reminder - invoice ${invoiceNumber}`;
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
  return {
    ...vars,
    lateFees: formatLateFeeText(lateFeeAmountCents, locale),
  };
}
