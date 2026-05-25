export type FinancialPeriodKind = "month" | "quarter" | "year" | "custom";

export type FinancialPeriodSelection = {
  kind: FinancialPeriodKind;
  year?: number;
  month?: number;
  quarter?: number;
  startDate?: string;
  endDate?: string;
};

export type FinancialPeriodRange = {
  kind: FinancialPeriodKind;
  label: string;
  startDate: Date;
  endDateExclusive: Date;
  previousStartDate: Date;
  previousEndDateExclusive: Date;
};

type SearchParamsReader = {
  get(name: string): string | null;
};

function toUtcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 0, 0, 0, 0));
}

function startOfUtcDay(value: Date) {
  return toUtcDate(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parsePositiveInteger(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function parseIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function formatIsoDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatMonthLabel(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

function getQuarter(month: number) {
  return Math.floor(month / 3) + 1;
}

export function getDefaultFinancialPeriodSelection(now: Date = new Date()): FinancialPeriodSelection {
  return {
    kind: "month",
    year: now.getUTCFullYear(),
    month: now.getUTCMonth() + 1,
  };
}

export function parseFinancialPeriodSearchParams(searchParams: SearchParamsReader): FinancialPeriodSelection {
  const kind = searchParams.get("period");

  if (kind === "quarter") {
    return {
      kind,
      year: parsePositiveInteger(searchParams.get("year")) ?? undefined,
      quarter: parsePositiveInteger(searchParams.get("quarter")) ?? undefined,
    };
  }

  if (kind === "year") {
    return {
      kind,
      year: parsePositiveInteger(searchParams.get("year")) ?? undefined,
    };
  }

  if (kind === "custom") {
    return {
      kind,
      startDate: searchParams.get("startDate") ?? undefined,
      endDate: searchParams.get("endDate") ?? undefined,
    };
  }

  return {
    kind: "month",
    year: parsePositiveInteger(searchParams.get("year")) ?? undefined,
    month: parsePositiveInteger(searchParams.get("month")) ?? undefined,
  };
}

export function buildFinancialPeriodSearchParams(selection: FinancialPeriodSelection) {
  const searchParams = new URLSearchParams();
  searchParams.set("period", selection.kind);

  if (selection.kind === "month") {
    if (selection.year) searchParams.set("year", String(selection.year));
    if (selection.month) searchParams.set("month", String(selection.month));
    return searchParams;
  }

  if (selection.kind === "quarter") {
    if (selection.year) searchParams.set("year", String(selection.year));
    if (selection.quarter) searchParams.set("quarter", String(selection.quarter));
    return searchParams;
  }

  if (selection.kind === "year") {
    if (selection.year) searchParams.set("year", String(selection.year));
    return searchParams;
  }

  if (selection.startDate) searchParams.set("startDate", selection.startDate);
  if (selection.endDate) searchParams.set("endDate", selection.endDate);
  return searchParams;
}

export function resolveFinancialPeriod(
  selection: FinancialPeriodSelection,
  now: Date = new Date()
): FinancialPeriodRange {
  const normalized = selection.kind ? selection : getDefaultFinancialPeriodSelection(now);

  if (normalized.kind === "month") {
    const year = normalized.year ?? now.getUTCFullYear();
    const month = normalized.month ?? now.getUTCMonth() + 1;

    if (month < 1 || month > 12) {
      throw new Error("Month must be between 1 and 12.");
    }

    const startDate = toUtcDate(year, month - 1, 1);
    const endDateExclusive = toUtcDate(year, month, 1);
    const previousEndDateExclusive = startDate;
    const previousStartDate = toUtcDate(previousEndDateExclusive.getUTCFullYear(), previousEndDateExclusive.getUTCMonth() - 1, 1);

    return {
      kind: normalized.kind,
      label: formatMonthLabel(startDate),
      startDate,
      endDateExclusive,
      previousStartDate,
      previousEndDateExclusive,
    };
  }

  if (normalized.kind === "quarter") {
    const year = normalized.year ?? now.getUTCFullYear();
    const quarter = normalized.quarter ?? getQuarter(now.getUTCMonth());

    if (quarter < 1 || quarter > 4) {
      throw new Error("Quarter must be between 1 and 4.");
    }

    const startMonthIndex = (quarter - 1) * 3;
    const startDate = toUtcDate(year, startMonthIndex, 1);
    const endDateExclusive = toUtcDate(year, startMonthIndex + 3, 1);
    const previousEndDateExclusive = startDate;
    const previousStartDate = toUtcDate(previousEndDateExclusive.getUTCFullYear(), previousEndDateExclusive.getUTCMonth() - 3, 1);

    return {
      kind: normalized.kind,
      label: `Q${quarter} ${year}`,
      startDate,
      endDateExclusive,
      previousStartDate,
      previousEndDateExclusive,
    };
  }

  if (normalized.kind === "year") {
    const year = normalized.year ?? now.getUTCFullYear();
    const startDate = toUtcDate(year, 0, 1);
    const endDateExclusive = toUtcDate(year + 1, 0, 1);
    const previousStartDate = toUtcDate(year - 1, 0, 1);
    const previousEndDateExclusive = startDate;

    return {
      kind: normalized.kind,
      label: String(year),
      startDate,
      endDateExclusive,
      previousStartDate,
      previousEndDateExclusive,
    };
  }

  const startDate = parseIsoDate(normalized.startDate);
  const endDate = parseIsoDate(normalized.endDate);

  if (!startDate || !endDate) {
    throw new Error("Custom periods require valid startDate and endDate.");
  }

  const normalizedStartDate = startOfUtcDay(startDate);
  const normalizedEndDate = startOfUtcDay(endDate);

  if (normalizedEndDate.getTime() < normalizedStartDate.getTime()) {
    throw new Error("endDate must be on or after startDate.");
  }

  const endDateExclusive = addUtcDays(normalizedEndDate, 1);
  const durationMs = endDateExclusive.getTime() - normalizedStartDate.getTime();
  const previousEndDateExclusive = normalizedStartDate;
  const previousStartDate = new Date(previousEndDateExclusive.getTime() - durationMs);

  return {
    kind: normalized.kind,
    label: `${formatIsoDateOnly(normalizedStartDate)} to ${formatIsoDateOnly(normalizedEndDate)}`,
    startDate: normalizedStartDate,
    endDateExclusive,
    previousStartDate,
    previousEndDateExclusive,
  };
}

export type RollingMonthRange = {
  key: string;
  label: string;
  startDate: Date;
  endDateExclusive: Date;
};

export function buildRollingMonthRanges(anchorEndDateExclusive: Date, count: number = 12): RollingMonthRange[] {
  const safeCount = Math.max(1, count);
  const anchorDate = new Date(anchorEndDateExclusive.getTime() - 1);
  const anchorMonthStart = toUtcDate(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1);
  const months: RollingMonthRange[] = [];

  for (let offset = safeCount - 1; offset >= 0; offset -= 1) {
    const startDate = toUtcDate(anchorMonthStart.getUTCFullYear(), anchorMonthStart.getUTCMonth() - offset, 1);
    const endDateExclusive = toUtcDate(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1);

    months.push({
      key: formatIsoDateOnly(startDate).slice(0, 7),
      label: formatMonthLabel(startDate),
      startDate,
      endDateExclusive,
    });
  }

  return months;
}