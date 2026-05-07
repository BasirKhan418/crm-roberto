export type RecurrenceScheduleValidationKey =
  | 'validation.recurrenceNextOccurrenceRequired'
  | 'validation.recurrenceNextOccurrenceInvalid'
  | 'validation.recurrenceEndDateInvalid'
  | 'validation.recurrenceEndDateBeforeNextOccurrence';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseRecurrenceDateInput(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = DATE_ONLY_PATTERN.test(trimmed)
    ? new Date(`${trimmed}T12:00:00Z`)
    : new Date(trimmed);

  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function getRecurrenceScheduleValidationKey(input: {
  nextOccurrenceAt?: string | Date | null;
  endDate?: string | Date | null;
}): RecurrenceScheduleValidationKey | null {
  if (
    input.nextOccurrenceAt === undefined
    || input.nextOccurrenceAt === null
    || (typeof input.nextOccurrenceAt === 'string' && input.nextOccurrenceAt.trim() === '')
  ) {
    return 'validation.recurrenceNextOccurrenceRequired';
  }

  const nextOccurrenceAt = parseRecurrenceDateInput(input.nextOccurrenceAt);
  if (!nextOccurrenceAt) {
    return 'validation.recurrenceNextOccurrenceInvalid';
  }

  if (
    input.endDate === undefined
    || input.endDate === null
    || (typeof input.endDate === 'string' && input.endDate.trim() === '')
  ) {
    return null;
  }

  const endDate = parseRecurrenceDateInput(input.endDate);
  if (!endDate) {
    return 'validation.recurrenceEndDateInvalid';
  }

  if (endDate.getTime() < nextOccurrenceAt.getTime()) {
    return 'validation.recurrenceEndDateBeforeNextOccurrence';
  }

  return null;
}