export interface QuoteLineComputationInput {
  quantity: number;
  unitPriceExcludingTax: number;
  vatRate: number;
  baseUnitPriceExcludingTax?: number | null;
  discountPercentage?: number | null;
}

export interface QuoteLineComputed {
  quantity: number;
  unitPriceExcludingTax: number;
  baseUnitPriceExcludingTax: number;
  discountPercentage: number;
  totalExcludingTaxBeforeDiscount: number;
  discountAmountExcludingTax: number;
  totalExcludingTax: number;
  vatRate: number;
  vatAmount: number;
  totalIncludingTax: number;
}

export interface QuoteTotalsComputed {
  totalExcludingTaxBeforeDiscount: number;
  totalDiscountExcludingTax: number;
  totalExcludingTax: number;
  totalVat: number;
  totalIncludingTax: number;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function sanitizeCents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.round(value));
}

function sanitizeQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.round(value));
}

function sanitizeVatRate(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return clampNumber(value, 0, 100);
}

export function deriveUnitPriceFromDiscount(baseUnitPriceExcludingTax: number, discountPercentage: number): number {
  const base = sanitizeCents(baseUnitPriceExcludingTax);
  const discount = clampNumber(discountPercentage, 0, 100);
  return Math.max(0, Math.round(base * (1 - discount / 100)));
}

export function deriveDiscountPercentageFromUnitPrice(baseUnitPriceExcludingTax: number, unitPriceExcludingTax: number): number {
  const base = sanitizeCents(baseUnitPriceExcludingTax);
  const unit = sanitizeCents(unitPriceExcludingTax);

  if (base <= 0 || unit >= base) {
    return 0;
  }

  return clampNumber(((base - unit) / base) * 100, 0, 100);
}

export function computeQuoteLine(input: QuoteLineComputationInput): QuoteLineComputed {
  const quantity = sanitizeQuantity(input.quantity);
  const unitPriceExcludingTax = sanitizeCents(input.unitPriceExcludingTax);
  const vatRate = sanitizeVatRate(input.vatRate);

  const baseFromPayload = sanitizeCents(input.baseUnitPriceExcludingTax ?? undefined);
  const hasBaseFromPayload =
    typeof input.baseUnitPriceExcludingTax === 'number' &&
    Number.isFinite(input.baseUnitPriceExcludingTax) &&
    baseFromPayload > 0;

  // Resolve base price using two recovery strategies:
  // 1. If explicitly provided and > 0, use it directly
  // 2. If only discountPercentage is available, back-derive base from unit price
  // 3. Fallback: base = unit price (no discount)
  let baseUnitPriceExcludingTax: number;
  if (hasBaseFromPayload) {
    baseUnitPriceExcludingTax = baseFromPayload;
  } else {
    const discountPct = typeof input.discountPercentage === 'number' &&
      Number.isFinite(input.discountPercentage) &&
      input.discountPercentage > 0
      ? clampNumber(input.discountPercentage, 0, 100)
      : 0;

    if (discountPct > 0 && unitPriceExcludingTax > 0) {
      // Back-derive: base = unitPrice / (1 - discount/100)
      baseUnitPriceExcludingTax = Math.round(unitPriceExcludingTax / (1 - discountPct / 100));
    } else {
      baseUnitPriceExcludingTax = unitPriceExcludingTax;
    }
  }

  const effectiveUnitPrice = unitPriceExcludingTax;
  const normalizedDiscountPercentage = deriveDiscountPercentageFromUnitPrice(
    baseUnitPriceExcludingTax,
    effectiveUnitPrice
  );

  const totalExcludingTaxBeforeDiscount = baseUnitPriceExcludingTax * quantity;
  const totalExcludingTax = effectiveUnitPrice * quantity;
  const discountAmountExcludingTax = Math.max(0, totalExcludingTaxBeforeDiscount - totalExcludingTax);
  const vatAmount = Math.round(totalExcludingTax * (vatRate / 100));
  const totalIncludingTax = totalExcludingTax + vatAmount;

  return {
    quantity,
    unitPriceExcludingTax: effectiveUnitPrice,
    baseUnitPriceExcludingTax,
    discountPercentage: normalizedDiscountPercentage,
    totalExcludingTaxBeforeDiscount,
    discountAmountExcludingTax,
    totalExcludingTax,
    vatRate,
    vatAmount,
    totalIncludingTax,
  };
}

export function computeQuoteTotalsFromComputedLines(lineItems: QuoteLineComputed[]): QuoteTotalsComputed {
  let totalExcludingTaxBeforeDiscount = 0;
  let totalDiscountExcludingTax = 0;
  let totalExcludingTax = 0;
  let totalVat = 0;

  for (const item of lineItems) {
    totalExcludingTaxBeforeDiscount += item.totalExcludingTaxBeforeDiscount;
    totalDiscountExcludingTax += item.discountAmountExcludingTax;
    totalExcludingTax += item.totalExcludingTax;
    totalVat += item.vatAmount;
  }

  return {
    totalExcludingTaxBeforeDiscount,
    totalDiscountExcludingTax,
    totalExcludingTax,
    totalVat,
    totalIncludingTax: totalExcludingTax + totalVat,
  };
}

export function computeQuoteTotals(lineItems: QuoteLineComputationInput[]): QuoteTotalsComputed {
  return computeQuoteTotalsFromComputedLines(lineItems.map((item) => computeQuoteLine(item)));
}
