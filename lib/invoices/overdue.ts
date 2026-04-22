const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(value: Date): Date {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function parseInvoiceDueDate(value?: string | Date | null): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export function getStartOfTomorrow(now = new Date()): Date {
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

export function getInvoiceDueDayOffset(value?: string | Date | null, now = new Date()): number | null {
  const dueDate = parseInvoiceDueDate(value);
  if (!dueDate) {
    return null;
  }

  return Math.round((startOfDay(now).getTime() - startOfDay(dueDate).getTime()) / MS_PER_DAY);
}

export function getInvoiceDaysOverdue(value?: string | Date | null, now = new Date()): number {
  return Math.max(0, getInvoiceDueDayOffset(value, now) ?? 0);
}

export function isInvoiceDueOnOrBeforeToday(value?: string | Date | null, now = new Date()): boolean {
  const dueDayOffset = getInvoiceDueDayOffset(value, now);
  return dueDayOffset !== null && dueDayOffset >= 0;
}