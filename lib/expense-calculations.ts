export function decimalToCents(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Invalid decimal value");
    }
    return Math.round(value * 100);
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      throw new Error("Invalid decimal value");
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw new Error("Invalid decimal value");
    }

    return Math.round(parsed * 100);
  }

  throw new Error("Invalid decimal value");
}

export function computeVatAmountCents(amountExclVatCents: number, vatRate: number): number {
  return Math.round(amountExclVatCents * (vatRate / 100));
}

export function computeAmountInclVatCents(amountExclVatCents: number, vatAmountCents: number): number {
  return Math.max(0, Math.round(amountExclVatCents) + Math.round(vatAmountCents));
}

export function computeRemainingBalanceCents(amountInclVatCents: number, amountPaidCents: number): number {
  return Math.max(0, Math.round(amountInclVatCents) - Math.max(0, Math.round(amountPaidCents)));
}
